import {
    createContext,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

interface MusicContextValue {
    isMuted: boolean;
    isPlaying: boolean;
    toggleMuted: () => void;
    volume: number;
    setVolume: (volume: number) => void;
}

const MUSIC_SRC = '/sounds/bg-music.mp3';
const STORAGE_KEY = 'musicMuted';
const DEFAULT_VOLUME = 0.22;

const MusicContext = createContext<MusicContextValue | null>(null);

const readInitialMuted = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (e) {
        return false;
    }
};

export function MusicProvider({ children }: PropsWithChildren) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isMuted, setIsMuted] = useState<boolean>(readInitialMuted);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolumeState] = useState<number>(DEFAULT_VOLUME);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const audio = new Audio(MUSIC_SRC);
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = DEFAULT_VOLUME;

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);

        audioRef.current = audio;

        const startOnGesture = () => {
            window.removeEventListener('pointerdown', startOnGesture, true);
            window.removeEventListener('keydown', startOnGesture, true);

            if (localStorage.getItem(STORAGE_KEY) === 'true') {
                return;
            }

            audio.load();
            audio.play().catch((error) => {
                console.warn('Background music autoplay failed:', error);
            });
        };

        window.addEventListener('pointerdown', startOnGesture, { capture: true, once: true });
        window.addEventListener('keydown', startOnGesture, { capture: true, once: true });

        return () => {
            window.removeEventListener('pointerdown', startOnGesture, true);
            window.removeEventListener('keydown', startOnGesture, true);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.pause();
            audio.src = '';
            audioRef.current = null;
        };
    }, []);

    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== STORAGE_KEY || event.newValue === null) {
                return;
            }

            setIsMuted(event.newValue === 'true');
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const toggleMuted = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) {
            return;
        }

        const next = !isMuted;
        setIsMuted(next);

        try {
            localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
        } catch (e) {
            // storage disabled — ignore
        }

        if (next) {
            audio.pause();
        } else {
            audio.play().catch((error) => {
                console.warn('Background music play failed:', error);
            });
        }
    }, [isMuted]);

    const setVolume = useCallback((next: number) => {
        const clamped = Math.max(0, Math.min(1, next));
        setVolumeState(clamped);
        if (audioRef.current) {
            audioRef.current.volume = clamped;
        }
    }, []);

    return (
        <MusicContext.Provider
            value={{ isMuted, isPlaying, toggleMuted, volume, setVolume }}
        >
            {children}
        </MusicContext.Provider>
    );
}

export function useMusic(): MusicContextValue {
    const context = useContext(MusicContext);

    if (!context) {
        throw new Error('useMusic must be used within a MusicProvider');
    }

    return context;
}
