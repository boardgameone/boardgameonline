import {
    createContext,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react';

export type Theme = 'light' | 'dark';

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

    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
};

export function ThemeProvider({ children }: PropsWithChildren) {
    const [theme, setThemeState] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        if (typeof document === 'undefined') {
            return;
        }

        document.documentElement.classList.toggle('dark', theme === 'dark');

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

            if (event.newValue === 'light' || event.newValue === 'dark') {
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
        setThemeState((current) => (current === 'dark' ? 'light' : 'dark'));
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
