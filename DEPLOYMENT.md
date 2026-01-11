# GCP デプロイメントガイド

このガイドでは、AIチャットボットをGoogle Cloud Platform (GCP)にデプロイする手順を説明します。

## プロジェクト情報

- **プロジェクトID**: `bright-practice-444611-p4`
- **リージョン**: `asia-northeast1` (東京)
- **サービス**: Cloud Run + Cloud SQL for PostgreSQL

## 前提条件

1. **Google Cloud SDK (gcloud CLI)** がインストールされていること
2. **Dockerがインストールされていること** (ローカルでビルドする場合)
3. **OpenAI API Key** を取得していること
4. **GCPプロジェクトの権限** があること (Editor以上)

## gcloud CLIのインストール

### Windows (WSL)

```bash
# Add Cloud SDK distribution URI as a package source
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list

# Import Google Cloud public key
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -

# Update and install
sudo apt-get update && sudo apt-get install google-cloud-cli
```

### macOS

```bash
brew install --cask google-cloud-sdk
```

### 初期化

```bash
gcloud init
gcloud auth login
gcloud config set project bright-practice-444611-p4
```

## デプロイ手順

### 方法1: 自動デプロイスクリプトを使用

```bash
# スクリプトに実行権限を付与
chmod +x deploy-gcp.sh

# デプロイ実行
./deploy-gcp.sh
```

スクリプトが以下を自動で実行します：
1. 必要なAPIを有効化
2. Cloud SQLインスタンス作成
3. データベースとユーザー作成
4. Cloud Runにデプロイ

### 方法2: 手動デプロイ

#### ステップ1: 必要なAPIを有効化

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable compute.googleapis.com
```

#### ステップ2: Cloud SQLインスタンスを作成

```bash
# PostgreSQL 15インスタンスを作成
gcloud sql instances create chatbot-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=asia-northeast1 \
    --root-password=YOUR_SECURE_PASSWORD \
    --storage-type=SSD \
    --storage-size=10GB
```

**注意**: `YOUR_SECURE_PASSWORD`を強力なパスワードに置き換えてください。

#### ステップ3: データベースとユーザーを作成

```bash
# データベース作成
gcloud sql databases create chatbot --instance=chatbot-db

# ユーザー作成
gcloud sql users create chatbot-user \
    --instance=chatbot-db \
    --password=YOUR_USER_PASSWORD
```

#### ステップ4: 接続情報を取得

```bash
# Cloud SQL接続名を取得
gcloud sql instances describe chatbot-db --format="value(connectionName)"
# 出力例: bright-practice-444611-p4:asia-northeast1:chatbot-db
```

#### ステップ5: Cloud Runにデプロイ

```bash
gcloud run deploy ai-chatbot \
    --source . \
    --platform managed \
    --region asia-northeast1 \
    --allow-unauthenticated \
    --set-env-vars "OPENAI_API_KEY=YOUR_OPENAI_API_KEY" \
    --set-env-vars "POSTGRES_PRISMA_URL=postgresql://chatbot-user:YOUR_USER_PASSWORD@/chatbot?host=/cloudsql/bright-practice-444611-p4:asia-northeast1:chatbot-db" \
    --set-env-vars "POSTGRES_URL_NON_POOLING=postgresql://chatbot-user:YOUR_USER_PASSWORD@/chatbot?host=/cloudsql/bright-practice-444611-p4:asia-northeast1:chatbot-db" \
    --set-env-vars "DATABASE_URL=postgresql://chatbot-user:YOUR_USER_PASSWORD@/chatbot?host=/cloudsql/bright-practice-444611-p4:asia-northeast1:chatbot-db" \
    --add-cloudsql-instances bright-practice-444611-p4:asia-northeast1:chatbot-db \
    --memory 512Mi \
    --cpu 1 \
    --max-instances 10 \
    --port 8080
```

**重要**: 以下を実際の値に置き換えてください：
- `YOUR_OPENAI_API_KEY` - OpenAI APIキー
- `YOUR_USER_PASSWORD` - ステップ3で設定したパスワード

#### ステップ6: データベースマイグレーションを実行

Cloud Runサービスがデプロイされたら、データベーススキーマをセットアップする必要があります。

```bash
# Cloud Shellまたはローカルから実行
# まず、Cloud SQL Proxyを使用してローカルから接続
cloud-sql-proxy bright-practice-444611-p4:asia-northeast1:chatbot-db &

# 環境変数を設定
export DATABASE_URL="postgresql://chatbot-user:YOUR_USER_PASSWORD@127.0.0.1:5432/chatbot"

# マイグレーション実行
cd /mnt/c/Users/hikar/web_app/chatbot
npx prisma migrate deploy
```

または、Cloud Runジョブを使用：

```bash
# Dockerイメージをビルドしてプッシュ
gcloud builds submit --tag gcr.io/bright-practice-444611-p4/chatbot-migrate

# Cloud Runジョブを作成して実行
gcloud run jobs create chatbot-migrate \
    --region=asia-northeast1 \
    --image=gcr.io/bright-practice-444611-p4/chatbot-migrate \
    --set-env-vars DATABASE_URL="postgresql://chatbot-user:YOUR_USER_PASSWORD@/chatbot?host=/cloudsql/bright-practice-444611-p4:asia-northeast1:chatbot-db" \
    --add-cloudsql-instances bright-practice-444611-p4:asia-northeast1:chatbot-db \
    --execute-now \
    --command='npx,prisma,migrate,deploy'
```

## デプロイ後の確認

### サービスURLを取得

```bash
gcloud run services describe ai-chatbot \
    --platform managed \
    --region asia-northeast1 \
    --format 'value(status.url)'
```

### ログを確認

```bash
gcloud run services logs read ai-chatbot \
    --region=asia-northeast1 \
    --limit=50
```

### サービスにアクセス

ブラウザで返されたURLにアクセスして、チャットボットが正常に動作することを確認します。

## 環境変数の更新

後で環境変数を更新する場合：

```bash
gcloud run services update ai-chatbot \
    --region=asia-northeast1 \
    --set-env-vars "KEY=VALUE"
```

## トラブルシューティング

### データベース接続エラー

```bash
# Cloud SQLインスタンスのステータス確認
gcloud sql instances describe chatbot-db

# 接続名が正しいか確認
gcloud sql instances describe chatbot-db --format="value(connectionName)"
```

### Cloud Runサービスが起動しない

```bash
# ログを確認
gcloud run services logs read ai-chatbot --region=asia-northeast1 --limit=100

# サービスの詳細を確認
gcloud run services describe ai-chatbot --region=asia-northeast1
```

### Prismaマイグレーションエラー

```bash
# Cloud SQL Proxyを使用してローカルから接続
cloud-sql-proxy bright-practice-444611-p4:asia-northeast1:chatbot-db

# 別のターミナルでマイグレーション実行
export DATABASE_URL="postgresql://chatbot-user:YOUR_USER_PASSWORD@127.0.0.1:5432/chatbot"
npx prisma migrate deploy
```

## コスト見積もり

### Cloud Run
- 月間100万リクエストまで無料
- CPU: $0.00002400/vCPU秒
- メモリ: $0.00000250/GiB秒

### Cloud SQL (db-f1-micro)
- 約 $10-15/月
- ストレージ: $0.17/GB/月

### 合計概算
低トラフィックの場合: **約$10-20/月**

## セキュリティ

### 認証を有効にする場合

```bash
gcloud run services update ai-chatbot \
    --region=asia-northeast1 \
    --no-allow-unauthenticated
```

### シークレットマネージャーを使用

```bash
# APIキーをシークレットとして保存
echo -n "YOUR_API_KEY" | gcloud secrets create anthropic-api-key --data-file=-

# Cloud Runサービスに権限を付与
gcloud secrets add-iam-policy-binding anthropic-api-key \
    --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# デプロイ時にシークレットを使用
gcloud run deploy ai-chatbot \
    --source . \
    --region=asia-northeast1 \
    --set-secrets="OPENAI_API_KEY=anthropic-api-key:latest"
```

## スケーリング設定

```bash
# 最小・最大インスタンス数を設定
gcloud run services update ai-chatbot \
    --region=asia-northeast1 \
    --min-instances=0 \
    --max-instances=10

# タイムアウトを設定（デフォルト: 300秒）
gcloud run services update ai-chatbot \
    --region=asia-northeast1 \
    --timeout=60
```

## アプリケーションの更新

コードを変更した後、再デプロイ：

```bash
gcloud run deploy ai-chatbot \
    --source . \
    --region=asia-northeast1
```

## リソースの削除

使用を終了したら、リソースを削除してコストを削減：

```bash
# Cloud Runサービスを削除
gcloud run services delete ai-chatbot --region=asia-northeast1

# Cloud SQLインスタンスを削除
gcloud sql instances delete chatbot-db
```

## サポート

問題が発生した場合：
1. ログを確認
2. 環境変数が正しく設定されているか確認
3. Cloud SQLインスタンスが実行中か確認
4. APIが有効化されているか確認

---

**作成日**: 2025-12-19
**プロジェクトID**: bright-practice-444611-p4
