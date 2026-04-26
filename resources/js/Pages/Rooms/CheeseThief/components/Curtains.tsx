interface CurtainsProps {
    open: boolean;
}

const velvetGradient =
    'linear-gradient(90deg, #4c0519 0%, #881337 8%, #9f1239 16%, #be123c 28%, #9f1239 40%, #881337 52%, #be123c 64%, #9f1239 76%, #881337 88%, #4c0519 100%)';

export default function Curtains({ open }: CurtainsProps) {
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute inset-x-0 top-0 z-30 flex h-4 items-center bg-gradient-to-b from-yellow-500 via-yellow-600 to-amber-700 shadow-[0_2px_6px_rgba(0,0,0,0.4)]">
                <div className="absolute -bottom-1 left-2 h-2 w-2 rounded-full bg-yellow-700" />
                <div className="absolute -bottom-1 right-2 h-2 w-2 rounded-full bg-yellow-700" />
            </div>

            <div
                className={`
                    absolute top-4 bottom-0 left-0 z-20 w-1/2
                    transition-transform duration-700 ease-out
                    ${open ? '-translate-x-[105%]' : 'translate-x-0'}
                `}
                style={{ backgroundImage: velvetGradient }}
            >
                <div className="absolute inset-y-0 right-0 w-2 bg-gradient-to-l from-black/40 to-transparent" />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col items-center">
                    <div className="h-12 w-3 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-700" />
                    <div className="h-2 w-6 rounded-full bg-yellow-600 -mt-1" />
                </div>
            </div>

            <div
                className={`
                    absolute top-4 bottom-0 right-0 z-20 w-1/2
                    transition-transform duration-700 ease-out
                    ${open ? 'translate-x-[105%]' : 'translate-x-0'}
                `}
                style={{ backgroundImage: velvetGradient }}
            >
                <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/40 to-transparent" />
                <div className="absolute left-2 top-1/2 flex -translate-y-1/2 flex-col items-center">
                    <div className="h-12 w-3 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-700" />
                    <div className="h-2 w-6 rounded-full bg-yellow-600 -mt-1" />
                </div>
            </div>
        </div>
    );
}
