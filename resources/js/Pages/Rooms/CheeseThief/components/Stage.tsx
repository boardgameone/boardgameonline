import { ReactNode } from 'react';

interface StageProps {
    children: ReactNode;
    /** Optional fixed height (legacy). When omitted, the stage fills its parent square slot. */
    height?: number;
}

export default function Stage({ children, height }: StageProps) {
    return (
        <div
            className="relative w-full overflow-hidden rounded-3xl shadow-[0_18px_40px_rgba(0,0,0,0.55)]"
            style={height ? { height } : { aspectRatio: '1 / 1' }}
        >
            {/* Sky / forest backdrop */}
            <div
                aria-hidden
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse 80% 60% at 50% 18%, #2c3a5a 0%, #1a2138 35%, #0d1422 70%, #060a14 100%)',
                }}
            />

            {/* Vignette */}
            <div
                aria-hidden
                className="absolute inset-0"
                style={{
                    background:
                        'radial-gradient(ellipse 100% 100% at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.55) 100%)',
                }}
            />

            {/* Stars */}
            <div className="absolute left-[18%] top-[14%] h-1 w-1 rounded-full bg-white/70" aria-hidden />
            <div className="absolute left-[42%] top-[8%]  h-[3px] w-[3px] rounded-full bg-white/90" aria-hidden />
            <div className="absolute left-[68%] top-[18%] h-1 w-1 rounded-full bg-white/60" aria-hidden />
            <div className="absolute left-[82%] top-[12%] h-[2px] w-[2px] rounded-full bg-white/80" aria-hidden />
            <div className="absolute left-[28%] top-[22%] h-[2px] w-[2px] rounded-full bg-white/40" aria-hidden />

            {/* Moon */}
            <div
                aria-hidden
                className="absolute right-[12%] top-[12%] h-7 w-7 rounded-full"
                style={{
                    background: 'radial-gradient(circle at 30% 30%, #fffbeb 0%, #fde68a 60%, #f59e0b 100%)',
                    boxShadow: '0 0 18px rgba(253,224,71,0.45)',
                }}
            />

            {/* Stage front lip — like a wooden boards proscenium */}
            <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-[14%] z-10"
                style={{
                    backgroundImage:
                        'repeating-linear-gradient(90deg, #3b1d09 0px, #6b3814 6px, #7c4519 12px, #6b3814 18px, #3b1d09 24px)',
                    boxShadow: 'inset 0 6px 10px rgba(0,0,0,0.55), 0 -3px 8px rgba(0,0,0,0.6)',
                }}
            />

            <div className="absolute inset-0">{children}</div>
        </div>
    );
}
