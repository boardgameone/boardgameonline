import StackedTrio from './StackedTrio';
import GameIcon from '@/Components/GameIcon';

interface Player {
    id: number;
    nickname: string;
    avatar_color: string;
    hand_count: number;
    collected_trios: number[][];
    trios_count: number;
    is_current_turn: boolean;
}

interface PlayerStatsProps {
    players: Player[];
    currentPlayerId?: number;
    canReveal: boolean;
    onAskHighest: (playerId: number) => void;
    onAskLowest: (playerId: number) => void;
    compact?: boolean;
}

export default function PlayerStats({
    players,
    currentPlayerId,
    canReveal,
    onAskHighest,
    onAskLowest,
    compact = false,
}: PlayerStatsProps) {
    return (
        <div className={compact ? 'space-y-2' : 'space-y-3'}>
            {players.map((player, index) => (
                <div
                    key={player.id}
                    className={`rounded-lg border-2 transition-all duration-300 animate-slideIn ${
                        compact ? 'p-2' : 'p-4 rounded-xl'
                    } ${
                        player.is_current_turn
                            ? 'border-yellow-400 bg-gradient-to-r from-yellow-50 to-yellow-100 shadow-lg'
                            : 'border-gray-200 bg-white'
                    }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                >
                    <div className={`flex items-center justify-between ${compact ? '' : 'mb-2'}`}>
                        <div className={`flex items-center ${compact ? 'gap-2' : 'gap-3'}`}>
                            {/* Avatar */}
                            <div
                                className={`rounded-full flex items-center justify-center text-white font-bold shadow-md ${
                                    compact ? 'h-8 w-8 text-sm' : 'h-12 w-12 text-lg'
                                } ${
                                    player.is_current_turn ? (compact ? 'ring-2 ring-yellow-400' : 'ring-4 ring-yellow-400 ring-offset-2') : ''
                                }`}
                                style={{ backgroundColor: player.avatar_color }}
                            >
                                {player.nickname.charAt(0).toUpperCase()}
                            </div>

                            {/* Player info */}
                            <div>
                                <p className={`font-bold text-gray-900 flex items-center gap-1 ${compact ? 'text-sm' : ''}`}>
                                    <span className={compact ? 'truncate max-w-[80px]' : ''}>{player.nickname}</span>
                                    {player.id === currentPlayerId && (
                                        <span className={`bg-blue-100 text-blue-700 rounded-full font-semibold ${
                                            compact ? 'text-[10px] px-1' : 'text-xs px-2 py-0.5'
                                        }`}>
                                            You
                                        </span>
                                    )}
                                    {player.is_current_turn && (
                                        <span className={`bg-yellow-100 text-yellow-700 rounded-full font-semibold ${
                                            compact ? 'text-[10px] px-1' : 'text-xs px-2 py-0.5'
                                        }`}>
                                            Turn
                                        </span>
                                    )}
                                </p>
                                <div className={`flex items-center gap-2 text-gray-600 ${compact ? 'text-xs' : 'text-sm mt-1'}`}>
                                    <span className="flex items-center gap-1">
                                        <span className="font-semibold">{player.hand_count}</span>{compact ? '' : ' cards'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <GameIcon name="trophy" size="sm" className="text-yellow-500" /> <span className="font-semibold">{player.trios_count}</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Ask buttons */}
                        {canReveal && player.hand_count > 0 && (
                            <div className={`flex ${compact ? 'gap-1' : 'gap-2'}`}>
                                <button
                                    onClick={() => onAskHighest(player.id)}
                                    className={`rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 font-bold text-white shadow hover:from-blue-600 hover:to-blue-700 transition-all duration-200 hover:scale-105 active:scale-95 ${
                                        compact ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm'
                                    }`}
                                >
                                    {compact ? 'H' : 'High'}
                                </button>
                                <button
                                    onClick={() => onAskLowest(player.id)}
                                    className={`rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 font-bold text-white shadow hover:from-purple-600 hover:to-purple-700 transition-all duration-200 hover:scale-105 active:scale-95 ${
                                        compact ? 'px-2 py-1 text-xs' : 'px-4 py-2 text-sm'
                                    }`}
                                >
                                    {compact ? 'L' : 'Low'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Collected trios - show inline in compact mode */}
                    {player.collected_trios.length > 0 && (
                        <div className={compact ? 'mt-2 pt-2 border-t border-gray-200' : 'mt-3 pt-3 border-t border-gray-200'}>
                            <div className={`flex gap-2 flex-wrap ${compact ? '' : 'gap-4'}`}>
                                {player.collected_trios.map((trio, idx) => (
                                    <StackedTrio
                                        key={idx}
                                        cards={trio}
                                        size="xs"
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
