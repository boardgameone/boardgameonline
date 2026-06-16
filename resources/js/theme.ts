/**
 * Centralized theme logic for the light / dark / sepia theme system.
 *
 * This module is the single source of truth for reading, applying, and
 * persisting the active theme. The React layer (`hooks/useTheme.tsx`) and any
 * other script can import these helpers. The pre-paint script in
 * `resources/views/app.blade.php` intentionally mirrors a few lines of this
 * logic inline — it must run before this module is loaded to avoid a flash of
 * the wrong theme, so it cannot import from here.
 */

export type Theme = 'light' | 'dark' | 'sepia';

/**
 * Display order for the segmented toggle and the cycle helper:
 * light → sepia → dark → (wraps to light).
 */
export const THEMES: readonly Theme[] = ['light', 'sepia', 'dark'];

export const STORAGE_KEY = 'theme';

/**
 * The `<html>` class for each non-light theme. Sepia uses `theme-sepia` rather
 * than `sepia` because `sepia` is a built-in Tailwind filter utility — naming
 * the class `sepia` would apply `filter: sepia()` to the whole page.
 */
const THEME_CLASS: Record<Exclude<Theme, 'light'>, string> = {
    dark: 'dark',
    sepia: 'theme-sepia',
};

const ALL_THEME_CLASSES = Object.values(THEME_CLASS);

/**
 * Map any value (unknown localStorage contents, missing keys) to a valid
 * theme. Anything that is not a recognised theme falls back to `light`.
 */
export function normalizeTheme(value: unknown): Theme {
    return value === 'dark' || value === 'sepia' || value === 'light'
        ? value
        : 'light';
}

/**
 * Read the persisted theme from localStorage. Returns `null` when nothing has
 * been stored (so callers can distinguish "no preference" from "light"), or
 * when storage is unavailable (private mode / disabled).
 */
export function getStoredTheme(): Theme | null {
    if (typeof localStorage === 'undefined') {
        return null;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === null) {
            return null;
        }

        return normalizeTheme(stored);
    } catch {
        return null;
    }
}

/**
 * The theme to use when initialising: the stored preference if present,
 * otherwise the OS `prefers-color-scheme`. Sepia is never auto-selected — it
 * is only ever an explicit user choice persisted in storage.
 */
export function getPreferredTheme(): Theme {
    const stored = getStoredTheme();
    if (stored !== null) {
        return stored;
    }

    if (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
        return 'dark';
    }

    return 'light';
}

/**
 * Apply the theme class to `<html>`, enforcing mutual exclusivity: remove every
 * theme class first, then add the one for the active theme. `light` adds none.
 */
export function applyThemeClass(theme: Theme): void {
    if (typeof document === 'undefined') {
        return;
    }

    const root = document.documentElement;
    root.classList.remove(...ALL_THEME_CLASSES);

    if (theme === 'dark' || theme === 'sepia') {
        root.classList.add(THEME_CLASS[theme]);
    }
}

/**
 * The theme currently applied to `<html>`, derived from its classes.
 */
export function getTheme(): Theme {
    if (typeof document === 'undefined') {
        return 'light';
    }

    const root = document.documentElement;
    if (root.classList.contains(THEME_CLASS.sepia)) {
        return 'sepia';
    }
    if (root.classList.contains(THEME_CLASS.dark)) {
        return 'dark';
    }

    return 'light';
}

/**
 * Set the active theme: apply the class, persist the choice, and notify
 * listeners via a `themechange` event so non-React code (game canvases, charts)
 * can react.
 */
export function setTheme(theme: Theme): Theme {
    const next = normalizeTheme(theme);

    applyThemeClass(next);

    if (typeof localStorage !== 'undefined') {
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Private-mode or disabled storage — ignore.
        }
    }

    if (typeof document !== 'undefined') {
        document.dispatchEvent(
            new CustomEvent<{ theme: Theme }>('themechange', {
                detail: { theme: next },
            }),
        );
    }

    return next;
}

/**
 * Advance to the next theme in {@link THEMES} order and apply it.
 * Returns the theme that was activated.
 */
export function cycleTheme(): Theme {
    const current = getTheme();
    const index = THEMES.indexOf(current);
    const next = THEMES[(index + 1) % THEMES.length];

    return setTheme(next);
}
