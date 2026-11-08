import { GoogleGenAI } from '@google/genai';
import { World, Message, StorySettings } from '../types';
import { buildSystemInstruction, generationConfig, GEMINI_MODEL, toGeminiHistory } from './prompt';
import { getApiKey } from './storage';

export class MissingApiKeyError extends Error {
  constructor() {
    super('APIキーが未設定です。右上の「設定」から Gemini APIキーを登録してください。');
  }
}

const isAbort = (e: any) => e?.name === 'AbortError' || /abort/i.test(e?.message || '');

interface ReplyRequest {
  world: World;
  history: Message[];
  message: string;
  settings: StorySettings;
  signal?: AbortSignal;
}

/**
 * AIの返答を少しずつ受け取る。
 * APIキーがあればブラウザから直接 Gemini を呼ぶ（GitHub Pages 用）。
 * なければローカルの server.ts 経由で呼ぶ。
 * エラーは例外として投げる（会話履歴には入れない）。停止された場合は静かに終わる。
 */
export async function* streamReply(req: ReplyRequest): AsyncGenerator<string, void, unknown> {
  const apiKey = getApiKey();
  try {
    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      const stream = await ai.models.generateContentStream({
        model: GEMINI_MODEL,
        contents: [...toGeminiHistory(req.history), { role: 'user', parts: [{ text: req.message }] }],
        config: {
          systemInstruction: buildSystemInstruction(req.world, req.settings),
          ...generationConfig(req.settings),
          abortSignal: req.signal,
        },
      });
      for await (const chunk of stream) {
        if (req.signal?.aborted) return;
        if (chunk.text) yield chunk.text;
      }
    } else {
      yield* streamViaServer(req);
    }
  } catch (e) {
    if (req.signal?.aborted || isAbort(e)) return;
    throw e;
  }
}

async function* streamViaServer({ world, history, message, settings, signal }: ReplyRequest) {
  const response = await fetch('api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ world, history, message, settings }),
    signal,
  });

  // サーバーがない（GitHub Pages など）→ APIキーが必要
  if (response.status === 404 || response.status === 405) throw new MissingApiKeyError();
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
      let data: any;
      try {
        data = JSON.parse(dataStr);
      } catch {
        continue;
      }
      if (data.error) throw new Error(data.error);
      if (data.text) yield data.text as string;
    }
  }
}

/** 一度に全文を受け取る生成（あらすじ要約用） */
export async function generateText(prompt: string, temperature = 0.3): Promise<string> {
  const apiKey = getApiKey();
  if (apiKey) {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { temperature },
    });
    return res.text || '';
  }
  const response = await fetch('api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, temperature }),
  });
  if (response.status === 404 || response.status === 405) throw new MissingApiKeyError();
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP error status ${response.status}`);
  return data.text || '';
}
