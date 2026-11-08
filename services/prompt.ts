import { World, Message, StorySettings, DEFAULT_SETTINGS } from '../types';

export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

/** 物語を始めるときにAIへ送る（画面には出さない）指示 */
export const INTRO_PROMPT = 'ストーリーを開始してください。導入のナレーションと、最初の状況を描写してください。';

const LENGTH_RULES: Record<StorySettings['responseLength'], string> = {
  short: '1回の返答は短め（150〜250文字程度）にしてください。',
  normal: '1回の返答は300〜500文字程度にしてください。',
  long: '1回の返答はじっくり長め（600〜900文字程度）にしてください。',
};

const STYLE_RULES: Record<StorySettings['style'], string> = {
  balanced: 'ナレーションとセリフをバランスよく織り交ぜてください。',
  novel: '小説のように情景・心情描写を豊かに、ナレーションを多めにしてください。',
  dialogue: 'NPCのセリフ（会話）を中心に、ナレーションは短めにしてください。',
};

export const buildSystemInstruction = (world: World, settings: StorySettings = DEFAULT_SETTINGS): string => {
  const charactersDesc = (world.characters || []).map(c =>
    `- 名前: ${c.name}\n  特徴: ${c.tagline}\n  性格・詳細: ${c.description}`
  ).join('\n\n');

  const summaryBlock = world.summary
    ? `\n    【これまでのあらすじ（古い会話の要約）】\n    ${world.summary}\n`
    : '';

  return `
    あなたはゲームマスター(GM)であり、以下の世界観における全てのNPCを演じます。

    【世界観・設定】
    タイトル: ${world.title}
    詳細: ${world.setting}

    【主人公（ユーザー）】
    名前: ${world.protagonist?.name || ''}
    設定: ${world.protagonist?.description || ''}

    【登場キャラクター (NPC)】
    ${charactersDesc}
${summaryBlock}
    【基本指示】
    1. あなたは状況描写（ナレーション）と、その場にいるNPCのセリフを出力します。
    2. NPCが話すときは、必ず行頭に「[キャラクター名]: セリフ」の形式で出力してください。
    3. 誰が話しているか明確にするため、セリフの前に必ず名前をつけてください。
    4. ナレーションは特定の形式なしで記述し、ナレーションの行頭に「名前:」のような書き方はしないでください。
    5. 基本的に日本語で応答してください。
    6. ${LENGTH_RULES[settings.responseLength] || LENGTH_RULES.normal}
    7. ${STYLE_RULES[settings.style] || STYLE_RULES.balanced}

    【重要な制約事項（厳守）】
    ・**物語を勝手に進めすぎないでください。** ユーザーの入力に対する「直後のリアクション（NPCの反応や状況の変化）」のみを描写し、必ずそこで出力を止めてください。
    ・**ユーザー（主人公）の行動、発言、感情、思考を勝手に描写しないでください。** これは絶対禁止です（God Moddingの禁止）。
    ・一度の出力で解決しようとせず、ユーザーとの対話のキャッチボール（ターン制）を維持してください。
    ・ユーザーが介入する余地を残すため、シーンを完結させすぎないようにしてください。

    最初のメッセージは、この世界の導入（ナレーション）と、主人公が最初に遭遇する状況、あるいはNPCからの呼びかけから始めてください。
  `;
};

export const generationConfig = (settings: StorySettings = DEFAULT_SETTINGS) => ({
  temperature: Math.min(2, Math.max(0, settings.temperature ?? 1)),
  topK: 40,
  topP: 0.95,
});

/** Gemini に渡す会話履歴を作る（必ずユーザーの発言から始まるようにする） */
export const toGeminiHistory = (history: Message[]) => {
  const items = history
    .filter(m => m.text.trim())
    .map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.text }] }));
  if (items.length > 0 && items[0].role === 'model') {
    items.unshift({ role: 'user', parts: [{ text: INTRO_PROMPT }] });
  }
  return items;
};

export const buildSummaryPrompt = (world: World, previousSummary: string | undefined, messages: Message[]) => {
  const log = messages
    .map(m => (m.role === 'user' ? `【${world.protagonist?.name || '主人公'}】${m.text}` : m.text))
    .join('\n\n');
  return `以下はロールプレイ「${world.title}」の会話ログです。今後の物語を続けるために必要な情報（起きた出来事、登場人物の関係や感情の変化、約束・伏線、所持品、現在地など）を漏らさず、日本語で簡潔なあらすじ（800文字以内）にまとめてください。あらすじ本文だけを出力してください。

${previousSummary ? `【これまでのあらすじ】\n${previousSummary}\n\n` : ''}【続きの会話ログ】
${log}`;
};

export const friendlyErrorMessage = (error: any): string => {
  const msg: string = error?.message || String(error || 'エラーが発生しました');
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded') || error?.status === 429) {
    return 'APIの無料利用枠（クォータ上限）に達しました。少し時間をおいて再送信してください。';
  }
  if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
    return 'APIキーが正しくありません。「設定」からAPIキーを確認してください。';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return '通信に失敗しました。ネット接続を確認して再送信してください。';
  }
  return msg;
};
