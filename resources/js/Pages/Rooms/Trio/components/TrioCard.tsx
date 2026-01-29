import { CardPattern } from './CardPattern';

interface TrioCardProps {
    value?: number | null;
    faceUp?: boolean;
    size?: 'sm' | 'md' | 'lg';
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
}

const CARD_COLORS: Record<number, {
    bg: string;
    pattern: string;
}> = {
    1: { bg: '#7c3aed', pattern: '#a78bfa' },   // Purple
    2: { bg: '#ea580c', pattern: '#fb923c' },   // Orange
    3: { bg: '#1e40af', pattern: '#60a5fa' },   // Navy
    4: { bg: '#dc2626', pattern: '#f87171' },   // Red
    5: { bg: '#db2777', pattern: '#f472b6' },   // Magenta
    6: { bg: '#65a30d', pattern: '#a3e635' },   // Lime
    7: { bg: '#92400e', pattern: '#d97706' },   // Brown
    8: { bg: '#065f46', pattern: '#34d399' },   // Forest green
    9: { bg: '#881337', pattern: '#f43f5e' },   // Burgundy
    10: { bg: '#ca8a04', pattern: '#fde047' },  // Gold
    11: { bg: '#84cc16', pattern: '#bef264' },  // Yellow-green
    12: { bg: '#0891b2', pattern: '#67e8f9' },  // Cyan
};

export default function TrioCard({
    value,
    faceUp = false,
    size = 'md',
    disabled = false,
    onClick,
    className = '',
}: TrioCardProps) {
    const sizeClasses = {
        sm: 'w-16 h-20 text-xl',
        md: 'w-20 h-28 text-3xl',
        lg: 'w-24 h-32 text-4xl',
    };

    const cornerNumberClasses = {
        sm: 'text-[0.5rem]',
        md: 'text-xs',
        lg: 'text-sm',
    };

    const interactiveClasses = !disabled && onClick
        ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200'
        : '';

    const disabledClasses = disabled ? 'opacity-60 cursor-not-allowed' : '';

    const cardColor = value && value >= 1 && value <= 12 ? CARD_COLORS[value] : null;

    return (
        <div className={`relative ${sizeClasses[size]} ${className}`}>
            <div
                className={`card-flip ${faceUp ? 'flipped' : ''} w-full h-full`}
                onClick={!disabled && onClick ? onClick : undefined}
            >
                {/* Front face (face down) */}
                <div
                    className={`card-face-front rounded-lg bg-gradient-to-br from-gray-400 to-gray-500 text-white font-bold flex items-center justify-center shadow-xl border-4 border-black ${interactiveClasses} ${disabledClasses}`}
                >
                    {faceUp ? null : '❓'}
                </div>

                {/* Back face (face up) */}
                {value && cardColor && (
                    <div
                        className={`card-face-back rounded-lg shadow-xl border-4 border-black relative overflow-hidden flex items-center justify-center ${interactiveClasses} ${disabledClasses}`}
                        style={{ backgroundColor: cardColor.bg }}
                    >
                        {/* Background Pattern */}
                        <CardPattern cardValue={value} patternColor={cardColor.pattern} />

                        {/* Corner Numbers (all 4 corners showing card value) */}
                        <span className={`absolute top-1 left-1.5 text-white font-bold drop-shadow-md ${cornerNumberClasses[size]}`}>
                            {value}
                        </span>
                        <span className={`absolute top-1 right-1.5 text-white font-bold drop-shadow-md ${cornerNumberClasses[size]}`}>
                            {value}
                        </span>
                        <span className={`absolute bottom-1 left-1.5 text-white font-bold drop-shadow-md ${cornerNumberClasses[size]}`}>
                            {value}
                        </span>
                        <span className={`absolute bottom-1 right-1.5 text-white font-bold drop-shadow-md ${cornerNumberClasses[size]}`}>
                            {value}
                        </span>

                        {/* Main Center Number */}
                        <div className="relative z-10 text-white font-bold drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            {value}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
