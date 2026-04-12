import { TwentyEightPlayer, TwentyEightTrickPlay } from '@/types';
import TeamBadge from './TeamBadge';
import PlayingCard from './PlayingCard';

interface PlayerSeatProps {
    player: TwentyEightPlayer;
    playedCard?: TwentyEightTrickPlay | null;
    position: 'top' | 'bottom' | 'left' | 'right';
    isDealer: boolean;
    isBidWinner: boolean;
    compact?: boolean;
}

export default function PlayerSeat({
    player,
    playedCard,
    position,
    isDealer,
    isBidWinner,
    compact = false,
}: PlayerSeatProps) {
    const isVertical = position === 'left' || position === 'right';

    return (
        <div className={`flex items-center gap-2 ${
            position === 'top' ? 'flex-col' :
            position === 'bottom' ? 'flex-col-reverse' :
            position === 'left' ? 'flex-row' :
            'flex-row-reverse'
        }`}>
            {/* Player info */}
            <div className={`flex items-center gap-1.5 ${compact ? 'max-w-[100px]' : 'max-w-[140px]'}`}>
                <div className="relative shrink-0">
                    <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ${
                            player.is_current_turn ? 'ring-2 ring-amber-400 ring-offset-1' : ''
                        }`}
                        style={{ backgroundColor: player.avatar_color }}
                    >
                        {player.nickname.charAt(0).toUpperCase()}
                    </div>
                    {isDealer && (
                        <span className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 rounded-full w-4 h-4 flex items-center justify-center text-[0.5rem] font-black border border-yellow-600">
                            D
                        </span>
                    )}
                </div>
                <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-800 truncate">
                        {player.nickname}
                    </div>
                    <div className="flex items-center gap-1">
                        <TeamBadge team={player.team} size="sm" />
                        {isBidWinner && (
                            <span className="text-[0.5rem] px-1 py-0.5 rounded-sm bg-amber-100 text-amber-700 font-bold">
                                Bid
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Played card or card count */}
            <div className="shrink-0">
                {playedCard ? (
                    <PlayingCard card={playedCard.card} faceUp size="sm" />
                ) : (
                    <div className="flex items-center gap-0.5">
                        {Array.from({ length: Math.min(player.hand_count, 4) }).map((_, i) => (
                            <div
                                key={i}
                                className="w-3 h-5 rounded-xs bg-linear-to-br from-blue-600 to-blue-800 border border-blue-900 shadow-xs"
                                style={{ marginLeft: i > 0 ? '-4px' : '0' }}
                            />
                        ))}
                        {player.hand_count > 4 && (
                            <span className="text-[0.5rem] text-gray-500 ml-0.5">+{player.hand_count - 4}</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
