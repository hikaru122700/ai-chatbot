# AIチャットボット 実行計画 & TODOリスト

**プロジェクト**: AIチャットボット（学習用）
**作成日**: 2025-12-19
**技術スタック**: Next.js + TypeScript + Tailwind CSS + Claude API + Vercel Postgres

---

## 📋 進捗サマリー

- [x] **フェーズ1**: プロジェクトセットアップ (8/8)
- [x] **フェーズ2**: データベース設計・実装 (6/6)
- [x] **フェーズ3**: バックエンドAPI実装 (8/8)
- [x] **フェーズ4**: フロントエンドコンポーネント実装 (11/12)
- [x] **フェーズ5**: UI/UX改善 (7/7)
- [ ] **フェーズ6**: テスト・品質保証 (0/6)
- [ ] **フェーズ7**: デプロイ・本番環境構築 (0/5)

**全体進捗**: 40/52 タスク完了

---

## フェーズ1: プロジェクトセットアップ

### 1.1 環境構築

- \[ \] Node\.js 18\.17以上がインストールされているか確認
  ```bash
  node --version
  ```

- \[ \] Next\.jsプロジェクトを作成
  ```bash
  npx create-next-app@latest chatbot --typescript --tailwind --app
  cd chatbot
  ```

- \[ \] 必要な依存パッケージをインストール
  ```bash
  npm install @anthropic-ai/sdk
  npm install @vercel/postgres
  npm install prisma @prisma/client
  npm install react-markdown remark-gfm
  npm install -D prisma
  ```

### 1.2 プロジェクト設定

- \[ \] `\.env\.local`ファイルを作成し、環境変数のテンプレートを追加
  ```env
  ANTHROPIC_API_KEY=your-api-key-here
  POSTGRES_URL=your-postgres-url
  POSTGRES_PRISMA_URL=your-postgres-prisma-url
  POSTGRES_URL_NON_POOLING=your-postgres-non-pooling-url
  ```

- \[ \] `\.gitignore`に`\.env\.local`が含まれていることを確認

- \[ \] Prismaを初期化
  ```bash
  npx prisma init
  ```

- \[ \] `next\.config\.js`を設定（必要に応じて）

- \[ \] Tailwind CSSの設定を確認・カスタマイズ（`tailwind\.config\.js`）

---

## フェーズ2: データベース設計・実装

### 2.1 Prismaスキーマ作成

- \[ \] `prisma/schema\.prisma`にConversationモデルを定義
  ```prisma
  model Conversation {
    id        String    @id @default(uuid())
    title     String
    messages  Message[]
    createdAt DateTime  @default(now())
    updatedAt DateTime  @updatedAt
  }
  ```

- \[ \] `prisma/schema\.prisma`にMessageモデルを定義
  ```prisma
  model Message {
    id             String       @id @default(uuid())
    conversationId String
    conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
    role           String
    content        String       @db.Text
    createdAt      DateTime     @default(now())

    @@index([conversationId])
  }
  ```

### 2.2 データベースマイグレーション

- \[ \] ローカル開発用のデータベース接続を設定（`\.env\.local`）

- \[ \] 初回マイグレーションを実行
  ```bash
  npx prisma migrate dev --name init
  ```

- \[ \] Prisma Clientを生成
  ```bash
  npx prisma generate
  ```

- \[ \] Prisma Studioでデータベースを確認（オプション）
  ```bash
  npx prisma studio
  ```

---

## フェーズ3: バックエンドAPI実装

### 3.1 ユーティリティ・ライブラリ作成

- \[ \] `app/lib/db\.ts`を作成してPrismaクライアントをエクスポート
  ```typescript
  import { PrismaClient } from '@prisma/client';

  const globalForPrisma = global as unknown as { prisma: PrismaClient };

  export const prisma = globalForPrisma.prisma || new PrismaClient();

  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
  ```

- \[ \] `app/lib/anthropic\.ts`を作成してClaude APIクライアントを設定
  ```typescript
  import Anthropic from '@anthropic-ai/sdk';

  export const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  ```

- \[ \] `app/lib/utils\.ts`を作成してヘルパー関数を追加（必要に応じて）

### 3.2 APIルート実装

- \[ \] `app/api/chat/route\.ts`を作成してチャットAPIを実装
  - リクエストボディからメッセージとconversationIdを取得
  - 新規会話の場合、Conversationを作成
  - データベースにユーザーメッセージを保存
  - Claude APIにストリーミングリクエストを送信
  - ストリーミングレスポンスをクライアントに転送
  - アシスタントの応答をデータベースに保存

- \[ \] `app/api/conversations/route\.ts`を作成
  - GET: 全会話履歴の一覧を取得
  - 各会話のメッセージ数もカウントして返す

- \[ \] `app/api/conversations/\[id\]/route\.ts`を作成
  - GET: 特定の会話とそのメッセージ履歴を取得
  - DELETE: 特定の会話を削除（カスケード削除でメッセージも削除）

### 3.3 エラーハンドリング

- \[ \] 各APIルートに適切なエラーハンドリングを実装
  - APIキーが設定されていない場合のエラー
  - データベース接続エラー
  - Claude APIエラー
  - 不正なリクエストパラメータ

- \[ \] レート制限の実装（オプション：後で追加可能）

---

## フェーズ4: フロントエンドコンポーネント実装

### 4.1 基本コンポーネント作成

- \[ \] `app/components/MessageInput\.tsx`を作成
  - テキストエリアとフォーム
  - 送信ボタン
  - ローディング状態の処理
  - Enterキーでの送信（Shift+Enterで改行）

- \[ \] `app/components/MessageList\.tsx`を作成
  - メッセージの一覧表示
  - ユーザーとアシスタントのメッセージを区別
  - 自動スクロール（最新メッセージが見える）
  - ストリーミング中の表示

- \[ \] `app/components/MarkdownRenderer\.tsx`を作成
  - `react-markdown`を使用
  - コードブロックのシンタックスハイライト
  - リンク、リスト、見出しのスタイリング

- \[ \] `app/components/ConversationHistory\.tsx`を作成
  - 会話履歴の一覧表示
  - 新規会話ボタン
  - 会話選択機能
  - 会話削除ボタン

### 4.2 メインインターフェース

- \[ \] `app/components/ChatInterface\.tsx`を作成
  - MessageList、MessageInput、ConversationHistoryを統合
  - 状態管理（現在の会話、メッセージ、ローディング状態）
  - APIとの通信ロジック
  - ストリーミングレスポンスの処理

- \[ \] `app/page\.tsx`を更新
  - ChatInterfaceコンポーネントを配置
  - レイアウト設定

- \[ \] `app/layout\.tsx`を更新
  - メタデータ設定
  - グローバルスタイル
  - フォント設定

### 4.3 状態管理

- \[ \] Reactの`useState`と`useEffect`でローカル状態を管理
  - 現在の会話ID
  - メッセージ配列
  - ローディング状態
  - エラー状態

- \[ \] 必要に応じてContext APIを導入（ダークモード切り替え用）

### 4.4 ストリーミング実装

- \[ \] フロントエンドでServer-Sent Events \(SSE\)またはストリーミングFetch APIを処理
  - チャンクごとにメッセージを更新
  - リアルタイムでUIを更新

- \[ \] ストリーミング中のローディングインジケーター表示

---

## フェーズ5: UI/UX改善

### 5.1 スタイリング

- \[ \] Tailwind CSSでレスポンシブレイアウトを実装
  - モバイル（< 768px）: サイドバーをハンバーガーメニュー化
  - タブレット（768px - 1024px）: 縮小サイドバー
  - デスクトップ（> 1024px）: フルレイアウト

- \[ \] メッセージの吹き出しデザインを作成
  - ユーザーメッセージ: 右寄せ、青系
  - アシスタントメッセージ: 左寄せ、グレー系

- \[ \] ナビゲーションバーのデザイン
  - アプリ名/ロゴ
  - ダークモード切り替えボタン

### 5.2 ダークモード実装

- \[ \] `next-themes`をインストール
  ```bash
  npm install next-themes
  ```

- \[ \] ダークモード対応のTailwind設定
  - `tailwind.config.js`に`darkMode: 'class'`を追加

- \[ \] ダークモード切り替えボタンの実装

### 5.3 アニメーション・インタラクション

- \[ \] メッセージ表示時のフェードインアニメーション

- \[ \] ホバー・フォーカス時のインタラクティブな効果

- \[ \] ローディングスピナーやスケルトンスクリーンの追加

### 5.4 エラー表示

- \[ \] エラーメッセージのトースト通知またはアラート表示
  - APIエラー
  - ネットワークエラー
  - バリデーションエラー

---

## フェーズ6: テスト・品質保証

### 6.1 手動テスト

- [ ] チャットメッセージの送受信が正常に動作するか確認

- [ ] ストリーミングレスポンスがリアルタイムで表示されるか確認

- [ ] 会話履歴の保存・読み込みが正常に動作するか確認

- [ ] 会話の削除機能が正常に動作するか確認

- [ ] レスポンシブデザインの確認（モバイル、タブレット、デスクトップ）

- [ ] ダークモード切り替えの動作確認

### 6.2 バグ修正・リファクタリング

- [ ] 発見したバグを修正

- [ ] コードのリファクタリング（必要に応じて）

- [ ] パフォーマンス最適化（必要に応じて）

---

## フェーズ7: デプロイ・本番環境構築

### 7.1 Vercel Postgresセットアップ

- [ ] Vercelにプロジェクトをインポート
  - GitHubリポジトリと連携（推奨）

- [ ] Vercel Postgresデータベースを作成
  - Vercelダッシュボード → Storage → Create Database → Postgres

- [ ] データベース環境変数が自動設定されていることを確認

### 7.2 環境変数設定

- [ ] Vercelダッシュボードで環境変数を設定
  - `ANTHROPIC_API_KEY`: Claude APIキー
  - （POSTGRES_URL等はVercel Postgresから自動設定）

- [ ] 本番環境用のマイグレーション実行
  ```bash
  npx prisma migrate deploy
  ```

### 7.3 デプロイ

- [ ] Vercelで自動デプロイが成功することを確認

- [ ] デプロイされたアプリケーションの動作確認
  - チャット機能
  - 会話履歴保存
  - データベース接続

- [ ] 本番環境でのパフォーマンステスト

### 7.4 最終確認

- [ ] セキュリティチェック
  - API Keyが環境変数で管理されているか
  - .env.localがGit管理外か

- [ ] ドキュメント整備
  - README.mdの作成・更新
  - セットアップ手順の記載

---

## 追加タスク（優先度低）

### 将来的な拡張機能

- [ ] ファイルアップロード機能（画像解析）
- [ ] 複数のClaudeモデル選択機能
- [ ] プロンプトテンプレート機能
- [ ] 会話のエクスポート機能（JSON/Markdown）
- [ ] システムプロンプトのカスタマイズ
- [ ] ユーザー認証機能（将来的に）
- [ ] 会話のタイトル自動生成機能

---

## 📝 メモ・備考

### 重要なコマンド

```bash
# 開発サーバー起動
npm run dev

# Prismaマイグレーション
npx prisma migrate dev --name <migration-name>

# Prisma Studio起動
npx prisma studio

# ビルド
npm run build

# Vercelデプロイ
vercel
```

### トラブルシューティング

- **データベース接続エラー**: `.env.local`の環境変数を確認
- **Claude APIエラー**: APIキーが正しく設定されているか確認
- **ストリーミングが動作しない**: `next.config.js`で適切な設定がされているか確認

---

**最終更新日**: 2025-12-19
**進捗状況**: 準備完了 → 実装開始待ち
