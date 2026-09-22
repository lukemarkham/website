#!/bin/sh
# Renders the spoken count-in ("one, two, three, four") used by the sticking
# generator's practice session into public/audio/count-in/{1..4}.wav.
#
# macOS only: it uses the system `say` voices, plus ffmpeg to trim the
# silence either side of each word, so the word starts exactly on the beat.
# Swap the voice with VOICE="Samantha" sh scripts/generate-count-in.sh, or
# replace the four files with your own recordings (trimmed tight at the start).
set -eu

VOICE="${VOICE:-Daniel}"
RATE="${RATE:-240}"
OUT_DIR="public/audio/count-in"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$OUT_DIR"
n=1
for word in one two three four; do
  say -v "$VOICE" -r "$RATE" -o "$TMP_DIR/$n.aiff" "$word"
  ffmpeg -loglevel error -y -i "$TMP_DIR/$n.aiff" \
    -af "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse" \
    -ac 1 -ar 22050 -c:a pcm_s16le "$OUT_DIR/$n.wav"
  n=$((n + 1))
done
