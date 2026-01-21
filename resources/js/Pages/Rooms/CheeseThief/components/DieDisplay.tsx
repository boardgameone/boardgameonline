interface DieDisplayProps {
    value: number | null;
    size?: 'sm' | 'md' | 'lg';
    showQuestion?: boolean;
}

const dieFaces: Record<number, string> = {
    1: '\u2680',
    2: '\u2681',
    3: '\u2682',
    4: '\u2683',
    5: '\u2684',
    6: '\u2685',
};

export default function DieDisplay({ value, size = 'md', showQuestion = true }: DieDisplayProps) {
    const sizeClasses = {
        sm: 'text-2xl',
        md: 'text-4xl',
        lg: 'text-6xl',
    };

    if (value === null) {
        return (
            <span className={`${sizeClasses[size]} text-gray-400`}>
                {showQuestion ? '?' : '\u2680'}
            </span>
        );
    }

    return (
        <span className={`${sizeClasses[size]}`}>
            {dieFaces[value] || '\u2680'}
        </span>
    );
}
