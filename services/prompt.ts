import { World } from '../types';

export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

export const buildSystemInstruction = (world: World): string => {
  const charactersDesc = (world.characters || []).map(c =>
    `- 名前: ${c.name}\n  特徴: ${c.tagline}\n  性格・詳細: ${c.description}`
  ).join('\n\n');

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

    【基本指示】
    1. あなたは状況描写（ナレーション）と、その場にいるNPCのセリフを出力します。
    2. NPCが話すときは、必ず「[キャラクター名]: セリフ」の形式で出力してください。
    3. 誰が話しているか明確にするため、セリフの前に必ず名前をつけてください。
    4. ナレーションは特定の形式なしで記述してください。
    5. 基本的に日本語で応答してください。

    【重要な制約事項（厳守）】
    ・**物語を勝手に進めすぎないでください。** ユーザーの入力に対する「直後のリアクション（NPCの反応や状況の変化）」のみを描写し、必ずそこで出力を止めてください。
    ・**ユーザー（主人公）の行動、発言、感情、思考を勝手に描写しないでください。** これは絶対禁止です（God Moddingの禁止）。
    ・一度の出力で解決しようとせず、ユーザーとの対話のキャッチボール（ターン制）を維持してください。
    ・ユーザーが介入する余地を残すため、シーンを完結させすぎないようにしてください。

    最初のメッセージは、この世界の導入（ナレーション）と、主人公が最初に遭遇する状況、あるいはNPCからの呼びかけから始めてください。
  `;
};

export const GENERATION_CONFIG = {
  temperature: 1.0,
  topK: 40,
  topP: 0.95,
};

export const friendlyErrorMessage = (error: any): string => {
  const msg: string = error?.message || String(error || 'エラーが発生しました');
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded') || error?.status === 429) {
    return 'APIの無料利用枠（クォータ上限）に達しました。時間をおいて再度お試しください。';
  }
  if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid') || error?.status === 400 && msg.includes('key')) {
    return 'APIキーが正しくありません。右上の「APIキー設定」から確認してください。';
  }
  return msg;
};
