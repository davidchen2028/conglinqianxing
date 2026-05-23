#!/usr/bin/env bash
# 将《丛林潜行》推送到 GitHub 远程仓库
# 用法：先修改下面的 GIT_NAME / GIT_EMAIL，再执行：bash push-to-github.sh

set -e
cd "$(dirname "$0")"

GIT_NAME="${GIT_NAME:-你的名字}"
GIT_EMAIL="${GIT_EMAIL:-your.email@example.com}"
REMOTE="https://github.com/davidchen2028/conglinqianxing.git"

export GIT_AUTHOR_NAME="$GIT_NAME"
export GIT_AUTHOR_EMAIL="$GIT_EMAIL"
export GIT_COMMITTER_NAME="$GIT_NAME"
export GIT_COMMITTER_EMAIL="$GIT_EMAIL"

echo "==> 1. 确认在项目目录"
pwd

echo "==> 2. 首次提交（若尚未提交）"
if ! git rev-parse HEAD >/dev/null 2>&1; then
  git add .
  git commit -m "Initial commit: 丛林潜行潜行游戏

Flask 关卡 Grid API、战争迷雾与圆锥形手电筒 FOV 检测。"
else
  echo "    已有提交，跳过 commit"
fi

echo "==> 3. 设置主分支为 main"
git branch -M main

echo "==> 4. 配置远程 origin"
git remote remove origin 2>/dev/null || true
git remote add origin "$REMOTE"
git remote -v

echo "==> 5. 推送到 GitHub（需登录或 Personal Access Token）"
git push -u origin main

echo "==> 完成！仓库地址：$REMOTE"
