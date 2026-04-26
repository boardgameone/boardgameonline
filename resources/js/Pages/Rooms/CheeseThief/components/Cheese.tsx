interface CheeseProps {
    present: boolean;
}

export default function Cheese({ present }: CheeseProps) {
    return (
        <div className="relative flex h-full w-full items-end justify-center pb-8">
            {/* Pedestal */}
            <div className="relative z-10">
                <div className="h-3 w-32 rounded-full bg-stone-700/60 blur-sm" />
                <div className="absolute inset-x-0 -top-2 mx-auto h-4 w-28 rounded-full bg-gradient-to-b from-amber-900 via-amber-800 to-amber-950" />
            </div>

            {/* Glow halo when cheese is present */}
            {present && (
                <div className="absolute bottom-12 left-1/2 h-32 w-32 -translate-x-1/2 rounded-full bg-yellow-300/20 blur-2xl animate-pulse" />
            )}

            {/* The cheese itself */}
            <div
                className={`
                    absolute bottom-12 left-1/2 -translate-x-1/2
                    transition-all duration-700 ease-out
                    ${present
                        ? 'opacity-100 scale-100 animate-[float_3s_ease-in-out_infinite]'
                        : 'opacity-0 scale-50 -translate-y-8 rotate-12'}
                `}
                style={{
                    // Inline keyframe via CSS variable for the floating animation
                    animationName: present ? 'cheese-float' : undefined,
                }}
            >
                <div className="relative">
                    <svg
                        viewBox="0 0 120 90"
                        className="h-24 w-32 drop-shadow-[0_0_24px_rgba(253,224,71,0.7)]"
                    >
                        <defs>
                            <linearGradient id="cheese-top" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#fef9c3" />
                                <stop offset="60%" stopColor="#fde047" />
                                <stop offset="100%" stopColor="#fbbf24" />
                            </linearGradient>
                            <linearGradient id="cheese-side" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#fbbf24" />
                                <stop offset="100%" stopColor="#92400e" />
                            </linearGradient>
                        </defs>
                        <path
                            d="M10 70 L60 15 L110 70 Z"
                            fill="url(#cheese-top)"
                            stroke="#78350f"
                            strokeWidth="1.5"
                        />
                        <path
                            d="M10 70 L110 70 L110 80 L10 80 Z"
                            fill="url(#cheese-side)"
                            stroke="#78350f"
                            strokeWidth="1.5"
                        />
                        <ellipse cx="48" cy="55" rx="6" ry="5" fill="#78350f" opacity="0.85" />
                        <ellipse cx="72" cy="48" rx="4" ry="3" fill="#78350f" opacity="0.85" />
                        <ellipse cx="60" cy="65" rx="5" ry="4" fill="#78350f" opacity="0.85" />
                        <ellipse cx="38" cy="65" rx="3" ry="2.5" fill="#78350f" opacity="0.85" />
                    </svg>

                    {/* Sparkles */}
                    {present && (
                        <>
                            <span
                                className="absolute -top-3 -left-2 text-yellow-200 animate-pulse"
                                style={{ animationDelay: '0s', animationDuration: '1.8s' }}
                            >
                                ✨
                            </span>
                            <span
                                className="absolute -top-1 right-0 text-yellow-200 animate-pulse"
                                style={{ animationDelay: '0.6s', animationDuration: '2.2s' }}
                            >
                                ✨
                            </span>
                            <span
                                className="absolute top-3 -right-3 text-amber-100 animate-pulse"
                                style={{ animationDelay: '1.2s', animationDuration: '2s' }}
                            >
                                ✦
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Theft aftermath */}
            {!present && (
                <>
                    <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-4xl opacity-70 animate-pulse">
                        💨
                    </div>
                    <div className="absolute bottom-20 left-[60%] -translate-x-1/2 text-2xl opacity-50">
                        🐭
                    </div>
                </>
            )}

            <style>{`
                @keyframes cheese-float {
                    0%, 100% { transform: translateX(-50%) translateY(0); }
                    50% { transform: translateX(-50%) translateY(-8px); }
                }
            `}</style>
        </div>
    );
}
