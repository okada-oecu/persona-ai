import { World, StorySettings, DEFAULT_SETTINGS } from '../types';

// localStorage を安全に読み書きするための小さなヘルパー。
// プライベートモードや容量オーバーでも例外でアプリが落ちないようにする。

export const STORAGE_KEYS = {
  worlds: 'persona_worlds_data', // 旧保存先（IndexedDB へ移行済み）
  session: 'persona_session',
  worldDraft: 'persona_world_draft',
  inputDraft: (worldId: string) => `persona_input_draft_${worldId}`,
  apiKey: 'persona_gemini_api_key',
  settings: 'persona_settings',
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

export const getSettings = (): StorySettings => ({
  ...DEFAULT_SETTINGS,
  ...loadJSON<Partial<StorySettings>>(STORAGE_KEYS.settings, {}),
});
export const setSettings = (s: StorySettings) => saveJSON(STORAGE_KEYS.settings, s);

// ---------------------------------------------------------------------------
// ワールドデータは IndexedDB に保存（localStorage の約5MB制限を回避）
// ---------------------------------------------------------------------------
const DB_NAME = 'persona-ai';
const STORE = 'kv';
const WORLDS_KEY = 'worlds';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
};

const idbGet = async <T,>(key: string): Promise<T | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
};

const idbSet = async (key: string, value: unknown): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
};

/** IndexedDB から読み込む。初回は旧 localStorage のデータを引き継ぐ。 */
export const loadWorlds = async (): Promise<World[]> => {
  try {
    const stored = await idbGet<World[]>(WORLDS_KEY);
    if (stored) return stored;
    const legacy = loadJSON<World[] | null>(STORAGE_KEYS.worlds, null);
    if (legacy) {
      await idbSet(WORLDS_KEY, legacy);
      removeKey(STORAGE_KEYS.worlds);
      return legacy;
    }
    return [];
  } catch (e) {
    console.error('IndexedDB unavailable, falling back to localStorage', e);
    return loadJSON<World[]>(STORAGE_KEYS.worlds, []);
  }
};

export const saveWorlds = async (worlds: World[]): Promise<boolean> => {
  try {
    await idbSet(WORLDS_KEY, worlds);
    return true;
  } catch (e) {
    console.error('IndexedDB save failed, falling back to localStorage', e);
    return saveJSON(STORAGE_KEYS.worlds, worlds);
  }
};
