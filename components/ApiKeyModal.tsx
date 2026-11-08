import React, { useState } from 'react';
import { KeyRound, X, ExternalLink } from 'lucide-react';
import { getApiKey, setApiKey } from '../services/storage';

interface ApiKeyModalProps {
  onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onClose }) => {
  const [value, setValue] = useState(getApiKey());
  const [show, setShow] = useState(false);

  const handleSave = () => {
    setApiKey(value);
    onClose();
  };

  const handleClear = () => {
    setApiKey('');
    setValue('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl text-gray-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <KeyRound className="text-amber-400" size={20} /> Gemini APIキー
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <p className="text-sm text-gray-400 mb-3 leading-relaxed">
          物語を生成するには、あなた自身の Gemini APIキーが必要です（無料枠あり）。
          キーはこのブラウザの中にだけ保存され、Google の API 以外には送信されません。
        </p>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 mb-4"
        >
          Google AI Studio でキーを取得 <ExternalLink size={14} />
        </a>

        <div className="flex gap-2 mb-5">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            placeholder="AIza..."
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <button
            onClick={() => setShow(!show)}
            className="px-3 py-2 text-xs rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"
          >
            {show ? '隠す' : '表示'}
          </button>
        </div>

        <div className="flex justify-between">
          <button onClick={handleClear} className="text-sm text-gray-500 hover:text-red-400">キーを削除</button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-lg bg-amber-500 text-black font-bold hover:bg-amber-400"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
