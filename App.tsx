import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AppState, World, Message } from './types';
import { WorldForm } from './components/WorldForm';
import { ChatInterface } from './components/ChatInterface';
import { ApiKeyModal } from './components/ApiKeyModal';
import { SaveIndicator, SaveStatus } from './components/SaveIndicator';
import { initializeWorldChat } from './services/geminiService';
import { STORAGE_KEYS, loadJSON, saveJSON, getApiKey } from './services/storage';
import { Plus, Zap, Globe, Book, Play, Download, Upload, Settings, KeyRound, Trash2 } from 'lucide-react';


interface SessionState {
  appState: AppState;
  activeWorldId: string | null;
  editingWorldId: string | null;
}

// 途中で中断された（空の）AI返信を取り除く
const cleanMessages = (messages?: Message[]) =>
  (messages || []).filter(m => m.role === 'user' || m.text.trim() !== '');

const AUTOSAVE_DELAY_MS = 800;

const App: React.FC = () => {
  const [worlds, setWorlds] = useState<World[]>(() =>
    loadJSON<World[]>(STORAGE_KEYS.worlds, []).map(w => ({ ...w, messages: cleanMessages(w.messages) }))
  );

  // 前回開いていた画面を復元する
  const initialSession = useRef<SessionState>(
    loadJSON<SessionState>(STORAGE_KEYS.session, { appState: AppState.HOME, activeWorldId: null, editingWorldId: null })
  ).current;
  const findWorld = (id: string | null) => (id ? worlds.find(w => w.id === id) || null : null);

  const [activeWorld, setActiveWorld] = useState<World | null>(() => {
    const w = initialSession.appState === AppState.CHATTING ? findWorld(initialSession.activeWorldId) : null;
    if (w) initializeWorldChat(w, w.messages);
    return w;
  });
  const [editingWorld, setEditingWorld] = useState<World | null>(() =>
    initialSession.appState === AppState.EDITING_WORLD ? findWorld(initialSession.editingWorldId) : null
  );
  const [appState, setAppState] = useState<AppState>(() => {
    const s = initialSession.appState;
    if (s === AppState.CHATTING && !findWorld(initialSession.activeWorldId)) return AppState.HOME;
    if (s === AppState.EDITING_WORLD && !findWorld(initialSession.editingWorldId)) return AppState.HOME;
    return s || AppState.HOME;
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: 'saved', at: null });
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(() => !!getApiKey());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // AUTO SAVE
  // ---------------------------------------------------------------------------
  const worldsRef = useRef(worlds);
  worldsRef.current = worlds;
  const dirtyRef = useRef(false);
  const firstRender = useRef(true);

  const flushSave = useCallback(() => {
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    const ok = saveJSON(STORAGE_KEYS.worlds, worldsRef.current);
    setSaveStatus({ state: ok ? 'saved' : 'error', at: Date.now() });
  }, []);

  // 変更のたびに少し待ってからまとめて保存（ストリーミング中の連続更新対策）
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    dirtyRef.current = true;
    setSaveStatus(prev => ({ ...prev, state: 'saving' }));
    const timer = setTimeout(flushSave, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [worlds, flushSave]);

  // タブを閉じる・裏に回すときは即保存
  useEffect(() => {
    const onHide = () => flushSave();
    const onVisibility = () => { if (document.visibilityState === 'hidden') flushSave(); };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [flushSave]);

  // 今いる画面を保存
  useEffect(() => {
    saveJSON(STORAGE_KEYS.session, {
      appState,
      activeWorldId: activeWorld?.id || null,
      editingWorldId: editingWorld?.id || null,
    } satisfies SessionState);
  }, [appState, activeWorld?.id, editingWorld?.id]);

  const handleUpdateMessages = (worldId: string, newMessages: Message[]) => {
    setWorlds(prev => prev.map(w => w.id === worldId ? { ...w, messages: newMessages } : w));
    setActiveWorld(prev => prev && prev.id === worldId ? { ...prev, messages: newMessages } : prev);
  };

  const handleSaveWorld = (world: World) => {
    const exists = worlds.some(w => w.id === world.id);
    if (exists) {
      setWorlds(prev => prev.map(w => w.id === world.id ? world : w));
    } else {
      setWorlds(prev => [world, ...prev]);
    }
    setEditingWorld(null);
    setAppState(AppState.HOME);
  };

  const handleSelectWorld = (world: World) => {
    setActiveWorld(world);
    initializeWorldChat(world, world.messages);
    setAppState(AppState.CHATTING);
  };

  const handleEditWorld = (e: React.MouseEvent, world: World) => {
    e.stopPropagation(); // Prevent triggering the card click (Play)
    setEditingWorld(world);
    setAppState(AppState.EDITING_WORLD);
  };

  const handleDeleteWorld = (e: React.MouseEvent, world: World) => {
    e.stopPropagation();
    if (!confirm(`「${world.title}」を削除しますか？会話履歴も消えます。`)) return;
    setWorlds(prev => prev.filter(w => w.id !== world.id));
  };

  const handleExitChat = () => {
    flushSave();
    setAppState(AppState.HOME);
    setActiveWorld(null);
  };

  // ---------------------------------------------------------------------------
  // JSON IMPORT / EXPORT HANDLERS
  // ---------------------------------------------------------------------------
  const handleExport = () => {
    if (worlds.length === 0) return;
    const dataStr = JSON.stringify(worlds, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `persona-worlds-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target?.result as string;
            const importedData = JSON.parse(content);
            
            if (Array.isArray(importedData)) {
                 setWorlds(prev => {
                     // IDに基づいて既存のデータを更新、新規データは追加
                     const merged = [...prev];
                     importedData.forEach((w: World) => {
                         // 簡易バリデーション
                         if (!w.id || !w.title || !w.characters) return;

                         const idx = merged.findIndex(m => m.id === w.id);
                         if (idx !== -1) {
                             merged[idx] = w;
                         } else {
                             merged.push(w);
                         }
                     });
                     return merged;
                 });
                 alert(`${importedData.length} 件のワールドデータを読み込みました。`);
            } else {
                alert('データ形式が正しくありません。配列形式のJSONファイルを選択してください。');
            }
        } catch (error) {
            console.error(error);
            alert('ファイルの読み込みに失敗しました。');
        }
    };
    reader.readAsText(file);
    // リセットして同じファイルを再度読み込めるようにする
    event.target.value = '';
  };

  const apiKeyModal = showApiKeyModal && (
    <ApiKeyModal
      onClose={() => {
        setShowApiKeyModal(false);
        setHasApiKey(!!getApiKey());
      }}
    />
  );

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
          onUpdateMessages={handleUpdateMessages}
          saveStatus={saveStatus}
          onOpenApiKey={() => setShowApiKeyModal(true)}
        />
        {apiKeyModal}
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER: CREATE / EDIT WORLD
  // ---------------------------------------------------------------------------
  if (appState === AppState.CREATING_WORLD || appState === AppState.EDITING_WORLD) {
    return (
      <div className="min-h-screen bg-black text-white p-4">
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
    <div className="min-h-screen bg-black text-slate-200 font-sans selection:bg-indigo-500/30">
      
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
              onClick={() => setShowApiKeyModal(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors ${
                hasApiKey
                  ? 'border-gray-700 bg-gray-800 text-gray-300 hover:text-white'
                  : 'border-amber-500/60 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              <KeyRound size={16} />
              <span className="hidden sm:inline">{hasApiKey ? 'APIキー設定' : 'APIキーを設定'}</span>
            </button>
          </div>
        </div>
      </nav>
      {apiKeyModal}

      {/* Hero / Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Call to Action */}
        <section className="mb-12 text-center py-12 relative overflow-hidden rounded-3xl bg-gray-900 border border-gray-800">
           <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/20 to-purple-900/20 pointer-events-none" />
           <div className="relative z-10">
             <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
               無限の <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">世界と物語</span> を創造しよう
             </h1>
             <p className="text-gray-400 max-w-xl mx-auto mb-8 text-lg">
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
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept=".json"
            />
            <button 
              onClick={handleImportClick}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-300 transition-colors border border-gray-700 hover:text-white"
              title="JSONファイルを読み込む"
            >
              <Upload size={16} /> インポート
            </button>
            <button 
              onClick={handleExport}
              disabled={worlds.length === 0}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border border-gray-700 ${
                  worlds.length === 0 
                  ? 'bg-gray-900 text-gray-600 cursor-not-allowed' 
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white'
              }`}
              title="JSONファイルとして保存"
            >
              <Download size={16} /> 保存 (JSON)
            </button>
          </div>
        </div>

        {worlds.length === 0 ? (
          // Empty State
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             <div 
               onClick={() => setAppState(AppState.CREATING_WORLD)}
               className="aspect-video rounded-3xl border-2 border-dashed border-gray-800 hover:border-indigo-500/50 hover:bg-gray-900/50 flex flex-col items-center justify-center cursor-pointer transition-all group p-6"
             >
               <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors">
                 <Plus size={32} />
               </div>
               <span className="font-medium text-gray-400 group-hover:text-gray-200">新規ワールド作成</span>
             </div>
          </div>
        ) : (
          // Grid of Worlds
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div 
               onClick={() => setAppState(AppState.CREATING_WORLD)}
               className="aspect-video rounded-3xl border-2 border-dashed border-gray-800 hover:border-indigo-500/50 hover:bg-gray-900/50 flex flex-col items-center justify-center cursor-pointer transition-all group"
             >
               <Plus size={32} className="text-gray-600 group-hover:text-indigo-400 mb-2" />
               <span className="font-medium text-gray-400">作成</span>
             </div>

            {worlds.map(world => (
              <div 
                key={world.id}
                onClick={() => handleSelectWorld(world)}
                className="group relative aspect-video rounded-3xl overflow-hidden cursor-pointer border border-gray-800 bg-gray-900 hover:ring-4 hover:ring-indigo-500/30 transition-all flex flex-col"
              >
                {/* Header pattern */}
                <div className="h-1/2 bg-gradient-to-br from-gray-800 to-gray-900 relative">
                   <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]"></div>
                   
                   {/* Edit / Delete Buttons */}
                   <div className="absolute top-2 right-2 flex gap-2 z-20">
                     <button
                       onClick={(e) => handleDeleteWorld(e, world)}
                       className="p-2 bg-black/40 hover:bg-red-900/70 rounded-full text-gray-300 hover:text-white transition-colors"
                       title="削除"
                     >
                       <Trash2 size={16} />
                     </button>
                     <button
                       onClick={(e) => handleEditWorld(e, world)}
                       className="p-2 bg-black/40 hover:bg-black/70 rounded-full text-gray-300 hover:text-white transition-colors"
                       title="編集"
                     >
                       <Settings size={16} />
                     </button>
                   </div>

                   <div className="absolute bottom-4 left-4 right-4">
                       <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                         {world.title}
                       </h3>
                   </div>
                </div>
                
                {/* Content */}
                <div className="flex-1 p-5 bg-gray-950 flex flex-col justify-between">
                   <p className="text-sm text-gray-400 line-clamp-2">
                     {world.setting}
                   </p>
                   <div className="flex items-center justify-between text-xs text-gray-500 mt-4">
                       <span className="flex items-center gap-1 max-w-[60%] truncate"><Book size={14}/> {world.protagonist.name}</span>
                       <span className="flex-shrink-0 flex items-center gap-1 bg-gray-800 px-2 py-1 rounded-full text-gray-300 group-hover:bg-indigo-900 group-hover:text-indigo-200 transition-colors">
                           <Play size={12} fill="currentColor"/> プレイ
                       </span>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;