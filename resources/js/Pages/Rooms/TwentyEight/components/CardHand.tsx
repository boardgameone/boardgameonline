import { TwentyEightCard } from '@/types';
import PlayingCard from './PlayingCard';

interface CardHandProps {
    cards: TwentyEightCard[];
    playableIndices: number[];
    canPlay: boolean;
    onPlayCard: (index: number) => void;
}

export default function CardHand({
    cards,
    playableIndices,
    canPlay,
    onPlayCard,
}: CardHandProps) {
    if (cards.length === 0) {
        return (
            <div className="text-center text-gray-400 text-sm py-4">
                No cards in hand
            </div>
        );
    }

    // Group cards by suit for display
    const suitOrder = ['hearts', 'diamonds', 'clubs', 'spades'];

    return (
        <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
            {cards.map((card, index) => {
                const isPlayable = canPlay && playableIndices.includes(index);
                return (
                    <div
                        key={`${card.rank}-${card.suit}-${index}`}
                        className="transition-all duration-200"
                        style={{ animationDelay: `${index * 40}ms` }}
                    >
                        <PlayingCard
                            card={card}
                            faceUp
                            size="md"
                            disabled={canPlay && !isPlayable}
                            highlighted={isPlayable}
                            onClick={isPlayable ? () => onPlayCard(index) : undefined}
                            showPoints
                        />
                    </div>
                );
            })}
        </div>
    );
}
