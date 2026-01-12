# AI Chatbot

OpenAI API (GPT-4o) を使用したAIチャットボットアプリケーションです。

## 特徴

### 基本機能
- **リアルタイムストリーミング**: GPT-4oの応答をリアルタイムで表示
- **会話履歴管理**: データベースに会話を永続的に保存
- **レスポンシブデザイン**: モバイル、タブレット、デスクトップに対応
- **ダークモード対応**: 目に優しい表示切り替え
- **Markdownレンダリング**: コードブロックやリストなど、リッチな表示に対応

### オリジナル機能
- **キャラクター設定**: 名前、アバター、性格、話し方をカスタマイズ可能
- **画像アップロード・解析**: GPT-4o Visionで画像の内容を理解・説明
- **音声入力**: Web Speech APIによる音声認識（日本語対応）
- **音声読み上げ**: アシスタントのメッセージを読み上げ（TTS）
- **PDF・文書アップロード**: PDF、テキスト、Markdownファイルの内容を解析
- **楽しいUIアニメーション**: メッセージのスライドイン、グラデーション、ローディング演出

### セキュリティ
- **ユーザー側APIキー管理**: サーバーにAPIキーを保存せず、ユーザーが自分のキーを使用
- **SessionStorage保存**: ブラウザを閉じるとAPIキーが自動削除

## 技術スタック

- **フロントエンド**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **バックエンド**: Next.js API Routes
- **AI API**: OpenAI API (GPT-4o, GPT-4o Vision)
- **データベース**: PostgreSQL (Neon / Vercel Postgres)
- **ORM**: Prisma 6.x
- **PDF解析**: pdfjs-dist

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定してください：

```env
# Database URLs (PostgreSQL)
DATABASE_URL=your-postgres-url
DATABASE_URL_UNPOOLED=your-postgres-direct-url
```

> **注意**: `OPENAI_API_KEY`はサーバー側では不要です。ユーザーがブラウザで自分のAPIキーを入力します。

### 3. データベースのセットアップ

```bash
# Prisma Clientを生成
npx prisma generate

# マイグレーションを実行
npx prisma migrate dev --name init
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開いてください。

## 使い方

1. **APIキーの設定**: 右上の歯車アイコンをクリックし、OpenAI APIキーを入力
2. **キャラクター設定**: 左上のキャラクターボタンから名前・性格をカスタマイズ
3. **メッセージ送信**: テキストを入力してEnterまたは送信ボタンをクリック
4. **画像添付**: 画像アイコンをクリックして画像を選択
5. **音声入力**: マイクアイコンをクリックして話す
6. **PDF添付**: 文書アイコンをクリックしてPDF/テキストファイルを選択
7. **読み上げ**: アシスタントのメッセージのスピーカーアイコンをクリック

## デプロイ

### Vercelへのデプロイ

1. Vercelにプロジェクトをインポート
2. Neonでデータベースを作成し、環境変数を設定
3. デプロイ

```bash
# ワンコマンドでGitHub pushとVercelデプロイを実行
npm run deploy
```

このコマンドで以下が自動実行されます：
- すべての変更をステージング
- コミット作成
- GitHubにプッシュ
- Vercelに本番デプロイ

### 環境変数（Vercel）

| 変数名 | 説明 |
|--------|------|
| `DATABASE_URL` | PostgreSQL接続URL（プーリング） |
| `DATABASE_URL_UNPOOLED` | PostgreSQL直接接続URL |

## プロジェクト構成

```
ai-chatbot/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts              # チャットAPI（ストリーミング）
│   │   └── conversations/
│   │       ├── route.ts              # 会話一覧取得
│   │       └── [id]/
│   │           └── route.ts          # 特定会話の取得・削除
│   ├── components/
│   │   ├── ChatInterface.tsx         # メインチャットUI
│   │   ├── MessageList.tsx           # メッセージ一覧（TTS含む）
│   │   ├── MessageInput.tsx          # 入力フォーム（画像・音声・PDF）
│   │   ├── ConversationHistory.tsx   # 会話履歴サイドバー
│   │   ├── MarkdownRenderer.tsx      # Markdownレンダラー
│   │   ├── ApiKeyInput.tsx           # APIキー入力
│   │   └── CharacterSettings.tsx     # キャラクター設定
│   ├── lib/
│   │   ├── openai.ts                 # OpenAI設定
│   │   ├── db.ts                     # データベース接続
│   │   └── utils.ts                  # ユーティリティ関数
│   ├── globals.css                   # グローバルスタイル・アニメーション
│   ├── layout.tsx
│   └── page.tsx                      # メインページ
├── prisma/
│   └── schema.prisma                 # データベーススキーマ
└── public/
```

## API仕様

### POST /api/chat

チャットメッセージを送信し、ストリーミングレスポンスを受信します。

**ヘッダー**:
```
X-API-Key: your-openai-api-key
```

**リクエスト**:
```json
{
  "conversationId": "uuid-string",
  "message": "ユーザーのメッセージ",
  "images": [{"base64": "...", "type": "image/jpeg", "name": "photo.jpg"}],
  "systemPrompt": "キャラクター設定プロンプト"
}
```

**レスポンス**: Server-Sent Events形式でストリーミング

### GET /api/conversations

会話履歴の一覧を取得します。

### GET /api/conversations/[id]

特定の会話とメッセージ履歴を取得します。

### DELETE /api/conversations/[id]

特定の会話を削除します。

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# Lint
npm run lint

# Prisma Studio（DB確認）
npx prisma studio

# デプロイ（GitHub + Vercel）
npm run deploy
```

## トラブルシューティング

### APIキーエラー
- 設定モーダルでOpenAI APIキーが正しく入力されているか確認
- APIキーの有効期限やクレジット残高を確認

### データベース接続エラー
- `.env.local`の`DATABASE_URL`が正しく設定されているか確認
- Neon/Vercel Postgresが起動しているか確認

### 画像アップロードエラー
- 画像サイズが大きすぎないか確認（推奨: 5MB以下）
- 対応形式: JPEG, PNG, GIF, WebP

### PDF解析エラー
- PDFにテキストが含まれているか確認（画像のみのPDFは非対応）
- ファイルが破損していないか確認

## ライセンス

MIT

## 作成者

Claude Code
