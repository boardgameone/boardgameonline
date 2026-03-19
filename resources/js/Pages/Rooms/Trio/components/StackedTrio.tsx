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
        xs: 'w-[3.5rem] h-[4.25rem]',
        sm: 'w-[5.5rem] h-[6.5rem]',
        md: 'w-[6.5rem] h-[8.5rem]',
        lg: 'w-[7.5rem] h-[9.5rem]',
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
