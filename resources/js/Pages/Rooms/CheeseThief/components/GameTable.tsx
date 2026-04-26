import { GameStatePlayer } from '@/types';
import { ReactNode } from 'react';
import Mouse from './Mouse';
import DieDisplay from './DieDisplay';
import PlayerAvatarWithVoice from '@/Components/PlayerAvatarWithVoice';

interface GameTableProps {
    players: GameStatePlayer[];
    currentPlayerId: number | null;
    awakePlayerIds?: number[];
    currentHour: number;
    onPlayerClick?: (player: GameStatePlayer) => void;
    clickablePlayerIds?: number[];
    selectedPlayerId?: number | null;
    showDice?: boolean;
    /** Central content rendered inside the table — e.g. <Stage>...</Stage> at night, dice during rolling. */
    children?: ReactNode;
}

const SEAT_RADIUS = 38;

/** Rotate the players array so the viewer ("you") is index 0 — they sit at the bottom. */
function reorderViewerFirst(players: GameStatePlayer[], viewerId: number | null): GameStatePlayer[] {
    if (viewerId === null) {
        return players;
    }
    const idx = players.findIndex((p) => p.id === viewerId);
    if (idx <= 0) {
        return players;
    }
    return [...players.slice(idx), ...players.slice(0, idx)];
}

export default function GameTable({
    players,
    currentPlayerId,
    awakePlayerIds = [],
    currentHour,
    onPlayerClick,
    clickablePlayerIds = [],
    selectedPlayerId = null,
    showDice = false,
    children,
}: GameTableProps) {
    const seats = reorderViewerFirst(players, currentPlayerId);
    const total = seats.length;
    const isNight = currentHour >= 1 && currentHour <= 6;
    const viewerIsAwake = currentPlayerId !== null && awakePlayerIds.includes(currentPlayerId);

    return (
        <div className="relative mx-auto aspect-square w-full max-w-[640px]">
            {/* Table backdrop — soft wood-toned felt circle */}
            <div
                aria-hidden
                className="absolute inset-[6%] rounded-full"
                style={{
                    background:
                        'radial-gradient(circle at 50% 38%, rgba(255, 233, 200, 0.10) 0%, rgba(0,0,0,0) 55%), radial-gradient(circle at 50% 50%, #2f3a2c 0%, #1f2a1c 70%, #15201a 100%)',
                    boxShadow:
                        'inset 0 0 0 4px rgba(120, 80, 40, 0.55), inset 0 0 0 8px rgba(60, 40, 20, 0.55), inset 0 30px 60px rgba(0,0,0,0.5)',
                }}
            />

            {/* Central content slot (stage / dice / panel) */}
            <div className="absolute inset-[24%] flex items-center justify-center">
                {children}
            </div>

            {/* Seats */}
            {seats.map((player, i) => {
                const angle = Math.PI / 2 - (2 * Math.PI * i) / total;
                const cx = 50 + Math.cos(angle) * SEAT_RADIUS;
                const cy = 50 + Math.sin(angle) * SEAT_RADIUS;

                const isSelf = player.id === currentPlayerId;
                const awake = awakePlayerIds.includes(player.id);
                const clickable = clickablePlayerIds.includes(player.id);
                const isSelected = selectedPlayerId === player.id;
                const dieIsPeeked =
                    !isSelf
                    && currentHour !== 9
                    && player.die_value !== null
                    && player.die_value !== undefined;

                // Mouse visual state — at night, asleep unless awake and viewer can see it.
                // (server already empties awakePlayerIds for asleep viewers, so this stays honest.)
                const showAsAwake = !isNight || (isNight && awake && (isSelf || viewerIsAwake));
                const showGlow = isNight && showAsAwake && (isSelf || awake);

                return (
                    <div
                        key={player.id}
                        role={clickable ? 'button' : undefined}
                        tabIndex={clickable ? 0 : -1}
                        onClick={() => clickable && onPlayerClick?.(player)}
                        onKeyDown={(e) => {
                            if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                                e.preventDefault();
                                onPlayerClick?.(player);
                            }
                        }}
                        aria-label={
                            clickable
                                ? `Select ${player.nickname}`
                                : isSelf
                                  ? `${player.nickname} (you)`
                                  : player.nickname
                        }
                        aria-pressed={clickable ? isSelected : undefined}
                        aria-disabled={!clickable}
                        className={`
                            group absolute z-10 flex flex-col items-center gap-1 rounded-2xl
                            px-2 pt-2 pb-1.5 transition-[background,box-shadow,transform] duration-200
                            ${clickable ? 'cursor-pointer' : 'cursor-default'}
                            ${isSelected ? 'bg-amber-300/15' : 'bg-transparent'}
                            ${!isNight ? '' : showAsAwake ? '' : 'opacity-60'}
                        `}
                        style={{
                            top: `${cy}%`,
                            left: `${cx}%`,
                            width: 'clamp(72px, 20%, 124px)',
                            transform: 'translate(-50%, -50%)',
                        }}
                    >
                        {/* Persistent clickable affordance — pulsing dashed ring (always rendered, hidden when not clickable so layout doesn't shift) */}
                        <span
                            aria-hidden
                            className={`
                                pointer-events-none absolute inset-0 rounded-2xl
                                ring-2 ring-dashed ring-amber-300
                                transition-opacity duration-200
                                ${clickable && !isSelected ? 'opacity-100 animate-pulse' : 'opacity-0'}
                            `}
                        />
                        {/* Selection ring — strong solid gold, no scale change */}
                        <span
                            aria-hidden
                            className={`
                                pointer-events-none absolute inset-0 rounded-2xl
                                ring-4 ring-amber-400 shadow-[0_0_16px_rgba(252,211,77,0.7)]
                                transition-opacity duration-150
                                ${isSelected ? 'opacity-100' : 'opacity-0'}
                            `}
                        />

                        {/* Awake marker pip — top-right of mouse */}
                        {isNight && showAsAwake && awake && (
                            <span
                                aria-hidden
                                className="absolute -top-1 -right-0.5 z-20 rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-900 shadow"
                            >
                                {'\u{1F319}'}
                            </span>
                        )}

                        <Mouse
                            bodyColor={player.avatar_color}
                            asleep={!showAsAwake}
                            glow={showGlow}
                            size={68}
                        />

                        {/* Nickname */}
                        <span className="block w-full truncate text-center text-[11px] font-semibold leading-tight text-slate-100/90">
                            {player.nickname}
                            {isSelf && (
                                <span className="ml-0.5 text-amber-300/90"> (you)</span>
                            )}
                        </span>

                        {/* Role icons (only set when revealed) */}
                        {(player.is_thief || player.is_accomplice) && (
                            <span className="flex items-center gap-0.5 text-[10px]">
                                {player.is_thief && <span title="Thief">{'\u{1F977}'}</span>}
                                {player.is_accomplice && <span title="Accomplice">{'\u{1F91D}'}</span>}
                            </span>
                        )}

                        {/* Die */}
                        {showDice && player.die_value !== null && player.die_value !== undefined && (
                            <div className={`relative ${dieIsPeeked ? 'rounded-md ring-1 ring-indigo-300/70' : ''}`}>
                                <DieDisplay value={player.die_value} size="sm" />
                                {dieIsPeeked && (
                                    <span
                                        aria-hidden
                                        className="absolute -top-1 -right-1 rounded-full bg-indigo-500 px-1 text-[9px] font-bold leading-tight text-white shadow"
                                        title="Learned via peek"
                                    >
                                        {'\u{1F441}'}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Phase status chips */}
                        {currentHour === 0 && (
                            <span className={`text-[9px] font-bold uppercase tracking-wide ${player.has_confirmed_roll ? 'text-emerald-300' : 'text-slate-400'}`}>
                                {player.has_confirmed_roll ? '✓ Ready' : 'Rolling…'}
                            </span>
                        )}
                        {currentHour === 8 && (
                            <span className={`text-[9px] font-bold uppercase tracking-wide ${player.has_voted ? 'text-emerald-300' : 'text-slate-400'}`}>
                                {player.has_voted ? '✓ Voted' : 'Voting…'}
                            </span>
                        )}

                        {/* Voice presence chip — small letter avatar with speaking ring + mute/video state.
                            Sits below the mouse; for the viewer it also exposes mute/video toggle buttons.
                            Viewer's chip uses size="sm" so the toggle buttons meet ~44px tap-target sanity on mobile. */}
                        <PlayerAvatarWithVoice
                            playerId={player.id}
                            nickname={player.nickname}
                            avatarColor={player.avatar_color}
                            currentPlayerId={currentPlayerId ?? 0}
                            size={isSelf ? 'sm' : 'xs'}
                            showVoiceControls={isSelf}
                            showVoiceIndicators={true}
                        />
                    </div>
                );
            })}

            {/* Tap-to-action hint — single steady label (no per-mouse popping badge) */}
            {clickablePlayerIds.length > 0 && !selectedPlayerId && (
                <div className="absolute inset-x-0 -bottom-7 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300/90">
                    {'\u{1F447}'} Tap a glowing mouse
                </div>
            )}
        </div>
    );
}
