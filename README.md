# AI Chatbot

OpenAI API (GPT-4o) を使用した学習用AIチャットボットアプリケーションです。

## 特徴

- **リアルタイムストリーミング**: GPT-4oの応答をリアルタイムで表示
- **会話履歴管理**: データベースに会話を永続的に保存
- **レスポンシブデザイン**: モバイル、タブレット、デスクトップに対応
- **ダークモード対応**: 目に優しい表示切り替え
- **Markdownレンダリング**: コードブロックやリストなど、リッチな表示に対応

## 技術スタック

- **フロントエンド**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **バックエンド**: Next.js API Routes
- **AI API**: OpenAI API (GPT-4o)
- **データベース**: PostgreSQL (Cloud SQL / Vercel Postgres)
- **ORM**: Prisma

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local`ファイルを作成し、以下の環境変数を設定してください：

```env
# OpenAI API Key
OPENAI_API_KEY=your-api-key-here

# Database URLs (PostgreSQL)
POSTGRES_URL=your-postgres-url
POSTGRES_PRISMA_URL=your-postgres-prisma-url
POSTGRES_URL_NON_POOLING=your-postgres-non-pooling-url
POSTGRES_USER=your-user
POSTGRES_HOST=your-host
POSTGRES_PASSWORD=your-password
POSTGRES_DATABASE=your-database
```

### 3. データベースのセットアップ

```bash
# Prisma Clientを生成
npx prisma generate

# マイグレーションを実行（データベースが接続されている場合）
npx prisma migrate dev --name init
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開いてください。

## デプロイ

### Google Cloud Platform (GCP) へのデプロイ ⭐ 推奨

**クイックスタート**: [QUICKSTART-GCP.md](./QUICKSTART-GCP.md) を参照

1. [Google Cloud Console](https://console.cloud.google.com/)を開く
2. Cloud Shellをアクティブにする
3. プロジェクトファイルをアップロード
4. デプロイスクリプトを実行

```bash
chmod +x deploy-gcp.sh
./deploy-gcp.sh
```

詳細な手順: [DEPLOYMENT.md](./DEPLOYMENT.md)

**プロジェクトID**: `bright-practice-444611-p4`
**推定コスト**: 月$10-20

### Vercelへのデプロイ

1. Vercelにプロジェクトをインポート
2. Vercel Postgresデータベースを作成（Neon推奨）
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

**手動デプロイの場合:**
```bash
# Vercel CLIを使用する場合
vercel

# 本番デプロイ
vercel --prod
```

## プロジェクト構成

```
chatbot/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts          # チャットAPI（ストリーミング）
│   │   └── conversations/
│   │       ├── route.ts           # 会話一覧取得
│   │       └── [id]/
│   │           └── route.ts       # 特定会話の取得・削除
│   ├── components/
│   │   ├── ChatInterface.tsx      # メインチャットUI
│   │   ├── MessageList.tsx        # メッセージ一覧
│   │   ├── MessageInput.tsx       # 入力フォーム
│   │   ├── ConversationHistory.tsx# 会話履歴サイドバー
│   │   └── MarkdownRenderer.tsx   # Markdownレンダラー
│   ├── lib/
│   │   ├── anthropic.ts           # Claude APIクライアント
│   │   ├── db.ts                  # データベース接続
│   │   └── utils.ts               # ユーティリティ関数
│   ├── layout.tsx
│   └── page.tsx                   # メインページ
├── prisma/
│   └── schema.prisma              # データベーススキーマ
└── public/
```

## API仕様

### POST /api/chat

チャットメッセージを送信し、ストリーミングレスポンスを受信します。

**リクエスト**:
```json
{
  "conversationId": "uuid-string",  // オプション
  "message": "ユーザーのメッセージ"
}
```

**レスポンス**: Server-Sent Events形式でストリーミング

### GET /api/conversations

会話履歴の一覧を取得します。

### GET /api/conversations/[id]

特定の会話とメッセージ履歴を取得します。

### DELETE /api/conversations/[id]

特定の会話を削除します。

## 開発

### データベースの確認

```bash
# Prisma Studioを起動
npx prisma studio
```

### ビルド

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## トラブルシューティング

### データベース接続エラー

- `.env.local`の環境変数が正しく設定されているか確認してください
- PostgreSQLデータベースが起動しているか確認してください

### Claude APIエラー

- `ANTHROPIC_API_KEY`が正しく設定されているか確認してください
- APIキーの有効期限やクレジット残高を確認してください

## ライセンス

MIT

## 作成者

Claude Code
