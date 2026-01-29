import { GameStatePlayer } from '@/types';
import DieDisplay from './DieDisplay';

interface PlayerCircleProps {
    players: GameStatePlayer[];
    currentPlayerId: number | null;
    awakePlayerIds: number[];
    currentHour: number;
    onPlayerClick?: (player: GameStatePlayer) => void;
    clickablePlayerIds?: number[];
    showDice?: boolean;
}

export default function PlayerCircle({
    players,
    currentPlayerId,
    awakePlayerIds,
    currentHour,
    onPlayerClick,
    clickablePlayerIds = [],
    showDice = false,
}: PlayerCircleProps) {
    const isNightPhase = currentHour >= 1 && currentHour <= 6;
    const isAwake = (playerId: number) => awakePlayerIds.includes(playerId);
    const currentPlayerIsAwake = currentPlayerId ? awakePlayerIds.includes(currentPlayerId) : false;
    const isClickable = (playerId: number) => clickablePlayerIds.includes(playerId);

    return (
        <div className="flex flex-wrap justify-center gap-4">
            {players.map((player) => {
                const isSelf = player.id === currentPlayerId;
                const awake = isAwake(player.id);
                const clickable = isClickable(player.id);

                return (
                    <button
                        key={player.id}
                        onClick={() => clickable && onPlayerClick?.(player)}
                        disabled={!clickable}
                        className={`
                            flex flex-col items-center gap-2 rounded-xl p-4 transition-all
                            ${isSelf ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-white'}
                            ${clickable ? 'cursor-pointer hover:bg-gray-100 hover:scale-105' : 'cursor-default'}
                            ${isNightPhase && !awake ? 'opacity-50' : ''}
                            ${player.has_stolen_cheese && (isSelf || currentPlayerIsAwake) ? 'ring-2 ring-yellow-500' : ''}
                        `}
                    >
                        {/* Avatar */}
                        <div
                            className={`
                                flex h-14 w-14 items-center justify-center rounded-full text-white font-bold text-xl
                                ${isNightPhase && awake && (isSelf || currentPlayerIsAwake) ? 'ring-4 ring-yellow-400 animate-pulse' : ''}
                            `}
                            style={{ backgroundColor: player.avatar_color }}
                        >
                            {player.nickname.charAt(0).toUpperCase()}
                        </div>

                        {/* Name */}
                        <span className="text-sm font-medium text-gray-900 max-w-[80px] truncate">
                            {player.nickname}
                            {isSelf && ' (You)'}
                        </span>

                        {/* Status indicators */}
                        <div className="flex items-center gap-1 text-xs">
                            {isNightPhase && awake && (isSelf || currentPlayerIsAwake) && (
                                <span className="text-yellow-600" title="Awake">
                                    {'\u{1F441}'}
                                </span>
                            )}
                            {isNightPhase && !awake && (isSelf || currentPlayerIsAwake) && (
                                <span className="text-gray-400" title="Sleeping">
                                    {'\u{1F4A4}'}
                                </span>
                            )}
                            {player.has_stolen_cheese && (isSelf || currentPlayerIsAwake) && (
                                <span title="Cheese stolen!">
                                    {'\u{1F9C0}'}
                                </span>
                            )}
                            {player.is_thief && (
                                <span title="Thief">
                                    {'\u{1F977}'}
                                </span>
                            )}
                            {player.is_accomplice && (
                                <span title="Accomplice">
                                    {'\u{1F91D}'}
                                </span>
                            )}
                        </div>

                        {/* Die display */}
                        {showDice && (
                            <div className="mt-1">
                                <DieDisplay
                                    value={isSelf || currentPlayerIsAwake ? player.die_value : null}
                                    size="sm"
                                />
                            </div>
                        )}

                        {/* Confirmation/Vote status */}
                        {currentHour === 0 && (
                            <span className={`text-xs ${player.has_confirmed_roll ? 'text-green-600' : 'text-gray-400'}`}>
                                {player.has_confirmed_roll ? '\u2713 Ready' : 'Waiting...'}
                            </span>
                        )}
                        {currentHour === 8 && (
                            <span className={`text-xs ${player.has_voted ? 'text-green-600' : 'text-gray-400'}`}>
                                {player.has_voted ? '\u2713 Voted' : 'Voting...'}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
