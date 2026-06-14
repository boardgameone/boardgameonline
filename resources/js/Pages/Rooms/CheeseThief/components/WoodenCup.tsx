import { ReactNode } from 'react';

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
 * Wooden cup token. Blender-rendered upside-down wooden tumbler — the metaphor for a hidden die
 * in the physical Cheese Thief game.
 *
 * - When `revealed` is false: cup sits over the die, eye-level with the seat. The die is hidden underneath.
 * - When `revealed` is true: cup tilts up and slides aside, revealing the die.
 */
export default function WoodenCup({ revealed = false, bandColor, children, size = 48 }: WoodenCupProps) {
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
            <div
                className="absolute inset-0 transition-transform duration-500 ease-out"
                style={{
                    transformOrigin: '50% 100%',
                    transform: revealed
                        ? 'translate(60%, -45%) rotate(-28deg) scale(0.85)'
                        : 'translate(0, 0) rotate(0deg) scale(1)',
                    filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.45))',
                }}
            >
                <img
                    src="/images/cheese-thief/cup.png"
                    alt=""
                    draggable={false}
                    className="h-full w-full select-none"
                />
                {/* Optional player-color band near the base — small, decorative identity cue. */}
                {bandColor && (
                    <span
                        aria-hidden
                        className="absolute bottom-[14%] left-1/2 h-[11%] w-[56%] -translate-x-1/2 rounded-full"
                        style={{ backgroundColor: bandColor, opacity: 0.8, mixBlendMode: 'multiply' }}
                    />
                )}
            </div>
        </div>
    );
}
