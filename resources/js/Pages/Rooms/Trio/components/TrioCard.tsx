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
        xs: 'w-11 h-15 text-sm',
        sm: 'w-18 h-22 text-xl',
        md: 'w-22 h-30 text-2xl',
        lg: 'w-26 h-34 text-3xl',
        responsive: 'w-18 h-22 sm:w-22 sm:h-30 text-xl sm:text-2xl',
    };

    const cornerNumberClasses = {
        xs: 'text-[0.35rem]',
        sm: 'text-[0.55rem]',
        md: 'text-[0.65rem]',
        lg: 'text-xs',
        responsive: 'text-[0.55rem] sm:text-[0.65rem]',
    };

    const interactiveClasses = !disabled && onClick
        ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200'
        : '';

    const disabledClasses = disabled ? 'opacity-60 cursor-not-allowed' : '';

    const cardColor = value && value >= 1 && value <= 12 ? CARD_COLORS[value] : null;

    const effectiveSize = size ?? 'responsive';

    return (
        <div className={`relative ${sizeClasses[effectiveSize]} ${className}`}>
            <div
                className={`card-flip ${faceUp ? 'flipped' : ''} w-full h-full`}
                onClick={!disabled && onClick ? onClick : undefined}
            >
                {/* Front face (face down) — Blender-rendered card back */}
                <div
                    className={`card-face-front rounded-lg overflow-hidden bg-[#0e1b45] shadow-[0_6px_16px_rgba(0,0,0,0.4)] ${interactiveClasses} ${disabledClasses}`}
                >
                    <img
                        src="/images/trio/card-back.png"
                        alt=""
                        draggable={false}
                        className="absolute inset-0 h-full w-full select-none object-cover"
                    />
                </div>

                {/* Back face (face up) — colored card stock */}
                {value && cardColor && (
                    <div
                        className={`card-face-back rounded-xl overflow-hidden relative flex items-center justify-center ring-2 ring-white/60 shadow-[0_6px_16px_rgba(0,0,0,0.4)] ${interactiveClasses} ${disabledClasses}`}
                        style={{ backgroundColor: cardColor.bg }}
                    >
                        {/* Background Pattern */}
                        <CardPattern cardValue={value} patternColor={cardColor.pattern} />

                        {/* Card-stock gloss + edge shading */}
                        <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/25 via-transparent to-black/15" />

                        {/* Corner Numbers (all 4 corners showing card value) */}
                        <span className={`absolute top-1 left-1.5 text-white font-bold drop-shadow-md ${cornerNumberClasses[effectiveSize]}`}>
                            {value}
                        </span>
                        <span className={`absolute top-1 right-1.5 text-white font-bold drop-shadow-md ${cornerNumberClasses[effectiveSize]}`}>
                            {value}
                        </span>
                        <span className={`absolute bottom-1 left-1.5 text-white font-bold drop-shadow-md ${cornerNumberClasses[effectiveSize]}`}>
                            {value}
                        </span>
                        <span className={`absolute bottom-1 right-1.5 text-white font-bold drop-shadow-md ${cornerNumberClasses[effectiveSize]}`}>
                            {value}
                        </span>

                        {/* Main Center Number on a subtle index medallion */}
                        <div className="relative z-10 flex items-center justify-center">
                            <div className="absolute h-[2em] w-[2em] rounded-full bg-white/10" />
                            <span className="relative text-white font-black drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                {value}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
