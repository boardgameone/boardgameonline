import { useNightPhaseTimer } from '@/hooks/useNightPhaseTimer';

interface HourNarratorProps {
    hour: number;
    timerDuration: number;
    startedAt: string | null;
}

export default function HourNarrator({ hour, timerDuration, startedAt }: HourNarratorProps) {
    const { timeRemaining, percentage } = useNightPhaseTimer(startedAt, timerDuration);

    const isUrgent = timeRemaining <= timerDuration * 0.3;
    const isWarning = timeRemaining <= timerDuration * 0.6 && !isUrgent;

    const ringColor = isUrgent
        ? 'stroke-rose-500'
        : isWarning
          ? 'stroke-amber-400'
          : 'stroke-emerald-400';
    const numberColor = isUrgent ? 'text-rose-200' : 'text-amber-100';

    const radius = 30;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - percentage / 100);

    return (
        <div className="flex w-full max-w-md items-center justify-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-950 via-purple-950 to-indigo-950 p-3 shadow-lg ring-1 ring-amber-500/20">
            {/* Hour pips */}
            <div className="hidden flex-col items-center gap-1 sm:flex" aria-hidden>
                {[1, 2, 3, 4, 5, 6].map((h) => (
                    <span
                        key={h}
                        className={`
                            h-1.5 w-1.5 rounded-full transition-all
                            ${h < hour ? 'bg-amber-400/40' : ''}
                            ${h === hour ? 'bg-amber-300 ring-2 ring-amber-300/40 scale-150' : ''}
                            ${h > hour ? 'bg-slate-700' : ''}
                        `}
                    />
                ))}
            </div>

            {/* Big hour number */}
            <div className="flex flex-col items-center px-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300/80">
                    {'\u{1F319}'} Hour
                </span>
                <span
                    key={hour /* re-mount on hour change so the animation replays */}
                    className="font-serif text-5xl font-bold leading-none text-amber-100 drop-shadow animate-[fadeIn_0.5s_ease-out]"
                >
                    {hour}
                </span>
                <span className="mt-0.5 text-[10px] text-amber-300/60">of 6</span>
            </div>

            {/* Countdown ring */}
            <div className="relative h-20 w-20">
                <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="transparent"
                        className="text-indigo-900/70"
                    />
                    <circle
                        cx="40"
                        cy="40"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className={`${ringColor} transition-all duration-100`}
                    />
                </svg>
                <div
                    className={`
                        absolute inset-0 flex items-center justify-center
                        ${isUrgent ? 'animate-pulse' : ''}
                    `}
                >
                    <span className={`text-2xl font-bold ${numberColor}`}>
                        {Math.ceil(timeRemaining)}
                    </span>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.7); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}
