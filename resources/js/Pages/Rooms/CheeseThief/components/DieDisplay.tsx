interface DieDisplayProps {
    value: number | null;
    size?: 'sm' | 'md' | 'lg';
    showQuestion?: boolean;
}

const sizeMap = {
    sm: { box: 'h-9 w-9', num: 'text-xl', label: 'text-[8px]' },
    md: { box: 'h-14 w-14', num: 'text-3xl', label: 'text-[10px]' },
    lg: { box: 'h-20 w-20', num: 'text-5xl', label: 'text-xs' },
};

export default function DieDisplay({ value, size = 'md', showQuestion = true }: DieDisplayProps) {
    const s = sizeMap[size];

    if (value === null || value === undefined) {
        return (
            <div
                className={`
                    ${s.box} flex flex-col items-center justify-center rounded-lg
                    border-2 border-dashed border-slate-300 bg-slate-50
                    text-slate-400
                `}
            >
                <span className={`font-bold leading-none ${s.num}`}>
                    {showQuestion ? '?' : ''}
                </span>
            </div>
        );
    }

    return (
        <div
            className={`
                ${s.box} relative flex flex-col items-center justify-center rounded-lg
                border border-slate-300 bg-gradient-to-b from-white to-slate-100
                shadow-sm
            `}
            title={`Wakes at hour ${value}`}
        >
            <span className={`font-extrabold leading-none text-slate-900 ${s.num}`}>
                {value}
            </span>
            <span className={`mt-0.5 font-bold uppercase tracking-wider text-slate-400 ${s.label}`}>
                hr
            </span>
        </div>
    );
}
