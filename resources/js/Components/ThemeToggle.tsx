import { ReactElement } from 'react';
import { useTheme, Theme } from '@/hooks/useTheme';

interface ThemeToggleProps {
    className?: string;
    showLabel?: boolean;
}

const DEFAULT_CLASSNAME =
    'rounded-full bg-white p-2 shadow-lg transition hover:scale-105 border-b-4 border-yellow-500 text-yellow-600 dark:bg-gray-800 dark:text-yellow-300 dark:border-gray-700';

const NEXT_THEME: Record<Theme, Theme> = {
    light: 'dark',
    dark: 'grayscale',
    grayscale: 'light',
};

const THEME_LABEL: Record<Theme, string> = {
    light: 'Light mode',
    dark: 'Dark mode',
    grayscale: 'Grayscale mode',
};

const SunIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className="h-5 w-5"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1.5m0 15V21m9-9h-1.5M4.5 12H3m15.364-6.364l-1.06 1.06M6.696 17.304l-1.06 1.06m12.728 0l-1.06-1.06M6.696 6.696l-1.06-1.06M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
        />
    </svg>
);

const MoonIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className="h-5 w-5"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
        />
    </svg>
);

const ContrastIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        className="h-5 w-5"
    >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18" fill="currentColor" stroke="none" />
        <path strokeLinecap="round" d="M12 3a9 9 0 010 18" fill="currentColor" />
    </svg>
);

const ICON: Record<Theme, () => ReactElement> = {
    light: SunIcon,
    dark: MoonIcon,
    grayscale: ContrastIcon,
};

export default function ThemeToggle({
    className = DEFAULT_CLASSNAME,
    showLabel = false,
}: ThemeToggleProps) {
    const { theme, setTheme } = useTheme();
    const next = NEXT_THEME[theme];
    const label = `Switch to ${THEME_LABEL[next].toLowerCase()}`;
    const Icon = ICON[theme];

    return (
        <button
            type="button"
            onClick={() => setTheme(next)}
            aria-label={label}
            title={label}
            className={className}
        >
            <span className="flex items-center gap-2">
                <Icon />
                {showLabel && (
                    <span className="text-sm font-medium">
                        {THEME_LABEL[theme]}
                    </span>
                )}
            </span>
        </button>
    );
}
