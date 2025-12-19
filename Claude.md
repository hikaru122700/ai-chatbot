# AIチャットボット 要件定義書

## 1. プロジェクト概要

### 1.1 目的
個人の学習・練習用AIチャットボットアプリケーションの開発

### 1.2 プロジェクトの特徴
- OpenAI API（Sonnet 4.5）を使用したインテリジェントな対話システム
- リアルタイムストリーミングレスポンスによる快適なユーザー体験
- 会話履歴の永続化による継続的な学習体験

---

## 2. 技術スタック

### 2.1 フロントエンド
- **フレームワーク**: Next.js (App Router推奨)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS
- **状態管理**: React Hooks / Context API

### 2.2 バックエンド
- **ランタイム**: Next.js API Routes / Server Actions
- **言語**: TypeScript
- **AI API**: OpenAI API (claude-sonnet-4-5-20250929)

### 2.3 データベース
- **種類**: Vercel Postgres (PostgreSQL)
- **ORM**: Prisma または Drizzle ORM（推奨）

### 2.4 デプロイ
- **プラットフォーム**: Vercel
- **環境変数管理**: Vercel Environment Variables

---

## 3. 機能要件

### 3.1 必須機能

#### 3.1.1 チャット機能
- ユーザーがテキストメッセージを入力可能
- OpenAI APIへのメッセージ送信
- ストリーミングレスポンスのリアルタイム表示
- Markdown形式のレスポンス表示（コードブロック、リストなど）

#### 3.1.2 会話履歴管理
- 会話セッションの作成
- 過去の会話履歴の保存（データベース）
- 会話履歴の一覧表示
- 過去の会話の閲覧
- 会話の削除機能

#### 3.1.3 UI/UX
- レスポンシブデザイン（モバイル・タブレット・デスクトップ対応）
- ダークモード/ライトモード切り替え
- メッセージ送信中のローディング表示
- エラーハンドリングとユーザーへのフィードバック

### 3.2 将来的な拡張候補
- ファイルアップロード機能（画像解析）
- 複数のClaudeモデル選択機能
- プロンプトテンプレート機能
- 会話のエクスポート機能（JSON/Markdown）
- システムプロンプトのカスタマイズ

---

## 4. 非機能要件

### 4.1 パフォーマンス
- ストリーミングレスポンスの開始: 2秒以内
- 初回ページロード: 3秒以内
- データベースクエリ: 500ms以内

### 4.2 セキュリティ
- API Keyの環境変数管理（.envファイル、Vercel環境変数）
- レート制限の実装（API乱用防止）
- XSS対策（入力のサニタイゼーション）

### 4.3 可用性
- Vercelによる99.9%のアップタイム
- エラー発生時の適切なフォールバック

---

## 5. システムアーキテクチャ

### 5.1 全体構成
```
[ブラウザ]
    ↓
[Next.js Frontend (React)]
    ↓
[Next.js API Routes / Server Actions]
    ↓
[OpenAI API] + [Vercel Postgres]
```

### 5.2 ディレクトリ構成（推奨）
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
│   │   ├── anthropic.ts           # OpenAI APIクライアント
│   │   ├── db.ts                  # データベース接続
│   │   └── utils.ts               # ユーティリティ関数
│   ├── layout.tsx
│   └── page.tsx                   # メインページ
├── prisma/
│   └── schema.prisma              # データベーススキーマ
├── public/
├── .env.local
├── next.config.js
├── tailwind.config.js
└── package.json
```

---

## 6. データベーススキーマ

### 6.1 テーブル設計

#### conversations テーブル
```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### messages テーブル
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

### 6.2 Prismaスキーマ例
```prisma
model Conversation {
  id        String    @id @default(uuid())
  title     String
  messages  Message[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Message {
  id             String       @id @default(uuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           String       // 'user' or 'assistant'
  content        String       @db.Text
  createdAt      DateTime     @default(now())

  @@index([conversationId])
}
```

---

## 7. API設計

### 7.1 POST /api/chat
**概要**: チャットメッセージの送信とストリーミングレスポンス

**リクエスト**:
```json
{
  "conversationId": "uuid-string", // オプション。新規の場合はnull
  "message": "ユーザーのメッセージ",
  "model": "claude-sonnet-4-5-20250929"
}
```

**レスポンス**:
- Content-Type: `text/event-stream`
- ストリーミング形式でClaudeの応答を返す

### 7.2 GET /api/conversations
**概要**: 会話履歴の一覧取得

**レスポンス**:
```json
{
  "conversations": [
    {
      "id": "uuid",
      "title": "会話タイトル",
      "createdAt": "2025-12-19T00:00:00Z",
      "updatedAt": "2025-12-19T00:00:00Z",
      "messageCount": 10
    }
  ]
}
```

### 7.3 GET /api/conversations/[id]
**概要**: 特定の会話とメッセージ履歴の取得

**レスポンス**:
```json
{
  "id": "uuid",
  "title": "会話タイトル",
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "メッセージ内容",
      "createdAt": "2025-12-19T00:00:00Z"
    }
  ]
}
```

### 7.4 DELETE /api/conversations/[id]
**概要**: 会話の削除

**レスポンス**:
```json
{
  "success": true
}
```

---

## 8. OpenAI API統合

### 8.1 使用モデル
- **モデル名**: `claude-sonnet-4-5-20250929`
- **特徴**: バランスの良い性能とコスト

### 8.2 ストリーミング実装
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.OPENAI_API_KEY,
});

const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 4096,
  messages: messages,
});

for await (const chunk of stream) {
  // ストリーミングデータの処理
}
```

### 8.3 会話コンテキストの管理
- データベースから過去のメッセージを取得
- OpenAI APIのmessages配列に変換
- 適切なトークン数制限内に収める（コンテキストウィンドウ管理）

---

## 9. UI/UX要件

### 9.1 レイアウト
```
┌─────────────────────────────────────────┐
│  [ナビゲーションバー]                      │
├───────────┬─────────────────────────────┤
│           │                             │
│  会話履歴  │    メインチャットエリア       │
│  サイドバー │                             │
│           │  [メッセージ一覧]            │
│  - 会話1   │                             │
│  - 会話2   │                             │
│  - 会話3   │  ─────────────────────     │
│           │  [入力フォーム]              │
│  [新規]    │                             │
└───────────┴─────────────────────────────┘
```

### 9.2 デザイン要素
- **カラースキーム**:
  - ライトモード: 白ベース、アクセントカラー（青系）
  - ダークモード: グレー/黒ベース
- **フォント**: システムフォント（Inter, SF Pro, など）
- **アニメーション**: スムーズなトランジション、マイクロインタラクション

### 9.3 レスポンシブ対応
- **モバイル（< 768px）**: サイドバーをハンバーガーメニュー化
- **タブレット（768px - 1024px）**: 縮小サイドバー
- **デスクトップ（> 1024px）**: フルレイアウト表示

---

## 10. 開発環境セットアップ

### 10.1 必要な環境
- Node.js 18.17以上
- npm/yarn/pnpm
- Git

### 10.2 セットアップ手順
```bash
# プロジェクト作成
npx create-next-app@latest chatbot --typescript --tailwind --app

# 依存関係インストール
cd chatbot
npm install @anthropic-ai/sdk @vercel/postgres prisma @prisma/client
npm install -D prisma

# Prisma初期化
npx prisma init

# 環境変数設定
# .env.localファイルを作成し、以下を設定
# OPENAI_API_KEY=your-api-key
# POSTGRES_URL=your-database-url

# データベースマイグレーション
npx prisma migrate dev --name init

# 開発サーバー起動
npm run dev
```

### 10.3 環境変数
```.env
OPENAI_API_KEY=sk-ant-xxxxx
POSTGRES_URL=postgres://...
POSTGRES_PRISMA_URL=postgres://...
POSTGRES_URL_NON_POOLING=postgres://...
```

---

## 11. デプロイ手順

### 11.1 Vercelデプロイ
```bash
# Vercel CLIインストール
npm install -g vercel

# ログイン
vercel login

# デプロイ
vercel

# 本番デプロイ
vercel --prod
```

### 11.2 環境変数設定
1. Vercelダッシュボードにアクセス
2. プロジェクト設定 → Environment Variables
3. 以下を設定:
   - `OPENAI_API_KEY`
   - `POSTGRES_URL`（Vercel Postgresから自動設定）

### 11.3 データベースセットアップ
```bash
# Vercel Postgres作成（Vercelダッシュボードから）
# または
vercel postgres create

# マイグレーション実行
npx prisma migrate deploy
```

---

## 12. テスト計画

### 12.1 単体テスト
- ユーティリティ関数のテスト
- APIルートのテスト
- コンポーネントのテスト（Jest + React Testing Library）

### 12.2 統合テスト
- OpenAI APIとの通信テスト
- データベース操作テスト
- エンドツーエンドフロー（Playwright/Cypress）

### 12.3 手動テスト項目
- [ ] チャットメッセージの送受信
- [ ] ストリーミングレスポンスの表示
- [ ] 会話履歴の保存・読み込み
- [ ] 会話の削除
- [ ] レスポンシブデザインの確認
- [ ] ダークモード切り替え
- [ ] エラーハンドリング

---

## 13. 開発スケジュール（目安）

### フェーズ1: 基本実装
- Next.jsプロジェクトセットアップ
- データベーススキーマ設計と実装
- 基本的なUI構築（Tailwind CSS）
- OpenAI APIの統合

### フェーズ2: 主要機能実装
- ストリーミングチャット機能
- 会話履歴の保存・読み込み
- サイドバー（会話履歴一覧）
- Markdownレンダリング

### フェーズ3: UI/UX改善
- レスポンシブデザイン対応
- ダークモード実装
- ローディング・エラー表示
- アニメーション追加

### フェーズ4: テスト・デプロイ
- テストコード作成
- バグ修正
- Vercelデプロイ
- 本番環境での動作確認

---

## 14. リスクと対策

### 14.1 技術的リスク
| リスク | 影響 | 対策 |
|--------|------|------|
| OpenAI API レート制限 | 高 | レート制限の実装、エラーハンドリング |
| ストリーミング実装の複雑さ | 中 | 公式SDKの使用、サンプルコード参照 |
| データベース接続エラー | 中 | 接続プーリング、リトライロジック |

### 14.2 コスト管理
- OpenAI API使用量の監視
- Vercel/Postgresの無料枠確認
- 必要に応じて使用制限の実装

---

## 15. 参考リンク

- [Next.js Documentation](https://nextjs.org/docs)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Vercel Documentation](https://vercel.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)

---

## 16. 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2025-12-19 | 1.0 | 初版作成 |

---

**作成日**: 2025-12-19
**作成者**: Claude Code
**プロジェクト名**: AIチャットボット（学習用）
