import React from 'react';
import { World, Character } from '../types';
import { Avatar } from './Avatar';

// **太字** と *斜体* だけを簡易的に表示する（記号がそのまま見えないように）
export const renderInline = (text: string): React.ReactNode[] => {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} className="font-bold text-white">{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

interface SpeakerLine {
  name: string;
  content: string;
  character?: Character;
}

/**
 * 行がセリフかどうかを判定する。
 * - 「[名前]: セリフ」の形 → セリフ
 * - 「名前: セリフ」の形 → 名前が登場キャラ（か主人公）と一致するときだけセリフ
 *   （「時刻: 夜」のようなナレーションを誤判定しないため）
 */
export const parseSpeaker = (rawLine: string, world: World): SpeakerLine | null => {
  const line = rawLine.replace(/^\s*[-*]\s+/, '').replace(/\*\*/g, '').trim();
  const findChar = (name: string) =>
    world.characters.find(c => c.name === name) ||
    world.characters.find(c => name.length >= 2 && (c.name.startsWith(name) || name.startsWith(c.name)));

  const bracket = line.match(/^[\[［【]([^\]］】]{1,30})[\]］】]\s*[:：]?\s*(.*)$/);
  if (bracket) {
    const name = bracket[1].trim();
    return { name, content: bracket[2].trim(), character: findChar(name) };
  }

  const plain = line.match(/^([^:：\s「」『』]{1,20})\s*[:：]\s*(.+)$/);
  if (plain) {
    const name = plain[1].trim();
    const character = findChar(name);
    if (character || name === world.protagonist?.name) {
      return { name, content: plain[2].trim(), character };
    }
  }
  return null;
};

export const MessageContent: React.FC<{ text: string; world: World }> = ({ text, world }) => {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((rawLine, idx) => {
        const line = rawLine.replace(/^#{1,6}\s+/, ''); // 見出し記号を消す
        if (!line.trim()) return <div key={idx} className="h-2" />;
        if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) return <hr key={idx} className="my-3 border-gray-700" />;

        const speaker = parseSpeaker(line, world);
        if (speaker) {
          const avatarChar = speaker.character || { name: speaker.name, themeColor: 'fuchsia' };
          return (
            <div key={idx} className="mb-2 flex gap-2 items-start">
              <Avatar character={avatarChar} size="sm" className="mt-1" />
              <div className="min-w-0">
                <span className="font-bold text-xs text-indigo-300 block mb-0.5">{speaker.name}</span>
                <span className="text-gray-100 whitespace-pre-wrap break-words">{renderInline(speaker.content)}</span>
              </div>
            </div>
          );
        }
        return (
          <div key={idx} className="mb-2 text-gray-300 italic leading-relaxed whitespace-pre-wrap break-words">
            {renderInline(line)}
          </div>
        );
      })}
    </>
  );
};
