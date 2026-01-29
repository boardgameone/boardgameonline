#!/bin/bash

# Script to check which Trio sound files are present/missing

echo "=== Trio Sound Files Status ==="
echo ""

SOUND_DIR="$(cd "$(dirname "$0")" && pwd)"
REQUIRED_SOUNDS=(
    "card-flip.mp3"
    "match.mp3"
    "mismatch.mp3"
    "trio-claim.mp3"
    "turn-transition.mp3"
    "game-start.mp3"
)

MISSING_COUNT=0
PRESENT_COUNT=0

for sound in "${REQUIRED_SOUNDS[@]}"; do
    if [ -f "$SOUND_DIR/$sound" ]; then
        echo "✅ $sound ($(du -h "$SOUND_DIR/$sound" | cut -f1))"
        PRESENT_COUNT=$((PRESENT_COUNT + 1))
    else
        echo "❌ $sound (MISSING)"
        MISSING_COUNT=$((MISSING_COUNT + 1))
    fi
done

echo ""
echo "Reused sounds from Cheese Thief:"
if [ -f "$SOUND_DIR/../cheese-thief/victory.mp3" ]; then
    echo "✅ victory.mp3 (from cheese-thief)"
else
    echo "❌ victory.mp3 (MISSING from cheese-thief)"
    MISSING_COUNT=$((MISSING_COUNT + 1))
fi

if [ -f "$SOUND_DIR/../cheese-thief/defeat.mp3" ]; then
    echo "✅ defeat.mp3 (from cheese-thief)"
else
    echo "❌ defeat.mp3 (MISSING from cheese-thief)"
    MISSING_COUNT=$((MISSING_COUNT + 1))
fi

echo ""
echo "=== Summary ==="
echo "Present: $PRESENT_COUNT / 6 required files"
echo "Missing: $MISSING_COUNT files"

if [ $MISSING_COUNT -eq 0 ]; then
    echo ""
    echo "🎉 All sound files are present!"
    exit 0
else
    echo ""
    echo "⚠️  Please add the missing sound files to:"
    echo "   $SOUND_DIR"
    echo ""
    echo "See README.md for sourcing suggestions."
    exit 1
fi
