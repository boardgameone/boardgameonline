import StackedTrio from './StackedTrio';

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
}

export default function PlayerStats({
    players,
    currentPlayerId,
    canReveal,
    onAskHighest,
    onAskLowest,
}: PlayerStatsProps) {
    return (
        <div className="space-y-3">
            {players.map((player, index) => (
                <div
                    key={player.id}
                    className={`rounded-xl border-2 p-4 transition-all duration-300 animate-slideIn ${
                        player.is_current_turn
                            ? 'border-yellow-400 bg-gradient-to-r from-yellow-50 to-yellow-100 shadow-lg animate-pulse'
                            : 'border-gray-200 bg-white'
                    }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                >
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div
                                className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md ${
                                    player.is_current_turn ? 'ring-4 ring-yellow-400 ring-offset-2' : ''
                                }`}
                                style={{ backgroundColor: player.avatar_color }}
                            >
                                {player.nickname.charAt(0).toUpperCase()}
                            </div>

                            {/* Player info */}
                            <div>
                                <p className="font-bold text-gray-900 flex items-center gap-2">
                                    {player.nickname}
                                    {player.id === currentPlayerId && (
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                                            You
                                        </span>
                                    )}
                                    {player.is_current_turn && (
                                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">
                                            Turn
                                        </span>
                                    )}
                                </p>
                                <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                                    <span className="flex items-center gap-1">
                                        <span className="font-semibold">{player.hand_count}</span> cards
                                    </span>
                                    <span className="flex items-center gap-1">
                                        🏆 <span className="font-semibold">{player.trios_count}</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Ask buttons */}
                        {canReveal && player.hand_count > 0 && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => onAskHighest(player.id)}
                                    className="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-bold text-white shadow hover:from-blue-600 hover:to-blue-700 transition-all duration-200 hover:scale-105 active:scale-95"
                                >
                                    High
                                </button>
                                <button
                                    onClick={() => onAskLowest(player.id)}
                                    className="rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-2 text-sm font-bold text-white shadow hover:from-purple-600 hover:to-purple-700 transition-all duration-200 hover:scale-105 active:scale-95"
                                >
                                    Low
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Collected trios */}
                    {player.collected_trios.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs font-semibold text-gray-600 mb-2">Collected Trios:</p>
                            <div className="flex gap-4 flex-wrap">
                                {player.collected_trios.map((trio, idx) => (
                                    <StackedTrio
                                        key={idx}
                                        cards={trio}
                                        size="sm"
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
