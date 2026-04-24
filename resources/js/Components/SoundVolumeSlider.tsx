import { ChangeEvent } from 'react';
import { useSoundContext } from '@/Contexts/SoundContext';

interface SoundVolumeSliderProps {
    className?: string;
    showLabel?: boolean;
}

export default function SoundVolumeSlider({
    className = '',
    showLabel = false,
}: SoundVolumeSliderProps) {
    const { volume, setVolume, isMuted } = useSoundContext();
    const percent = Math.round(volume * 100);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        setVolume(parseFloat(event.target.value));
    };

    return (
        <div
            className={`flex items-center gap-2 ${className}`}
            aria-label="Sound effects volume"
        >
            {showLabel && (
                <span className="text-sm font-medium whitespace-nowrap">
                    Sound effects
                </span>
            )}
            <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={volume}
                onChange={handleChange}
                disabled={isMuted}
                aria-label="Sound effects volume"
                className="flex-1 min-w-20 h-2 rounded-full appearance-none cursor-pointer bg-yellow-200 dark:bg-gray-700 accent-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            {showLabel && (
                <span className="text-xs tabular-nums w-10 text-right opacity-80">
                    {percent}%
                </span>
            )}
        </div>
    );
}
