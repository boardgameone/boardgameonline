interface CheeseProps {
    present: boolean;
}

export default function Cheese({ present }: CheeseProps) {
    return (
        <div className="relative flex h-full w-full items-end justify-center pb-8">
            <div className="relative">
                <div className="h-3 w-32 rounded-full bg-stone-700/60 blur-sm" />
                <div className="absolute inset-x-0 -top-2 mx-auto h-4 w-28 rounded-full bg-gradient-to-b from-amber-900 via-amber-800 to-amber-950" />
            </div>

            <div
                className={`
                    absolute bottom-12 left-1/2 -translate-x-1/2
                    transition-all duration-700 ease-out
                    ${present ? 'opacity-100 scale-100' : 'opacity-0 scale-50 -translate-y-8 rotate-12'}
                `}
            >
                <div className="relative">
                    <svg
                        viewBox="0 0 120 90"
                        className="h-24 w-32 drop-shadow-[0_0_18px_rgba(253,224,71,0.55)]"
                    >
                        <defs>
                            <linearGradient id="cheese-top" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#fef08a" />
                                <stop offset="100%" stopColor="#fbbf24" />
                            </linearGradient>
                            <linearGradient id="cheese-side" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#fbbf24" />
                                <stop offset="100%" stopColor="#b45309" />
                            </linearGradient>
                        </defs>
                        <path d="M10 70 L60 15 L110 70 Z" fill="url(#cheese-top)" stroke="#92400e" strokeWidth="1.5" />
                        <path d="M10 70 L110 70 L110 80 L10 80 Z" fill="url(#cheese-side)" stroke="#92400e" strokeWidth="1.5" />
                        <ellipse cx="48" cy="55" rx="6" ry="5" fill="#a16207" />
                        <ellipse cx="72" cy="48" rx="4" ry="3" fill="#a16207" />
                        <ellipse cx="60" cy="65" rx="5" ry="4" fill="#a16207" />
                        <ellipse cx="38" cy="65" rx="3" ry="2.5" fill="#a16207" />
                    </svg>
                </div>
            </div>

            {!present && (
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-3xl opacity-60 animate-pulse">
                    💨
                </div>
            )}
        </div>
    );
}
