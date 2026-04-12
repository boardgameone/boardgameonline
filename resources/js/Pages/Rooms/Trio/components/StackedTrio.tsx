import TrioCard from './TrioCard';

interface StackedTrioProps {
    cards: number[];
    size?: 'xs' | 'sm' | 'md' | 'lg';
}

export default function StackedTrio({ cards, size = 'sm' }: StackedTrioProps) {
    if (cards.length !== 3) {
        return null;
    }

    // Size-specific dimensions for the container
    const containerSizes = {
        xs: 'w-14 h-17',
        sm: 'w-22 h-26',
        md: 'w-26 h-34',
        lg: 'w-30 h-38',
    };

    return (
        <div className={`relative ${containerSizes[size]}`}>
            {cards.map((card, idx) => (
                <div
                    key={idx}
                    className="absolute transition-transform hover:z-20"
                    style={{
                        left: `${idx * 8}px`,
                        top: `${idx * 2}px`,
                        transform: `rotate(${(idx - 1) * 3}deg)`,
                        zIndex: idx,
                    }}
                >
                    <TrioCard
                        value={card}
                        faceUp={true}
                        size={size}
                    />
                </div>
            ))}
        </div>
    );
}
