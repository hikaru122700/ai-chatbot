#!/bin/bash

# Auto Push Script (10秒間隔で自動監視)
# 使い方: ./auto-push.sh
# 停止: Ctrl+C

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔄 自動Push監視を開始します（10秒間隔）${NC}"
echo -e "${BLUE}   停止するには Ctrl+C を押してください${NC}"
echo ""

while true; do
    # 変更があるかチェック
    if [[ -n $(git status --porcelain) ]]; then
        TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

        echo -e "${YELLOW}📁 変更を検出しました${NC}"
        git add .

        echo -e "${YELLOW}📝 コミット中...${NC}"
        git commit -m "Auto commit: $TIMESTAMP"

        echo -e "${YELLOW}🚀 プッシュ中...${NC}"
        git push origin main

        echo -e "${GREEN}✅ 完了！ ($TIMESTAMP)${NC}"
        echo ""
    fi

    sleep 10
done
