import React, { useState } from 'react';
import { Settings as SettingsIcon, X, ExternalLink } from 'lucide-react';
import { getApiKey, setApiKey, getSettings, setSettings } from '../services/storage';
import { StorySettings, ResponseLength, WritingStyle, DEFAULT_SETTINGS } from '../types';

interface SettingsModalProps {
  onClose: () => void;
}

const LENGTH_OPTIONS: { value: ResponseLength; label: string }[] = [
  { value: 'short', label: '短め' },
  { value: 'normal', label: '普通' },
  { value: 'long', label: '長め' },
];

const STYLE_OPTIONS: { value: WritingStyle; label: string; hint: string }[] = [
  { value: 'balanced', label: 'バランス', hint: '描写と会話を半々' },
  { value: 'novel', label: '小説風', hint: '情景・心情描写が多め' },
  { value: 'dialogue', label: '会話多め', hint: 'セリフ中心でテンポよく' },
];

const Segmented = <T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string; hint?: string }[]; value: T; onChange: (v: T) => void }) => (
  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
    {options.map(o => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        title={o.hint}
        className={`px-2 py-2 rounded-lg text-sm border transition-colors ${
          value === o.value
            ? 'bg-indigo-600 border-indigo-500 text-white'
            : 'bg-gray-800 border-gray-700 text-gray-300 hover:text-white'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [key, setKey] = useState(getApiKey());
  const [showKey, setShowKey] = useState(false);
  const [settings, setLocal] = useState<StorySettings>(getSettings());

  const update = <K extends keyof StorySettings>(k: K, v: StorySettings[K]) => setLocal(s => ({ ...s, [k]: v }));

  const handleSave = () => {
    setApiKey(key);
    setSettings(settings);
    onClose();
  };

  const creativityLabel =
    settings.temperature < 0.6 ? '安定（話がぶれにくい）' : settings.temperature > 1.3 ? '自由奔放（意外な展開）' : '標準';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl text-gray-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <SettingsIcon className="text-indigo-400" size={20} /> 設定
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        {/* API KEY */}
        <section className="mb-6">
          <h3 className="text-sm font-bold text-gray-300 mb-1">Gemini APIキー</h3>
          <p className="text-xs text-gray-400 mb-2 leading-relaxed">
            物語の生成に必要です（無料枠あり）。キーはこのブラウザの中にだけ保存され、Google の API 以外には送信されません。
          </p>
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mb-2"
          >
            Google AI Studio でキーを取得 <ExternalLink size={12} />
          </a>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={key}
              onChange={e => setKey(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              placeholder="AIza..."
              autoComplete="off"
              spellCheck={false}
              className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="px-3 py-2 text-xs rounded-lg bg-gray-800 border border-gray-700 text-gray-400 hover:text-white"
            >
              {showKey ? '隠す' : '表示'}
            </button>
          </div>
          {key && (
            <button onClick={() => setKey('')} className="mt-2 text-xs text-gray-500 hover:text-red-400">キーを削除</button>
          )}
        </section>

        {/* STORY SETTINGS */}
        <section className="space-y-5 mb-6">
          <div>
            <h3 className="text-sm font-bold text-gray-300 mb-2">返答の長さ</h3>
            <Segmented options={LENGTH_OPTIONS} value={settings.responseLength} onChange={v => update('responseLength', v)} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-300 mb-2">文体</h3>
            <Segmented options={STYLE_OPTIONS} value={settings.style} onChange={v => update('style', v)} />
            <p className="text-xs text-gray-500 mt-1">{STYLE_OPTIONS.find(o => o.value === settings.style)?.hint}</p>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-300 mb-2 flex justify-between">
              <span>創造性</span>
              <span className="font-normal text-gray-400">{settings.temperature.toFixed(1)}・{creativityLabel}</span>
            </h3>
            <input
              type="range" min={0} max={2} step={0.1}
              value={settings.temperature}
              onChange={e => update('temperature', Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>
          <button onClick={() => setLocal(DEFAULT_SETTINGS)} className="text-xs text-gray-500 hover:text-white">
            初期設定に戻す
          </button>
        </section>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white">キャンセル</button>
          <button onClick={handleSave} className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-500">
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
