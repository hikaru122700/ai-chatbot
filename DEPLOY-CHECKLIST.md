# 🚀 GCPデプロイ チェックリスト

## デプロイ前の準備

- [ ] Anthropic APIキーを取得済み
  - https://platform.openai.com/api-keys でAPIキーを作成
  - キーを安全な場所に保存

- [ ] GCPプロジェクトへのアクセス権限を確認
  - プロジェクトID: `bright-practice-444611-p4`
  - 必要な権限: Editor以上

- [ ] 必要なファイルを確認
  - [ ] Dockerfile
  - [ ] .dockerignore
  - [ ] .gcloudignore
  - [ ] deploy-gcp.sh
  - [ ] すべてのアプリケーションコード

## デプロイ手順

### オプション1: Cloud Shell (推奨) ✅

1. [ ] [Google Cloud Console](https://console.cloud.google.com/)を開く
2. [ ] プロジェクトを`bright-practice-444611-p4`に切り替え
3. [ ] Cloud Shellをアクティブにする（右上のアイコン）
4. [ ] プロジェクトファイルをアップロード
   ```bash
   # Cloud Shellで
   mkdir -p ~/chatbot
   cd ~/chatbot
   # メニュー > ファイルをアップロード
   ```
5. [ ] デプロイスクリプトを実行
   ```bash
   chmod +x deploy-gcp.sh
   ./deploy-gcp.sh
   ```
6. [ ] Anthropic APIキーを入力（プロンプトが表示されたら）
7. [ ] デプロイ完了を待つ（10-15分）
8. [ ] 表示されたサービスURLを保存
9. [ ] データベースパスワードを安全に保存

### オプション2: ローカルから (gcloud CLIインストール済み)

1. [ ] gcloud CLIにログイン
   ```bash
   gcloud auth login
   gcloud config set project bright-practice-444611-p4
   ```
2. [ ] デプロイスクリプトを実行
   ```bash
   chmod +x deploy-gcp.sh
   ./deploy-gcp.sh
   ```

## デプロイ後の設定

### データベースマイグレーション

1. [ ] Cloud SQL Proxyを起動
   ```bash
   CONNECTION_NAME=$(gcloud sql instances describe chatbot-db --format="value(connectionName)")
   cloud-sql-proxy $CONNECTION_NAME &
   ```

2. [ ] マイグレーションを実行
   ```bash
   export DATABASE_URL="postgresql://chatbot-user:YOUR_PASSWORD@127.0.0.1:5432/chatbot"
   npx prisma migrate deploy
   ```

### 動作確認

- [ ] サービスURLにアクセス
- [ ] チャットメッセージを送信
- [ ] ストリーミングレスポンスが表示されることを確認
- [ ] 会話が保存されることを確認
- [ ] 新規会話を作成できることを確認

### ログ確認

```bash
gcloud run services logs read ai-chatbot \
    --region=asia-northeast1 \
    --limit=50
```

- [ ] エラーがないか確認
- [ ] 正常にリクエストが処理されているか確認

## セキュリティチェック

- [ ] APIキーが環境変数として設定されている（ハードコードされていない）
- [ ] データベースパスワードを安全に保存
- [ ] 不要なファイルがデプロイされていないか確認（.env.local等）

## オプション設定

### カスタムドメイン設定 (オプション)

```bash
gcloud run services update ai-chatbot \
    --region=asia-northeast1 \
    --platform=managed \
    --domain=yourdomain.com
```

### シークレットマネージャー使用 (推奨)

```bash
# APIキーをシークレットとして保存
echo -n "YOUR_API_KEY" | gcloud secrets create anthropic-api-key --data-file=-

# サービスアカウントに権限付与
PROJECT_NUMBER=$(gcloud projects describe bright-practice-444611-p4 --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding anthropic-api-key \
    --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# デプロイ時にシークレット使用
gcloud run services update ai-chatbot \
    --region=asia-northeast1 \
    --set-secrets="OPENAI_API_KEY=anthropic-api-key:latest"
```

### モニタリング設定

- [ ] Cloud Consoleでメトリクスダッシュボードを確認
- [ ] アラート設定（オプション）
  - リクエストエラー率
  - レスポンスタイム
  - メモリ使用率

## トラブルシューティング

### デプロイが失敗した場合

1. [ ] 最新のビルドログを確認
   ```bash
   gcloud builds list --limit=1
   gcloud builds log $(gcloud builds list --limit=1 --format="value(id)")
   ```

2. [ ] 必要なAPIが有効化されているか確認
   ```bash
   gcloud services list --enabled
   ```

3. [ ] 権限を確認
   ```bash
   gcloud projects get-iam-policy bright-practice-444611-p4
   ```

### データベース接続エラー

1. [ ] Cloud SQLインスタンスが実行中か確認
   ```bash
   gcloud sql instances describe chatbot-db
   ```

2. [ ] 接続名が正しいか確認
   ```bash
   gcloud sql instances describe chatbot-db --format="value(connectionName)"
   ```

3. [ ] 環境変数が正しく設定されているか確認
   ```bash
   gcloud run services describe ai-chatbot \
       --region=asia-northeast1 \
       --format="value(spec.template.spec.containers[0].env)"
   ```

## コスト管理

### 現在のコスト確認

- [ ] [Cloud Console - 請求](https://console.cloud.google.com/billing)でコスト確認
- [ ] 予算アラート設定（推奨）

### コスト削減オプション

- [ ] 使用しない時間帯にインスタンス数を減らす
  ```bash
  gcloud run services update ai-chatbot \
      --region=asia-northeast1 \
      --min-instances=0
  ```

- [ ] Cloud SQLのマシンタイプを確認（db-f1-microが最小）

## 完了！

✅ すべてのチェックリストが完了したら、デプロイ成功です！

**サービスURL**: _________________________
**DBパスワード**: _________________________ (安全に保管)
**デプロイ日**: _________________________

---

**サポート**: 問題が発生した場合は、DEPLOYMENT.mdの詳細ガイドを参照してください。
