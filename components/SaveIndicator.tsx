import React from 'react';

export type SaveStatus = { state: 'saved' | 'saving' | 'error'; at: number | null };

export const SaveIndicator: React.FC<{ status: SaveStatus }> = ({ status }) => {
  if (status.state === 'saving') {
    return <span className="text-xs text-gray-500">保存中…</span>;
  }
  if (status.state === 'error') {
    return <span className="text-xs text-red-400" title="ブラウザの保存容量が足りない可能性があります。JSONで書き出してください。">⚠ 自動セーブ失敗</span>;
  }
  if (!status.at) return null;
  const time = new Date(status.at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  return <span className="text-xs text-gray-500">✓ 自動セーブ済み {time}</span>;
};
