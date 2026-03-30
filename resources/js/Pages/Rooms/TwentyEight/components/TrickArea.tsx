import { TwentyEightTrickPlay } from '@/types';
import PlayingCard from './PlayingCard';

interface TrickAreaProps {
    cards: TwentyEightTrickPlay[];
    playerOrder: number[];
    currentPlayerId?: number;
    trickNumber: number;
}

export default function TrickArea({
    cards,
    playerOrder,
    currentPlayerId,
    trickNumber,
}: TrickAreaProps) {
    // Arrange cards based on relative position to current player
    const getRelativePosition = (playerId: number): 'bottom' | 'left' | 'top' | 'right' => {
        const myIndex = playerOrder.indexOf(currentPlayerId ?? 0);
        const theirIndex = playerOrder.indexOf(playerId);
        const relative = ((theirIndex - myIndex) + 4) % 4;

        switch (relative) {
            case 0: return 'bottom';
            case 1: return 'left';
            case 2: return 'top';
            case 3: return 'right';
            default: return 'bottom';
        }
    };

    const positionStyles: Record<string, string> = {
        top: 'top-0 left-1/2 -translate-x-1/2',
        bottom: 'bottom-0 left-1/2 -translate-x-1/2',
        left: 'left-0 top-1/2 -translate-y-1/2',
        right: 'right-0 top-1/2 -translate-y-1/2',
    };

    return (
        <div className="relative w-40 h-40 sm:w-48 sm:h-48">
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center">
                {cards.length === 0 && (
                    <span className="text-xs text-gray-400 font-medium">
                        Trick {trickNumber}
                    </span>
                )}
            </div>

            {/* Played cards */}
            {cards.map((play) => {
                const position = getRelativePosition(play.player_id);
                return (
                    <div
                        key={play.player_id}
                        className={`absolute ${positionStyles[position]} transition-all duration-300`}
                    >
                        <PlayingCard card={play.card} faceUp size="sm" showPoints />
                    </div>
                );
            })}
        </div>
    );
}
