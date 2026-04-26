import { GameStatePlayer } from '@/types';
import DieDisplay from './DieDisplay';
import PlayerAvatarWithVoice from '@/Components/PlayerAvatarWithVoice';

interface PlayerCircleProps {
    players: GameStatePlayer[];
    currentPlayerId: number | null;
    awakePlayerIds: number[];
    currentHour: number;
    onPlayerClick?: (player: GameStatePlayer) => void;
    clickablePlayerIds?: number[];
    showDice?: boolean;
    selectedPlayerId?: number | null;
    /** Short verb shown as a "tap to ___" badge over clickable cards (e.g. "peek", "vote"). Hidden when omitted. */
    actionLabel?: string;
}

export default function PlayerCircle({
    players,
    currentPlayerId,
    awakePlayerIds,
    currentHour,
    onPlayerClick,
    clickablePlayerIds = [],
    showDice = false,
    selectedPlayerId = null,
    actionLabel,
}: PlayerCircleProps) {
    const isNightPhase = currentHour >= 1 && currentHour <= 6;
    const isAwake = (playerId: number) => awakePlayerIds.includes(playerId);
    const currentPlayerIsAwake = currentPlayerId ? awakePlayerIds.includes(currentPlayerId) : false;
    const isClickable = (playerId: number) => clickablePlayerIds.includes(playerId);

    return (
        <div className="flex flex-wrap justify-center gap-3">
            {players.map((player) => {
                const isSelf = player.id === currentPlayerId;
                const awake = isAwake(player.id);
                const clickable = isClickable(player.id);
                const isSelected = selectedPlayerId === player.id;
                // Awake-state markers are only meaningful when the viewer is awake too
                // (the server already empties awakePlayerIds for sleeping viewers).
                const showAwakeMarker = isNightPhase && awake && (isSelf || currentPlayerIsAwake);
                // The die is "peeked" only during gameplay (not at hour 9 results, where the
                // server reveals everyone's die universally — that's not a peek).
                const dieIsPeeked =
                    !isSelf
                    && currentHour !== 9
                    && player.die_value !== null
                    && player.die_value !== undefined;

                return (
                    <button
                        key={player.id}
                        onClick={() => clickable && onPlayerClick?.(player)}
                        disabled={!clickable}
                        className={`
                            relative flex flex-col items-center gap-2 rounded-2xl p-3 pt-5 transition-all
                            ${isSelf ? 'bg-gradient-to-b from-sky-50 to-white ring-2 ring-sky-400' : 'bg-white ring-1 ring-slate-200'}
                            ${isSelected ? 'ring-4 ring-indigo-500 shadow-lg scale-105' : ''}
                            ${clickable && !isSelected ? 'cursor-pointer ring-2 ring-indigo-300 ring-dashed hover:scale-105 hover:ring-indigo-500 hover:shadow-md' : ''}
                            ${!clickable ? 'cursor-default' : ''}
                        `}
                    >
                        {showAwakeMarker && (
                            <span
                                className="absolute -top-2 right-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-900 shadow"
                                aria-hidden
                            >
                                {'\u{1F319}'} AWAKE
                            </span>
                        )}

                        {clickable && !isSelected && actionLabel && (
                            <span
                                className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow"
                                aria-hidden
                            >
                                tap to {actionLabel}
                            </span>
                        )}

                        <PlayerAvatarWithVoice
                            playerId={player.id}
                            nickname={player.nickname}
                            avatarColor={player.avatar_color}
                            currentPlayerId={currentPlayerId ?? 0}
                            size="lg"
                            showVoiceControls={true}
                            showVoiceIndicators={true}
                        />

                        <span className="text-sm font-medium text-gray-900 max-w-[80px] truncate">
                            {player.nickname}
                            {isSelf && ' (You)'}
                        </span>

                        <div className="flex items-center gap-1 text-xs">
                            {player.is_thief && (
                                <span title="Thief">{'\u{1F977}'}</span>
                            )}
                            {player.is_accomplice && (
                                <span title="Accomplice">{'\u{1F91D}'}</span>
                            )}
                        </div>

                        {showDice && player.die_value && (
                            <div
                                className={`
                                    relative mt-1 rounded-lg p-1
                                    ${dieIsPeeked ? 'bg-indigo-100 ring-1 ring-indigo-300' : ''}
                                `}
                                title={dieIsPeeked ? 'You peeked at this mouse' : undefined}
                            >
                                <DieDisplay value={player.die_value} size="md" />
                                {dieIsPeeked && (
                                    <span
                                        className="absolute -top-2 -right-2 rounded-full bg-indigo-500 px-1 text-[10px] leading-tight text-white shadow"
                                        title="Learned via peek"
                                    >
                                        {'\u{1F441}'}
                                    </span>
                                )}
                            </div>
                        )}

                        {currentHour === 0 && (
                            <span className={`text-xs ${player.has_confirmed_roll ? 'text-green-600' : 'text-gray-400'}`}>
                                {player.has_confirmed_roll ? '✓ Ready' : 'Waiting...'}
                            </span>
                        )}
                        {currentHour === 8 && (
                            <span className={`text-xs ${player.has_voted ? 'text-green-600' : 'text-gray-400'}`}>
                                {player.has_voted ? '✓ Voted' : 'Voting...'}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
