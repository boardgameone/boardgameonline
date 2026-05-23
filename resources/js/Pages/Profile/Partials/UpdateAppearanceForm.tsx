import ThemeToggle from '@/Components/ThemeToggle';
import { useTheme } from '@/hooks/useTheme';
import { Theme } from '@/theme';

const THEME_LABELS: Record<Theme, string> = {
    light: 'Light mode',
    dark: 'Dark mode',
    sepia: 'Sepia mode',
};

export default function UpdateAppearanceForm({
    className = '',
}: {
    className?: string;
}) {
    const { theme } = useTheme();

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 sepia:text-sepia-text">
                    Appearance
                </h2>

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 sepia:text-sepia-muted">
                    Choose between light, dark, and sepia mode. Your preference
                    is saved in this browser.
                </p>
            </header>

            <div className="mt-6 flex items-center gap-4">
                <ThemeToggle />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 sepia:text-sepia-muted">
                    Currently: {THEME_LABELS[theme]}
                </span>
            </div>
        </section>
    );
}
