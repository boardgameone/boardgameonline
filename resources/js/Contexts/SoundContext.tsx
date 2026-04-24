import {
    createContext,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

interface PlayOptions {
    volume?: number;
}

interface SoundContextValue {
    volume: number;
    setVolume: (volume: number) => void;
    isMuted: boolean;
    toggleMuted: () => void;
    playSfx: (src: string, options?: PlayOptions) => void;
}

const MUTED_KEY = 'sfxMuted';
const VOLUME_KEY = 'sfxVolume';
const LEGACY_MUTED_KEY = 'soundMuted';
const DEFAULT_VOLUME = 0.7;
const POOL_SIZE_PER_SRC = 4;

const SoundContext = createContext<SoundContextValue | null>(null);

const readInitialMuted = (): boolean => {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        const current = localStorage.getItem(MUTED_KEY);
        if (current !== null) {
            return current === 'true';
        }

        const legacy = localStorage.getItem(LEGACY_MUTED_KEY);
        if (legacy !== null) {
            localStorage.setItem(MUTED_KEY, legacy);
            localStorage.removeItem(LEGACY_MUTED_KEY);
            return legacy === 'true';
        }
    } catch {
        // storage disabled — ignore
    }

    return false;
};

const readInitialVolume = (): number => {
    if (typeof window === 'undefined') {
        return DEFAULT_VOLUME;
    }

    try {
        const raw = localStorage.getItem(VOLUME_KEY);
        if (raw === null) {
            return DEFAULT_VOLUME;
        }

        const parsed = parseFloat(raw);
        if (Number.isFinite(parsed)) {
            return Math.max(0, Math.min(1, parsed));
        }
    } catch {
        // ignore
    }

    return DEFAULT_VOLUME;
};

interface AudioPool {
    instances: HTMLAudioElement[];
    cursor: number;
}

export function SoundProvider({ children }: PropsWithChildren) {
    const [isMuted, setIsMuted] = useState<boolean>(readInitialMuted);
    const [volume, setVolumeState] = useState<number>(readInitialVolume);

    const volumeRef = useRef(volume);
    const mutedRef = useRef(isMuted);
    const poolsRef = useRef<Map<string, AudioPool>>(new Map());

    useEffect(() => {
        volumeRef.current = volume;
    }, [volume]);

    useEffect(() => {
        mutedRef.current = isMuted;
    }, [isMuted]);

    useEffect(() => {
        const handleStorage = (event: StorageEvent) => {
            if (event.newValue === null) {
                return;
            }

            if (event.key === MUTED_KEY) {
                setIsMuted(event.newValue === 'true');
            } else if (event.key === VOLUME_KEY) {
                const parsed = parseFloat(event.newValue);
                if (Number.isFinite(parsed)) {
                    setVolumeState(Math.max(0, Math.min(1, parsed)));
                }
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    useEffect(() => {
        return () => {
            poolsRef.current.forEach((pool) => {
                pool.instances.forEach((audio) => {
                    audio.pause();
                    audio.src = '';
                });
            });
            poolsRef.current.clear();
        };
    }, []);

    const setVolume = useCallback((next: number) => {
        const clamped = Math.max(0, Math.min(1, next));
        setVolumeState(clamped);
        try {
            localStorage.setItem(VOLUME_KEY, clamped.toString());
        } catch {
            // ignore
        }
    }, []);

    const toggleMuted = useCallback(() => {
        setIsMuted((prev) => {
            const next = !prev;
            try {
                localStorage.setItem(MUTED_KEY, next ? 'true' : 'false');
            } catch {
                // ignore
            }
            return next;
        });
    }, []);

    const playSfx = useCallback((src: string, options?: PlayOptions) => {
        if (typeof window === 'undefined') {
            return;
        }

        if (mutedRef.current || volumeRef.current <= 0) {
            return;
        }

        let pool = poolsRef.current.get(src);
        if (!pool) {
            pool = { instances: [], cursor: 0 };
            poolsRef.current.set(src, pool);
        }

        let audio: HTMLAudioElement;
        if (pool.instances.length < POOL_SIZE_PER_SRC) {
            audio = new Audio(src);
            audio.preload = 'auto';
            pool.instances.push(audio);
        } else {
            audio = pool.instances[pool.cursor];
            pool.cursor = (pool.cursor + 1) % pool.instances.length;
        }

        const perPlay = options?.volume ?? 1;
        audio.volume = Math.max(0, Math.min(1, volumeRef.current * perPlay));
        audio.currentTime = 0;
        audio.play().catch(() => {
            // autoplay or decode errors — silent
        });
    }, []);

    const value = useMemo<SoundContextValue>(
        () => ({ volume, setVolume, isMuted, toggleMuted, playSfx }),
        [volume, setVolume, isMuted, toggleMuted, playSfx]
    );

    return (
        <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
    );
}

export function useSoundContext(): SoundContextValue {
    const context = useContext(SoundContext);
    if (!context) {
        throw new Error('useSoundContext must be used within a SoundProvider');
    }
    return context;
}

/**
 * Best-effort read of current SFX settings from outside React (e.g. legacy useSound hook
 * instances that live in providers before SoundProvider mounts). Falls back to localStorage.
 */
export function readSfxSettings(): { volume: number; muted: boolean } {
    return {
        volume: readInitialVolume(),
        muted: readInitialMuted(),
    };
}
