export interface Character {
  id: string;
  name: string;
  tagline: string;
  description: string;
  avatarSeed: string;
  themeColor: string;
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
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export enum AppState {
  HOME = 'HOME',
  CREATING_WORLD = 'CREATING_WORLD',
  EDITING_WORLD = 'EDITING_WORLD',
  CHATTING = 'CHATTING'
}