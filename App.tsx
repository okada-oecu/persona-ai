import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppState, World, Message } from './types';
import { WorldForm } from './components/WorldForm';
import { ChatInterface } from './components/ChatInterface';
import { SettingsModal } from './components/SettingsModal';
import { SaveIndicator, SaveStatus } from './components/SaveIndicator';
import { Avatar } from './components/Avatar';
import { STORAGE_KEYS, loadJSON, saveJSON, getApiKey, loadWorlds, saveWorlds } from './services/storage';
import { SAMPLE_WORLDS, createWorldFromSample } from './services/samples';
import {
  createShareUrl, readSharedWorldFromUrl, clearShareHash, isWorldLike, normalizeImportedWorld, downloadJSON,
} from './services/share';
import { Plus, Zap, Globe, Book, Play, Download, Upload, Settings, Trash2, Share2, Sparkles, Link, FileDown, X, Pencil } from 'lucide-react';

interface SessionState {
  appState: AppState;
  activeWorldId: string | null;
  editingWorldId: string | null;
}

// 途中で中断された（空の）AI返信や、旧バージョンで履歴に混ざったエラー文を取り除く
const isLegacyError = (m: Message) => m.role === 'model' && /^\s*(⚠|\[(接続)?エラー)/.test(m.text);
const cleanMessages = (messages?: Message[]) =>
  (messages || []).filter(m => (m.role === 'user' || m.text.trim() !== '') && !isLegacyError(m));

const AUTOSAVE_DELAY_MS = 800;

const App: React.FC = () => {
  const [loaded, setLoaded] = useState(false);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [activeWorld, setActiveWorld] = useState<World | null>(null);
  const [editingWorld, setEditingWorld] = useState<World | null>(null);

  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'saved', at: null });
  const [showSettings, setShowSettings] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(() => !!getApiKey());
  const [shareTarget, setShareTarget] = useState<World | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // AUTO SAVE
  // ---------------------------------------------------------------------------
  const worldsRef = useRef(worlds);
  worldsRef.current = worlds;
  const dirtyRef = useRef(false);
  const skipNextSave = useRef(true);

  // ---------------------------------------------------------------------------
  // 読み込み（IndexedDB）＋ 前回の画面を復元 ＋ 共有リンクの取り込み
  // ---------------------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const stored: World[] = (await loadWorlds()).map(w => ({ ...w, messages: cleanMessages(w.messages) }));
      let list = stored;

      const shared = await readSharedWorldFromUrl();
      clearShareHash();
      if (shared && isWorldLike(shared)) {
        if (confirm(`共有されたワールド「${shared.title}」を追加しますか？`)) {
          list = [normalizeImportedWorld(shared), ...list];
        }
      }

      const session = loadJSON<SessionState>(STORAGE_KEYS.session, { appState: AppState.HOME, activeWorldId: null, editingWorldId: null });
      const find = (id: string | null) => (id ? list.find(w => w.id === id) || null : null);
      if (list === stored) {
        if (session.appState === AppState.CHATTING && find(session.activeWorldId)) {
          setActiveWorld(find(session.activeWorldId));
          setAppState(AppState.CHATTING);
        } else if (session.appState === AppState.EDITING_WORLD && find(session.editingWorldId)) {
          setEditingWorld(find(session.editingWorldId));
          setAppState(AppState.EDITING_WORLD);
        } else if (session.appState === AppState.CREATING_WORLD) {
          setAppState(AppState.CREATING_WORLD);
        }
      }
      skipNextSave.current = list === stored;
      setWorlds(list);
      setLoaded(true);
    })();
  }, []);

  const flushSave = useCallback(async () => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    const ok = await saveWorlds(worldsRef.current);
    setSaveStatus({ state: ok ? 'saved' : 'error', at: Date.now() });
  }, []);

  // 変更のたびに少し待ってからまとめて保存（ストリーミング中の連続更新対策）
  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    dirtyRef.current = true;
    setSaveStatus(prev => ({ ...prev, state: 'saving' }));
    const timer = setTimeout(flushSave, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [worlds, loaded, flushSave]);

  // タブを閉じる・裏に回すときは即保存
  useEffect(() => {
    const onHide = () => { flushSave(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushSave(); };
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flushSave]);

  // 今いる画面を保存
  useEffect(() => {
    if (!loaded) return;
    saveJSON(STORAGE_KEYS.session, {
      appState,
      activeWorldId: activeWorld?.id || null,
      editingWorldId: editingWorld?.id || null,
    } satisfies SessionState);
  }, [loaded, appState, activeWorld?.id, editingWorld?.id]);

  // ---------------------------------------------------------------------------
  // ワールド操作
  // ---------------------------------------------------------------------------
  const handleUpdateWorld = (worldId: string, patch: Partial<World>) => {
    setWorlds(prev => prev.map(w => (w.id === worldId ? { ...w, ...patch } : w)));
    setActiveWorld(prev => (prev && prev.id === worldId ? { ...prev, ...patch } : prev));
  };

  const handleSaveWorld = (world: World) => {
    setWorlds(prev => (prev.some(w => w.id === world.id) ? prev.map(w => (w.id === world.id ? { ...w, ...world } : w)) : [world, ...prev]));
    setEditingWorld(null);
    setAppState(AppState.HOME);
  };

  const handleSelectWorld = (world: World) => {
    setActiveWorld(world);
    setAppState(AppState.CHATTING);
  };

  const handleEditWorld = (e: React.MouseEvent, world: World) => {
    e.stopPropagation();
    setEditingWorld(world);
    setAppState(AppState.EDITING_WORLD);
  };

  const handleDeleteWorld = (e: React.MouseEvent, world: World) => {
    e.stopPropagation();
    if (!confirm(`「${world.title}」を削除しますか？会話履歴も消えます。`)) return;
    setWorlds(prev => prev.filter(w => w.id !== world.id));
  };

  const handleResetStory = (world: World) => {
    if (!confirm(`「${world.title}」の会話・あらすじ・記憶メモをすべて消して、最初から始めますか？`)) return;
    setWorlds(prev => prev.map(w => (w.id === world.id ? { ...w, messages: [], summary: undefined, summarizedCount: 0, memo: undefined } : w)));
    setShareTarget(null);
  };

  const handleAddSample = (index: number) => {
    const world = createWorldFromSample(SAMPLE_WORLDS[index]);
    setWorlds(prev => [world, ...prev]);
    handleSelectWorld(world);
  };

  const handleExitChat = () => {
    flushSave();
    setAppState(AppState.HOME);
    setActiveWorld(null);
  };

  // ---------------------------------------------------------------------------
  // JSON IMPORT / EXPORT
  // ---------------------------------------------------------------------------
  const handleExportAll = () => {
    if (worlds.length === 0) return;
    downloadJSON(worlds, `persona-worlds-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        // 全体バックアップ（配列）でも、1つのワールドでも読み込める
        const items: any[] = Array.isArray(data) ? data : [data];
        const valid = items.filter(isWorldLike);
        if (valid.length === 0) {
          alert('ワールドのデータが見つかりませんでした。');
          return;
        }
        setWorlds(prev => {
          const merged = [...prev];
          valid.forEach(w => {
            const world = normalizeImportedWorld(w, true);
            const idx = merged.findIndex(m => m.id === world.id);
            if (idx !== -1) merged[idx] = world;
            else merged.unshift(world);
          });
          return merged;
        });
        alert(`${valid.length} 件のワールドを読み込みました。`);
      } catch (error) {
        console.error(error);
        alert('ファイルの読み込みに失敗しました。');
      }
    };
    reader.readAsText(file);
  };

  const settingsModal = showSettings && (
    <SettingsModal
      onClose={() => {
        setShowSettings(false);
        setHasApiKey(!!getApiKey());
      }}
    />
  );

  if (!loaded) {
    return <div className="min-h-[100dvh] bg-black flex items-center justify-center text-gray-500">読み込み中…</div>;
  }

  // ---------------------------------------------------------------------------
  // RENDER: CHAT
  // ---------------------------------------------------------------------------
  if (appState === AppState.CHATTING && activeWorld) {
    return (
      <>
        <ChatInterface
          key={activeWorld.id}
          world={activeWorld}
          onExit={handleExitChat}
          onUpdateWorld={handleUpdateWorld}
          saveStatus={saveStatus}
          onOpenSettings={() => setShowSettings(true)}
        />
        {settingsModal}
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: CREATE / EDIT WORLD
  // ---------------------------------------------------------------------------
  if (appState === AppState.CREATING_WORLD || appState === AppState.EDITING_WORLD) {
    return (
      <div className="min-h-[100dvh] bg-black text-white p-2 sm:p-4">
        <WorldForm
          onSave={handleSaveWorld}
          onCancel={() => {
            setAppState(AppState.HOME);
            setEditingWorld(null);
          }}
          initialData={appState === AppState.EDITING_WORLD ? editingWorld : null}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: HOME
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-[100dvh] bg-black text-slate-200 font-sans selection:bg-indigo-500/30">

      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-black/50 backdrop-blur-lg sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 font-bold text-xl tracking-tight">
            <Zap className="text-indigo-500" fill="currentColor" size={24} />
            Persona.AI
          </div>
          <div className="flex items-center gap-3">
            <SaveIndicator status={saveStatus} />
            <button
              onClick={() => setShowSettings(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                hasApiKey
                  ? 'border-gray-700 bg-gray-800 text-gray-300 hover:text-white'
                  : 'border-amber-500/60 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              <Settings size={16} />
              <span className="hidden sm:inline">{hasApiKey ? '設定' : '設定（APIキー未登録）'}</span>
            </button>
          </div>
        </div>
      </nav>
      {settingsModal}

      <main className="max-w-6xl mx-auto px-4 py-8">

        {!hasApiKey && (
          <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span>遊ぶには Gemini APIキー（無料で取得できます）の登録が必要です。</span>
            <button onClick={() => setShowSettings(true)} className="px-4 py-2 rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400 flex-shrink-0">
              APIキーを登録する
            </button>
          </div>
        )}

        {/* Call to Action */}
        <section className="mb-12 text-center py-10 sm:py-12 px-4 relative overflow-hidden rounded-3xl bg-gray-900 border border-gray-800">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 pointer-events-none" />
          <div className="relative z-10">
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              無限の <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">世界と物語</span> を創造しよう
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto mb-8 sm:text-lg">
              世界観設定、主人公、そしてNPCたちを一括作成。AIがGMとなり、あなたの物語を紡ぎ出します。
            </p>
            <button
              onClick={() => setAppState(AppState.CREATING_WORLD)}
              className="group relative inline-flex items-center gap-2 px-8 py-4 bg-white text-black rounded-full font-bold text-lg hover:scale-105 transition-transform duration-200"
            >
              <Plus size={20} />
              新しい世界を作る
            </button>
          </div>
        </section>

        {/* World List Header & Controls */}
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="text-indigo-400" size={24} />
            あなたのワールド一覧
            <span className="text-sm font-normal text-gray-500 ml-2">({worlds.length})</span>
          </h2>

          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json,application/json" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors border border-gray-700 hover:text-white"
              title="JSONファイルを読み込む"
            >
              <Upload size={16} /> インポート
            </button>
            <button
              onClick={handleExportAll}
              disabled={worlds.length === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white disabled:bg-gray-900 disabled:text-gray-600 disabled:cursor-not-allowed"
              title="全ワールドをJSONファイルとして保存"
            >
              <Download size={16} /> 全部保存
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            onClick={() => setAppState(AppState.CREATING_WORLD)}
            className="aspect-video rounded-3xl border-2 border-dashed border-gray-800 hover:border-indigo-500/50 hover:bg-gray-900/50 flex flex-col items-center justify-center cursor-pointer transition-all group"
          >
            <Plus size={32} className="text-gray-600 group-hover:text-indigo-400 mb-2" />
            <span className="font-medium text-gray-400">新規ワールド作成</span>
          </div>

          {worlds.map(world => (
            <div
              key={world.id}
              onClick={() => handleSelectWorld(world)}
              className="group relative aspect-video rounded-3xl overflow-hidden cursor-pointer border border-gray-800 bg-gray-900 hover:ring-4 hover:ring-indigo-500/30 transition-all flex flex-col"
            >
              <div className="h-1/2 bg-gradient-to-br from-gray-800 to-gray-900 relative">
                <div className="absolute top-2 right-2 flex gap-2 z-20">
                  <button
                    onClick={(e) => { e.stopPropagation(); setShareTarget(world); }}
                    className="p-2 bg-black/40 hover:bg-black/70 rounded-full text-gray-300 hover:text-white transition-colors"
                    title="共有・書き出し"
                  >
                    <Share2 size={16} />
                  </button>
                  <button
                    onClick={(e) => handleEditWorld(e, world)}
                    className="p-2 bg-black/40 hover:bg-black/70 rounded-full text-gray-300 hover:text-white transition-colors"
                    title="編集"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteWorld(e, world)}
                    className="p-2 bg-black/40 hover:bg-red-900/70 rounded-full text-gray-300 hover:text-white transition-colors"
                    title="削除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-2">
                  <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                    {world.title}
                  </h3>
                  <div className="flex -space-x-2 flex-shrink-0">
                    {world.characters.slice(0, 4).map(c => <Avatar key={c.id} character={c} size="sm" className="ring-2 ring-gray-900" />)}
                  </div>
                </div>
              </div>

              <div className="flex-1 p-5 bg-gray-950 flex flex-col justify-between">
                <p className="text-sm text-gray-400 line-clamp-2">{world.setting}</p>
                <div className="flex items-center justify-between text-xs text-gray-500 mt-4">
                  <span className="flex items-center gap-1 max-w-[60%] truncate"><Book size={14} /> {world.protagonist.name}</span>
                  <span className="flex-shrink-0 flex items-center gap-1 bg-gray-800 px-2 py-1 rounded-full text-gray-300 group-hover:bg-indigo-900 group-hover:text-indigo-200 transition-colors">
                    <Play size={12} fill="currentColor" /> {world.messages && world.messages.length > 0 ? '続きから' : 'プレイ'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Samples */}
        <section className="mt-14">
          <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
            <Sparkles className="text-amber-400" size={20} /> サンプルの世界で遊ぶ
          </h2>
          <p className="text-sm text-gray-500 mb-5">選ぶとコピーが「あなたのワールド一覧」に追加され、すぐに始まります。あとから自由に編集できます。</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SAMPLE_WORLDS.map((s, i) => (
              <button
                key={s.title}
                onClick={() => handleAddSample(i)}
                className="text-left p-5 rounded-2xl border border-gray-800 bg-gray-900/60 hover:border-amber-500/50 hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <h3 className="font-bold text-white">{s.title}</h3>
                  <div className="flex -space-x-2 flex-shrink-0">
                    {s.characters.map(c => <Avatar key={c.id} character={c} size="sm" className="ring-2 ring-gray-900" />)}
                  </div>
                </div>
                <p className="text-xs text-gray-400 line-clamp-3">{s.setting}</p>
              </button>
            ))}
          </div>
        </section>
      </main>

      {shareTarget && <ShareModal world={shareTarget} onClose={() => setShareTarget(null)} onReset={handleResetStory} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// 共有・書き出しダイアログ
// ---------------------------------------------------------------------------
const ShareModal: React.FC<{ world: World; onClose: () => void; onReset: (w: World) => void }> = ({ world, onClose, onReset }) => {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    createShareUrl(world).then(setUrl).catch(() => setUrl(''));
  }, [world]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt('このURLをコピーしてください', url);
    }
  };

  const safeName = world.title.replace(/[\\/:*?"<>|]/g, '_');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl text-gray-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2 min-w-0"><Share2 size={20} className="text-indigo-400 flex-shrink-0" /> <span className="truncate">「{world.title}」</span></h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <h3 className="text-sm font-bold mb-1 flex items-center gap-1"><Link size={14} /> 友達に共有するリンク</h3>
        <p className="text-xs text-gray-400 mb-2">世界観・主人公・NPCの設定だけが入ります（会話履歴やアイコン画像は含まれません）。</p>
        <div className="flex gap-2 mb-6">
          <input readOnly value={url || '作成中…'} onFocus={e => e.target.select()} className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-400" />
          <button onClick={copy} disabled={!url} className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-bold flex-shrink-0 disabled:opacity-50">
            {copied ? 'コピー済み' : 'コピー'}
          </button>
        </div>

        <h3 className="text-sm font-bold mb-2 flex items-center gap-1"><FileDown size={14} /> ファイルに書き出す</h3>
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => downloadJSON(world, `${safeName}.json`)}
            className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm"
          >
            会話も含めて保存
          </button>
          <button
            onClick={() => {
              const { messages, summary, summarizedCount, memo, ...settingsOnly } = world;
              downloadJSON(settingsOnly, `${safeName}-設定のみ.json`);
            }}
            className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm"
          >
            設定だけ保存
          </button>
        </div>

        {world.messages && world.messages.length > 0 && (
          <button onClick={() => onReset(world)} className="text-xs text-gray-500 hover:text-red-400">
            この世界の会話を消して最初から始める
          </button>
        )}
      </div>
    </div>
  );
};

export default App;
