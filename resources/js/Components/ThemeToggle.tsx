import type { ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Theme, THEMES } from '@/theme';

interface ThemeToggleProps {
    /** Styles the outer wrapper. In compact mode (no `showLabel`) it overrides the pill styling. */
    className?: string;
    /** Render as a full-width menu row with a leading "Theme" caption (dropdowns / mobile menus). */
    showLabel?: boolean;
}

const ICON_CLASS = 'h-5 w-5';

function SunIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className={ICON_CLASS}
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 3v1.5m0 15V21m9-9h-1.5M4.5 12H3m15.364-6.364l-1.06 1.06M6.696 17.304l-1.06 1.06m12.728 0l-1.06-1.06M6.696 6.696l-1.06-1.06M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
            />
        </svg>
    );
}

function BookOpenIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className={ICON_CLASS}
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
            />
        </svg>
    );
}

function MoonIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className={ICON_CLASS}
            aria-hidden="true"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
            />
        </svg>
    );
}

const THEME_META: Record<Theme, { label: string; Icon: () => ReactNode }> = {
    light: { label: 'Light', Icon: SunIcon },
    sepia: { label: 'Sepia', Icon: BookOpenIcon },
    dark: { label: 'Dark', Icon: MoonIcon },
};

const PILL_CLASSNAME =
    'inline-flex items-center gap-1 rounded-full bg-white p-1 shadow-lg border-b-4 border-yellow-500 dark:bg-gray-800 dark:border-gray-700 sepia:bg-sepia-surface sepia:border-sepia-accent-border';

const ACTIVE_BUTTON =
    'bg-yellow-400 text-yellow-900 dark:bg-yellow-300 dark:text-gray-900 sepia:bg-sepia-accent sepia:text-sepia-bg';

const INACTIVE_BUTTON =
    'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 sepia:text-sepia-muted sepia:hover:text-sepia-text';

export default function ThemeToggle({
    className,
    showLabel = false,
}: ThemeToggleProps) {
    const { theme, setTheme } = useTheme();

    const pill = (
        <div
            role="group"
            aria-label="Theme"
            className={showLabel ? PILL_CLASSNAME : (className ?? PILL_CLASSNAME)}
        >
            {THEMES.map((value) => {
                const { label, Icon } = THEME_META[value];
                const active = theme === value;
                const title = `Switch to ${label.toLowerCase()} mode`;

                return (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setTheme(value)}
                        aria-pressed={active}
                        aria-label={title}
                        title={title}
                        className={
                            'flex items-center justify-center rounded-full p-1.5 transition focus:outline-hidden focus-visible:ring-2 focus-visible:ring-yellow-500 ' +
                            (active ? ACTIVE_BUTTON : INACTIVE_BUTTON)
                        }
                    >
                        <Icon />
                    </button>
                );
            })}
        </div>
    );

    if (showLabel) {
        return (
            <div className={className}>
                <span className="text-sm font-medium">Theme</span>
                {pill}
            </div>
        );
    }

    return pill;
}
