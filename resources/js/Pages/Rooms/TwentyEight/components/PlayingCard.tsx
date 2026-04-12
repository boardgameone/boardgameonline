import { TwentyEightCard } from '@/types';

interface PlayingCardProps {
    card?: TwentyEightCard | null;
    faceUp?: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    disabled?: boolean;
    highlighted?: boolean;
    onClick?: () => void;
    className?: string;
    showPoints?: boolean;
}

const SUIT_SYMBOLS: Record<string, string> = {
    hearts: '\u2665',
    diamonds: '\u2666',
    clubs: '\u2663',
    spades: '\u2660',
};

const SUIT_COLORS: Record<string, string> = {
    hearts: 'text-red-600',
    diamonds: 'text-red-600',
    clubs: 'text-gray-900',
    spades: 'text-gray-900',
};

const CARD_POINTS: Record<string, number> = {
    J: 3,
    '9': 2,
    A: 1,
    '10': 1,
    K: 0,
    Q: 0,
    '8': 0,
    '7': 0,
};

export default function PlayingCard({
    card,
    faceUp = false,
    size = 'md',
    disabled = false,
    highlighted = false,
    onClick,
    className = '',
    showPoints = false,
}: PlayingCardProps) {
    const sizeClasses = {
        xs: 'w-10 h-14 text-xs',
        sm: 'w-14 h-20 text-sm',
        md: 'w-20 h-28 text-lg',
        lg: 'w-24 h-34 text-xl',
    };

    const cornerTextClasses = {
        xs: 'text-[0.5rem] leading-tight',
        sm: 'text-[0.65rem] leading-tight',
        md: 'text-xs leading-tight',
        lg: 'text-sm leading-tight',
    };

    const centerSuitClasses = {
        xs: 'text-lg',
        sm: 'text-2xl',
        md: 'text-4xl',
        lg: 'text-5xl',
    };

    const interactiveClasses = !disabled && onClick
        ? 'cursor-pointer hover:-translate-y-2 hover:shadow-xl active:translate-y-0 transition-all duration-200'
        : '';

    const disabledClasses = disabled ? 'opacity-40 cursor-not-allowed saturate-50' : '';
    const highlightClasses = highlighted && !disabled
        ? 'ring-2 ring-amber-400 ring-offset-2 shadow-lg shadow-amber-200/50'
        : '';

    if (!faceUp || !card) {
        return (
            <div
                className={`${sizeClasses[size]} rounded-lg bg-linear-to-br from-blue-600 via-blue-700 to-blue-800 shadow-md border border-blue-900 relative overflow-hidden ${interactiveClasses} ${disabledClasses} ${className}`}
                onClick={!disabled && onClick ? onClick : undefined}
            >
                <div className="absolute inset-0 opacity-30">
                    <div className="absolute inset-1.5 border border-white/40 rounded-sm" />
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 140" preserveAspectRatio="none">
                        <pattern id="cardBack28" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
                            <path d="M7 0 L14 7 L7 14 L0 7 Z" fill="white" fillOpacity="0.15" />
                        </pattern>
                        <rect x="0" y="0" width="100" height="140" fill="url(#cardBack28)" />
                    </svg>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/15 flex items-center justify-center border border-white/30">
                        <span className="text-white/80 font-black text-xs sm:text-sm">28</span>
                    </div>
                </div>
            </div>
        );
    }

    const suitSymbol = SUIT_SYMBOLS[card.suit];
    const suitColor = SUIT_COLORS[card.suit];
    const points = CARD_POINTS[card.rank];

    return (
        <div
            className={`${sizeClasses[size]} rounded-lg bg-white shadow-md border border-gray-200 relative overflow-hidden select-none ${interactiveClasses} ${disabledClasses} ${highlightClasses} ${className}`}
            onClick={!disabled && onClick ? onClick : undefined}
        >
            {/* Top-left corner */}
            <div className={`absolute top-0.5 left-1 ${cornerTextClasses[size]} ${suitColor} font-bold text-center`}>
                <div>{card.rank}</div>
                <div className="-mt-0.5">{suitSymbol}</div>
            </div>

            {/* Bottom-right corner (inverted) */}
            <div className={`absolute bottom-0.5 right-1 ${cornerTextClasses[size]} ${suitColor} font-bold text-center rotate-180`}>
                <div>{card.rank}</div>
                <div className="-mt-0.5">{suitSymbol}</div>
            </div>

            {/* Center suit symbol */}
            <div className={`absolute inset-0 flex items-center justify-center ${centerSuitClasses[size]} ${suitColor}`}>
                {suitSymbol}
            </div>

            {/* Points badge */}
            {showPoints && points > 0 && (
                <div className="absolute top-0.5 right-0.5 bg-amber-400 text-amber-900 rounded-full w-4 h-4 flex items-center justify-center text-[0.5rem] font-black">
                    {points}
                </div>
            )}
        </div>
    );
}
