# Cheese Thief Sound Triggers Reference

Quick reference for when each sound effect plays during the game.

## Sound Trigger Map

| Sound File | When It Plays | Component | Trigger Action |
|------------|---------------|-----------|----------------|
| `die-roll.mp3` | Rolling Phase | RollingPhase.tsx:17 | Player clicks "Got it!" button |
| `mouse-squeak-1/2/3.mp3` | Multiple moments | Multiple | Random squeak selected each time |
| `sneaking.mp3` | Night Phase (background) | NightPhase.tsx:36 | Player is awake AND alone (loops) |
| `peek.mp3` | Night Phase | NightPhase.tsx:55 | Player clicks "Peek at their die" |
| `cheese-munch.mp3` | Night Phase | NightPhase.tsx:41 | When cheese_stolen becomes true |
| `whisper.mp3` | Accomplice Phase | AccomplicePhase.tsx:23 | Thief clicks "Choose as Accomplice" |
| `voting-chatter.mp3` | Voting Phase (background) | VotingPhase.tsx:32 | Phase loads (loops) |
| `victory.mp3` | Results Phase | ResultsPhase.tsx:31 | Player wins |
| `defeat.mp3` | Results Phase | ResultsPhase.tsx:31 | Player loses |

## Mouse Squeak Usage

The mouse squeak sounds (3 variations) play randomly in these situations:
1. **Night Phase**: When peeking at another player
2. **Night Phase**: When cheese is stolen
3. **Voting Phase**: When casting a vote

Random selection provides variety and keeps the game feeling fresh.

## Looping Sounds

Two sounds are designed to loop continuously:

### Sneaking Sound
- **Volume**: 0.3 (quiet background)
- **Starts**: When player wakes up and is alone
- **Stops**: When other players wake up OR phase changes
- **Purpose**: Creates tension during solo peeking moments

### Voting Chatter
- **Volume**: 0.3 (quiet background)
- **Starts**: When voting phase begins
- **Stops**: When phase changes
- **Purpose**: Creates discussion/deliberation atmosphere

## Volume Levels

| Sound Type | Volume | Reason |
|------------|--------|--------|
| Background loops | 0.3 | Ambient, shouldn't overwhelm |
| Mouse squeaks | 0.6 | Noticeable but not jarring |
| Action sounds | 0.7-0.8 | Clear feedback for actions |
| Victory/Defeat | 0.8 | Celebratory/emphatic |

## Testing Each Sound

### 1. Die Roll
```
1. Create or join a game
2. Wait for Rolling Phase
3. Click "Got it!" button
4. Should hear: die-roll.mp3
```

### 2. Sneaking (Background)
```
1. Start game
2. Complete Rolling Phase
3. If you wake up alone (no one else has same die value)
4. Should hear: sneaking.mp3 (looping quietly)
5. Stops when: others wake up or you leave night phase
```

### 3. Peek + Squeak
```
1. Wake up alone during night
2. Click on another player
3. Click "Peek at their die"
4. Should hear: peek.mp3 + random squeak
```

### 4. Cheese Munch + Squeak
```
1. Continue playing through night
2. When someone peeks at the thief
3. Yellow banner appears: "The cheese has been stolen!"
4. Should hear: cheese-munch.mp3 + random squeak
```

### 5. Whisper
```
1. If you're the thief, after night ends
2. Accomplice Selection Phase loads
3. Click on another player
4. Click "Choose as Accomplice"
5. Should hear: whisper.mp3
```

### 6. Voting Chatter + Squeak
```
1. During Voting Phase
2. Should immediately hear: voting-chatter.mp3 (looping quietly)
3. Click on a player to vote
4. Click "Cast Vote"
5. Should hear: random squeak
```

### 7. Victory
```
1. Complete voting
2. Results Phase loads
3. If you won (innocent mouse and caught thief, OR you're thief/accomplice and escaped)
4. Should hear: victory.mp3
```

### 8. Defeat
```
1. Complete voting
2. Results Phase loads
3. If you lost
4. Should hear: defeat.mp3
```

## Mute Toggle Testing

```
1. During any phase, click the speaker button (top-right)
2. Button should change from "🔊 Sound On" to "🔇 Muted"
3. Trigger any sound - should not play
4. Click button again to unmute
5. Trigger sound - should play
6. Refresh page - mute state should persist
```

## Troubleshooting

### Sound doesn't play
- Check browser console (F12) for errors
- Verify file exists at correct path
- Check if sounds are muted via toggle
- Ensure file is valid MP3 format

### Sound plays but is wrong
- Check file name matches exactly (case-sensitive)
- Verify file is the correct sound effect

### Sound too loud/quiet
- Adjust source file volume using Audacity
- Re-normalize to target peak: -3.0 dB
- Rebuild frontend: `npm run build`

### Background loop doesn't stop
- Check if component is unmounting properly
- Verify cleanup in useEffect is running
- Check browser console for React errors

## File Checklist

Before testing, verify these files exist:
- [ ] `public/sounds/cheese-thief/die-roll.mp3`
- [ ] `public/sounds/cheese-thief/mouse-squeak-1.mp3`
- [ ] `public/sounds/cheese-thief/mouse-squeak-2.mp3`
- [ ] `public/sounds/cheese-thief/mouse-squeak-3.mp3`
- [ ] `public/sounds/cheese-thief/sneaking.mp3`
- [ ] `public/sounds/cheese-thief/peek.mp3`
- [ ] `public/sounds/cheese-thief/cheese-munch.mp3`
- [ ] `public/sounds/cheese-thief/whisper.mp3`
- [ ] `public/sounds/cheese-thief/voting-chatter.mp3`
- [ ] `public/sounds/cheese-thief/victory.mp3`
- [ ] `public/sounds/cheese-thief/defeat.mp3`

All 11 files are required for complete sound coverage.
