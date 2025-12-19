# ⚠️ セキュリティ警告 - 重要

## APIキーのセキュリティについて

**重要**: APIキーは機密情報です。絶対に公開しないでください。

## すぐに実行してください

### 1. このAPIキーを無効化

1. [OpenAI API Keys](https://platform.openai.com/api-keys) にアクセス
2. このAPIキーを見つけて**削除**
3. 新しいAPIキーを生成

### 2. 新しいAPIキーを安全に設定

```bash
# .env.localファイルを編集
OPENAI_API_KEY=your-new-api-key-here
```

### 3. APIキーを絶対に公開しない

- ❌ チャットやメッセージで共有しない
- ❌ Gitにコミットしない
- ❌ スクリーンショットを撮らない
- ✅ 環境変数として設定する
- ✅ `.env.local`は`.gitignore`に含める

## なぜ危険なのか

公開されたAPIキーは：
- ✗ 第三者があなたのアカウントでAPIを使用できる
- ✗ 大量のリクエストで高額な請求が発生する可能性
- ✗ アカウントが不正利用される可能性

## 正しいAPIキーの管理方法

### ローカル開発

```bash
# .env.localファイルに保存（Gitにコミットしない）
OPENAI_API_KEY=sk-...
```

### 本番環境（GCP）

```bash
# Secret Managerを使用
echo -n "your-api-key" | gcloud secrets create openai-api-key --data-file=-

# Cloud Runで使用
gcloud run services update ai-chatbot \
    --region=asia-northeast1 \
    --set-secrets="OPENAI_API_KEY=openai-api-key:latest"
```

## チェックリスト

- [ ] 公開されたAPIキーを削除した
- [ ] 新しいAPIキーを生成した
- [ ] `.env.local`に新しいAPIキーを設定した
- [ ] `.env.local`が`.gitignore`に含まれていることを確認した
- [ ] OpenAIの請求設定で使用制限を設定した

## OpenAI請求設定

1. [OpenAI Billing](https://platform.openai.com/account/billing/overview) にアクセス
2. 使用上限を設定（例: $10/月）
3. アラートを設定

---

**重要**: このファイルを読んだら、すぐにAPIキーを無効化してください！
