import { useState } from 'react';

const DEFAULT_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

interface ConfettiProps {
    /** Number of falling pieces. */
    count?: number;
    /** Piece colors; one is picked at random per piece. */
    colors?: string[];
}

/**
 * Full-bleed falling confetti using the shared `animate-confetti` keyframe.
 * Place inside a `relative` container; it never captures pointer events and
 * renders nothing for users who prefer reduced motion.
 */
export default function Confetti({ count = 60, colors = DEFAULT_COLORS }: ConfettiProps) {
    // Randomised once per mount so parent re-renders don't reshuffle mid-fall.
    const [pieces] = useState(
        () => Array.from({ length: count }, (_, id) => ({
            id,
            left: Math.random() * 100,
            delay: Math.random() * 1.2,
            size: 6 + Math.random() * 8,
            round: Math.random() < 0.35,
            color: colors[Math.floor(Math.random() * colors.length)],
        })),
    );

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden" aria-hidden="true">
            {pieces.map((piece) => (
                <div
                    key={piece.id}
                    className={`absolute animate-confetti ${piece.round ? 'rounded-full' : 'rounded-xs'}`}
                    style={{
                        left: `${piece.left}%`,
                        top: '-16px',
                        width: piece.size,
                        height: piece.round ? piece.size : piece.size * 0.6,
                        backgroundColor: piece.color,
                        animationDelay: `${piece.delay}s`,
                    }}
                />
            ))}
        </div>
    );
}
