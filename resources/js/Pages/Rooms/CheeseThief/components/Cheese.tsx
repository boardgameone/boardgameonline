interface CheeseProps {
    present: boolean;
}

export default function Cheese({ present }: CheeseProps) {
    return (
        <div className="pointer-events-none absolute inset-0">
            {/* Layer 1 — centring (always). Static so it never conflicts with other transforms. */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                {/* Layer 2 — enter/exit transition. Its own transform stack, independent of layer 1. */}
                <div
                    className={`
                        transition-[opacity,transform] duration-700 ease-out
                        ${present
                            ? 'opacity-100 scale-100 rotate-0 translate-y-0'
                            : 'opacity-0 scale-50 rotate-12 -translate-y-10'}
                    `}
                >
                    {/* Layer 3 — float animation (only when present). Its own keyframe-driven transform. */}
                    <div
                        className="relative"
                        style={{
                            animation: present ? 'cheese-float 3s ease-in-out infinite' : undefined,
                        }}
                    >
                    {/* Glow halo */}
                    {present && (
                        <div
                            aria-hidden
                            className="absolute left-1/2 top-1/2 -z-10 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-300/20 blur-3xl"
                            style={{ animation: 'cheese-halo 3s ease-in-out infinite' }}
                        />
                    )}

                    {/* Cheese SVG */}
                    <svg
                        viewBox="0 0 120 90"
                        className="h-28 w-36"
                        style={{
                            filter: present
                                ? 'drop-shadow(0 8px 12px rgba(0,0,0,0.5)) drop-shadow(0 0 22px rgba(253,224,71,0.65))'
                                : 'none',
                        }}
                    >
                        <defs>
                            <linearGradient id="cheese-top" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#fff7c2" />
                                <stop offset="55%" stopColor="#fde047" />
                                <stop offset="100%" stopColor="#f59e0b" />
                            </linearGradient>
                            <linearGradient id="cheese-side" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f59e0b" />
                                <stop offset="100%" stopColor="#7c2d12" />
                            </linearGradient>
                        </defs>
                        {/* Top facet */}
                        <path
                            d="M10 70 L60 12 L110 70 Z"
                            fill="url(#cheese-top)"
                            stroke="#7c2d12"
                            strokeWidth="1.5"
                        />
                        {/* Front lip */}
                        <path
                            d="M10 70 L110 70 L110 80 L10 80 Z"
                            fill="url(#cheese-side)"
                            stroke="#7c2d12"
                            strokeWidth="1.5"
                        />
                        {/* Highlight along top edge */}
                        <path
                            d="M14 68 L60 18 L106 68"
                            fill="none"
                            stroke="rgba(255,255,255,0.55)"
                            strokeWidth="1.2"
                            strokeLinecap="round"
                        />
                        {/* Holes */}
                        <ellipse cx="48" cy="55" rx="6" ry="5" fill="#7c2d12" opacity="0.85" />
                        <ellipse cx="72" cy="48" rx="4" ry="3" fill="#7c2d12" opacity="0.85" />
                        <ellipse cx="60" cy="65" rx="5" ry="4" fill="#7c2d12" opacity="0.85" />
                        <ellipse cx="38" cy="65" rx="3" ry="2.5" fill="#7c2d12" opacity="0.85" />
                    </svg>

                    {/* Pedestal — directly under the cheese */}
                    <div className="relative mx-auto -mt-1 w-32">
                        <div className="mx-auto h-2 w-32 rounded-full bg-amber-950/70 blur-[2px]" />
                        <div className="mx-auto -mt-2 h-3 w-28 rounded-full bg-gradient-to-b from-amber-800 via-amber-900 to-amber-950 ring-1 ring-amber-950/50" />
                    </div>

                    {/* Sparkles */}
                    {present && (
                        <>
                            <span
                                className="absolute -top-3 -left-2 text-yellow-200"
                                style={{ animation: 'cheese-sparkle 1.8s ease-in-out infinite' }}
                            >
                                ✨
                            </span>
                            <span
                                className="absolute -top-1 right-0 text-yellow-200"
                                style={{ animation: 'cheese-sparkle 2.2s ease-in-out 0.6s infinite' }}
                            >
                                ✨
                            </span>
                            <span
                                className="absolute top-3 -right-3 text-amber-100"
                                style={{ animation: 'cheese-sparkle 2s ease-in-out 1.2s infinite' }}
                            >
                                ✦
                            </span>
                        </>
                    )}
                    </div>
                </div>
            </div>

            {/* Theft aftermath */}
            {!present && (
                <>
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl opacity-70 animate-pulse">
                        💨
                    </div>
                    <div className="absolute left-[58%] top-[44%] -translate-x-1/2 -translate-y-1/2 text-2xl opacity-50">
                        🐭
                    </div>
                </>
            )}
        </div>
    );
}
