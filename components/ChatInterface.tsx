import React, { useState, useEffect, useRef } from 'react';
import { World, Message } from '../types';
import { sendMessageToGemini } from '../services/geminiService';
import { STORAGE_KEYS, loadString, saveString } from '../services/storage';
import { SaveIndicator, SaveStatus } from './SaveIndicator';
import { Send, ArrowLeft, BookOpen, KeyRound } from 'lucide-react';

interface ChatInterfaceProps {
  world: World;
  onExit: () => void;
  onUpdateMessages: (worldId: string, messages: Message[]) => void;
  saveStatus: SaveStatus;
  onOpenApiKey: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ world, onExit, onUpdateMessages, saveStatus, onOpenApiKey }) => {
  const [messages, setMessages] = useState<Message[]>(world.messages || []);
  // 入力途中の文章も自動セーブ（リロードしても消えない）
  const draftKey = STORAGE_KEYS.inputDraft(world.id);
  const [inputValue, setInputValue] = useState(() => loadString(draftKey));
  const [isTyping, setIsTyping] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Sync messages to parent whenever it changes
  useEffect(() => {
    if (initialized.current) {
      onUpdateMessages(world.id, messages);
    }
  }, [messages, world.id]);

  useEffect(() => {
    const timer = setTimeout(() => saveString(draftKey, inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue, draftKey]);

  // Initialize - Send empty prompt to trigger intro only if history is empty
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    
    if (!world.messages || world.messages.length === 0) {
      // Trigger opening narration
      handleInitialLoad();
    }
  }, []);

  const handleInitialLoad = async () => {
     setIsTyping(true);
     try {
        const aiMsgId = 'intro';
        setMessages([{ id: aiMsgId, role: 'model', text: '', timestamp: Date.now() }]);
        
        let accumulatedText = '';
        // Send a hidden prompt to start the story
        const stream = sendMessageToGemini("ストーリーを開始してください。導入のナレーションと、最初の状況を描写してください。", world, []);

        for await (const chunk of stream) {
          accumulatedText += chunk;
          setMessages(prev => 
            prev.map(m => m.id === aiMsgId ? { ...m, text: accumulatedText } : m)
          );
        }
     } catch (e) {
         console.error(e);
     } finally {
         setIsTyping(false);
     }
  };

  // Auto-scroll logic: Only scroll when new messages are added or typing state changes.
  // This prevents scrolling while the text is streaming/updating in the same message bubble.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isTyping]);

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userText = inputValue.trim();
    setInputValue('');
    saveString(draftKey, '');
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const aiMsgId = (Date.now() + 1).toString();
      setMessages(prev => [
        ...prev, 
        { id: aiMsgId, role: 'model', text: '', timestamp: Date.now() }
      ]);

      let accumulatedText = '';
      const stream = sendMessageToGemini(userText, world, messages);

      for await (const chunk of stream) {
        accumulatedText += chunk;
        setMessages(prev => 
          prev.map(m => m.id === aiMsgId ? { ...m, text: accumulatedText } : m)
        );
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  // Helper to parse text for "[Name]:" pattern to show specific avatars
  const renderMessageContent = (text: string) => {
    // Simple regex to find "Name:" or "[Name]:" at the start of lines
    // This is a basic implementation. For complex rendering, we might split by newlines.
    const lines = text.split('\n');
    return lines.map((line, idx) => {
        const match = line.match(/^\[?([^\]:]+)\]?[:：](.*)/);
        if (match) {
            const name = match[1].trim();
            const content = match[2].trim();
            // Find character for avatar
            const char = world.characters.find(c => c.name === name);
            const avatarUrl = char 
                ? `https://picsum.photos/seed/${char.avatarSeed}/50` 
                : null; // Null implies narrator or unknown

            return (
                <div key={idx} className="mb-2 flex gap-2 items-start">
                   {avatarUrl && (
                       <img src={avatarUrl} className="w-6 h-6 rounded-full border border-gray-600 mt-1 flex-shrink-0" alt={name} />
                   )}
                   <div className={avatarUrl ? "font-normal" : "italic text-gray-400"}>
                       {avatarUrl && <span className="font-bold text-xs text-indigo-300 block mb-0.5">{name}</span>}
                       {content}
                   </div>
                </div>
            );
        }
        // Narration text
        return <div key={idx} className="mb-2 text-gray-300 italic leading-relaxed">{line || <br/>}</div>;
    });
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto bg-black shadow-2xl overflow-hidden relative">
      
      {/* Background Ambience */}
      <div className={`absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-purple-900 to-black opacity-20 pointer-events-none blur-3xl`} />

      {/* Header */}
      <header className="flex items-center justify-between p-4 z-10 border-b border-gray-800 bg-black/80 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-3">
          <button onClick={onExit} className="p-2 hover:bg-gray-800 rounded-full transition-colors text-gray-400">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold text-gray-100 flex items-center gap-2">
                <GlobeIcon />
                {world.title}
            </h1>
            <p className="text-xs text-gray-400">主人公: {world.protagonist.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="hidden sm:inline mr-2"><SaveIndicator status={saveStatus} /></span>
          <button onClick={onOpenApiKey} className="p-2 rounded-full text-gray-400 hover:text-white transition-colors" title="APIキー設定">
            <KeyRound size={20} />
          </button>
          <button onClick={() => setShowInfo(!showInfo)} className={`p-2 rounded-full transition-colors ${showInfo ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-400 hover:text-white'}`}>
            <BookOpen size={20} />
          </button>
        </div>
      </header>

      {/* World Info Overlay */}
      {showInfo && (
          <div className="bg-gray-900/95 border-b border-gray-700 p-4 text-sm text-gray-300 max-h-48 overflow-y-auto animate-fade-in absolute w-full z-20 top-[73px]">
              <h3 className="font-bold text-white mb-1">世界観</h3>
              <p className="mb-3 whitespace-pre-wrap">{world.setting}</p>
              <h3 className="font-bold text-white mb-1">登場人物</h3>
              <div className="flex flex-wrap gap-2">
                  {world.characters.map(c => (
                      <span key={c.id} className="bg-gray-800 px-2 py-1 rounded border border-gray-700 text-xs">
                          {c.name}
                      </span>
                  ))}
              </div>
          </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 sm:p-6 custom-scrollbar">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div 
              key={msg.id} 
              className={`flex gap-4 ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
            >
              <div 
                className={`max-w-[90%] sm:max-w-[85%] px-5 py-3 text-sm sm:text-base shadow-lg ${
                  isUser 
                    ? `bg-gradient-to-br from-indigo-900 to-purple-900 text-white rounded-2xl rounded-tr-none border border-indigo-700/50` 
                    : 'bg-gray-900/80 text-gray-200 rounded-2xl rounded-tl-none border border-gray-800'
                }`}
              >
                {isUser ? (
                    <div>{msg.text}</div>
                ) : (
                    <div className="leading-relaxed">
                        {renderMessageContent(msg.text)}
                    </div>
                )}
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div className="flex gap-4 justify-start animate-pulse">
             <div className="bg-gray-900 px-4 py-3 rounded-2xl rounded-tl-none border border-gray-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-0"></span>
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-150"></span>
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce delay-300"></span>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-black border-t border-gray-800">
        <div className="max-w-4xl mx-auto relative flex items-center gap-2">
          
          <div className="flex-1 relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`${world.protagonist.name} として行動・発言する...`}
              rows={1}
              className="w-full bg-gray-900 text-gray-100 border border-gray-700 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:border-transparent resize-none scroll-hide"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            className={`p-3 rounded-xl transition-all ${
               !inputValue.trim() || isTyping 
               ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
               : `bg-white text-black shadow-lg hover:shadow-xl active:scale-95`
            }`}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

const GlobeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
);