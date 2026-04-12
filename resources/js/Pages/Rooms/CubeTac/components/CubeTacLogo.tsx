/**
 * CubeTacLogo — the branded logo used on the landing page.
 *
 * Pairs an animated CSS-3D isometric cube (with X/O stickers on its
 * visible faces) with an Audiowide gradient wordmark ("Cube" in red→rose
 * gradient, "Tac" in blue→indigo).
 *
 * Variants:
 *   - `inline`:  cube + wordmark side-by-side (hero cards, buttons)
 *   - `stacked`: cube on top, wordmark below (compact / square layouts)
 *
 * Sizes map to sensible pixel/text presets.
 */

type LogoSize = 'sm' | 'md' | 'lg' | 'xl';

interface CubeTacLogoProps {
    size?: LogoSize;
    layout?: 'inline' | 'stacked';
    animated?: boolean;
    showTagline?: boolean;
}

const CUBE_PX: Record<LogoSize, number> = {
    sm: 40,
    md: 72,
    lg: 120,
    xl: 168,
};

const WORDMARK_CLASS: Record<LogoSize, string> = {
    sm: 'text-2xl',
    md: 'text-4xl',
    lg: 'text-6xl',
    xl: 'text-7xl sm:text-8xl',
};

const TAGLINE_CLASS: Record<LogoSize, string> = {
    sm: 'text-[8px]',
    md: 'text-[10px]',
    lg: 'text-xs',
    xl: 'text-sm',
};

export default function CubeTacLogo({
    size = 'lg',
    layout = 'inline',
    animated = true,
    showTagline = false,
}: CubeTacLogoProps) {
    const container =
        layout === 'stacked'
            ? 'flex flex-col items-center gap-4'
            : 'flex items-center gap-4 sm:gap-6';

    return (
        <div className={container}>
            <LogoCube px={CUBE_PX[size]} animated={animated} />
            <div className="flex flex-col items-start leading-none">
                <Wordmark sizeClass={WORDMARK_CLASS[size]} />
                {showTagline && (
                    <div className={`mt-2 font-bold uppercase tracking-[0.3em] text-yellow-900/70 ${TAGLINE_CLASS[size]}`}>
                        Tic-tac-toe · 3 × 3 × 3
                    </div>
                )}
            </div>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Wordmark — "CubeTac" in Audiowide with tonal gradients
// -----------------------------------------------------------------------------

function Wordmark({ sizeClass }: { sizeClass: string }) {
    return (
        <h1
            className={`font-display leading-[0.9] tracking-tight ${sizeClass}`}
            aria-label="CubeTac"
        >
            <span
                className="bg-linear-to-br from-orange-400 via-red-500 to-rose-600 bg-clip-text text-transparent drop-shadow-[0_2px_0_rgba(120,20,20,0.25)]"
                style={{
                    WebkitTextStroke: '1.5px rgba(120, 20, 20, 0.18)',
                }}
            >
                Cube
            </span>
            <span
                className="bg-linear-to-br from-sky-400 via-blue-600 to-indigo-700 bg-clip-text text-transparent drop-shadow-[0_2px_0_rgba(30,58,138,0.25)]"
                style={{
                    WebkitTextStroke: '1.5px rgba(30, 58, 138, 0.18)',
                }}
            >
                Tac
            </span>
        </h1>
    );
}

// -----------------------------------------------------------------------------
// LogoCube — an isometric cube, CSS-3D, slowly rotating on the Y axis.
// -----------------------------------------------------------------------------

interface LogoCubeProps {
    px: number;
    animated: boolean;
}

export function LogoCube({ px, animated }: LogoCubeProps) {
    const half = px / 2;

    // Face patterns: each face shows a subset of a tic-tac-toe-on-a-cube situation.
    // Rendered as a 3×3 grid of sticker cells. `null` = empty sticker.
    const front: Pattern = ['X', null, 'X', null, 'X', null, 'X', null, 'X']; // X diagonals
    const right: Pattern = [null, 'O', null, 'O', 'O', 'O', null, 'O', null]; // O plus
    const top: Pattern = ['X', null, 'O', null, 'X', null, 'O', null, 'X'];
    const empty: Pattern = [null, null, null, null, null, null, null, null, null];
    const back = empty;
    const left = empty;
    const bottom = empty;

    const perspectiveStyle = {
        perspective: `${px * 3}px`,
        width: `${px}px`,
        height: `${px}px`,
    };

    return (
        <div className="relative shrink-0" style={perspectiveStyle}>
            {/* Soft radial halo behind the cube */}
            <div
                aria-hidden
                className="absolute inset-0 -z-10 blur-2xl opacity-60"
                style={{
                    background:
                        'radial-gradient(closest-side, rgba(255, 138, 61, 0.6), rgba(255, 138, 61, 0) 65%), radial-gradient(closest-side at 70% 70%, rgba(91, 155, 213, 0.55), rgba(91, 155, 213, 0) 70%)',
                }}
            />
            <div
                className={`relative h-full w-full transform-gpu ${
                    animated ? 'animate-cubeRotateSlow' : ''
                }`}
                style={{
                    transformStyle: 'preserve-3d',
                    transform: animated ? undefined : 'rotateX(-20deg) rotateY(-28deg)',
                }}
            >
                <LogoFace side="front" marks={front} half={half} />
                <LogoFace side="back" marks={back} half={half} />
                <LogoFace side="right" marks={right} half={half} />
                <LogoFace side="left" marks={left} half={half} />
                <LogoFace side="top" marks={top} half={half} />
                <LogoFace side="bottom" marks={bottom} half={half} />
            </div>
        </div>
    );
}

type Side = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';
type Mark = 'X' | 'O' | null;
type Pattern = [Mark, Mark, Mark, Mark, Mark, Mark, Mark, Mark, Mark];

interface LogoFaceProps {
    side: Side;
    marks: Pattern;
    half: number;
}

function LogoFace({ side, marks, half }: LogoFaceProps) {
    const transforms: Record<Side, string> = {
        front: `translateZ(${half}px)`,
        back: `rotateY(180deg) translateZ(${half}px)`,
        right: `rotateY(90deg) translateZ(${half}px)`,
        left: `rotateY(-90deg) translateZ(${half}px)`,
        top: `rotateX(90deg) translateZ(${half}px)`,
        bottom: `rotateX(-90deg) translateZ(${half}px)`,
    };

    const faceGradient: Record<Side, string> = {
        // Slight shade variation per face for depth
        front: 'bg-linear-to-br from-slate-50 to-slate-200',
        back: 'bg-linear-to-br from-slate-200 to-slate-300',
        right: 'bg-linear-to-br from-slate-100 to-slate-300',
        left: 'bg-linear-to-br from-slate-100 to-slate-300',
        top: 'bg-linear-to-br from-white to-slate-100',
        bottom: 'bg-linear-to-br from-slate-200 to-slate-400',
    };

    return (
        <div
            className={`absolute grid grid-cols-3 grid-rows-3 gap-[3%] rounded-lg p-[6%] shadow-[inset_0_0_32px_rgba(0,0,0,0.18)] ring-1 ring-black/10 ${faceGradient[side]}`}
            style={{
                width: `${half * 2}px`,
                height: `${half * 2}px`,
                transform: transforms[side],
                backfaceVisibility: 'hidden',
            }}
        >
            {marks.map((mark, i) => (
                <StickerCell key={i} mark={mark} />
            ))}
        </div>
    );
}

function StickerCell({ mark }: { mark: Mark }) {
    return (
        <div className="relative flex items-center justify-center rounded-[18%] bg-white shadow-[0_1px_0_rgba(0,0,0,0.08)] ring-1 ring-slate-200">
            {mark === 'X' && (
                <svg viewBox="0 0 32 32" className="h-[70%] w-[70%]">
                    <line
                        x1="6"
                        y1="6"
                        x2="26"
                        y2="26"
                        stroke="#ef4444"
                        strokeWidth="6"
                        strokeLinecap="round"
                    />
                    <line
                        x1="26"
                        y1="6"
                        x2="6"
                        y2="26"
                        stroke="#ef4444"
                        strokeWidth="6"
                        strokeLinecap="round"
                    />
                </svg>
            )}
            {mark === 'O' && (
                <svg viewBox="0 0 32 32" className="h-[70%] w-[70%]">
                    <circle
                        cx="16"
                        cy="16"
                        r="10"
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="6"
                    />
                </svg>
            )}
        </div>
    );
}
