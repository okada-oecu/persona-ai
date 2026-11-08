import React, { useState } from 'react';
import { Character } from '../types';
import { Sparkles, ArrowLeft, Dice5 } from 'lucide-react';

interface CharacterFormProps {
  onSave: (character: Character) => void;
  onCancel: () => void;
}

const THEME_COLORS = [
  'indigo', 'rose', 'cyan', 'emerald', 'amber', 'violet', 'fuchsia'
];

// Localized presets
const PRESETS = [
  {
    name: "アリア",
    tagline: "サイバーパンク・ハッカー",
    description: "ネオ東京に住む天才だが皮肉屋なハッカー。ネットスラングを使い、権力を疑っているが、野良猫とレトロな技術には目がない。「～だね」「～じゃん」といった口調。",
    firstMessage: "暗号化チャンネル接続完了。何か用？ 信号を追跡中だから手短に頼むよ。"
  },
  {
    name: "エルドリン",
    tagline: "古代の魔法使い",
    description: "お茶とマイナーな魔法を愛する、忘れっぽい数千歳の魔法使い。古風な話し方（「～じゃ」「～かのう」）をするが、現代の概念をよく面白おかしく勘違いする。",
    firstMessage: "おや、旅人よ！ わしの杖を見かけなかったかの？ それとも...ええと、何のポーションを求めて来たんじゃったか？"
  },
  {
    name: "K-9000",
    tagline: "忠実なロボット犬",
    description: "「良い子」でありたいと願う、過剰に熱心なロボット犬。シンプルで興奮した口調で話し、頻繁にセンサーやバッテリー残量に言及する。語尾に「ワン！」や「ロボ！」をつける。",
    firstMessage: "ワン！ センサーが新しい友達を検知しました！ 尻尾振りシーケンスを開始します。データボーン（骨）を持っていますか？"
  }
];

export const CharacterForm: React.FC<CharacterFormProps> = ({ onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [themeColor, setThemeColor] = useState('indigo');

  const handleSave = () => {
    if (!name || !description) return; // Basic validation
    
    const newCharacter: Character = {
      id: Date.now().toString(),
      name,
      tagline,
      description,
      firstMessage: firstMessage || "こんにちは。",
      avatarSeed: name + Date.now(),
      themeColor
    };
    onSave(newCharacter);
  };

  const loadPreset = () => {
    const random = PRESETS[Math.floor(Math.random() * PRESETS.length)];
    setName(random.name);
    setTagline(random.tagline);
    setDescription(random.description);
    setFirstMessage(random.firstMessage);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={onCancel}
          className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <ArrowLeft size={20} /> 戻る
        </button>
        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
          ペルソナを作成
        </h2>
        <button 
          onClick={loadPreset}
          className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-full flex items-center gap-1 transition-all"
        >
          <Dice5 size={14} /> ランダム
        </button>
      </div>

      <div className="space-y-6 bg-gray-900/50 p-6 rounded-2xl border border-gray-800 backdrop-blur-sm">
        
        {/* Name & Tagline */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">名前</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: セラフィナ"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder-gray-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">キャッチコピー</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="例: 皮肉屋なAIアシスタント"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder-gray-600"
            />
          </div>
        </div>

        {/* Description/Prompt */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            性格と設定 (プロンプト)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="キャラクターがどのように振る舞うべきか詳しく書いてください。例：「ユーザーの料理の腕を侮辱するが、アドバイスは的確なスパルタ料理人。」"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none h-32 resize-none transition-all placeholder-gray-600 leading-relaxed"
          />
          <p className="text-xs text-gray-500 mt-2">これはGeminiに送信される「システム指示」になります。</p>
        </div>

        {/* First Message */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">最初のメッセージ</label>
          <input
            type="text"
            value={firstMessage}
            onChange={(e) => setFirstMessage(e.target.value)}
            placeholder="会話の始め方は？"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder-gray-600"
          />
        </div>

        {/* Color Theme */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">テーマカラー</label>
          <div className="flex gap-3">
            {THEME_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setThemeColor(color)}
                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                  themeColor === color ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: `var(--color-${color}-500, ${getColorHex(color)})` }}
              />
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!name || !description}
          className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all ${
            !name || !description 
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
              : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-blue-500/25 active:scale-95'
          }`}
        >
          <Sparkles size={20} />
          命を吹き込む
        </button>

      </div>
    </div>
  );
};

// Helper for inline styles since we can't easily dynamic class w/ Tailwind without full safelist
const getColorHex = (colorName: string) => {
  const map: Record<string, string> = {
    indigo: '#6366f1', rose: '#f43f5e', cyan: '#06b6d4', 
    emerald: '#10b981', amber: '#f59e0b', violet: '#8b5cf6', fuchsia: '#d946ef'
  };
  return map[colorName] || '#6366f1';
};