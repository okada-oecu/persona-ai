export interface Character {
  id: string;
  name: string;
  tagline: string;
  description: string;
  avatarSeed: string;
  themeColor: string;
  avatarImage?: string; // アップロードされた画像（data URL）
  firstMessage?: string;
}

export interface Protagonist {
  name: string;
  description: string; // User's role/backstory
}

export interface World {
  id: string;
  title: string;
  setting: string; // The lore/world description
  protagonist: Protagonist;
  characters: Character[];
  createdAt: number;
  messages?: Message[];
  /** 古い会話の要約（長編でAIに送る量を減らすため） */
  summary?: string;
  /** プレイヤーが書く「必ず覚えておくこと」メモ */
  memo?: string;
  /** summary に含まれている先頭からのメッセージ数 */
  summarizedCount?: number;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export type ResponseLength = 'short' | 'normal' | 'long';
export type WritingStyle = 'balanced' | 'novel' | 'dialogue';

export interface StorySettings {
  responseLength: ResponseLength;
  style: WritingStyle;
  temperature: number; // 0.0〜2.0
}

export const DEFAULT_SETTINGS: StorySettings = {
  responseLength: 'normal',
  style: 'balanced',
  temperature: 1.0,
};

export enum AppState {
  HOME = 'HOME',
  CREATING_WORLD = 'CREATING_WORLD',
  EDITING_WORLD = 'EDITING_WORLD',
  CHATTING = 'CHATTING'
}
