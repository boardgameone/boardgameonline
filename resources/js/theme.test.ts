import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    cycleTheme,
    getPreferredTheme,
    getStoredTheme,
    getTheme,
    normalizeTheme,
    setTheme,
    STORAGE_KEY,
    THEMES,
} from '@/theme';

function mockMatchMedia(prefersDark: boolean) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: prefersDark && query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    mockMatchMedia(false);
});

describe('normalizeTheme', () => {
    it('passes through valid themes', () => {
        expect(normalizeTheme('light')).toBe('light');
        expect(normalizeTheme('dark')).toBe('dark');
        expect(normalizeTheme('sepia')).toBe('sepia');
    });

    it('falls back to light for unknown / null values', () => {
        expect(normalizeTheme('banana')).toBe('light');
        expect(normalizeTheme(null)).toBe('light');
        expect(normalizeTheme(undefined)).toBe('light');
        expect(normalizeTheme(42)).toBe('light');
    });
});

describe('getStoredTheme', () => {
    it('returns null when nothing is stored', () => {
        expect(getStoredTheme()).toBeNull();
    });

    it('returns the stored theme', () => {
        localStorage.setItem(STORAGE_KEY, 'sepia');
        expect(getStoredTheme()).toBe('sepia');
    });

    it('normalizes an unknown stored value to light', () => {
        localStorage.setItem(STORAGE_KEY, 'banana');
        expect(getStoredTheme()).toBe('light');
    });
});

describe('getPreferredTheme', () => {
    it('defaults to light when unstored and OS does not prefer dark', () => {
        mockMatchMedia(false);
        expect(getPreferredTheme()).toBe('light');
    });

    it('uses prefers-color-scheme: dark only when unstored', () => {
        mockMatchMedia(true);
        expect(getPreferredTheme()).toBe('dark');
    });

    it('honors a stored preference over the OS setting', () => {
        mockMatchMedia(true);
        localStorage.setItem(STORAGE_KEY, 'light');
        expect(getPreferredTheme()).toBe('light');
    });

    it('never auto-selects sepia from the OS', () => {
        mockMatchMedia(true);
        expect(getPreferredTheme()).not.toBe('sepia');
    });
});

describe('setTheme', () => {
    it('persists and applies the dark class', () => {
        setTheme('dark');
        expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        expect(document.documentElement.classList.contains('sepia')).toBe(
            false,
        );
    });

    it('applies the theme-sepia class (not the bare sepia filter utility)', () => {
        setTheme('sepia');
        expect(
            document.documentElement.classList.contains('theme-sepia'),
        ).toBe(true);
        // Must NOT use the bare `sepia` class — that is Tailwind's filter utility.
        expect(document.documentElement.classList.contains('sepia')).toBe(
            false,
        );
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('light adds no theme class (mutual exclusivity)', () => {
        setTheme('dark');
        setTheme('light');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(
            document.documentElement.classList.contains('theme-sepia'),
        ).toBe(false);
    });

    it('switching themes never leaves two classes present', () => {
        setTheme('dark');
        setTheme('sepia');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(
            document.documentElement.classList.contains('theme-sepia'),
        ).toBe(true);
    });

    it('dispatches a themechange event carrying the new theme', () => {
        const handler = vi.fn();
        document.addEventListener('themechange', handler);
        setTheme('sepia');
        expect(handler).toHaveBeenCalledOnce();
        const event = handler.mock.calls[0][0] as CustomEvent<{
            theme: string;
        }>;
        expect(event.detail.theme).toBe('sepia');
        document.removeEventListener('themechange', handler);
    });

    it('normalizes an unknown theme to light', () => {
        setTheme('banana' as never);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('light');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
        expect(
            document.documentElement.classList.contains('theme-sepia'),
        ).toBe(false);
    });
});

describe('getTheme', () => {
    it('reflects the class on <html>', () => {
        expect(getTheme()).toBe('light');
        setTheme('sepia');
        expect(getTheme()).toBe('sepia');
        setTheme('dark');
        expect(getTheme()).toBe('dark');
    });
});

describe('cycleTheme', () => {
    it('cycles light -> sepia -> dark -> light', () => {
        setTheme('light');
        expect(cycleTheme()).toBe('sepia');
        expect(cycleTheme()).toBe('dark');
        expect(cycleTheme()).toBe('light');
    });

    it('exposes the themes in the expected order', () => {
        expect([...THEMES]).toEqual(['light', 'sepia', 'dark']);
    });
});
