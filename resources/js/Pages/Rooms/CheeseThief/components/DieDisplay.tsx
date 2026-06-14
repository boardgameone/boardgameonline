interface DieDisplayProps {
    value: number | null;
    size?: 'sm' | 'md' | 'lg';
    showQuestion?: boolean;
}

const sizeMap = {
    sm: { box: 'h-9 w-9', num: 'text-xl' },
    md: { box: 'h-14 w-14', num: 'text-3xl' },
    lg: { box: 'h-20 w-20', num: 'text-5xl' },
};

export default function DieDisplay({ value, size = 'md', showQuestion = true }: DieDisplayProps) {
    const s = sizeMap[size];

    if (value === null || value === undefined || value < 1 || value > 6) {
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
        <img
            src={`/images/cheese-thief/die-${value}.png`}
            alt={`Die showing ${value}`}
            title={`Wakes at hour ${value}`}
            draggable={false}
            className={`${s.box} select-none object-contain drop-shadow-sm`}
        />
    );
}
