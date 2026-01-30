import TrioCard from './TrioCard';

interface MiddleCard {
    position: number;
    value: number | null;
    face_up: boolean;
    removed?: boolean;
}

interface MiddleGridProps {
    cards: MiddleCard[];
    canReveal: boolean;
    onRevealCard: (position: number) => void;
    compact?: boolean;
}

export default function MiddleGrid({ cards, canReveal, onRevealCard, compact = false }: MiddleGridProps) {
    return (
        <div className={compact ? 'w-fit' : 'w-full max-w-md mx-auto'}>
            <div className={`grid grid-cols-3 ${compact ? 'gap-1.5' : 'gap-2 sm:gap-3 md:gap-4'}`}>
                {cards.map((card, index) => (
                    <div
                        key={card.position}
                        className="animate-slideIn"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        {card.removed ? (
                            <div className={`${compact ? 'w-[4.5rem] h-[5.5rem]' : 'w-[4.5rem] h-[5.5rem] sm:w-[5.5rem] sm:h-[7.5rem]'} rounded-lg bg-slate-200/50 border-2 border-dashed border-slate-300`} />
                        ) : (
                            <TrioCard
                                value={card.value}
                                faceUp={card.face_up}
                                size={compact ? 'sm' : undefined}
                                disabled={!canReveal || card.face_up}
                                onClick={() => {
                                    if (canReveal && !card.face_up) {
                                        onRevealCard(card.position);
                                    }
                                }}
                                className={canReveal && !card.face_up ? 'hover:animate-pulse' : ''}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
