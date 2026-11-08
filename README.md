# Persona.AI - 無限のストーリー

世界観・主人公・NPCを作って、AI（Gemini）がGMとなって物語を紡ぐロールプレイチャットです。

## 遊び方（ネット版）

1. GitHub Pages で公開されたページを開く
2. 右上の「APIキーを設定」から自分の Gemini APIキーを登録（[Google AI Studio](https://aistudio.google.com/apikey) で無料取得）
   - キーはあなたのブラウザの中にだけ保存されます
3. 「新しい世界を作る」から世界を作ってプレイ

## 自動セーブ

すべてブラウザ（localStorage）に自動で保存されます。

- ワールドと会話履歴（変更のたびに保存、タブを閉じる直前にも保存）
- 作成途中のワールド入力内容
- チャット欄に入力途中の文章
- 最後に開いていた画面（リロードしても続きから再開）

別の端末へ移すときは「保存 (JSON)」で書き出し →「インポート」で読み込めます。

## ローカルで動かす

```bash
npm install
npm run dev
```

`.env.local` などで `GEMINI_API_KEY` を設定すると、APIキー未入力でもサーバー経由で動きます。

## 公開（GitHub Pages）

`main` ブランチに push すると GitHub Actions が自動でビルド・公開します。
