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
        xs: 'w-14 h-16',
        sm: 'w-20 h-24',
        md: 'w-24 h-32',
        lg: 'w-28 h-36',
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
