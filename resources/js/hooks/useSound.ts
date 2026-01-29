import { useEffect, useRef, useState } from 'react';

interface UseSoundOptions {
    volume?: number;
    loop?: boolean;
    preload?: boolean;
}

interface UseSoundReturn {
    play: () => void;
    stop: () => void;
    isPlaying: boolean;
    isLoaded: boolean;
}

/**
 * React hook for playing sound effects
 *
 * @param src - Path to the sound file (e.g., '/sounds/cheese-thief/die-roll.mp3')
 * @param options - Optional configuration (volume, loop, preload)
 * @returns Object with play/stop controls and status
 *
 * @example
 * const { play, stop, isPlaying } = useSound('/sounds/cheese-thief/die-roll.mp3', { volume: 0.8 });
 *
 * // Play the sound
 * play();
 */
export function useSound(
    src: string,
    options: UseSoundOptions = {}
): UseSoundReturn {
    const {
        volume = 0.8,
        loop = false,
        preload = true,
    } = options;

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    // Check if sound is muted via localStorage
    const isMuted = () => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('soundMuted') === 'true';
    };

    useEffect(() => {
        // Create audio element
        const audio = new Audio(src);
        audio.volume = volume;
        audio.loop = loop;

        if (preload) {
            audio.preload = 'auto';
        }

        // Event listeners
        const handleCanPlay = () => setIsLoaded(true);
        const handleEnded = () => setIsPlaying(false);
        const handleError = (e: ErrorEvent) => {
            console.warn(`Failed to load sound: ${src}`, e);
            setIsLoaded(false);
        };

        audio.addEventListener('canplaythrough', handleCanPlay);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError as EventListener);

        audioRef.current = audio;

        // Cleanup
        return () => {
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError as EventListener);
            audio.pause();
            audio.src = '';
        };
    }, [src, volume, loop, preload]);

    const play = () => {
        if (!audioRef.current || isMuted()) return;

        // Reset to start if already playing
        audioRef.current.currentTime = 0;

        audioRef.current.play().catch((error) => {
            console.warn('Failed to play sound:', error);
        });

        setIsPlaying(true);
    };

    const stop = () => {
        if (!audioRef.current) return;

        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
    };

    return { play, stop, isPlaying, isLoaded };
}

/**
 * Helper hook for playing random sounds from a list
 *
 * @param sounds - Array of sound file paths
 * @param options - Optional configuration
 * @returns Object with playRandom function and status
 *
 * @example
 * const { playRandom } = useRandomSound([
 *   '/sounds/cheese-thief/squeak-1.mp3',
 *   '/sounds/cheese-thief/squeak-2.mp3',
 *   '/sounds/cheese-thief/squeak-3.mp3',
 * ]);
 */
export function useRandomSound(
    sounds: string[],
    options: UseSoundOptions = {}
): { playRandom: () => void } {
    const audioRefs = useRef<HTMLAudioElement[]>([]);

    useEffect(() => {
        // Create audio elements for all sounds
        audioRefs.current = sounds.map((src) => {
            const audio = new Audio(src);
            audio.volume = options.volume ?? 0.8;
            audio.preload = options.preload !== false ? 'auto' : 'none';
            return audio;
        });

        // Cleanup
        return () => {
            audioRefs.current.forEach((audio) => {
                audio.pause();
                audio.src = '';
            });
        };
    }, [sounds, options.volume, options.preload]);

    const playRandom = () => {
        // Check if muted
        if (typeof window !== 'undefined' && localStorage.getItem('soundMuted') === 'true') {
            return;
        }

        if (audioRefs.current.length === 0) return;

        const randomIndex = Math.floor(Math.random() * audioRefs.current.length);
        const audio = audioRefs.current[randomIndex];

        audio.currentTime = 0;
        audio.play().catch((error) => {
            console.warn('Failed to play random sound:', error);
        });
    };

    return { playRandom };
}

/**
 * Utility functions for managing global sound settings
 */
export const soundUtils = {
    isMuted: (): boolean => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('soundMuted') === 'true';
    },

    setMuted: (muted: boolean): void => {
        if (typeof window === 'undefined') return;
        localStorage.setItem('soundMuted', muted ? 'true' : 'false');
    },

    toggleMuted: (): boolean => {
        const newState = !soundUtils.isMuted();
        soundUtils.setMuted(newState);
        return newState;
    },
};
