import { useState } from 'react';
import { soundUtils } from '@/hooks/useSound';
import GameIcon from '@/Components/GameIcon';

export default function SoundToggle() {
    const [isMuted, setIsMuted] = useState(soundUtils.isMuted());

    const handleToggle = () => {
        const newState = soundUtils.toggleMuted();
        setIsMuted(newState);
    };

    return (
        <button
            onClick={handleToggle}
            className="flex items-center gap-2 rounded-lg bg-white/90 backdrop-blur-sm px-3 py-1.5 shadow-md transition-all hover:scale-105 hover:shadow-lg border border-white/50 text-gray-700"
            title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
        >
            <GameIcon name={isMuted ? 'muted' : 'speaker'} size="sm" />
            <span className="text-sm font-medium">
                {isMuted ? 'Muted' : 'Sound On'}
            </span>
        </button>
    );
}
