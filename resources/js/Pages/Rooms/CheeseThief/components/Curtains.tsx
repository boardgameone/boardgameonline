interface CurtainsProps {
    open: boolean;
}

const velvetGradient =
    'linear-gradient(90deg, #4c0519 0%, #881337 8%, #9f1239 16%, #be123c 28%, #9f1239 40%, #881337 52%, #be123c 64%, #9f1239 76%, #881337 88%, #4c0519 100%)';

export default function Curtains({ open }: CurtainsProps) {
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            {/* Curtain rod with finials */}
            <div className="absolute inset-x-0 top-0 z-30 flex h-4 items-center bg-gradient-to-b from-yellow-400 via-yellow-600 to-amber-700 shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                <div className="absolute -bottom-1 left-1 h-3 w-3 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-700 ring-1 ring-amber-900/50" />
                <div className="absolute -bottom-1 right-1 h-3 w-3 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-700 ring-1 ring-amber-900/50" />
            </div>

            {/* Spotlight when curtains open — soft glow from above on the cheese */}
            <div
                className={`
                    pointer-events-none absolute inset-x-0 top-4 z-10 mx-auto h-full w-2/3
                    transition-opacity duration-700 ease-out
                    ${open ? 'opacity-100' : 'opacity-0'}
                `}
                style={{
                    background:
                        'radial-gradient(ellipse 60% 50% at 50% 30%, rgba(253, 224, 71, 0.18) 0%, rgba(253, 224, 71, 0.05) 50%, transparent 80%)',
                }}
                aria-hidden
            />

            {/* Left curtain panel */}
            <div
                className={`
                    absolute top-4 bottom-0 left-0 z-20 w-1/2
                    transition-transform duration-[800ms] ease-[cubic-bezier(0.65,0,0.35,1)]
                    ${open ? '-translate-x-[105%]' : 'translate-x-0'}
                `}
                style={{ backgroundImage: velvetGradient }}
            >
                <div className="absolute inset-y-0 right-0 w-3 bg-gradient-to-l from-black/60 via-black/30 to-transparent" />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col items-center gap-0.5">
                    <div className="h-12 w-3 rounded-full bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700 shadow" />
                    <div className="-mt-1 h-2 w-7 rounded-full bg-yellow-600 shadow" />
                    <div className="h-3 w-2 rounded-b-full bg-yellow-700" />
                </div>
            </div>

            {/* Right curtain panel */}
            <div
                className={`
                    absolute top-4 bottom-0 right-0 z-20 w-1/2
                    transition-transform duration-[800ms] ease-[cubic-bezier(0.65,0,0.35,1)]
                    ${open ? 'translate-x-[105%]' : 'translate-x-0'}
                `}
                style={{ backgroundImage: velvetGradient }}
            >
                <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
                <div className="absolute left-2 top-1/2 flex -translate-y-1/2 flex-col items-center gap-0.5">
                    <div className="h-12 w-3 rounded-full bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700 shadow" />
                    <div className="-mt-1 h-2 w-7 rounded-full bg-yellow-600 shadow" />
                    <div className="h-3 w-2 rounded-b-full bg-yellow-700" />
                </div>
            </div>
        </div>
    );
}
