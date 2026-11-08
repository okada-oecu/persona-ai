import React from 'react';
import { Character } from '../types';

// Tailwind CDN はクラス名を実行時に解釈するので、動的な色名はここで固定値に対応させる
const COLORS: Record<string, string> = {
  indigo: 'from-indigo-500 to-indigo-700',
  rose: 'from-rose-500 to-rose-700',
  cyan: 'from-cyan-500 to-cyan-700',
  emerald: 'from-emerald-500 to-emerald-700',
  amber: 'from-amber-500 to-amber-700',
  violet: 'from-violet-500 to-violet-700',
  fuchsia: 'from-fuchsia-500 to-fuchsia-700',
};

const SIZES = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
};

interface AvatarProps {
  character: Pick<Character, 'name' | 'themeColor' | 'avatarImage'>;
  size?: keyof typeof SIZES;
  className?: string;
}

/** アップロード画像があれば表示、なければ名前の頭文字アイコン */
export const Avatar: React.FC<AvatarProps> = ({ character, size = 'md', className = '' }) => {
  const base = `${SIZES[size]} rounded-full flex-shrink-0 border border-white/10 ${className}`;
  if (character.avatarImage) {
    return <img src={character.avatarImage} alt={character.name} className={`${base} object-cover`} />;
  }
  const initial = Array.from(character.name.trim())[0] || '?';
  return (
    <div
      className={`${base} bg-gradient-to-br ${COLORS[character.themeColor] || COLORS.indigo} flex items-center justify-center font-bold text-white select-none`}
      aria-label={character.name}
    >
      {initial}
    </div>
  );
};

/** 画像ファイルを小さく縮めて data URL にする（保存容量の節約） */
export const resizeImageFile = (file: File, maxSize = 160): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('画像を読み込めませんでした'));
      img.onload = () => {
        // 中央を正方形に切り抜いて縮小
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = Math.min(maxSize, side);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas unavailable'));
        ctx.drawImage(
          img,
          (img.width - side) / 2, (img.height - side) / 2, side, side,
          0, 0, canvas.width, canvas.height,
        );
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
