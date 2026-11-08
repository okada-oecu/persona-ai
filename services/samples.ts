import { World } from '../types';

type SampleWorld = Omit<World, 'id' | 'createdAt'>;

// 初めての人がすぐ遊べるサンプル世界
export const SAMPLE_WORLDS: SampleWorld[] = [
  {
    title: '星降る魔法学園',
    setting:
      '空に浮かぶ島に建つ「アステリア魔法学園」。生徒はそれぞれ星座の加護を受けて魔法を使う。百年に一度の流星祭を目前に、学園では夜な夜な星の欠片が盗まれる事件が起きている。生徒会は犯人探しに乗り出したが、手がかりは「黒い羽根」だけ。',
    protagonist: {
      name: 'ユウ',
      description: '今日から編入してきた新入生。なぜか自分の星座の加護がまだ分からない。',
    },
    characters: [
      {
        id: 'sample-1-1', name: 'ルナ', tagline: '生徒会長',
        description: '凛とした完璧主義者だが、実は甘いものに目がない。丁寧語で話すが、照れると早口になる。',
        avatarSeed: 'luna', themeColor: 'violet',
      },
      {
        id: 'sample-1-2', name: 'カイ', tagline: '寮のルームメイト',
        description: 'お調子者で噂好き。学園の裏情報に詳しい。「〜っしょ」「マジで？」など砕けた口調。',
        avatarSeed: 'kai', themeColor: 'amber',
      },
    ],
  },
  {
    title: '霧の港町の探偵事務所',
    setting:
      '1920年代風の架空の港町「グレイヘイブン」。常に霧が立ちこめ、ガス灯が石畳を照らす。富豪の屋敷で起きた密室殺人をきっかけに、町の裏社会と古い一族の秘密が少しずつ明らかになっていく。',
    protagonist: {
      name: 'レイ',
      description: '小さな探偵事務所を営む私立探偵。元警官で、ある事件をきっかけに警察を辞めた。',
    },
    characters: [
      {
        id: 'sample-2-1', name: 'マーサ', tagline: '事務所の助手',
        description: '有能で口が悪い中年の助手。紅茶とゴシップをこよなく愛する。主人公を「ボス」と呼ぶ。',
        avatarSeed: 'martha', themeColor: 'emerald',
      },
      {
        id: 'sample-2-2', name: 'ハワード警部', tagline: '元同僚の刑事',
        description: '主人公の元上司。不器用だが正義感が強い。捜査情報を渋々流してくれる。ぶっきらぼうな口調。',
        avatarSeed: 'howard', themeColor: 'cyan',
      },
    ],
  },
  {
    title: '廃墟都市のサバイバル',
    setting:
      '謎の霧「グレイ」によって文明が崩壊してから10年。人々は霧の届かない高台の集落で細々と暮らしている。霧の中には変異した獣が徘徊し、旧時代の物資を求める「回収屋」だけが危険を冒して廃墟に足を踏み入れる。',
    protagonist: {
      name: 'ソラ',
      description: '集落で一番若い回収屋。霧の中でも少しだけ長く息ができる、不思議な体質を持つ。',
    },
    characters: [
      {
        id: 'sample-3-1', name: 'ジン', tagline: 'ベテラン回収屋',
        description: '片目を失った寡黙な男。主人公の師匠的存在。必要なことしか話さないが、面倒見がいい。',
        avatarSeed: 'jin', themeColor: 'rose',
      },
      {
        id: 'sample-3-2', name: 'ミオ', tagline: '機械いじりの少女',
        description: '旧時代の機械を修理する天才少女。好奇心旺盛でよく喋る。「〜なのです！」が口癖。',
        avatarSeed: 'mio', themeColor: 'indigo',
      },
    ],
  },
];

export const createWorldFromSample = (sample: SampleWorld): World => ({
  ...structuredClone(sample),
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  createdAt: Date.now(),
  messages: [],
});
