import { GoogleGenAI, Content } from '@google/genai';
import { World, Message } from '../types';
import { buildSystemInstruction, friendlyErrorMessage, GEMINI_MODEL, GENERATION_CONFIG } from './prompt';
import { getApiKey } from './storage';

let activeWorldState: World | null = null;
let activeHistoryState: Message[] = [];

export const initializeWorldChat = (world: World, history?: Message[]) => {
  activeWorldState = world;
  activeHistoryState = history ? [...history] : (world.messages ? [...world.messages] : []);
};

export const MISSING_KEY_MESSAGE =
  '⚠ APIキーが未設定です。ホーム画面右上の「APIキー設定」から Gemini APIキーを登録してください。';

/**
 * ブラウザから直接 Gemini を呼ぶ（GitHub Pages など静的ホスティング用）。
 * APIキーはプレイヤー自身のもので、このブラウザの localStorage にだけ保存される。
 */
async function* streamDirect(apiKey: string, world: World, history: Message[], message: string) {
  const ai = new GoogleGenAI({ apiKey });
  const formattedHistory: Content[] = history
    .filter(m => m.text)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));

  const chat = ai.chats.create({
    model: GEMINI_MODEL,
    config: { systemInstruction: buildSystemInstruction(world), ...GENERATION_CONFIG },
    history: formattedHistory,
  });

  const stream = await chat.sendMessageStream({ message });
  for await (const chunk of stream) {
    if (chunk.text) yield chunk.text;
  }
}

/** ローカルで `npm run dev`（server.ts）を動かしている場合のサーバー経由ルート。 */
async function* streamViaServer(world: World, history: Message[], message: string) {
  const response = await fetch('api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ world, history, message }),
  });

  if (response.status === 404 || response.status === 405) {
    // サーバーがない（静的ホスティング）→ APIキーが必要
    yield MISSING_KEY_MESSAGE;
    return;
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error status ${response.status}`);
  }
  if (!response.body) throw new Error('Response body is null');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const dataStr = trimmed.slice(6);
      if (dataStr === '[DONE]') return;
      try {
        const data = JSON.parse(dataStr);
        if (data.error) yield ` [エラー: ${data.error}]`;
        else if (data.text) yield data.text;
      } catch (e) {
        console.error('Failed to parse SSE line:', line, e);
      }
    }
  }
}

export const sendMessageToGemini = async function* (
  message: string,
  overrideWorld?: World,
  overrideHistory?: Message[]
): AsyncGenerator<string, void, unknown> {
  const world = overrideWorld || activeWorldState;
  const history = overrideHistory || activeHistoryState;

  if (!world) {
    throw new Error('Chat session not initialized: World is missing');
  }

  const apiKey = getApiKey();
  try {
    if (apiKey) {
      yield* streamDirect(apiKey, world, history, message);
    } else {
      yield* streamViaServer(world, history, message);
    }
  } catch (error: any) {
    console.error('Error communicating with Gemini:', error);
    yield `\n⚠ ${friendlyErrorMessage(error)}`;
  }
};
