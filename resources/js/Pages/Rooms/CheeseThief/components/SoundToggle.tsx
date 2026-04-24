import { useSoundContext } from '@/Contexts/SoundContext';
import GameIcon from '@/Components/GameIcon';

export default function SoundToggle() {
    const { isMuted, toggleMuted } = useSoundContext();

    return (
        <button
            onClick={toggleMuted}
            className="flex items-center gap-2 rounded-lg bg-white/90 backdrop-blur-xs px-3 py-1.5 shadow-md transition-all hover:scale-105 hover:shadow-lg border border-white/50 text-gray-700 dark:bg-gray-800/90 dark:border-gray-700/50 dark:text-gray-300"
            title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
        >
            <GameIcon name={isMuted ? 'muted' : 'speaker'} size="sm" />
            <span className="text-sm font-medium">
                {isMuted ? 'Muted' : 'Sound On'}
            </span>
        </button>
    );
}
