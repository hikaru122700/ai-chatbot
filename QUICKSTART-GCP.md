# 🚀 クイックスタート - GCPデプロイ

最も簡単な方法でAIチャットボットをGCPにデプロイします。

## 推奨方法: Google Cloud Shell を使用

Google Cloud Shellを使えば、gcloud CLIのインストールが不要で、すぐにデプロイできます。

### ステップ1: Cloud Shellを開く

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. プロジェクトを`bright-practice-444611-p4`に切り替え
3. 右上の「Cloud Shellをアクティブにする」ボタンをクリック

### ステップ2: コードをアップロード

Cloud Shellで以下を実行：

```bash
# 作業ディレクトリを作成
mkdir -p ~/chatbot
cd ~/chatbot

# ファイルをアップロード（Cloud Shellのメニューから「ファイルをアップロード」を選択）
# または、GitHubにプッシュしてclone
```

**オプション: ローカルからファイルを転送**
Cloud Shellのメニュー > ファイルをアップロード で以下をアップロード：
- プロジェクトのすべてのファイル（node_modulesと.nextを除く）

### ステップ3: デプロイスクリプトを実行

```bash
# スクリプトに実行権限を付与
chmod +x deploy-gcp.sh

# デプロイ実行
./deploy-gcp.sh
```

スクリプトが以下を自動実行します：
1. 必要なAPIを有効化
2. Cloud SQLインスタンスを作成
3. データベースとユーザーを作成
4. Cloud Runにデプロイ

途中でOpenAI APIキーの入力を求められます。

### ステップ4: データベースマイグレーション

デプロイ完了後、マイグレーションを実行：

```bash
# 接続名を取得（deploy-gcp.shの出力に表示されています）
CONNECTION_NAME=$(gcloud sql instances describe chatbot-db --format="value(connectionName)")

# Cloud SQL Proxyをバックグラウンドで起動
cloud-sql-proxy $CONNECTION_NAME &

# 少し待つ（Proxyの起動を待つ）
sleep 5

# DATABASE_URLを設定（パスワードはdeploy-gcp.shの出力から取得）
export DATABASE_URL="postgresql://chatbot-user:YOUR_PASSWORD@127.0.0.1:5432/chatbot"

# マイグレーション実行
cd ~/chatbot
npx prisma migrate deploy
```

### ステップ5: 確認

```bash
# サービスURLを取得
gcloud run services describe ai-chatbot \
    --platform managed \
    --region asia-northeast1 \
    --format 'value(status.url)'
```

表示されたURLをブラウザで開いてアクセス！

---

## 代替方法: ワンライナーデプロイ

必要なAPIが有効化済みの場合、以下のコマンドで直接デプロイできます：

```bash
# 変数を設定
export PROJECT_ID="bright-practice-444611-p4"
export REGION="asia-northeast1"
export OPENAI_API_KEY="your-api-key-here"
export DB_PASSWORD=$(openssl rand -base64 32)

# Cloud SQLインスタンス作成
gcloud sql instances create chatbot-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=$REGION \
    --root-password=$(openssl rand -base64 32) \
    --project=$PROJECT_ID

# データベース作成
gcloud sql databases create chatbot \
    --instance=chatbot-db \
    --project=$PROJECT_ID

# ユーザー作成
gcloud sql users create chatbot-user \
    --instance=chatbot-db \
    --password=$DB_PASSWORD \
    --project=$PROJECT_ID

# 接続名を取得
CONNECTION_NAME=$(gcloud sql instances describe chatbot-db --format="value(connectionName)" --project=$PROJECT_ID)

# DATABASE_URLを構築
DATABASE_URL="postgresql://chatbot-user:$DB_PASSWORD@/chatbot?host=/cloudsql/$CONNECTION_NAME"

# Cloud Runにデプロイ
gcloud run deploy ai-chatbot \
    --source . \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars "OPENAI_API_KEY=$OPENAI_API_KEY,POSTGRES_PRISMA_URL=$DATABASE_URL,POSTGRES_URL_NON_POOLING=$DATABASE_URL,DATABASE_URL=$DATABASE_URL" \
    --add-cloudsql-instances $CONNECTION_NAME \
    --memory 512Mi \
    --port 8080 \
    --project=$PROJECT_ID

echo "✅ デプロイ完了!"
echo "🔑 DBパスワード: $DB_PASSWORD"
echo "保存してください！"
```

---

## トラブルシューティング

### エラー: API not enabled

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
```

### エラー: Permission denied

プロジェクトの権限を確認してください（Editor以上が必要）

### デプロイが遅い

初回デプロイは10-15分かかることがあります。Cloud Buildのログを確認：

```bash
gcloud builds list --limit=5
```

### データベース接続エラー

1. Cloud SQLインスタンスが実行中か確認
2. 環境変数が正しいか確認
3. マイグレーションが実行されているか確認

---

## 次のステップ

1. **カスタムドメインを設定**
   ```bash
   gcloud run services update ai-chatbot \
       --region=asia-northeast1 \
       --platform=managed \
       --allow-unauthenticated \
       --domain=yourdomain.com
   ```

2. **シークレットマネージャーを使用**
   ```bash
   echo -n "$OPENAI_API_KEY" | gcloud secrets create anthropic-api-key --data-file=-
   ```

3. **モニタリングを設定**
   - Cloud Consoleでメトリクスを確認
   - アラートを設定

---

**必要な情報:**
- OpenAI APIキー: https://platform.openai.com/api-keys
- GCPプロジェクトID: `bright-practice-444611-p4`

**推定デプロイ時間:** 10-15分
**推定コスト:** 月$10-20（低トラフィック時）
