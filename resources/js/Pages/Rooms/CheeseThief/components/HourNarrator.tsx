import { useNightPhaseTimer } from '@/hooks/useNightPhaseTimer';

interface HourNarratorProps {
    hour: number;
    timerDuration: number;
    startedAt: string | null;
}

export default function HourNarrator({ hour, timerDuration, startedAt }: HourNarratorProps) {
    const { timeRemaining, percentage } = useNightPhaseTimer(startedAt, timerDuration);

    const ringColor =
        timeRemaining > timerDuration * 0.6
            ? 'stroke-emerald-400'
            : timeRemaining > timerDuration * 0.3
              ? 'stroke-amber-400'
              : 'stroke-rose-400';

    const radius = 28;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - percentage / 100);

    return (
        <div className="flex w-full flex-col items-center gap-3">
            <div className="rounded-full bg-indigo-950/80 px-6 py-2 text-center text-lg font-semibold tracking-wide text-amber-100 shadow-lg ring-1 ring-amber-500/30">
                <span className="mr-2">🌙</span>
                Hour <span className="text-amber-300">{hour}</span> of 6
            </div>

            <div className="relative h-20 w-20">
                <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r={radius} stroke="currentColor" strokeWidth="6" fill="transparent" className="text-indigo-900/60" />
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
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-amber-100">
                        {Math.ceil(timeRemaining)}
                    </span>
                </div>
            </div>
        </div>
    );
}
