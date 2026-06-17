import {
    createContext,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';

export type Theme = 'light' | 'dark' | 'grayscale';

const THEMES: readonly Theme[] = ['light', 'dark', 'grayscale'];

const isTheme = (value: unknown): value is Theme =>
    typeof value === 'string' && (THEMES as readonly string[]).includes(value);

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
}

const STORAGE_KEY = 'theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Read the initial theme from the DOM (set by the FOUC script in app.blade.php).
 * Falling through to 'light' keeps this SSR-safe — the effect below will reconcile
 * once the document is available.
 */
const getInitialTheme = (): Theme => {
    if (typeof document === 'undefined') {
        return 'light';
    }

    const classes = document.documentElement.classList;
    if (classes.contains('grayscale')) return 'grayscale';
    if (classes.contains('dark')) return 'dark';
    return 'light';
};

export function ThemeProvider({ children }: PropsWithChildren) {
    const [theme, setThemeState] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        const root = document.documentElement.classList;
        root.toggle('dark', theme === 'dark');
        root.toggle('grayscale', theme === 'grayscale');

        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (e) {
            // Private-mode or disabled storage — ignore.
        }
    }, [theme]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== STORAGE_KEY || !event.newValue) {
                return;
            }

            if (isTheme(event.newValue)) {
                setThemeState(event.newValue);
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const setTheme = useCallback((next: Theme) => {
        setThemeState(next);
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState((current) => {
            const idx = THEMES.indexOf(current);
            return THEMES[(idx + 1) % THEMES.length];
        });
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }

    return context;
}
