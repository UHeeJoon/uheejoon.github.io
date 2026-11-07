#!/usr/bin/env bash
# 로컬 미리보기. GitHub Pages와 같은 정적 파일을 그대로 띄운다.
# 사용법: ./serve.sh [포트]  →  http://localhost:포트 (기본 8765)
set -euo pipefail
cd "$(dirname "$0")"
PORT="${1:-8765}"
echo "http://localhost:${PORT}"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
