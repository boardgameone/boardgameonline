/**
 * Active-game phase for CubeTac (light theme).
 *
 * Receives a uniform props shape that works for both online mode (fed by
 * Inertia poll) and local hotseat mode (fed by reducer). The parent is
 * responsible for turning user actions into the correct side effect
 * (HTTP POST vs. reducer dispatch).
 *
 * Supports 2..6 players. Player 0/1 use X/O for the HUD chip (matching
 * the 3D cube glyphs); 2..5 use triangle, square, plus, hexagon.
 */

import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from 'react';
import { Marks, Move, indexOf } from '@/lib/rubikCube';
import { indexOf as megaIndexOf, type Direction as MegaDirection } from '@/lib/megaminx';
import { indexOf as pyraIndexOf, type Direction as PyraDirection } from '@/lib/pyraminx';
import RotateControls from './components/RotateControls';
import PyraRotateControls from './components/PyraRotateControls';
import type { CubeSceneHandle } from './CubeScene';
import type { MegaminxSceneHandle } from './MegaminxScene';
import type { PyraminxSceneHandle } from './PyraminxScene';
import { useVoiceChatOptional } from '@/Contexts/VoiceChatContext';
import VideoModal from '@/Components/VideoModal';
import { useSound } from '@/hooks/useSound';

const CubeScene = lazy(() => import('./CubeScene'));
const MegaminxScene = lazy(() => import('./MegaminxScene'));
const PyraminxScene = lazy(() => import('./PyraminxScene'));

export interface CubeTacPlayerInfo {
    id: number | null;
    nickname: string;
    avatar_color: string;
    /** Glyph-design index (0..5): X / O / △ / ▢ / ✚ / ⬡. */
    design: number;
    /** Cumulative wins in this lobby (online) or session (local hotseat). */
    wins: number;
}

export interface PlayingPhaseProps {
    marks: Marks;
    currentTurn: number;
    moveCount: number;
    moveLimit: number;
    /** One entry per slot (0..N-1). Length determines N. */
    players: CubeTacPlayerInfo[];
    /** Viewer's slot, or `null` for spectators / local mode. */
    mySlot: number | null;
    /** Viewer's player id, or `null` for spectators / local mode. Drives voice UI. */
    currentPlayerId?: number | null;
    isMyTurn: boolean;
    /**
     * True after the current player has placed a mark but not yet clicked
     * Confirm Turn. Marks/rotations are blocked; the Confirm button is shown.
     * Rotations never set this — they auto-advance the turn.
     */
    pendingAction: boolean;
    /**
     * Most recent action's metadata. When `pendingAction` is true and this
     * is a mark, its `{face,row,col}` (cube) or `{face,slot}` (megaminx)
     * identifies the cell the current player can click again to undo.
     */
    lastAction?: Record<string, unknown> | null;
    /**
     * Which playing surface this room uses. Defaults to 'cube' for callers
     * that predate the variant feature (and for the local hotseat page).
     */
    variant?: 'cube' | 'megaminx' | 'pyraminx';
    onMark: (face: number, row: number, col: number) => void;
    onRotate: (move: Move) => void;
    /** Megaminx mark handler — required when variant === 'megaminx'. */
    onMegaMark?: (face: number, slot: number) => void;
    /** Megaminx rotate handler — required when variant === 'megaminx'. */
    onMegaRotate?: (face: number, direction: MegaDirection) => void;
    /** Pyraminx mark handler — required when variant === 'pyraminx'. */
    onPyraMark?: (face: number, slot: number) => void;
    /** Pyraminx rotate handler — required when variant === 'pyraminx'. */
    onPyraRotate?: (face: number, direction: PyraDirection) => void;
    onEndTurn: () => void;
    onUndoMark: () => void;
    /** Banner override — used by local mode to show "Player 1's turn" etc. */
    turnLabelOverride?: string;
    /** Back / leave handler */
    onLeave?: () => void;
    /** Ref for the cube scene's imperative handle (drives rotation animation). */
    cubeRef?: Ref<CubeSceneHandle>;
    /** Ref for the megaminx scene's imperative handle. */
    megaRef?: Ref<MegaminxSceneHandle>;
    /** Ref for the pyraminx scene's imperative handle. */
    pyraRef?: Ref<PyraminxSceneHandle>;
    /**
     * Total completed games in this lobby (wins + draws). Feeds the round
     * indicator in the leaderboard — a round is one game per player.
     */
    gamesPlayed: number;
}

/** 2D HUD chips for each slot — Unicode chars so the badges stay cheap. */
export const SLOT_CHARS = ['X', 'O', '△', '▢', '✚', '⬡'] as const;

export default function PlayingPhase({
    marks,
    currentTurn,
    moveCount,
    moveLimit,
    players,
    mySlot,
    currentPlayerId = null,
    isMyTurn,
    pendingAction,
    lastAction,
    variant = 'cube',
    onMark,
    onRotate,
    onMegaMark,
    onMegaRotate,
    onPyraMark,
    onPyraRotate,
    onEndTurn,
    onUndoMark,
    turnLabelOverride,
    onLeave,
    cubeRef,
    megaRef,
    pyraRef,
    gamesPlayed,
}: PlayingPhaseProps) {
    const voiceChat = useVoiceChatOptional();
    const voiceReady = !!voiceChat?.isConnected && currentPlayerId !== null;
    const selfMuted = voiceChat?.isMuted ?? true;
    const selfVideoOn = voiceChat?.isVideoEnabled ?? false;
    const { play: playRotateSound } = useSound('/sounds/cubetac/rotate.mp3', { volume: 0.6 });
    const handleRotateWithSound = (move: Move) => {
        playRotateSound();
        onRotate(move);
    };
    const markCounts = useMemo(() => countMarksBySlot(marks, players.length), [marks, players.length]);
    const playerColors = useMemo(() => players.map((p) => p.avatar_color), [players]);
    const playerDesigns = useMemo(() => players.map((p, slot) => p.design ?? slot), [players]);

    const currentPlayer = players[currentTurn];
    const currentColor = currentPlayer?.avatar_color ?? '#5b9bd5';
    const turnLabel =
        turnLabelOverride ??
        (mySlot === null
            ? `${currentPlayer?.nickname ?? SLOT_CHARS[playerDesigns[currentTurn] ?? currentTurn] ?? '?'} to move`
            : isMyTurn
                ? 'Your Turn'
                : `${currentPlayer?.nickname ?? 'Opponent'}'s Turn`);

    const canAct = isMyTurn && !pendingAction;

    // Pending mark — different lastAction.type per variant. The cube
    // identifies the pending sticker by (face, row, col); megaminx and
    // pyraminx by (face, slot). We compute a single flat index for all
    // three so the scene components can highlight it uniformly.
    const isMegaminx = variant === 'megaminx';
    const isPyraminx = variant === 'pyraminx';
    const pendingCubeMark = variant === 'cube' && pendingAction && lastAction && lastAction.type === 'mark'
        ? {
            face: lastAction.face as number,
            row: lastAction.row as number,
            col: lastAction.col as number,
        }
        : null;
    const pendingMegaMark = isMegaminx && pendingAction && lastAction && lastAction.type === 'mega_mark'
        ? {
            face: lastAction.face as number,
            slot: lastAction.slot as number,
        }
        : null;
    const pendingPyraMark = isPyraminx && pendingAction && lastAction && lastAction.type === 'pyra_mark'
        ? {
            face: lastAction.face as number,
            slot: lastAction.slot as number,
        }
        : null;
    const pendingIndex = pendingCubeMark
        ? indexOf(pendingCubeMark.face, pendingCubeMark.row, pendingCubeMark.col)
        : pendingMegaMark
            ? megaIndexOf(pendingMegaMark.face, pendingMegaMark.slot)
            : pendingPyraMark
                ? pyraIndexOf(pendingPyraMark.face, pendingPyraMark.slot)
                : null;
    const hasPending = pendingCubeMark !== null || pendingMegaMark !== null || pendingPyraMark !== null;
    const subLabel = pendingAction && isMyTurn
        ? 'Confirm · or tap your mark to undo'
        : canAct || turnLabelOverride
            ? isMegaminx
                ? 'Tap a cell · or use a face center to rotate ↺ ↻'
                : isPyraminx
                    ? 'Tap a perimeter cell · or rotate a face below'
                    : 'Tap a sticker · or rotate a face'
            : 'Waiting…';

    // Cube click: tap the pending mark to undo, otherwise mark an empty cell.
    const handleStickerClick = (face: number, row: number, col: number) => {
        if (pendingCubeMark
            && pendingCubeMark.face === face
            && pendingCubeMark.row === row
            && pendingCubeMark.col === col) {
            onUndoMark();
            return;
        }
        if (canAct && marks[indexOf(face, row, col)] === null) {
            onMark(face, row, col);
        }
    };

    // Megaminx click: same shape, with (face, slot) instead of (face, row, col).
    const handleCellClick = (face: number, slot: number) => {
        if (pendingMegaMark && pendingMegaMark.face === face && pendingMegaMark.slot === slot) {
            onUndoMark();
            return;
        }
        if (canAct && marks[megaIndexOf(face, slot)] === null) {
            onMegaMark?.(face, slot);
        }
    };

    const handleMegaRotateWithSound = (face: number, direction: MegaDirection) => {
        if (!canAct) return;
        playRotateSound();
        // Trigger the local animation; the network round-trip runs in parallel.
        if (megaRef && typeof megaRef === 'object' && 'current' in megaRef) {
            megaRef.current?.playMove(face, direction);
        }
        onMegaRotate?.(face, direction);
    };

    // Pyraminx click: same shape as megaminx, but only the 6 perimeter slots
    // (0..5) are accepted. The scene already restricts clicking to those.
    const handlePyraCellClick = (face: number, slot: number) => {
        if (pendingPyraMark && pendingPyraMark.face === face && pendingPyraMark.slot === slot) {
            onUndoMark();
            return;
        }
        if (canAct && marks[pyraIndexOf(face, slot)] === null) {
            onPyraMark?.(face, slot);
        }
    };

    const handlePyraRotateWithSound = (face: number, direction: PyraDirection) => {
        if (!canAct) return;
        playRotateSound();
        if (pyraRef && typeof pyraRef === 'object' && 'current' in pyraRef) {
            pyraRef.current?.playMove(face, direction);
        }
        onPyraRotate?.(face, direction);
    };

    const stickerClickActive = isMyTurn && (canAct || hasPending);

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden">
            {/* Top bar: leave button + move counter */}
            <div className="flex items-center justify-between px-4 pt-3 sm:px-6">
                {onLeave ? (
                    <button
                        type="button"
                        onClick={onLeave}
                        className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-sm font-bold text-yellow-900 shadow-md backdrop-blur-xs transition hover:bg-white hover:text-yellow-700"
                        aria-label="Leave game"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                ) : (
                    <span className="h-9 w-9" />
                )}

                <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gray-700 shadow-md backdrop-blur-xs">
                    Move {moveCount} / {moveLimit}
                </div>

                <span className="h-9 w-9" />
            </div>

            {/* Turn banner */}
            <div className="mt-3 flex flex-col items-center">
                <div
                    className="text-3xl font-black leading-none sm:text-4xl drop-shadow-xs"
                    style={{ color: currentColor }}
                >
                    {turnLabel}
                </div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.3em] text-gray-600">
                    {subLabel}
                </div>
            </div>

            {/* 3D canvas — cube or dodecahedron depending on variant */}
            <div className="relative flex-1 min-h-0">
                <Suspense
                    fallback={
                        <div className="flex h-full items-center justify-center">
                            <div className="text-xs font-bold uppercase tracking-[0.4em] text-gray-500">
                                {isMegaminx
                                    ? 'Loading megaminx…'
                                    : isPyraminx
                                        ? 'Loading pyraminx…'
                                        : 'Loading cube…'}
                            </div>
                        </div>
                    }
                >
                    {isMegaminx ? (
                        <MegaminxScene
                            ref={megaRef}
                            marks={marks}
                            playerColors={playerColors}
                            designs={playerDesigns}
                            pendingIndex={pendingIndex}
                            onCellClick={stickerClickActive ? handleCellClick : undefined}
                            onRotate={canAct ? handleMegaRotateWithSound : undefined}
                            interactive={stickerClickActive || canAct}
                        />
                    ) : isPyraminx ? (
                        <PyraminxScene
                            ref={pyraRef}
                            marks={marks}
                            playerColors={playerColors}
                            designs={playerDesigns}
                            pendingIndex={pendingIndex}
                            onCellClick={stickerClickActive ? handlePyraCellClick : undefined}
                            interactive={stickerClickActive}
                        />
                    ) : (
                        <CubeScene
                            ref={cubeRef}
                            marks={marks}
                            playerColors={playerColors}
                            designs={playerDesigns}
                            pendingIndex={pendingIndex}
                            onStickerClick={stickerClickActive ? handleStickerClick : undefined}
                            interactive={stickerClickActive}
                        />
                    )}
                </Suspense>

                {!isMyTurn && !turnLabelOverride && (
                    <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
                        <div className="rounded-full bg-white/80 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-600 shadow-md backdrop-blur-xs">
                            waiting for opponent
                        </div>
                    </div>
                )}

                <ShortcutHints variant={variant} />

                <Leaderboard
                    players={players}
                    currentTurn={currentTurn}
                    gamesPlayed={gamesPlayed}
                />
            </div>

            {/* Player HUD + rotate controls */}
            <div className="flex flex-col gap-3 border-t-2 border-yellow-600/30 bg-white/80 px-4 py-4 backdrop-blur-xs sm:px-6">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                    {players.map((p, slot) => (
                        <PlayerBadge
                            key={slot}
                            player={p}
                            slot={slot}
                            isActive={currentTurn === slot}
                            markCount={markCounts[slot] ?? 0}
                            currentPlayerId={currentPlayerId}
                        />
                    ))}
                    {voiceReady && (
                        <div className="flex items-center gap-1.5 rounded-full bg-white px-2 py-1 shadow-xs border-2 border-gray-200">
                            <button
                                type="button"
                                onClick={() => voiceChat!.toggleMute()}
                                aria-label={selfMuted ? 'Unmute microphone' : 'Mute microphone'}
                                title={selfMuted ? 'Unmute microphone' : 'Mute microphone'}
                                className={`grid h-8 w-8 place-items-center rounded-full text-white shadow-md transition hover:scale-110 ${
                                    selfMuted ? 'bg-red-500' : 'bg-green-500'
                                }`}
                            >
                                {selfMuted ? <MicOffIcon className="h-4 w-4" /> : <MicOnIcon className="h-4 w-4" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => voiceChat!.toggleVideo()}
                                aria-label={selfVideoOn ? 'Turn off camera' : 'Turn on camera'}
                                title={selfVideoOn ? 'Turn off camera' : 'Turn on camera'}
                                className={`grid h-8 w-8 place-items-center rounded-full text-white shadow-md transition hover:scale-110 ${
                                    selfVideoOn ? 'bg-green-500' : 'bg-gray-500'
                                }`}
                            >
                                {selfVideoOn ? <VideoOnIcon className="h-4 w-4" /> : <VideoOffIcon className="h-4 w-4" />}
                            </button>
                        </div>
                    )}
                </div>

                {!isMegaminx && !isPyraminx && <RotateControls onRotate={handleRotateWithSound} disabled={!canAct} />}
                {isPyraminx && <PyraRotateControls onRotate={handlePyraRotateWithSound} disabled={!canAct} />}

                {isMyTurn && pendingAction && (
                    <div className="flex justify-center pt-1">
                        <button
                            type="button"
                            onClick={onEndTurn}
                            aria-label="End turn"
                            className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg border-b-4 border-emerald-700 transition hover:scale-[1.03] hover:from-emerald-600 hover:to-teal-600 active:scale-95"
                            style={{ boxShadow: `0 8px 22px ${hexWithAlpha(currentColor, 0.35)}` }}
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            Confirm Turn
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

// -----------------------------------------------------------------------------

interface PlayerBadgeProps {
    player: CubeTacPlayerInfo;
    slot: number;
    isActive: boolean;
    markCount: number;
    currentPlayerId: number | null;
}

function PlayerBadge({ player, slot, isActive, markCount, currentPlayerId }: PlayerBadgeProps) {
    const color = player.avatar_color;
    const char = SLOT_CHARS[player.design ?? slot] ?? '?';

    const voiceChat = useVoiceChatOptional();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [showModal, setShowModal] = useState(false);

    const playerId = player.id;
    const isSelf = playerId !== null && currentPlayerId !== null && playerId === currentPlayerId;
    const voiceReady = !!voiceChat?.isConnected && playerId !== null;

    const remoteStream = voiceReady && !isSelf ? voiceChat!.remoteVideos.get(playerId!) ?? null : null;
    const localStream = isSelf && voiceChat?.isVideoEnabled ? voiceChat.localVideoStream ?? null : null;
    const videoStream = remoteStream ?? localStream;
    const hasVideo = !!videoStream;

    const isSpeaking = voiceReady && voiceChat!.speakingPlayers.has(playerId!);
    const peerVoice = voiceReady ? voiceChat!.players.find((p) => p.id === playerId) : undefined;
    const peerMuted = peerVoice?.is_muted ?? true;
    const selfMuted = voiceChat?.isMuted ?? true;
    const showMutedDot = voiceReady && !isSelf && peerMuted;

    useEffect(() => {
        if (videoRef.current && videoStream) {
            videoRef.current.srcObject = videoStream;
        }
    }, [videoStream]);

    // Active player gets a colored ring + drop glow. Inline styles for the
    // dynamic color — Tailwind v3 JIT can't synthesize arbitrary class names.
    const activeStyle: CSSProperties = isActive
        ? {
              borderColor: color,
              boxShadow: `0 0 22px ${hexWithAlpha(color, 0.45)}`,
          }
        : {};

    return (
        <>
            <div
                className={`flex items-center gap-2 rounded-xl border-2 border-gray-200 bg-white px-2.5 py-1.5 shadow-xs transition ${
                    isSpeaking ? 'ring-2 ring-green-400' : ''
                }`}
                style={activeStyle}
            >
                <button
                    type="button"
                    onClick={() => hasVideo && setShowModal(true)}
                    disabled={!hasVideo}
                    title={hasVideo ? 'Click to maximize' : undefined}
                    className={`relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full ring-2 ring-white text-lg font-black ${
                        hasVideo ? 'cursor-pointer group' : 'cursor-default'
                    } ${isSpeaking ? 'animate-pulse' : ''}`}
                    style={hasVideo ? { backgroundColor: '#000' } : { backgroundColor: hexWithAlpha(color, 0.15), color }}
                >
                    {hasVideo ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="absolute inset-0 h-full w-full object-cover scale-x-[-1]"
                        />
                    ) : (
                        <span>{char}</span>
                    )}
                    {showMutedDot && (
                        <span
                            className="absolute -bottom-0.5 -right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-red-500 text-white ring-2 ring-white"
                            title="Muted"
                        >
                            <MicOffIcon className="h-2 w-2" />
                        </span>
                    )}
                </button>
                <div className="flex flex-col leading-tight">
                    <span className="max-w-[96px] truncate text-xs font-black text-gray-900">
                        {player.nickname || 'Waiting…'}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                        {markCount} marks
                    </span>
                </div>
            </div>

            {playerId !== null && (
                <VideoModal
                    show={showModal}
                    onClose={() => setShowModal(false)}
                    stream={videoStream}
                    playerName={player.nickname || `Player ${slot + 1}`}
                    isMuted={isSelf ? selfMuted : peerMuted}
                    isLocal={isSelf}
                />
            )}
        </>
    );
}

// -----------------------------------------------------------------------------

function MicOnIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        </svg>
    );
}

function MicOffIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
        </svg>
    );
}

function VideoOnIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
    );
}

function VideoOffIcon({ className }: { className?: string }) {
    return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
        </svg>
    );
}

// -----------------------------------------------------------------------------

interface LeaderboardProps {
    players: CubeTacPlayerInfo[];
    currentTurn: number;
    /** Games already completed in this lobby (feeds the round indicator). */
    gamesPlayed: number;
}

/**
 * Always-visible per-slot wins tally floated on the right edge of the cube
 * canvas, plus a round indicator. A round is N games (one game per player),
 * so with N=3 the indicator cycles R1 G1/3 → R1 G2/3 → R1 G3/3 → R2 G1/3…
 *
 * Hidden on mobile (< sm) where the cube takes most of the viewport; the
 * bottom HUD still shows players and FinishedPhase surfaces the scoreboard
 * between games.
 */
function Leaderboard({ players, currentTurn, gamesPlayed }: LeaderboardProps) {
    const n = Math.max(1, players.length);
    const round = Math.floor(gamesPlayed / n) + 1;
    const gameInRound = (gamesPlayed % n) + 1;

    return (
        <div className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 flex-col gap-2 sm:flex">
            <div className="rounded-xl bg-white/90 px-3 py-1.5 text-center shadow-md backdrop-blur-xs">
                <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">
                    Round {round}
                </div>
                <div className="text-[11px] font-black text-gray-900">
                    Game {gameInRound} / {n}
                </div>
            </div>
            {players.map((p, slot) => (
                <LeaderboardRow
                    key={slot}
                    player={p}
                    slot={slot}
                    isActive={currentTurn === slot}
                />
            ))}
        </div>
    );
}

interface LeaderboardRowProps {
    player: CubeTacPlayerInfo;
    slot: number;
    isActive: boolean;
}

function LeaderboardRow({ player, slot, isActive }: LeaderboardRowProps) {
    const color = player.avatar_color;
    const char = SLOT_CHARS[player.design ?? slot] ?? '?';

    const rowStyle: CSSProperties = isActive
        ? {
              borderColor: color,
              boxShadow: `0 0 14px ${hexWithAlpha(color, 0.45)}`,
          }
        : {};

    return (
        <div
            className="flex items-center gap-2 rounded-full border-2 border-gray-200 bg-white px-2 py-1 shadow-md"
            style={rowStyle}
        >
            <div
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-black"
                style={{ backgroundColor: hexWithAlpha(color, 0.15), color }}
            >
                {char}
            </div>
            <span className="max-w-[7rem] truncate text-xs font-black text-gray-900">
                {player.nickname || `Player ${slot + 1}`}
            </span>
            <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-yellow-200 px-1.5 py-0.5 text-[10px] font-black text-yellow-900">
                <span aria-hidden="true">🏆</span>
                {player.wins}
            </span>
        </div>
    );
}

function countMarksBySlot(marks: Marks, n: number): number[] {
    const out = new Array<number>(n).fill(0);
    for (const m of marks) {
        if (m !== null && m !== undefined && m >= 0 && m < n) {
            out[m] += 1;
        }
    }
    return out;
}

// -----------------------------------------------------------------------------

/**
 * Bottom-left hint overlay advertising the keyboard shortcuts: arrow keys
 * orbit the camera, letter keys rotate a face (Shift inverts). Hidden on
 * mobile where keyboard input isn't available; pointer-events-none so it
 * never intercepts cube drags.
 */
function ShortcutHints({ variant }: { variant: 'cube' | 'megaminx' | 'pyraminx' }) {
    return (
        <div
            className="pointer-events-none absolute bottom-3 left-3 hidden rounded-lg bg-white/80 px-3 py-2 shadow-md backdrop-blur-xs sm:block"
            aria-hidden="true"
        >
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-700">
                <span className="inline-flex items-center gap-0.5">
                    <Kbd>←</Kbd>
                    <Kbd>↑</Kbd>
                    <Kbd>→</Kbd>
                    <Kbd>↓</Kbd>
                </span>
                <span className="text-gray-500">orbit camera</span>
            </div>
            {variant === 'cube' && (
                <>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-700">
                        <span className="inline-flex items-center gap-0.5">
                            <Kbd>U</Kbd>
                            <Kbd>D</Kbd>
                            <Kbd>L</Kbd>
                            <Kbd>R</Kbd>
                            <Kbd>F</Kbd>
                            <Kbd>P</Kbd>
                        </span>
                        <span className="text-gray-500">rotate face</span>
                    </div>
                    <div className="mt-1 text-[9px] font-semibold tracking-wide text-gray-400">
                        +Shift for counter-clockwise
                    </div>
                </>
            )}
            {variant === 'pyraminx' && (
                <>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-700">
                        <span className="inline-flex items-center gap-0.5">
                            <Kbd>1</Kbd>
                            <Kbd>2</Kbd>
                            <Kbd>3</Kbd>
                            <Kbd>4</Kbd>
                        </span>
                        <span className="text-gray-500">rotate face</span>
                    </div>
                    <div className="mt-1 text-[9px] font-semibold tracking-wide text-gray-400">
                        +Shift for counter-clockwise
                    </div>
                </>
            )}
        </div>
    );
}

function Kbd({ children }: { children: ReactNode }) {
    return (
        <span className="inline-grid h-[1.25rem] min-w-[1.25rem] place-items-center rounded-sm border border-gray-300 bg-gray-50 px-1 text-[9px] font-black text-gray-700 shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]">
            {children}
        </span>
    );
}

// -----------------------------------------------------------------------------

/** Expand a #rrggbb string to `rgba(r, g, b, a)`. Tolerates #rgb shorthand. */
function hexWithAlpha(hex: string, alpha: number): string {
    let h = hex.replace('#', '');
    if (h.length === 3) {
        h = h.split('').map((c) => c + c).join('');
    }
    if (h.length !== 6) return `rgba(91, 155, 213, ${alpha})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

