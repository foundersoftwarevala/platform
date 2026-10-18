#!/bin/sh
# Downloads the engine's models, pinned by revision and verified by checksum.
#   MADLAD-400 3B MT, CTranslate2 int8   Apache-2.0   (Nextcloud-AI conversion of google/madlad400-3b-mt)
#   fastText lid.176                      CC-BY-SA-3.0 (language identification)
set -eu

MODELS="${MODELS:-/opt/sv-translate/models}"
MADLAD_REPO="Nextcloud-AI/madlad400-3b-mt-ct2-int8"
MADLAD_REV="aa32bbdeba7880eff2096ec044cb155a340a9400"
MADLAD_SHA256="77b9fd9ab97c1259d07089b5f854393dad81bc5fb5647d3f9a5d101c94f40daa"
SPIECE_SHA256="ef11ac9a22c7503492f56d48dce53be20e339b63605983e9f27d2cd0e0f3922c"
LID_URL="https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.ftz"
LID_SHA256="${LID_SHA256:-}"

dir="$MODELS/madlad400-3b-mt-ct2-int8"
mkdir -p "$dir"
for f in config.json generation_config.json shared_vocabulary.json special_tokens_map.json \
         spiece.model tokenizer_config.json added_tokens.json README.md model.bin; do
  if [ ! -s "$dir/$f" ]; then
    curl -sSfL --retry 5 -C - -o "$dir/$f" "https://huggingface.co/$MADLAD_REPO/resolve/$MADLAD_REV/$f"
  fi
done
echo "$MADLAD_SHA256  $dir/model.bin" | sha256sum -c -
echo "$SPIECE_SHA256  $dir/spiece.model" | sha256sum -c -
echo "$MADLAD_REV" > "$dir/REVISION"

if [ ! -s "$MODELS/lid.176.ftz" ]; then
  curl -sSfL --retry 5 -o "$MODELS/lid.176.ftz" "$LID_URL"
fi
if [ -n "$LID_SHA256" ]; then
  echo "$LID_SHA256  $MODELS/lid.176.ftz" | sha256sum -c -
fi
sha256sum "$MODELS/lid.176.ftz"
chmod -R a+rX "$MODELS"
echo "models ready in $MODELS"
