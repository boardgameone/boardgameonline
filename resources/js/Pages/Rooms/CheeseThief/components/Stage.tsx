import { ReactNode } from 'react';

interface StageProps {
    children: ReactNode;
    height?: number;
}

export default function Stage({ children, height = 280 }: StageProps) {
    return (
        <div
            className="relative w-full overflow-hidden rounded-2xl border-4 border-amber-900 shadow-2xl"
            style={{ height }}
        >
            <div
                className="absolute inset-0 bg-gradient-to-b from-indigo-950 via-purple-950 to-slate-900"
                aria-hidden
            />
            <div className="absolute right-4 top-4 text-3xl opacity-70" aria-hidden>
                🌙
            </div>
            <div className="absolute left-1/4 top-6 h-1 w-1 rounded-full bg-white/50" aria-hidden />
            <div className="absolute left-1/2 top-12 h-1 w-1 rounded-full bg-white/30" aria-hidden />
            <div className="absolute left-3/4 top-8 h-1 w-1 rounded-full bg-white/40" aria-hidden />

            <div
                className="absolute inset-x-0 bottom-0 h-12"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(90deg, #422006 0px, #78350f 6px, #92400e 12px, #78350f 18px, #422006 24px)',
                }}
                aria-hidden
            />

            <div className="absolute inset-0">{children}</div>
        </div>
    );
}
