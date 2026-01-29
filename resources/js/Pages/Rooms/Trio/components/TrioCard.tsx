interface TrioCardProps {
    value?: number | null;
    faceUp?: boolean;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'gray' | 'blue' | 'purple' | 'green' | 'indigo';
    disabled?: boolean;
    onClick?: () => void;
    className?: string;
}

export default function TrioCard({
    value,
    faceUp = false,
    size = 'md',
    variant = 'gray',
    disabled = false,
    onClick,
    className = '',
}: TrioCardProps) {
    const sizeClasses = {
        sm: 'w-16 h-20 text-xl',
        md: 'w-20 h-28 text-3xl',
        lg: 'w-24 h-32 text-4xl',
    };

    const variantClasses = {
        gray: 'from-gray-400 to-gray-500',
        blue: 'from-blue-500 to-blue-600',
        purple: 'from-purple-500 to-purple-600',
        green: 'from-green-500 to-green-600',
        indigo: 'from-indigo-500 to-indigo-600',
    };

    const interactiveClasses = !disabled && onClick
        ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200'
        : '';

    const disabledClasses = disabled ? 'opacity-60 cursor-not-allowed' : '';

    return (
        <div className={`relative ${sizeClasses[size]} ${className}`}>
            <div
                className={`card-flip ${faceUp ? 'flipped' : ''} w-full h-full`}
                onClick={!disabled && onClick ? onClick : undefined}
            >
                {/* Front face (face down) */}
                <div
                    className={`card-face-front rounded-lg bg-gradient-to-br ${variantClasses[variant]} text-white font-bold flex items-center justify-center shadow-lg ${interactiveClasses} ${disabledClasses}`}
                >
                    {faceUp ? null : '❓'}
                </div>

                {/* Back face (face up) */}
                <div
                    className={`card-face-back rounded-lg bg-gradient-to-br ${variantClasses[variant]} text-white font-bold flex items-center justify-center shadow-lg ${interactiveClasses} ${disabledClasses}`}
                >
                    {value !== null && value !== undefined ? value : ''}
                </div>
            </div>
        </div>
    );
}
