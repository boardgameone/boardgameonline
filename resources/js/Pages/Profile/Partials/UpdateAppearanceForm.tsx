import ThemeToggle from '@/Components/ThemeToggle';
import { useTheme } from '@/hooks/useTheme';

export default function UpdateAppearanceForm({
    className = '',
}: {
    className?: string;
}) {
    const { theme } = useTheme();

    return (
        <section className={className}>
            <header>
                <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                    Appearance
                </h2>

                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Toggle between light and dark mode. Your preference is saved
                    in this browser.
                </p>
            </header>

            <div className="mt-6 flex items-center gap-4">
                <ThemeToggle />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Currently: {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                </span>
            </div>
        </section>
    );
}
