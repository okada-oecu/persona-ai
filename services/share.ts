import { World } from '../types';

// ワールドを URL（#share=...）に詰めて共有する。会話履歴・画像は含めない。

const SHARE_PREFIX = '#share=';

const toBase64Url = (bytes: Uint8Array) => {
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (s: string) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};

const pipeThrough = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream) => {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
};

/** 共有用に、他人に渡す必要のない情報を取り除く */
export const toShareableWorld = (world: World, includeImages = false): Partial<World> => ({
  title: world.title,
  setting: world.setting,
  protagonist: world.protagonist,
  characters: world.characters.map(c => {
    const { avatarImage, ...rest } = c;
    return includeImages && avatarImage ? { ...rest, avatarImage } : rest;
  }),
});

export const createShareUrl = async (world: World): Promise<string> => {
  const json = new TextEncoder().encode(JSON.stringify(toShareableWorld(world)));
  const compressed = await pipeThrough(json, new CompressionStream('deflate-raw'));
  const base = location.href.split('#')[0];
  return `${base}${SHARE_PREFIX}${toBase64Url(compressed)}`;
};

/** URL に共有データがあれば取り出す */
export const readSharedWorldFromUrl = async (): Promise<Partial<World> | null> => {
  if (!location.hash.startsWith(SHARE_PREFIX)) return null;
  try {
    const bytes = fromBase64Url(location.hash.slice(SHARE_PREFIX.length));
    const json = await pipeThrough(bytes, new DecompressionStream('deflate-raw'));
    return JSON.parse(new TextDecoder().decode(json));
  } catch (e) {
    console.error('Failed to read shared world', e);
    return null;
  }
};

export const clearShareHash = () => {
  history.replaceState(null, '', location.pathname + location.search);
};

/** 読み込んだデータが最低限ワールドの形をしているか */
export const isWorldLike = (w: any): w is Partial<World> =>
  !!w && typeof w.title === 'string' && typeof w.setting === 'string' &&
  Array.isArray(w.characters) && !!w.protagonist;

/** 取り込むワールドに新しいIDを振る */
export const normalizeImportedWorld = (w: Partial<World>, keepId = false): World => ({
  id: keepId && w.id ? w.id : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: w.title || '無題の世界',
  setting: w.setting || '',
  protagonist: { name: w.protagonist?.name || '主人公', description: w.protagonist?.description || '' },
  characters: (w.characters || []).map((c, i) => ({
    id: c.id || `${Date.now()}-${i}`,
    name: c.name || '名無し',
    tagline: c.tagline || '',
    description: c.description || '',
    avatarSeed: c.avatarSeed || c.name || String(i),
    themeColor: c.themeColor || 'indigo',
    ...(c.avatarImage ? { avatarImage: c.avatarImage } : {}),
  })),
  createdAt: w.createdAt || Date.now(),
  messages: w.messages || [],
  ...(w.summary ? { summary: w.summary, summarizedCount: w.summarizedCount || 0 } : {}),
  ...(w.memo ? { memo: w.memo } : {}),
});

export const downloadJSON = (data: unknown, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
