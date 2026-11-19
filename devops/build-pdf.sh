#!/usr/bin/env bash
# devops/index.html을 A4 PDF로 만든다. 페이지 내용을 고친 뒤 다시 실행해 PDF를 갱신한다.
# 사용법: ./devops/build-pdf.sh  →  assets/docs/devops-portfolio.pdf
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="assets/docs/devops-portfolio.pdf"
CHROME="$(command -v google-chrome || command -v chromium || command -v chromium-browser)"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --run-all-compositor-stages-before-draw --virtual-time-budget=15000 \
  --print-to-pdf="$OUT" "file://$PWD/devops/index.html#pdf" 2>/dev/null
echo "$OUT ($(pdfinfo "$OUT" | awk '/^Pages/{print $2}') pages)"
