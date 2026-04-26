import { ReactNode, useId } from 'react';

interface WoodenCupProps {
    /** When true, the cup is tilted up off the table — its contents (the die) become visible. */
    revealed?: boolean;
    /** Color band painted around the cup base — typically the player's avatar color. */
    bandColor?: string;
    /** The die (or other token) hidden beneath the cup. Stays mounted underneath even when closed
     * so the reveal animation can lift the cup smoothly. */
    children?: ReactNode;
    /** Pixel width of the cup. Height is derived. Default 48. */
    size?: number;
}

/**
 * Wooden cup token. Top-down SVG of an upside-down wooden tumbler — the metaphor for a hidden die
 * in the physical Cheese Thief game.
 *
 * - When `revealed` is false: cup sits over the die, eye-level with the seat. The die is hidden underneath.
 * - When `revealed` is true: cup tilts up and slides aside, revealing the die.
 */
export default function WoodenCup({ revealed = false, bandColor, children, size = 48 }: WoodenCupProps) {
    const grainId = useId();
    const rimId = useId();

    return (
        <div
            className="relative inline-block"
            style={{ width: size, height: size, perspective: '160px' }}
        >
            {/* Die underneath — always rendered so the cup can lift to expose it cleanly. */}
            <div
                className={`
                    absolute inset-0 flex items-center justify-center
                    transition-[opacity,transform] duration-500 ease-out
                    ${revealed ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
                `}
            >
                {children}
            </div>

            {/* The cup itself — sits over the die when closed; tilts up + slides when revealed. */}
            <svg
                viewBox="0 0 100 100"
                width={size}
                height={size}
                className="absolute inset-0 transition-transform duration-500 ease-out"
                style={{
                    transformOrigin: '50% 100%',
                    transform: revealed
                        ? 'translate(60%, -45%) rotate(-28deg) scale(0.85)'
                        : 'translate(0, 0) rotate(0deg) scale(1)',
                    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.45))',
                }}
            >
                <defs>
                    <linearGradient id={grainId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a8693c" />
                        <stop offset="40%" stopColor="#8a4f25" />
                        <stop offset="100%" stopColor="#5b2f12" />
                    </linearGradient>
                    <linearGradient id={rimId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c98756" />
                        <stop offset="100%" stopColor="#7a4220" />
                    </linearGradient>
                </defs>

                {/* Cup body (slightly tapered tumbler, top-down perspective) */}
                <path
                    d="M 22 22 Q 50 12 78 22 L 82 88 Q 50 96 18 88 Z"
                    fill={`url(#${CSS.escape(grainId)})`}
                    stroke="#3b1d09"
                    strokeWidth="1.5"
                />

                {/* Wood grain — repeating thin curves */}
                <g stroke="#3b1d09" strokeWidth="0.5" fill="none" opacity="0.45">
                    <path d="M 28 30 Q 50 24 72 30" />
                    <path d="M 26 44 Q 50 38 74 44" />
                    <path d="M 24 60 Q 50 54 76 60" />
                    <path d="M 22 76 Q 50 70 78 76" />
                </g>

                {/* Optional player-color band near the base — small, decorative */}
                {bandColor && (
                    <path
                        d="M 21 78 Q 50 86 79 78 L 81 86 Q 50 94 19 86 Z"
                        fill={bandColor}
                        opacity="0.85"
                        stroke="#3b1d09"
                        strokeWidth="0.8"
                    />
                )}

                {/* Top rim ellipse — what you see when looking down at the cup */}
                <ellipse
                    cx="50"
                    cy="22"
                    rx="28"
                    ry="6"
                    fill={`url(#${CSS.escape(rimId)})`}
                    stroke="#3b1d09"
                    strokeWidth="1.2"
                />
                <ellipse cx="50" cy="22" rx="22" ry="3" fill="#2a1408" opacity="0.6" />

                {/* Side highlight */}
                <path
                    d="M 28 28 Q 30 50 32 84"
                    stroke="rgba(255,255,255,0.18)"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                />
            </svg>
        </div>
    );
}
