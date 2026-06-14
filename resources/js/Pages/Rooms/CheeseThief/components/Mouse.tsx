interface MouseProps {
    bodyColor: string;
    asleep?: boolean;
    glow?: boolean;
    size?: number;
}

const BODY = '/images/cheese-thief/mouse-body.png';
const DETAILS_AWAKE = '/images/cheese-thief/mouse-details-awake.png';
const DETAILS_ASLEEP = '/images/cheese-thief/mouse-details-asleep.png';

/**
 * Top-down mouse token. Blender-rendered as three aligned layers so each player's
 * `bodyColor` tints the fur while the face details (eyes, pink ears, nose) stay untinted:
 *   1. base — the soft-shaded grey body
 *   2. tint — the player colour multiplied over the body, masked to the body silhouette
 *   3. details — eyes/ears/nose/whiskers on top (open when awake, closed dashes when asleep)
 */
export default function Mouse({ bodyColor, asleep = false, glow = false, size = 72 }: MouseProps) {
    return (
        <div
            className="relative inline-block select-none"
            style={{
                width: size,
                height: size,
                isolation: 'isolate',
                filter: glow
                    ? 'drop-shadow(0 0 10px rgba(253, 224, 71, 0.85)) drop-shadow(0 2px 3px rgba(0,0,0,0.25))'
                    : 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))',
                transition: 'filter 400ms ease-out',
            }}
        >
            <img src={BODY} alt="" draggable={false} className="absolute inset-0 h-full w-full" />
            <div
                aria-hidden
                className="absolute inset-0"
                style={{
                    backgroundColor: bodyColor,
                    mixBlendMode: 'multiply',
                    WebkitMaskImage: `url(${BODY})`,
                    maskImage: `url(${BODY})`,
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                }}
            />
            <img
                src={asleep ? DETAILS_ASLEEP : DETAILS_AWAKE}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full"
            />

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
