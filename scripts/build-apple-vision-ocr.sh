#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Skipping Apple Vision OCR build (macOS only)."
  exit 0
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$ROOT_DIR/apple-vision-ocr.m"
OUT_DIR="$ROOT_DIR/bin"
OUT="$OUT_DIR/apple-vision-ocr"

mkdir -p "$OUT_DIR"

echo "Building Apple Vision OCR helper..."
echo "  src: $SRC"
echo "  out: $OUT"

xcrun clang \
  -O3 \
  -fobjc-arc \
  -mmacosx-version-min=14.0 \
  -Werror \
  -framework Foundation \
  -framework Vision \
  -framework ImageIO \
  -framework CoreGraphics \
  -framework CoreML \
  -o "$OUT" \
  "$SRC"

# Guardrails: ensure we didn't accidentally bump the deployment target or pull Swift runtime deps.
MINOS="$(otool -l "$OUT" | awk 'BEGIN{inBuild=0} /LC_BUILD_VERSION/{inBuild=1} inBuild && /minos/{print $2; exit}')"
if [[ "$MINOS" != 14.* ]]; then
  echo "error: apple-vision-ocr minos must be 14.x, got: ${MINOS:-unknown}" >&2
  exit 1
fi

if otool -L "$OUT" | grep -q "libswift"; then
  echo "error: apple-vision-ocr unexpectedly links Swift runtime dylibs" >&2
  otool -L "$OUT" | grep "libswift" >&2 || true
  exit 1
fi

echo "Built: $OUT"
