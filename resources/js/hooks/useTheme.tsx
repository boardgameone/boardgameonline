import {
    createContext,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';
import {
    getTheme as getThemeFromDom,
    normalizeTheme,
    setTheme as setThemeModule,
    STORAGE_KEY,
    Theme,
    THEMES,
} from '@/theme';

export type { Theme };

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
    cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Read the initial theme from the DOM (set by the FOUC script in app.blade.php).
 * Falling through to 'light' keeps this SSR-safe — the effect below will
 * reconcile once the document is available.
 */
const getInitialTheme = (): Theme => getThemeFromDom();

export function ThemeProvider({ children }: PropsWithChildren) {
    const [theme, setThemeState] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        setThemeModule(theme);
    }, [theme]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const handleStorage = (event: StorageEvent) => {
            if (event.key !== STORAGE_KEY || !event.newValue) {
                return;
            }

            setThemeState(normalizeTheme(event.newValue));
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    const setTheme = useCallback((next: Theme) => {
        setThemeState(normalizeTheme(next));
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
    }, []);

    const cycleTheme = useCallback(() => {
        setThemeState((current) => {
            const index = THEMES.indexOf(current);
            return THEMES[(index + 1) % THEMES.length];
        });
    }, []);

    return (
        <ThemeContext.Provider
            value={{ theme, setTheme, toggleTheme, cycleTheme }}
        >
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
