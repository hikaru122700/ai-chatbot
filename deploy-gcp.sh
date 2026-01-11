#!/bin/bash

# GCP Deployment Script for AI Chatbot
# Project ID: bright-practice-444611-p4

set -e

PROJECT_ID="bright-practice-444611-p4"
REGION="asia-northeast1"  # Tokyo region
SERVICE_NAME="ai-chatbot"
DB_INSTANCE_NAME="chatbot-db"
DB_NAME="chatbot"
DB_USER="chatbot-user"

echo "🚀 Deploying AI Chatbot to Google Cloud Platform"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Set project
echo "📋 Setting GCP project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔧 Enabling required APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable compute.googleapis.com

# Create Cloud SQL instance (if not exists)
echo "🗄️  Creating Cloud SQL PostgreSQL instance..."
if gcloud sql instances describe $DB_INSTANCE_NAME --project=$PROJECT_ID 2>/dev/null; then
    echo "Cloud SQL instance already exists, skipping creation..."
else
    gcloud sql instances create $DB_INSTANCE_NAME \
        --database-version=POSTGRES_15 \
        --tier=db-f1-micro \
        --region=$REGION \
        --root-password=$(openssl rand -base64 32) \
        --storage-type=SSD \
        --storage-size=10GB
fi

# Create database
echo "📊 Creating database..."
gcloud sql databases create $DB_NAME \
    --instance=$DB_INSTANCE_NAME \
    || echo "Database already exists, skipping..."

# Create database user
echo "👤 Creating database user..."
DB_PASSWORD=$(openssl rand -base64 32)
gcloud sql users create $DB_USER \
    --instance=$DB_INSTANCE_NAME \
    --password=$DB_PASSWORD \
    || echo "User already exists, skipping..."

# Get connection name
CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE_NAME --format="value(connectionName)")
echo "Database connection name: $CONNECTION_NAME"

# Build and deploy to Cloud Run
echo "🏗️  Building and deploying to Cloud Run..."

# Get OpenAI API Key from user
read -sp "Enter your OPENAI_API_KEY: " OPENAI_API_KEY
echo ""

# Build database URL
DB_HOST="/cloudsql/$CONNECTION_NAME"
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST/$DB_NAME?host=$DB_HOST"

# Deploy to Cloud Run
gcloud run deploy $SERVICE_NAME \
    --source . \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars "OPENAI_API_KEY=$OPENAI_API_KEY" \
    --set-env-vars "POSTGRES_PRISMA_URL=$DATABASE_URL" \
    --set-env-vars "POSTGRES_URL_NON_POOLING=$DATABASE_URL" \
    --set-env-vars "DATABASE_URL=$DATABASE_URL" \
    --add-cloudsql-instances $CONNECTION_NAME \
    --memory 512Mi \
    --cpu 1 \
    --max-instances 10 \
    --port 8080

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')

echo ""
echo "✅ Deployment completed!"
echo "🌐 Service URL: $SERVICE_URL"
echo ""
echo "📝 Database credentials:"
echo "  Instance: $DB_INSTANCE_NAME"
echo "  Connection: $CONNECTION_NAME"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo "  Password: $DB_PASSWORD"
echo ""
echo "⚠️  IMPORTANT: Save the database password securely!"
echo ""
echo "🔄 Next steps:"
echo "1. Run database migrations:"
echo "   gcloud run jobs create chatbot-migrate --region=$REGION --image=gcr.io/$PROJECT_ID/$SERVICE_NAME --set-env-vars DATABASE_URL=$DATABASE_URL --add-cloudsql-instances $CONNECTION_NAME --execute-now --command='npx,prisma,migrate,deploy'"
echo ""
echo "2. Test your application at: $SERVICE_URL"
