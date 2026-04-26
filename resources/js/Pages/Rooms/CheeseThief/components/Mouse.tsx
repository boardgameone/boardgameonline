import { useId } from 'react';

interface MouseProps {
    bodyColor: string;
    asleep?: boolean;
    glow?: boolean;
    size?: number;
}

export default function Mouse({ bodyColor, asleep = false, glow = false, size = 72 }: MouseProps) {
    const gradientId = useId();
    const fur = `url(#${CSS.escape(gradientId)})`;

    return (
        <div className="relative inline-block" style={{ width: size, height: size }}>
            <svg
                viewBox="0 0 100 100"
                width={size}
                height={size}
                className="block"
                style={{
                    filter: glow
                        ? 'drop-shadow(0 0 10px rgba(253, 224, 71, 0.85)) drop-shadow(0 2px 3px rgba(0,0,0,0.25))'
                        : 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))',
                    transition: 'filter 400ms ease-out',
                }}
            >
                <defs>
                    <radialGradient id={gradientId} cx="50%" cy="35%" r="70%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
                        <stop offset="55%" stopColor={bodyColor} stopOpacity="0.95" />
                        <stop offset="100%" stopColor={bodyColor} />
                    </radialGradient>
                </defs>

                {/* Tail */}
                <path
                    d="M 78 76 Q 96 68 94 88"
                    stroke="#3d2617"
                    strokeWidth="2.2"
                    fill="none"
                    strokeLinecap="round"
                />

                {/* Body */}
                <ellipse
                    cx="50"
                    cy="68"
                    rx="29"
                    ry="22"
                    fill={fur}
                    stroke="#2d1a0e"
                    strokeWidth="1.6"
                />
                {/* Belly */}
                <ellipse cx="50" cy="74" rx="15" ry="9" fill="#fff8f0" opacity="0.7" />

                {/* Ears */}
                <g>
                    <circle cx="32" cy="29" r="9.5" fill={fur} stroke="#2d1a0e" strokeWidth="1.2" />
                    <circle cx="32" cy="30" r="5" fill="#f4a8a8" opacity="0.85" />
                    <circle cx="68" cy="29" r="9.5" fill={fur} stroke="#2d1a0e" strokeWidth="1.2" />
                    <circle cx="68" cy="30" r="5" fill="#f4a8a8" opacity="0.85" />
                </g>

                {/* Head */}
                <circle cx="50" cy="44" r="22" fill={fur} stroke="#2d1a0e" strokeWidth="1.6" />

                {/* Cheek highlight */}
                <ellipse cx="50" cy="52" rx="14" ry="9" fill="#fff8f0" opacity="0.55" />

                {/* Eyes */}
                {asleep ? (
                    <>
                        <path
                            d="M 38 44 Q 42.5 49 47 44"
                            stroke="#1a1208"
                            strokeWidth="1.7"
                            fill="none"
                            strokeLinecap="round"
                        />
                        <path
                            d="M 53 44 Q 57.5 49 62 44"
                            stroke="#1a1208"
                            strokeWidth="1.7"
                            fill="none"
                            strokeLinecap="round"
                        />
                    </>
                ) : (
                    <>
                        <circle cx="42.5" cy="44" r="2.6" fill="#1a1208" />
                        <circle cx="57.5" cy="44" r="2.6" fill="#1a1208" />
                        <circle cx="43.2" cy="43.2" r="0.9" fill="white" />
                        <circle cx="58.2" cy="43.2" r="0.9" fill="white" />
                    </>
                )}

                {/* Whiskers */}
                <g stroke="#3d2617" strokeWidth="0.7" strokeLinecap="round">
                    <line x1="46" y1="55" x2="33" y2="52" />
                    <line x1="46" y1="56.5" x2="33" y2="58.5" />
                    <line x1="54" y1="55" x2="67" y2="52" />
                    <line x1="54" y1="56.5" x2="67" y2="58.5" />
                </g>

                {/* Nose */}
                <ellipse cx="50" cy="55" rx="2.2" ry="1.6" fill="#2a1208" />

                {/* Mouth */}
                {asleep ? (
                    <path
                        d="M 47 60 Q 50 62 53 60"
                        stroke="#2a1208"
                        strokeWidth="1"
                        fill="none"
                        strokeLinecap="round"
                    />
                ) : (
                    <path
                        d="M 47 60 Q 50 63 53 60"
                        stroke="#2a1208"
                        strokeWidth="1"
                        fill="none"
                        strokeLinecap="round"
                    />
                )}
            </svg>

            {asleep && (
                <span
                    className="pointer-events-none absolute -right-1 -top-2 select-none text-[0.65rem] font-extrabold text-slate-300/80"
                    style={{
                        animation: 'mouse-zzz 2.4s ease-in-out infinite',
                        textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                    }}
                    aria-hidden
                >
                    z
                    <span style={{ marginLeft: 1, fontSize: '0.85em', opacity: 0.7 }}>z</span>
                    <span style={{ marginLeft: 1, fontSize: '0.7em', opacity: 0.5 }}>z</span>
                </span>
            )}
        </div>
    );
}
