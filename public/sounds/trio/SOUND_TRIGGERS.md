# Trio Game - Sound Effects Implementation Guide

This document describes when each sound effect is triggered during gameplay.

## Sound Triggers by Game Phase

### Waiting Phase
| Sound | File | When | Volume |
|-------|------|------|--------|
| Game Start | `game-start.mp3` | Host clicks "Start Game" button | 0.7 |

### Playing Phase

#### Card Actions
| Sound | File | When | Volume |
|-------|------|------|--------|
| Card Flip | `card-flip.mp3` | Any card reveal (middle grid or player query) | 0.6 |
| Match | `match.mp3` | Two consecutive reveals have same value (200ms after flip) | 0.7 |
| Mismatch | `mismatch.mp3` | Two consecutive reveals have different values (200ms after flip) | 0.5 |

#### Turn Actions
| Sound | File | When | Volume |
|-------|------|------|--------|
| Trio Claim | `trio-claim.mp3` | Player successfully claims a trio | 0.85 |
| Turn Transition | `turn-transition.mp3` | Turn number increases (player ends turn) | 0.5 |

### Finished Phase
| Sound | File | When | Volume |
|-------|------|------|--------|
| Victory | `/sounds/cheese-thief/victory.mp3` | Current player won (3+ trios) | 0.8 |
| Defeat | `/sounds/cheese-thief/defeat.mp3` | Current player lost | 0.8 |

## Technical Implementation

### Sound Detection Logic

**Card Flip Detection:**
```typescript
// Monitors currentTurn.reveals.length
// Plays immediately when length increases
```

**Match/Mismatch Detection:**
```typescript
// After 200ms delay to avoid overlap with flip sound
// Compares last 2 reveals:
if (reveals[n-1].value === reveals[n-2].value) {
    playMatch(); // Same values
} else {
    playMismatch(); // Different values
}
```

**Trio Claim Detection:**
```typescript
// Monitors myPlayer.trios_count
// Plays when count increases
```

**Turn Transition Detection:**
```typescript
// Monitors currentTurn.turn_number
// Plays when number increases
```

**Victory/Defeat Detection:**
```typescript
// On FinishedPhase mount
// Checks if current player has 3+ trios
// Plays victory (winner) or defeat (losers)
```

## Sound State Management

- **Mute Toggle**: Fixed position top-right, syncs with localStorage
- **Mute Check**: All sounds check `localStorage.getItem('soundMuted')` before playing
- **No Looping**: All Trio sounds are one-shot (unlike Cheese Thief's ambient sounds)
- **Overlap Prevention**: 200ms delay between flip and match/mismatch sounds

## Volume Hierarchy

Sound effects are balanced by importance:

- **Celebratory (0.8-0.9)**: Victory, Trio Claim
- **Main Actions (0.6-0.7)**: Card Flip, Match, Game Start
- **Subtle (0.5-0.6)**: Mismatch, Turn Transition, Defeat

## Files Modified

1. **TrioGame.tsx** - Added SoundToggle component wrapper
2. **WaitingPhase.tsx** - Game start sound on host click
3. **PlayingPhase.tsx** - Card flip, match/mismatch, trio claim, turn transition
4. **FinishedPhase.tsx** - Victory/defeat sounds based on player result

## Testing Checklist

### Functional Tests
- [ ] SoundToggle appears in top-right corner
- [ ] Mute state persists across page refreshes
- [ ] Game start sound plays when host starts game
- [ ] Card flip plays when revealing middle card
- [ ] Card flip plays when asking highest/lowest
- [ ] Match sound after two matching reveals
- [ ] Mismatch sound after non-matching reveals
- [ ] Trio claim sound when collecting trio
- [ ] Turn transition when ending turn
- [ ] Victory sound for winner
- [ ] Defeat sound for losers
- [ ] All sounds respect mute toggle

### UX Tests
- [ ] No audio overlap issues
- [ ] 200ms delay feels natural
- [ ] Volume levels are balanced
- [ ] Sounds enhance gameplay
- [ ] No stuttering or glitches

## Browser Console Testing

After adding sound files, check browser console (F12) for:
- ✅ No "Failed to load sound" warnings
- ✅ No audio playback errors
- ✅ Sounds load successfully (check Network tab)

## Sound File Requirements

All MP3 files must be placed in `/public/sounds/trio/`:
- card-flip.mp3
- match.mp3
- mismatch.mp3
- trio-claim.mp3
- turn-transition.mp3
- game-start.mp3

See `README.md` for detailed specifications and sourcing suggestions.
