import { CardPattern } from './CardPattern';

interface TrioCardProps {
    value?: number | null;
    faceUp?: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg';
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
        xs: 'w-[2.75rem] h-[3.75rem] text-sm',
        sm: 'w-[4.5rem] h-[5.5rem] text-xl',
        md: 'w-[5.5rem] h-[7.5rem] text-2xl',
        lg: 'w-[6.5rem] h-[8.5rem] text-3xl',
    };

    const cornerNumberClasses = {
        xs: 'text-[0.35rem]',
        sm: 'text-[0.55rem]',
        md: 'text-[0.65rem]',
        lg: 'text-xs',
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
                    className={`card-face-front rounded-lg bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white font-bold flex items-center justify-center shadow-xl border-4 border-blue-900 overflow-hidden ${interactiveClasses} ${disabledClasses}`}
                >
                    {/* Decorative pattern for card back */}
                    <div className="absolute inset-0 opacity-30">
                        <div className="absolute inset-2 border-2 border-white/50 rounded" />
                        <div className="absolute inset-3 border border-white/30 rounded" />
                        {/* Diamond pattern */}
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                            <pattern id="cardBackPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                                <path d="M10 0 L20 10 L10 20 L0 10 Z" fill="white" fillOpacity="0.15" />
                            </pattern>
                            <rect x="0" y="0" width="100" height="100" fill="url(#cardBackPattern)" />
                        </svg>
                    </div>
                    {/* Center emblem */}
                    <div className="relative z-10 flex items-center justify-center">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/40">
                            <span className="text-white/90 font-black text-lg sm:text-xl">T</span>
                        </div>
                    </div>
                </div>

                {/* Back face (face up) */}
                {value && cardColor && (
                    <div
                        className={`card-face-back rounded-lg shadow-xl border-4 border-blue-900 relative overflow-hidden flex items-center justify-center ${interactiveClasses} ${disabledClasses}`}
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
