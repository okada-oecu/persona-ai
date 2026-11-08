import React, { useState, useEffect, useRef } from 'react';
import { World, Message } from '../types';
import { streamReply, generateText } from '../services/geminiService';
import { INTRO_PROMPT, buildSummaryPrompt, friendlyErrorMessage } from '../services/prompt';
import { STORAGE_KEYS, loadString, saveString, getSettings } from '../services/storage';
import { SaveIndicator, SaveStatus } from './SaveIndicator';
import { MessageContent } from './MessageContent';
import { Avatar } from './Avatar';
import { Send, ArrowLeft, BookOpen, Settings, Square, RotateCcw, Undo2, Pencil, AlertTriangle, X, Check } from 'lucide-react';

interface ChatInterfaceProps {
  world: World;
  onExit: () => void;
  onUpdateWorld: (worldId: string, patch: Partial<World>) => void;
  saveStatus: SaveStatus;
  onOpenSettings: () => void;
}

// 未要約の会話がこの件数を超えたら、古い部分をあらすじにまとめる
const SUMMARY_TRIGGER = 40;
// 要約後も原文のまま送る直近の件数
const KEEP_RECENT = 20;

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ world, onExit, onUpdateWorld, saveStatus, onOpenSettings }) => {
  const [messages, setMessages] = useState<Message[]>(world.messages || []);
  // 入力途中の文章も自動セーブ（リロードしても消えない）
  const draftKey = STORAGE_KEYS.inputDraft(world.id);
  const [inputValue, setInputValue] = useState(() => loadString(draftKey));
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const initialized = useRef(false);
  const summarizingRef = useRef(false);
  const worldRef = useRef(world);
  worldRef.current = world;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // 会話が変わるたびに親へ渡す（親が自動セーブする）
  const firstSync = useRef(true);
  useEffect(() => {
    if (firstSync.current) {
      firstSync.current = false;
      return;
    }
    onUpdateWorld(world.id, { messages });
  }, [messages, world.id]);

  useEffect(() => {
    const timer = setTimeout(() => saveString(draftKey, inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue, draftKey]);

  // 入力欄を文章の量に合わせて広げる
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputValue]);

  // 画面を離れたら生成を止める
  useEffect(() => () => abortRef.current?.abort(), []);

  // 初回：会話がなければ物語の導入を生成
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    if (messages.length === 0) runReply([], null);
  }, []);

  // 開いた直後は一番下（最新）へ一瞬で、その後はなめらかにスクロール
  const firstScroll = useRef(true);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: firstScroll.current ? 'auto' : 'smooth', block: 'end' });
    firstScroll.current = false;
  }, [messages.length, isTyping, error]);

  // ---------------------------------------------------------------------------
  // 古い会話をあらすじに要約（長編でもAIに送る量を一定に保つ）
  // ---------------------------------------------------------------------------
  const maybeSummarize = async (all: Message[]) => {
    const w = worldRef.current;
    const done = w.summarizedCount || 0;
    if (summarizingRef.current || all.length - done <= SUMMARY_TRIGGER) return;
    const upto = all.length - KEEP_RECENT;
    summarizingRef.current = true;
    try {
      const summary = (await generateText(buildSummaryPrompt(w, w.summary, all.slice(done, upto)))).trim();
      // 要約中に「戻す」などで会話が短くなっていたら使わない
      if (summary && messagesRef.current.length >= upto) {
        onUpdateWorld(w.id, { summary, summarizedCount: upto });
      }
    } catch (e) {
      console.warn('Summary failed (will retry next turn)', e);
    } finally {
      summarizingRef.current = false;
    }
  };

  /**
   * AIの返答を生成する。
   * prior: それまでの会話 / userMsg: 今回のユーザー発言（null なら物語の導入）
   */
  const runReply = async (prior: Message[], userMsg: Message | null) => {
    setError(null);
    const placeholder: Message = { id: newId(), role: 'model', text: '', timestamp: Date.now() };
    const base = userMsg ? [...prior, userMsg] : [...prior];
    setMessages([...base, placeholder]);
    setIsTyping(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // 要約済みの範囲より前を書き換えた場合は、要約を捨てる
    let w = worldRef.current;
    if (w.summary && (w.summarizedCount || 0) > prior.length) {
      w = { ...w, summary: undefined, summarizedCount: 0 };
      worldRef.current = w;
      onUpdateWorld(w.id, { summary: undefined, summarizedCount: 0 });
    }

    let acc = '';
    try {
      const stream = streamReply({
        world: w,
        history: prior.slice(w.summarizedCount || 0),
        message: userMsg ? userMsg.text : INTRO_PROMPT,
        settings: getSettings(),
        signal: controller.signal,
      });
      for await (const chunk of stream) {
        acc += chunk;
        setMessages(prev => prev.map(m => (m.id === placeholder.id ? { ...m, text: acc } : m)));
      }
    } catch (e) {
      console.error(e);
      setError(friendlyErrorMessage(e));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsTyping(false);
    }

    // 空の返答（エラー・すぐ停止）は残さない
    const final = acc.trim() ? [...base, { ...placeholder, text: acc }] : base;
    setMessages(final);
    if (acc.trim()) maybeSummarize(final);
  };

  // ---------------------------------------------------------------------------
  // 操作
  // ---------------------------------------------------------------------------
  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isTyping) return;
    setInputValue('');
    saveString(draftKey, '');
    runReply(messages, { id: newId(), role: 'user', text, timestamp: Date.now() });
  };

  const handleStop = () => abortRef.current?.abort();

  /** 最後のAI返答を作り直す（返答がない場合は生成する） */
  const handleRegenerate = () => {
    if (isTyping) return;
    const last = messages[messages.length - 1];
    if (!last) return runReply([], null);
    if (last.role === 'model') {
      const i = messages.length - 1;
      if (i > 0 && messages[i - 1].role === 'user') runReply(messages.slice(0, i - 1), messages[i - 1]);
      else runReply(messages.slice(0, i), null);
    } else {
      // 最後がユーザー発言（エラーで返答がない）→ その発言に対して再生成
      runReply(messages.slice(0, -1), last);
    }
  };

  /** 最後の自分の発言と、それへの返答を取り消す（文章は入力欄に戻す） */
  const handleUndo = () => {
    if (isTyping) return;
    let u = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { u = i; break; }
    }
    if (u === -1) return;
    setInputValue(messages[u].text);
    setMessages(messages.slice(0, u));
    setError(null);
    textareaRef.current?.focus();
  };

  const startEdit = (msg: Message) => {
    if (isTyping) return;
    setEditingId(msg.id);
    setEditText(msg.text);
  };

  const saveEdit = () => {
    const i = messages.findIndex(m => m.id === editingId);
    const text = editText.trim();
    if (i === -1 || !text) return;
    const laterCount = messages.length - i - 1;
    if (laterCount > 1 && !confirm('この発言より後の会話は消えて、ここから物語が作り直されます。よろしいですか？')) return;
    setEditingId(null);
    runReply(messages.slice(0, i), { ...messages[i], text, timestamp: Date.now() });
  };

  const lastIndex = messages.length - 1;
  const canUndo = !isTyping && messages.some(m => m.role === 'user');
  const lastIsUser = lastIndex >= 0 && messages[lastIndex].role === 'user';

  return (
    <div className="flex flex-col h-[100dvh] max-w-4xl mx-auto bg-black shadow-2xl overflow-hidden relative">

      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-purple-900 to-black opacity-20 pointer-events-none blur-3xl" />

      {/* Header */}
      <header className="flex items-center justify-between p-3 sm:p-4 z-10 border-b border-gray-800 bg-black/80 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button onClick={onExit} className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400 flex-shrink-0" title="ホームへ">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-gray-100 truncate">{world.title}</h1>
            <p className="text-xs text-gray-400 truncate">主人公: {world.protagonist.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="hidden sm:inline mr-2"><SaveIndicator status={saveStatus} /></span>
          <button onClick={onOpenSettings} className="p-2 rounded-full text-gray-400 hover:text-white transition-colors" title="設定">
            <Settings size={20} />
          </button>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`p-2 rounded-full transition-colors ${showInfo ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-400 hover:text-white'}`}
            title="世界観・登場人物"
          >
            <BookOpen size={20} />
          </button>
        </div>
      </header>

      {/* World Info Overlay */}
      {showInfo && (
        <div className="bg-gray-900/95 border-b border-gray-700 p-4 text-sm text-gray-300 max-h-[50dvh] overflow-y-auto absolute w-full z-20 top-[65px] sm:top-[73px]">
          <h3 className="font-bold text-white mb-1">世界観</h3>
          <p className="mb-3 whitespace-pre-wrap">{world.setting}</p>
          <h3 className="font-bold text-white mb-2">登場人物</h3>
          <div className="space-y-2 mb-3">
            {world.characters.map(c => (
              <div key={c.id} className="flex items-center gap-2">
                <Avatar character={c} size="sm" />
                <span className="font-bold text-gray-200">{c.name}</span>
                <span className="text-xs text-gray-500 truncate">{c.tagline}</span>
              </div>
            ))}
          </div>
          {world.summary && (
            <>
              <h3 className="font-bold text-white mb-1">これまでのあらすじ（自動要約）</h3>
              <p className="whitespace-pre-wrap text-gray-400 text-xs leading-relaxed">{world.summary}</p>
            </>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 sm:p-6">
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const isEditing = editingId === msg.id;
          if (!isUser && !msg.text) return null; // 生成待ちは下の「…」で表示
          return (
            <div key={msg.id} className={`group flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[92%] sm:max-w-[85%] px-4 sm:px-5 py-3 text-[15px] sm:text-base shadow-lg ${
                  isUser
                    ? 'bg-gradient-to-br from-indigo-900 to-purple-900 text-white rounded-2xl rounded-tr-none border border-indigo-700/50'
                    : 'bg-gray-900/80 text-gray-200 rounded-2xl rounded-tl-none border border-gray-800'
                } ${isEditing ? 'w-full' : ''}`}
              >
                {isEditing ? (
                  <div>
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      autoFocus
                      rows={3}
                      className="w-full bg-black/30 rounded-lg p-2 text-white focus:outline-none resize-y"
                    />
                    <div className="flex justify-end gap-2 mt-2">
                      <button onClick={() => setEditingId(null)} className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-gray-800 hover:bg-gray-700">
                        <X size={14} /> やめる
                      </button>
                      <button onClick={saveEdit} disabled={!editText.trim()} className="flex items-center gap-1 px-3 py-1 text-xs rounded-lg bg-white text-black font-bold disabled:opacity-50">
                        <Check size={14} /> 送り直す
                      </button>
                    </div>
                  </div>
                ) : isUser ? (
                  <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                ) : (
                  <div className="leading-relaxed">
                    <MessageContent text={msg.text} world={world} />
                  </div>
                )}
              </div>

              {/* 発言ごとの操作 */}
              {!isTyping && !isEditing && isUser && (
                <button
                  onClick={() => startEdit(msg)}
                  className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-white sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                >
                  <Pencil size={12} /> 編集
                </button>
              )}
              {!isTyping && !isUser && i === lastIndex && (
                <button onClick={handleRegenerate} className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-white">
                  <RotateCcw size={12} /> 別の展開にする
                </button>
              )}
            </div>
          );
        })}

        {isTyping && !messages[lastIndex]?.text && (
          <div className="flex gap-4 justify-start animate-pulse">
            <div className="bg-gray-900 px-4 py-3 rounded-2xl rounded-tl-none border border-gray-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:150ms]"></span>
              <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:300ms]"></span>
            </div>
          </div>
        )}

        {/* エラーは会話に混ぜず、ここに出して再送信できるようにする */}
        {error && !isTyping && (
          <div className="rounded-xl border border-red-800/60 bg-red-950/40 p-4 text-sm text-red-200">
            <div className="flex items-start gap-2 mb-3">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5 text-red-400" />
              <span className="break-words">{error}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleRegenerate} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-100">
                <RotateCcw size={14} /> 再送信
              </button>
              <button onClick={onOpenSettings} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200">
                <Settings size={14} /> 設定を開く
              </button>
              <button onClick={() => setError(null)} className="px-3 py-1.5 rounded-lg text-gray-400 hover:text-white">閉じる</button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        className="px-3 sm:px-4 pt-2 bg-black border-t border-gray-800"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {/* 操作バー */}
        <div className="flex items-center gap-2 mb-2 text-xs">
          {isTyping ? (
            <button onClick={handleStop} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-800 hover:bg-gray-700 text-gray-200">
              <Square size={12} fill="currentColor" /> 生成を停止
            </button>
          ) : (
            <>
              <button
                onClick={handleUndo}
                disabled={!canUndo}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-900 hover:bg-gray-800 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed"
                title="最後の自分の発言とAIの返答を取り消す"
              >
                <Undo2 size={12} /> 1つ戻す
              </button>
              {(lastIsUser || messages.length === 0) && !error && (
                <button onClick={handleRegenerate} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-900 hover:bg-gray-800 text-gray-300">
                  <RotateCcw size={12} /> 返答を生成
                </button>
              )}
            </>
          )}
        </div>

        <div className="relative flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              // Enterで送信、Shift+Enterで改行（日本語変換中は送信しない）
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`${world.protagonist.name} として行動・発言する...`}
            rows={1}
            className="flex-1 bg-gray-900 text-gray-100 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent resize-none text-base"
            style={{ minHeight: '48px', maxHeight: '160px' }}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className={`p-3 rounded-xl transition-all flex-shrink-0 ${
              !inputValue.trim() || isTyping
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : 'bg-white text-black shadow-lg hover:shadow-xl active:scale-95'
            }`}
            title="送信 (Enter)"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
