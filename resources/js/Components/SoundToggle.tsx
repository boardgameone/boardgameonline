import { useSoundContext } from '@/Contexts/SoundContext';
import { SFX } from '@/lib/sfx';

interface SoundToggleProps {
    className?: string;
    showLabel?: boolean;
}

const DEFAULT_CLASSNAME =
    'rounded-full bg-white p-2 shadow-lg transition hover:scale-105 border-b-4 border-yellow-500 text-yellow-600 dark:bg-gray-800 dark:text-yellow-300 dark:border-gray-700';

export default function SoundToggle({
    className = DEFAULT_CLASSNAME,
    showLabel = false,
}: SoundToggleProps) {
    const { isMuted, toggleMuted, playSfx } = useSoundContext();
    const label = isMuted ? 'Unmute sound effects' : 'Mute sound effects';

    const handleClick = () => {
        // If we're about to unmute, play the toggle sound AFTER unmute so the user hears it.
        // If we're muting, play it BEFORE so it's still audible as feedback.
        if (isMuted) {
            toggleMuted();
            // Defer a tick so the context state propagates before we play.
            setTimeout(() => playSfx(SFX.UI_TOGGLE), 0);
        } else {
            playSfx(SFX.UI_TOGGLE);
            toggleMuted();
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
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
                        {/* Bell with slash */}
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6.75 6M3 3l18 18M6 8.25v1.5c0 2.485-.67 4.812-1.832 6.824A23.87 23.87 0 0 0 9.143 17.082m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
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
                        {/* Bell */}
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9a6 6 0 0 0-12 0v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m6.714 0a24.255 24.255 0 0 1-6.714 0m6.714 0a3 3 0 1 1-6.714 0"
                        />
                    </svg>
                )}
                {showLabel && (
                    <span className="text-sm font-medium">
                        {isMuted ? 'Sounds off' : 'Sounds on'}
                    </span>
                )}
            </span>
        </button>
    );
}
