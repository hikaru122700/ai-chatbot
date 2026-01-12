#!/bin/bash

# Auto Push Script
# Usage: ./auto-push.sh "コミットメッセージ"

set -e

# 色付き出力
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# コミットメッセージ（引数がなければデフォルト）
COMMIT_MSG="${1:-Update}"

echo -e "${YELLOW}📁 変更をステージング...${NC}"
git add .

# 変更があるか確認
if git diff --cached --quiet; then
    echo -e "${YELLOW}⚠️  コミットする変更がありません${NC}"
    exit 0
fi

echo -e "${YELLOW}📝 コミット中...${NC}"
git commit -m "$COMMIT_MSG"

echo -e "${YELLOW}🚀 プッシュ中...${NC}"
git push origin main

echo -e "${GREEN}✅ 完了！${NC}"
