import MusicToggle from '@/Components/MusicToggle';
import MusicVolumeSlider from '@/Components/MusicVolumeSlider';
import SoundToggle from '@/Components/SoundToggle';
import SoundVolumeSlider from '@/Components/SoundVolumeSlider';

type Variant = 'guest' | 'authenticated' | 'game';
type Layout = 'horizontal' | 'stacked';

interface AudioControlsProps {
    variant?: Variant;
    layout?: Layout;
    showLabel?: boolean;
    className?: string;
}

const PILL_BASE = 'flex items-center shadow-lg';

const PILL_VARIANTS: Record<Variant, string> = {
    guest:
        'bg-white/60 dark:bg-gray-800/70 border-b-4 border-yellow-500 dark:border-gray-700 rounded-full px-3 py-1.5',
    authenticated:
        'bg-white/15 backdrop-blur-xs rounded-full px-3 py-1.5',
    game:
        'bg-white/15 backdrop-blur-xs rounded-full px-3 py-1.5',
};

const TOGGLE_CLASS: Record<Variant, string> = {
    guest: 'rounded-full bg-white dark:bg-gray-800 p-1.5 text-yellow-600 dark:text-yellow-300 hover:scale-105 transition',
    authenticated:
        'rounded-full bg-white/80 dark:bg-gray-800/80 p-1.5 text-yellow-600 dark:text-yellow-300 hover:scale-105 transition',
    game: 'rounded-full bg-white/80 dark:bg-gray-800/80 p-1.5 text-yellow-600 dark:text-yellow-300 hover:scale-105 transition',
};

const SLIDER_COLOR: Record<Variant, string> = {
    guest: 'text-yellow-700 dark:text-yellow-300',
    authenticated: 'text-white',
    game: 'text-white',
};

const DIVIDER_CLASS: Record<Variant, string> = {
    guest: 'w-px h-5 bg-yellow-500/50 dark:bg-gray-600 mx-1',
    authenticated: 'w-px h-5 bg-white/40 mx-1',
    game: 'w-px h-5 bg-white/40 mx-1',
};

export default function AudioControls({
    variant = 'guest',
    layout = 'horizontal',
    showLabel = false,
    className = '',
}: AudioControlsProps) {
    if (layout === 'stacked') {
        return (
            <div className={`flex flex-col gap-2 ${className}`}>
                <div className="flex items-center gap-2">
                    <MusicToggle className={TOGGLE_CLASS[variant]} />
                    <MusicVolumeSlider
                        className={`flex-1 ${SLIDER_COLOR[variant]}`}
                        showLabel={showLabel}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <SoundToggle className={TOGGLE_CLASS[variant]} />
                    <SoundVolumeSlider
                        className={`flex-1 ${SLIDER_COLOR[variant]}`}
                        showLabel={showLabel}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className={`${PILL_BASE} ${PILL_VARIANTS[variant]} gap-2 ${className}`}>
            <MusicToggle className={TOGGLE_CLASS[variant]} />
            <MusicVolumeSlider className={`w-14 sm:w-20 ${SLIDER_COLOR[variant]}`} />
            <span className={DIVIDER_CLASS[variant]} aria-hidden="true" />
            <SoundToggle className={TOGGLE_CLASS[variant]} />
            <SoundVolumeSlider className={`w-14 sm:w-20 ${SLIDER_COLOR[variant]}`} />
        </div>
    );
}
