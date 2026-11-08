import React, { useState, useEffect } from 'react';
import { World, Character } from '../types';
import { STORAGE_KEYS, loadJSON, saveJSON, removeKey } from '../services/storage';
import { Sparkles, ArrowLeft, Plus, Trash2, Globe, User, Users, Save } from 'lucide-react';

interface WorldFormProps {
  onSave: (world: World) => void;
  onCancel: () => void;
  initialData?: World | null;
}

const THEME_COLORS = ['indigo', 'rose', 'cyan', 'emerald', 'amber', 'violet'];

interface WorldDraft {
  forWorldId: string | null; // 編集中のワールドID（新規作成なら null）
  step: 1 | 2 | 3;
  title: string;
  setting: string;
  protagonistName: string;
  protagonistDesc: string;
  characters: Character[];
  tempCharName: string;
  tempCharTagline: string;
  tempCharDesc: string;
}

export const WorldForm: React.FC<WorldFormProps> = ({ onSave, onCancel, initialData }) => {
  // 作成途中の内容を自動セーブから復元（同じワールドの下書きのときだけ）
  const [draft] = useState<WorldDraft | null>(() => {
    const d = loadJSON<WorldDraft | null>(STORAGE_KEYS.worldDraft, null);
    return d && d.forWorldId === (initialData?.id || null) ? d : null;
  });

  // Step management
  const [step, setStep] = useState<1 | 2 | 3>(draft?.step || 1);

  // World Data - Initialize with initialData if available
  const [title, setTitle] = useState(draft?.title ?? initialData?.title ?? '');
  const [setting, setSetting] = useState(draft?.setting ?? initialData?.setting ?? '');

  // Protagonist Data
  const [protagonistName, setProtagonistName] = useState(draft?.protagonistName ?? initialData?.protagonist.name ?? '');
  const [protagonistDesc, setProtagonistDesc] = useState(draft?.protagonistDesc ?? initialData?.protagonist.description ?? '');

  // Characters Data
  const [characters, setCharacters] = useState<Character[]>(draft?.characters ?? initialData?.characters ?? []);

  // Temporary Character Input
  const [tempCharName, setTempCharName] = useState(draft?.tempCharName ?? '');
  const [tempCharTagline, setTempCharTagline] = useState(draft?.tempCharTagline ?? '');
  const [tempCharDesc, setTempCharDesc] = useState(draft?.tempCharDesc ?? '');

  // 入力のたびに下書きを自動セーブ
  useEffect(() => {
    const timer = setTimeout(() => {
      saveJSON(STORAGE_KEYS.worldDraft, {
        forWorldId: initialData?.id || null,
        step, title, setting, protagonistName, protagonistDesc, characters,
        tempCharName, tempCharTagline, tempCharDesc,
      } satisfies WorldDraft);
    }, 400);
    return () => clearTimeout(timer);
  }, [step, title, setting, protagonistName, protagonistDesc, characters, tempCharName, tempCharTagline, tempCharDesc, initialData?.id]);

  const handleCancel = () => {
    const hasInput = title || setting || protagonistName || protagonistDesc || characters.length > 0;
    if (hasInput && !initialData && !confirm('作成中の内容を破棄しますか？')) return;
    removeKey(STORAGE_KEYS.worldDraft);
    onCancel();
  };

  const addCharacter = () => {
    if (!tempCharName || !tempCharDesc) return;
    const newChar: Character = {
      id: Date.now().toString(),
      name: tempCharName,
      tagline: tempCharTagline,
      description: tempCharDesc,
      avatarSeed: tempCharName + Date.now(),
      themeColor: THEME_COLORS[characters.length % THEME_COLORS.length]
    };
    setCharacters([...characters, newChar]);
    setTempCharName('');
    setTempCharTagline('');
    setTempCharDesc('');
  };

  const removeCharacter = (id: string) => {
    setCharacters(characters.filter(c => c.id !== id));
  };

  const handleSave = () => {
    const newWorld: World = {
      // Use existing ID and createdAt if editing, otherwise generate new ones
      id: initialData?.id || Date.now().toString(),
      title,
      setting,
      protagonist: {
        name: protagonistName,
        description: protagonistDesc
      },
      characters,
      createdAt: initialData?.createdAt || Date.now(),
      // 編集時に会話履歴が消えないように引き継ぐ
      messages: initialData?.messages,
    };
    removeKey(STORAGE_KEYS.worldDraft);
    onSave(newWorld);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={handleCancel} className="text-gray-400 hover:text-white flex items-center gap-2">
          <ArrowLeft size={20} /> キャンセル
        </button>
        <div className="flex gap-2">
          <div className={`h-2 w-8 rounded-full transition-colors ${step >= 1 ? 'bg-indigo-500' : 'bg-gray-800'}`} />
          <div className={`h-2 w-8 rounded-full transition-colors ${step >= 2 ? 'bg-indigo-500' : 'bg-gray-800'}`} />
          <div className={`h-2 w-8 rounded-full transition-colors ${step >= 3 ? 'bg-indigo-500' : 'bg-gray-800'}`} />
        </div>
      </div>

      <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800 backdrop-blur-sm min-h-[60vh]">
        
        {/* STEP 1: WORLD */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-indigo-400">
              <Globe /> 世界観の設定
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">ワールドタイトル</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 魔法学園クロニクル"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">世界の設定・あらすじ</label>
              <textarea
                value={setting}
                onChange={(e) => setSetting(e.target.value)}
                placeholder="どんな世界ですか？歴史、ルール、現状などを詳しく書いてください。"
                className="w-full h-64 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none leading-relaxed"
              />
            </div>
            <div className="flex justify-end mt-4">
              <button
                onClick={() => setStep(2)}
                disabled={!title || !setting}
                className="px-6 py-2 bg-indigo-600 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors"
              >
                次へ: 主人公設定
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: PROTAGONIST */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-rose-400">
              <User /> あなた（主人公）の設定
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">主人公の名前</label>
              <input
                value={protagonistName}
                onChange={(e) => setProtagonistName(e.target.value)}
                placeholder="例: アキラ"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">役割・バックストーリー</label>
              <textarea
                value={protagonistDesc}
                onChange={(e) => setProtagonistDesc(e.target.value)}
                placeholder="あなたの役割は？冒険者？転校生？記憶喪失？"
                className="w-full h-48 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-rose-500 focus:outline-none resize-none leading-relaxed"
              />
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={() => setStep(1)} className="text-gray-400 hover:text-white px-4">戻る</button>
              <button
                onClick={() => setStep(3)}
                disabled={!protagonistName || !protagonistDesc}
                className="px-6 py-2 bg-rose-600 rounded-lg font-bold disabled:opacity-50 hover:bg-rose-500 transition-colors"
              >
                次へ: キャラクター追加
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CHARACTERS */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold flex items-center gap-2 text-cyan-400">
              <Users /> 登場キャラクター (NPC)
            </h2>
            
            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto custom-scrollbar pr-2">
              {characters.map(char => (
                <div key={char.id} className="bg-gray-800 p-3 rounded-lg flex items-center gap-3 border border-gray-700">
                  <img src={`https://picsum.photos/seed/${char.avatarSeed}/50`} className="w-10 h-10 rounded-full" alt="" />
                  <div className="flex-1 overflow-hidden">
                    <div className="font-bold truncate">{char.name}</div>
                    <div className="text-xs text-gray-400 truncate">{char.tagline}</div>
                  </div>
                  <button onClick={() => removeCharacter(char.id)} className="text-gray-500 hover:text-red-400">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              {characters.length === 0 && (
                <div className="col-span-full text-center text-gray-500 py-4 text-sm">
                  まだキャラクターがいません。右側（スマホなら下）で追加してください。
                </div>
              )}
            </div>

            {/* Add Form */}
            <div className="bg-black/30 p-4 rounded-xl border border-gray-800 space-y-4">
              <div className="flex gap-4">
                <input
                  value={tempCharName}
                  onChange={(e) => setTempCharName(e.target.value)}
                  placeholder="NPC名"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                />
                <input
                  value={tempCharTagline}
                  onChange={(e) => setTempCharTagline(e.target.value)}
                  placeholder="短い肩書き (例: 幼馴染)"
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                />
              </div>
              <textarea
                value={tempCharDesc}
                onChange={(e) => setTempCharDesc(e.target.value)}
                placeholder="性格や口調の詳細"
                className="w-full h-20 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 resize-none"
              />
              <button
                onClick={addCharacter}
                disabled={!tempCharName || !tempCharDesc}
                className="w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium flex items-center justify-center gap-2"
              >
                <Plus size={16} /> リストに追加
              </button>
            </div>

            <div className="flex justify-between mt-6 pt-4 border-t border-gray-800">
              <button onClick={() => setStep(2)} className="text-gray-400 hover:text-white px-4">戻る</button>
              <button
                onClick={handleSave}
                disabled={characters.length === 0}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-bold shadow-lg hover:shadow-purple-500/20 transform hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50 disabled:transform-none"
              >
                {initialData ? <Save size={20} /> : <Sparkles size={20} />}
                {initialData ? '変更を保存' : 'ワールド作成完了'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};