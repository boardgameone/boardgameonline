# Trio Game Sound Effects

This directory contains sound effects for the Trio card game.

## Required Sound Files

You need to create or source the following MP3 files:

### 1. card-flip.mp3
- **Duration**: 300-500ms
- **Volume**: 0.6
- **Description**: Quick card flipping sound when revealing middle cards or asking players for highest/lowest
- **Triggers**: Every time a card is revealed (middle grid or player query)

### 2. match.mp3
- **Duration**: 500-800ms
- **Volume**: 0.7
- **Description**: Positive chime/ding for when two consecutive reveals match
- **Triggers**: After card flip sound (200ms delay), when last two reveals have the same value

### 3. mismatch.mp3
- **Duration**: 400-600ms
- **Volume**: 0.5
- **Description**: Subtle negative buzz/thud for non-matching reveals
- **Triggers**: After card flip sound (200ms delay), when last two reveals have different values

### 4. trio-claim.mp3
- **Duration**: 1-1.5s
- **Volume**: 0.85
- **Description**: Celebratory sound when successfully claiming a trio
- **Triggers**: When player's trio count increases (claims 3 matching cards)

### 5. turn-transition.mp3
- **Duration**: 300-400ms
- **Volume**: 0.5
- **Description**: Neutral whoosh/transition sound for turn changes
- **Triggers**: When turn_number increases (player ends turn)

### 6. game-start.mp3
- **Duration**: 1-2s
- **Volume**: 0.7
- **Description**: Upbeat game beginning sound
- **Triggers**: When host clicks "Start Game" button

## Reused Sounds

These sounds are shared from the Cheese Thief game:

- **victory.mp3**: `/sounds/cheese-thief/victory.mp3` (volume: 0.8)
  - Plays for the winner when game finishes

- **defeat.mp3**: `/sounds/cheese-thief/defeat.mp3` (volume: 0.8)
  - Plays for losers when game finishes

## Sound Sourcing Suggestions

### Free Sound Resources:
- [Freesound.org](https://freesound.org/) - Community sound library
- [Zapsplat](https://www.zapsplat.com/) - Free sound effects
- [Mixkit](https://mixkit.co/free-sound-effects/) - Free sound effects
- [Pixabay](https://pixabay.com/sound-effects/) - Royalty-free sounds

### Search Terms:
- **card-flip**: "card flip", "paper flip", "card slide"
- **match**: "correct ding", "success chime", "positive bell"
- **mismatch**: "error buzz", "wrong sound", "negative beep"
- **trio-claim**: "success fanfare", "victory short", "achievement unlock"
- **turn-transition**: "whoosh", "transition swipe", "UI transition"
- **game-start**: "game start", "level begin", "ready go"

## Implementation Status

All sound triggers are implemented in the following files:
- ✅ `TrioGame.tsx` - SoundToggle component added
- ✅ `WaitingPhase.tsx` - Game start sound
- ✅ `PlayingPhase.tsx` - Card flip, match, mismatch, trio claim, turn transition
- ✅ `FinishedPhase.tsx` - Victory/defeat sounds

## Testing

Once you add the MP3 files to this directory, test by:
1. Starting a Trio game
2. Verifying SoundToggle appears in top-right
3. Playing through all game phases and actions
4. Checking browser console for any audio loading errors
