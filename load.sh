#!/usr/bin/env bash
set -euo pipefail

: "${BASE:?Set BASE, e.g. http://<EC2-DNS>:8080}"
: "${TOKEN:?Set TOKEN}"
: "${VIDEO_ID:?Set VIDEO_ID}"

COUNT="${COUNT:-50}"   # 循环次数（默认50次）
SLEEP="${SLEEP:-0}"    # 每次请求之间的停顿秒数（默认0）

for i in $(seq 1 "$COUNT"); do
  echo "[$i/$COUNT] POST /api/v1/videos/$VIDEO_ID/transcode"
  curl -sS -X POST "$BASE/api/v1/videos/$VIDEO_ID/transcode" \
    -H "Authorization: Bearer $TOKEN" \
    -o /dev/null
  if [[ "$SLEEP" != "0" ]]; then sleep "$SLEEP"; fi
done

echo "Done."
