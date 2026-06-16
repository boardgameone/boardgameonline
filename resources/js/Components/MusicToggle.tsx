import { useMusic } from '@/Contexts/MusicContext';

interface MusicToggleProps {
    className?: string;
    showLabel?: boolean;
}

const DEFAULT_CLASSNAME =
    'rounded-full bg-white p-2 shadow-lg transition hover:scale-105 border-b-4 border-yellow-500 text-yellow-600 dark:bg-gray-800 sepia:bg-sepia-surface dark:text-yellow-300 sepia:text-sepia-accent dark:border-gray-700 sepia:border-sepia-border';

export default function MusicToggle({
    className = DEFAULT_CLASSNAME,
    showLabel = false,
}: MusicToggleProps) {
    const { isMuted, toggleMuted } = useMusic();
    const label = isMuted ? 'Unmute music' : 'Mute music';

    return (
        <button
            type="button"
            onClick={toggleMuted}
            aria-label={label}
            aria-pressed={isMuted}
            title={label}
            className={className}
        >
            <span className="flex items-center gap-2">
                {isMuted ? (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-5 w-5"
                    >
                        {/* Musical note with a slash */}
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 18V6.75a.75.75 0 0 1 .568-.728l7.5-1.875A.75.75 0 0 1 18 4.875V8"
                        />
                        <circle cx="6.75" cy="18" r="2.25" strokeLinecap="round" strokeLinejoin="round" />
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 4l16 16"
                        />
                    </svg>
                ) : (
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="h-5 w-5"
                    >
                        {/* Musical note (single eighth note) */}
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 18V6.75a.75.75 0 0 1 .568-.728l7.5-1.875A.75.75 0 0 1 18 4.875V15.75"
                        />
                        <circle cx="6.75" cy="18" r="2.25" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="15.75" cy="15.75" r="2.25" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                )}
                {showLabel && (
                    <span className="text-sm font-medium">
                        {isMuted ? 'Music off' : 'Music on'}
                    </span>
                )}
            </span>
        </button>
    );
}
