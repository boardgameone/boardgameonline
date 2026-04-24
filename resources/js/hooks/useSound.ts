import { useEffect, useMemo, useRef, useState } from 'react';
import { useSoundContext } from '@/Contexts/SoundContext';

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
 * React hook for playing sound effects. Honors the global SFX volume + mute
 * from SoundContext. Effective playback volume = options.volume * context.volume.
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

    const { volume: globalVolume, isMuted } = useSoundContext();

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    const baseVolumeRef = useRef(volume);
    useEffect(() => {
        baseVolumeRef.current = volume;
    }, [volume]);

    useEffect(() => {
        const audio = new Audio(src);
        audio.volume = Math.max(0, Math.min(1, volume * globalVolume));
        audio.loop = loop;

        if (preload) {
            audio.preload = 'auto';
        }

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

        return () => {
            audio.removeEventListener('canplaythrough', handleCanPlay);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError as EventListener);
            audio.pause();
            audio.src = '';
        };
        // Intentionally omit globalVolume — we update audio.volume live below without rebuilding the element.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src, loop, preload]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = Math.max(0, Math.min(1, baseVolumeRef.current * globalVolume));
        }
    }, [globalVolume]);

    const api = useMemo<UseSoundReturn>(() => ({
        play: () => {
            if (!audioRef.current || isMuted || globalVolume <= 0) return;
            audioRef.current.currentTime = 0;
            audioRef.current.volume = Math.max(0, Math.min(1, baseVolumeRef.current * globalVolume));
            audioRef.current.play().catch((error) => {
                console.warn('Failed to play sound:', error);
            });
            setIsPlaying(true);
        },
        stop: () => {
            if (!audioRef.current) return;
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        },
        isPlaying,
        isLoaded,
    }), [isMuted, globalVolume, isPlaying, isLoaded]);

    return api;
}

/**
 * Helper hook for playing random sounds from a list. Respects global SFX mute + volume.
 */
export function useRandomSound(
    sounds: string[],
    options: UseSoundOptions = {}
): { playRandom: () => void } {
    const { volume: globalVolume, isMuted } = useSoundContext();
    const audioRefs = useRef<HTMLAudioElement[]>([]);
    const baseVolumeRef = useRef(options.volume ?? 0.8);

    useEffect(() => {
        baseVolumeRef.current = options.volume ?? 0.8;
    }, [options.volume]);

    useEffect(() => {
        audioRefs.current = sounds.map((src) => {
            const audio = new Audio(src);
            audio.volume = Math.max(0, Math.min(1, (options.volume ?? 0.8) * globalVolume));
            audio.preload = options.preload !== false ? 'auto' : 'none';
            return audio;
        });

        return () => {
            audioRefs.current.forEach((audio) => {
                audio.pause();
                audio.src = '';
            });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sounds, options.preload]);

    useEffect(() => {
        audioRefs.current.forEach((audio) => {
            audio.volume = Math.max(0, Math.min(1, baseVolumeRef.current * globalVolume));
        });
    }, [globalVolume]);

    const playRandom = () => {
        if (isMuted || globalVolume <= 0) return;
        if (audioRefs.current.length === 0) return;

        const randomIndex = Math.floor(Math.random() * audioRefs.current.length);
        const audio = audioRefs.current[randomIndex];

        audio.currentTime = 0;
        audio.volume = Math.max(0, Math.min(1, baseVolumeRef.current * globalVolume));
        audio.play().catch((error) => {
            console.warn('Failed to play random sound:', error);
        });
    };

    return { playRandom };
}
