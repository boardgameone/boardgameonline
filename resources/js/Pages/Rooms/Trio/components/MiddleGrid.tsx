import TrioCard from './TrioCard';

interface MiddleCard {
    position: number;
    value: number | null;
    face_up: boolean;
}

interface MiddleGridProps {
    cards: MiddleCard[];
    canReveal: boolean;
    onRevealCard: (position: number) => void;
}

export default function MiddleGrid({ cards, canReveal, onRevealCard }: MiddleGridProps) {
    return (
        <div className="w-full max-w-md mx-auto">
            <div className="grid grid-cols-3 gap-3 md:gap-4">
                {cards.map((card, index) => (
                    <div
                        key={card.position}
                        className="animate-slideIn"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <TrioCard
                            value={card.value}
                            faceUp={card.face_up}
                            size="md"
                            disabled={!canReveal || card.face_up}
                            onClick={() => {
                                if (canReveal && !card.face_up) {
                                    onRevealCard(card.position);
                                }
                            }}
                            className={canReveal && !card.face_up ? 'hover:animate-pulse' : ''}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
