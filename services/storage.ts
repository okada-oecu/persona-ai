// localStorage を安全に読み書きするための小さなヘルパー。
// プライベートモードや容量オーバーでも例外でアプリが落ちないようにする。

export const STORAGE_KEYS = {
  worlds: 'persona_worlds_data',
  session: 'persona_session',
  worldDraft: 'persona_world_draft',
  inputDraft: (worldId: string) => `persona_input_draft_${worldId}`,
  apiKey: 'persona_gemini_api_key',
};

export const loadJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

/** 保存に成功したら true。容量オーバーなどで失敗したら false。 */
export const saveJSON = (key: string, value: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`Failed to save ${key}`, e);
    return false;
  }
};

export const loadString = (key: string): string => {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
};

export const saveString = (key: string, value: string) => {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch (e) {
    console.error(`Failed to save ${key}`, e);
  }
};

export const removeKey = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
};

export const getApiKey = () => loadString(STORAGE_KEYS.apiKey).trim();
export const setApiKey = (key: string) => saveString(STORAGE_KEYS.apiKey, key.trim());
