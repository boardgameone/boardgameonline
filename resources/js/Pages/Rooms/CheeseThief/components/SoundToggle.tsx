import { useState, useEffect } from 'react';
import { soundUtils } from '@/hooks/useSound';

export default function SoundToggle() {
    const [isMuted, setIsMuted] = useState(soundUtils.isMuted());

    const handleToggle = () => {
        const newState = soundUtils.toggleMuted();
        setIsMuted(newState);
    };

    return (
        <button
            onClick={handleToggle}
            className="fixed top-4 right-4 flex items-center gap-2 rounded-lg bg-white px-4 py-2 shadow-lg transition-all hover:scale-105 hover:shadow-xl border border-gray-200"
            title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
        >
            <span className="text-xl">
                {isMuted ? '\u{1F507}' : '\u{1F50A}'}
            </span>
            <span className="text-sm font-medium text-gray-700">
                {isMuted ? 'Muted' : 'Sound On'}
            </span>
        </button>
    );
}
