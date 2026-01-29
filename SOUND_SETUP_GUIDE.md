# Cheese Thief Sound Effects Setup Guide

## Overview
This guide will help you download and configure mouse/rat sound effects for the Cheese Thief game.

## Implementation Status
✅ Sound system implemented
✅ All game phases integrated
✅ Sound toggle button added
⏳ Actual sound files need to be downloaded

## Quick Start

1. **Download Sound Effects**: Visit Pixabay or other free sound effect sites
2. **Convert to MP3**: Ensure all files are in MP3 format
3. **Normalize Volume**: Use audio editing software to balance volume levels
4. **Place Files**: Copy all MP3 files to `public/sounds/cheese-thief/`
5. **Test**: Play through a complete game to verify all sounds work

## Required Sound Files

All sound files must be placed in: `public/sounds/cheese-thief/`

### 1. Die Roll Sound (`die-roll.mp3`)
- **When**: Player confirms their die roll
- **Duration**: 0.5-1 second
- **Character**: Quick dice rolling/rattling sound
- **Search terms**: "dice roll", "die rolling", "board game dice"

### 2. Mouse Squeaks (3 variations)
- **Files**: `mouse-squeak-1.mp3`, `mouse-squeak-2.mp3`, `mouse-squeak-3.mp3`
- **When**: Various moments (peeking, voting, cheese stolen)
- **Duration**: 0.3-0.8 seconds each
- **Character**: Short, playful mouse squeaks (not scary)
- **Search terms**: "mouse squeak", "cute mouse", "rat sound"

### 3. Sneaking Sound (`sneaking.mp3`)
- **When**: Background loop during night phase when player is awake and alone
- **Duration**: 2-5 seconds (will loop)
- **Character**: Subtle scurrying, light footsteps, sneaky movement
- **Volume**: LOW (0.3) - should be ambient background
- **Search terms**: "mouse scurrying", "sneaking", "light footsteps"

### 4. Peek Sound (`peek.mp3`)
- **When**: Player peeks at another player's die
- **Duration**: 0.5-1 second
- **Character**: Quick spy/detective sound, peek effect
- **Search terms**: "spy sound", "peek", "whoosh"

### 5. Cheese Munch Sound (`cheese-munch.mp3`)
- **When**: Cheese is stolen (someone peeked at the thief)
- **Duration**: 1-2 seconds
- **Character**: Eating/munching/chomping sound
- **Search terms**: "eating", "munching", "chomping", "bite"

### 6. Whisper Sound (`whisper.mp3`)
- **When**: Thief selects their accomplice
- **Duration**: 1-2 seconds
- **Character**: Scheming whisper, secretive planning
- **Search terms**: "whisper", "secret", "scheming"

### 7. Voting Chatter (`voting-chatter.mp3`)
- **When**: Background loop during voting phase
- **Duration**: 3-8 seconds (will loop)
- **Character**: Mouse chatter, discussion, multiple mice talking
- **Volume**: LOW (0.3) - should be ambient background
- **Search terms**: "mouse chatter", "mice sounds", "crowd talking"

### 8. Victory Sound (`victory.mp3`)
- **When**: Results phase - player wins
- **Duration**: 2-3 seconds
- **Character**: Celebratory, victorious, happy mouse sounds
- **Search terms**: "victory", "success", "celebration", "win"

### 9. Defeat Sound (`defeat.mp3`)
- **When**: Results phase - player loses
- **Duration**: 2-3 seconds
- **Character**: Disappointed, defeated (but not too sad)
- **Search terms**: "defeat", "fail", "sad trombone", "disappointment"

## Recommended Sources

### Free with No Attribution Required
1. **Pixabay Sound Effects** (Recommended)
   - URL: https://pixabay.com/sound-effects/search/rat/
   - URL: https://pixabay.com/sound-effects/search/mouse/
   - License: Free for commercial use, no attribution required
   - Quality: High
   - Format: Various (convert to MP3)

2. **ZapSplat** (Free Account Required)
   - URL: https://www.zapsplat.com/
   - License: Free with account, no attribution on most sounds
   - Quality: High
   - Format: Various (convert to MP3)

### Free with Attribution
3. **Freesound.org**
   - URL: https://freesound.org/
   - License: Varies (check individual sounds)
   - Quality: High
   - Format: Various (convert to MP3)

## Audio Editing Requirements

### Volume Normalization
All sounds should be normalized to similar volume levels to prevent jarring transitions.

**Using Audacity (Free)**:
1. Download Audacity: https://www.audacityteam.org/
2. Open sound file
3. Effect > Normalize > Set to -3.0 dB
4. File > Export > Export as MP3

### Format Conversion
If you download WAV or other formats:
1. Open in Audacity
2. File > Export > Export as MP3
3. Quality: 128-192 kbps (good balance of quality and file size)

### Recommended Settings
- **Format**: MP3
- **Bitrate**: 128-192 kbps
- **Sample Rate**: 44100 Hz
- **Channels**: Mono (for sound effects) or Stereo
- **Target Peak**: -3.0 dB
- **File Size**: Under 100KB per file

## Testing Checklist

After adding all sound files, test in the browser:

### Rolling Phase
- [ ] Click "Got it!" button - hear die roll sound

### Night Phase
- [ ] Wake up alone - hear sneaking loop in background
- [ ] Click to peek at player - hear peek sound + random squeak
- [ ] See "cheese stolen" message - hear cheese munch + squeak

### Accomplice Phase
- [ ] Select accomplice - hear whisper sound

### Voting Phase
- [ ] Phase loads - hear voting chatter loop in background
- [ ] Cast vote - hear random squeak

### Results Phase
- [ ] Win - hear victory sound
- [ ] Lose - hear defeat sound

### Sound Toggle
- [ ] Click mute button - all sounds stop
- [ ] Click unmute - sounds resume
- [ ] Setting persists across page reloads

## Browser Compatibility

Test sound playback in:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

## Troubleshooting

### Sounds Don't Play
1. Check browser console for errors (F12)
2. Verify sound files exist in correct directory
3. Verify files are valid MP3 format
4. Check that sounds aren't muted via toggle button
5. Check browser isn't blocking audio autoplay (user interaction required)

### Sound Quality Issues
1. Re-normalize all sounds to same volume level
2. Reduce bitrate if files are too large
3. Ensure sample rate is 44100 Hz
4. Check for audio clipping (waveform touching edges)

### Performance Issues
1. Reduce file sizes (lower bitrate, shorten duration)
2. Ensure files are under 100KB each
3. Check network tab for slow loading
4. Verify preloading is working

## File Size Reference

Target file sizes (approximate):
- Short squeaks (0.5s): 10-20 KB
- Die roll (1s): 15-25 KB
- Loops (3-5s): 40-80 KB
- Victory/Defeat (2-3s): 30-50 KB

## Alternative: Using Text-to-Speech for Placeholders

If you can't find suitable sounds immediately, you can use browser TTS for placeholders:

```javascript
// Temporary placeholder code (not recommended for production)
const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
};

// Examples:
speak("Roll the dice");
speak("Squeak");
speak("Munch munch");
```

However, this is not ideal and actual sound effects will provide a much better experience.

## Final Notes

- **Placeholder files**: Currently, empty MP3 files exist as placeholders. Replace them with actual sounds.
- **User experience**: Keep volumes moderate (no sounds above 0.8 volume)
- **Accessibility**: Sound toggle allows users to disable audio if needed
- **Performance**: All sounds are preloaded for instant playback
- **Graceful degradation**: If sound files fail to load, game still works without audio

## Support

For issues or questions about the sound system implementation:
1. Check browser console for errors
2. Review `resources/js/hooks/useSound.ts` for hook logic
3. Review individual phase components for integration
4. Check `public/sounds/cheese-thief/README.md` for basic file list
