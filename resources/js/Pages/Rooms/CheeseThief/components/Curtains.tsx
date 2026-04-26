interface CurtainsProps {
    open: boolean;
}

const velvetGradient =
    'linear-gradient(90deg, #3a0418 0%, #6b1131 8%, #8b1a3d 18%, #a51247 30%, #8b1a3d 42%, #6b1131 54%, #a51247 66%, #8b1a3d 78%, #6b1131 90%, #3a0418 100%)';

const velvetFolds =
    'repeating-linear-gradient(90deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0) 8px, rgba(255,255,255,0.05) 16px, rgba(0,0,0,0.15) 24px)';

export default function Curtains({ open }: CurtainsProps) {
    return (
        <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-3xl">
            {/* Curtain rod */}
            <div
                aria-hidden
                className="absolute inset-x-0 top-0 z-30 h-[5%]"
                style={{
                    background: 'linear-gradient(180deg, #fde68a 0%, #d97706 50%, #92400e 100%)',
                    boxShadow: '0 3px 8px rgba(0,0,0,0.6)',
                }}
            />
            {/* Rod finials (decorative balls at each end) */}
            <div
                aria-hidden
                className="absolute left-[1%] top-[1%] z-30 h-[6%] w-[3%] rounded-full"
                style={{
                    background: 'radial-gradient(circle at 35% 30%, #fef3c7 0%, #d97706 60%, #78350f 100%)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                }}
            />
            <div
                aria-hidden
                className="absolute right-[1%] top-[1%] z-30 h-[6%] w-[3%] rounded-full"
                style={{
                    background: 'radial-gradient(circle at 35% 30%, #fef3c7 0%, #d97706 60%, #78350f 100%)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                }}
            />

            {/* Spotlight when curtains open — glow on the cheese */}
            <div
                aria-hidden
                className={`
                    pointer-events-none absolute inset-x-0 top-[5%] z-10 mx-auto h-full w-3/4
                    transition-opacity duration-[900ms] ease-out
                    ${open ? 'opacity-100' : 'opacity-0'}
                `}
                style={{
                    background:
                        'radial-gradient(ellipse 50% 45% at 50% 38%, rgba(253, 224, 71, 0.22) 0%, rgba(253, 224, 71, 0.06) 55%, transparent 85%)',
                }}
            />

            {/* Left curtain panel */}
            <div
                className={`
                    absolute top-[5%] bottom-0 left-0 z-20
                    transition-[transform,width] duration-[1000ms] ease-[cubic-bezier(0.65,0,0.35,1)]
                    ${open ? 'w-[14%] -translate-x-2' : 'w-1/2 translate-x-0'}
                `}
                style={{
                    backgroundImage: `${velvetFolds}, ${velvetGradient}`,
                    boxShadow: 'inset -10px 0 18px rgba(0,0,0,0.55), 4px 0 12px rgba(0,0,0,0.45)',
                }}
            >
                {/* Inner trailing shadow against the open stage */}
                <div
                    aria-hidden
                    className="absolute inset-y-0 right-0 w-4 bg-gradient-to-l from-black/70 via-black/30 to-transparent"
                />
                {/* Tieback rope */}
                <div className={`absolute right-1 top-1/2 flex -translate-y-1/2 flex-col items-center gap-0.5 transition-opacity duration-500 ${open ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="h-10 w-[6px] rounded-full bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700 shadow" />
                    <div className="-mt-1 h-2 w-7 rounded-full bg-yellow-600 shadow" />
                    <div className="h-3 w-2 rounded-b-full bg-yellow-700" />
                </div>
            </div>

            {/* Right curtain panel */}
            <div
                className={`
                    absolute top-[5%] bottom-0 right-0 z-20
                    transition-[transform,width] duration-[1000ms] ease-[cubic-bezier(0.65,0,0.35,1)]
                    ${open ? 'w-[14%] translate-x-2' : 'w-1/2 translate-x-0'}
                `}
                style={{
                    backgroundImage: `${velvetFolds}, ${velvetGradient}`,
                    boxShadow: 'inset 10px 0 18px rgba(0,0,0,0.55), -4px 0 12px rgba(0,0,0,0.45)',
                }}
            >
                <div
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-4 bg-gradient-to-r from-black/70 via-black/30 to-transparent"
                />
                <div className={`absolute left-1 top-1/2 flex -translate-y-1/2 flex-col items-center gap-0.5 transition-opacity duration-500 ${open ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="h-10 w-[6px] rounded-full bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700 shadow" />
                    <div className="-mt-1 h-2 w-7 rounded-full bg-yellow-600 shadow" />
                    <div className="h-3 w-2 rounded-b-full bg-yellow-700" />
                </div>
            </div>
        </div>
    );
}
