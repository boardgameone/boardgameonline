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
import { indexOf as octaIndexOf, type Direction as OctaDirection } from '@/lib/octahedron';
import { indexOf as icosaIndexOf, type Direction as IcosaDirection } from '@/lib/icosahedron';
import RotateControls from './components/RotateControls';
import PyraRotateControls from './components/PyraRotateControls';
import OctaRotateControls from './components/OctaRotateControls';
import IcosaRotateControls from './components/IcosaRotateControls';
import SlotGlyph from './components/SlotGlyph';
import type { CubeSceneHandle } from './CubeScene';
import type { MegaminxSceneHandle } from './MegaminxScene';
import type { PyraminxSceneHandle } from './PyraminxScene';
import type { OctahedronSceneHandle } from './OctahedronScene';
import type { IcosahedronSceneHandle } from './IcosahedronScene';
import { useVoiceChatOptional } from '@/Contexts/VoiceChatContext';
import VideoModal from '@/Components/VideoModal';
import { useSound } from '@/hooks/useSound';
import { useSfx } from '@/lib/sfx';
import { vibrate } from './gameFeedback';
import type { SceneViewHandle } from './sceneInteraction';

const CubeScene = lazy(() => import('./CubeScene'));
const MegaminxScene = lazy(() => import('./MegaminxScene'));
const PyraminxScene = lazy(() => import('./PyraminxScene'));
const OctahedronScene = lazy(() => import('./OctahedronScene'));
const IcosahedronScene = lazy(() => import('./IcosahedronScene'));

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
    variant?: 'cube' | 'megaminx' | 'pyraminx' | 'octahedron' | 'icosahedron';
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
    /** Octahedron mark handler — required when variant === 'octahedron'. */
    onOctaMark?: (face: number, slot: number) => void;
    /** Octahedron rotate handler — required when variant === 'octahedron'. */
    onOctaRotate?: (face: number, direction: OctaDirection) => void;
    /** Icosahedron mark handler — required when variant === 'icosahedron'. */
    onIcosaMark?: (face: number, slot: number) => void;
    /** Icosahedron rotate handler — required when variant === 'icosahedron'. */
    onIcosaRotate?: (face: number, direction: IcosaDirection) => void;
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
    /** Ref for the octahedron scene's imperative handle. */
    octaRef?: Ref<OctahedronSceneHandle>;
    /** Ref for the icosahedron scene's imperative handle. */
    icosaRef?: Ref<IcosahedronSceneHandle>;
    /**
     * Total completed games in this lobby (wins + draws). Feeds the round
     * indicator in the leaderboard — a round is one game per player.
     */
    gamesPlayed: number;
    /**
     * Set once the game has ended but before the results screen takes over:
     * the board stays up, locked, with the winning line drawn.
     */
    outcome?: number | 'draw' | null;
    /** Winning lines as flat indices — drawn on the board during the reveal. */
    winLines?: number[][];
}

/** Display names for the cube faces, matching the 3D face labels. */
const CUBE_FACE_NAMES = ['Up', 'Down', 'Left', 'Right', 'Front', 'Peeché'];
const CUBE_MOVE_FACE: Record<string, number> = { U: 0, D: 1, L: 2, R: 3, F: 4, B: 5 };

function refCurrent<T>(ref?: Ref<T>): T | null {
    return ref && typeof ref === 'object' && 'current' in ref ? ref.current : null;
}

function isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT' || !!el?.isContentEditable;
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
    onOctaMark,
    onOctaRotate,
    onIcosaMark,
    onIcosaRotate,
    onEndTurn,
    onUndoMark,
    turnLabelOverride,
    onLeave,
    cubeRef,
    megaRef,
    pyraRef,
    octaRef,
    icosaRef,
    gamesPlayed,
    outcome = null,
    winLines,
}: PlayingPhaseProps) {
    const voiceChat = useVoiceChatOptional();
    const voiceReady = !!voiceChat?.isConnected && currentPlayerId !== null;
    const selfMuted = voiceChat?.isMuted ?? true;
    const selfVideoOn = voiceChat?.isVideoEnabled ?? false;
    const { play: playRotateSound } = useSound('/sounds/cubetac/rotate.mp3', { volume: 0.6 });
    const { play: playMarkSound } = useSound('/sounds/trio/card-flip.mp3', { volume: 0.55 });
    const { play: playTurnSound } = useSound('/sounds/trio/turn-transition.mp3', { volume: 0.5 });
    const { play: playSfx } = useSfx();
    const [previewMove, setPreviewMove] = useState<Move | null>(null);
    const [previewFace, setPreviewFace] = useState<number | null>(null);
    const [rotateDrawerOpen, setRotateDrawerOpen] = useState(false);

    const markCounts = useMemo(() => countMarksBySlot(marks, players.length), [marks, players.length]);
    const playerColors = useMemo(() => players.map((p) => p.avatar_color), [players]);
    const playerDesigns = useMemo(() => players.map((p, slot) => p.design ?? slot), [players]);

    const isRevealing = outcome !== null;
    const currentPlayer = players[currentTurn];
    const currentColor = currentPlayer?.avatar_color ?? '#5b9bd5';
    const winnerPlayer = typeof outcome === 'number' ? players[outcome] : null;
    const bannerColor = isRevealing ? winnerPlayer?.avatar_color ?? '#6b7280' : currentColor;
    const turnLabel = isRevealing
        ? outcome === 'draw'
            ? "It's a draw"
            : outcome === mySlot
                ? 'You win!'
                : `${winnerPlayer?.nickname ?? 'Opponent'} wins!`
        : turnLabelOverride
            ?? (mySlot === null
                ? `${currentPlayer?.nickname ?? SLOT_CHARS[playerDesigns[currentTurn] ?? currentTurn] ?? '?'} to move`
                : isMyTurn
                    ? 'Your Turn'
                    : `${currentPlayer?.nickname ?? 'Opponent'}'s Turn`);

    const canAct = isMyTurn && !pendingAction && !isRevealing;

    const isMegaminx = variant === 'megaminx';
    const isPyraminx = variant === 'pyraminx';
    const isOctahedron = variant === 'octahedron';
    const isIcosahedron = variant === 'icosahedron';
    const isCube = variant === 'cube';

    // Flat index of the most recent mark, whatever the variant. The cube
    // identifies stickers by (face, row, col); the rest by (face, slot).
    const actionType = typeof lastAction?.type === 'string' ? lastAction.type : null;
    const lastMarkIndex = (() => {
        if (!lastAction || !actionType) return null;
        const face = lastAction.face as number;
        const slot = lastAction.slot as number;
        switch (actionType) {
            case 'mark': return indexOf(face, lastAction.row as number, lastAction.col as number);
            case 'mega_mark': return megaIndexOf(face, slot);
            case 'pyra_mark': return pyraIndexOf(face, slot);
            case 'octa_mark': return octaIndexOf(face, slot);
            case 'icosa_mark': return icosaIndexOf(face, slot);
            default: return null;
        }
    })();
    const pendingIndex = pendingAction ? lastMarkIndex : null;
    const hasPending = pendingIndex !== null;
    const actionMoveId = typeof lastAction?.move_id === 'number' ? lastAction.move_id : moveCount;
    const popToken = lastMarkIndex !== null ? `${actionMoveId}:${lastMarkIndex}` : null;
    const actionPlayer = typeof lastAction?.player === 'number' ? lastAction.player : null;
    const isOpponentAction = mySlot !== null && actionPlayer !== null && actionPlayer !== mySlot;

    // Opponent rotations arrive by poll; hand them to the scene to replay.
    const remoteCubeMove = isOpponentAction && actionType === 'rotate'
        ? { id: actionMoveId, move: lastAction!.move as Move }
        : null;
    const remotePolyMove = isOpponentAction && actionType !== null && actionType.endsWith('_rotate')
        ? { id: actionMoveId, face: lastAction!.face as number, direction: lastAction!.direction as 'cw' | 'ccw' }
        : null;

    const subLabel = isRevealing
        ? outcome === 'draw' ? 'No more moves' : 'Three in a row!'
        : pendingAction && isMyTurn
            ? 'Confirm · or tap your mark to undo'
            : canAct || turnLabelOverride
                ? isMegaminx
                    ? 'Tap a cell · or use a face center to rotate ↺ ↻'
                    : isPyraminx || isOctahedron || isIcosahedron
                        ? 'Tap a perimeter cell · or rotate a face below'
                        : 'Tap a sticker · or rotate a face'
                : 'Waiting…';

    const activeHandle = (): SceneViewHandle | null => {
        if (isMegaminx) return refCurrent(megaRef);
        if (isPyraminx) return refCurrent(pyraRef);
        if (isOctahedron) return refCurrent(octaRef);
        if (isIcosahedron) return refCurrent(icosaRef);
        return refCurrent(cubeRef);
    };

    // Feedback for opponent actions arriving by poll. Our own actions play
    // their sounds at click time instead.
    const seenMoveIdRef = useRef(actionMoveId);
    useEffect(() => {
        if (seenMoveIdRef.current === actionMoveId) return;
        seenMoveIdRef.current = actionMoveId;
        if (!isOpponentAction || !actionType) return;
        if (actionType.endsWith('rotate')) {
            playRotateSound();
        } else if (actionType.endsWith('mark')) {
            playMarkSound();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [actionMoveId]);

    // "Your turn" cue: sound + banner pop. In hotseat mode every hand-off
    // is announced since the device changes hands.
    const turnSignal = mySlot === null ? `slot-${currentTurn}` : isMyTurn ? 'mine' : 'theirs';
    const prevTurnSignalRef = useRef(turnSignal);
    const [turnPulse, setTurnPulse] = useState(0);
    useEffect(() => {
        if (prevTurnSignalRef.current === turnSignal) return;
        prevTurnSignalRef.current = turnSignal;
        if (isRevealing) return;
        if (mySlot === null || turnSignal === 'mine') {
            playTurnSound();
            setTurnPulse((n) => n + 1);
            if (mySlot !== null) vibrate([20, 40, 20]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [turnSignal]);

    useEffect(() => {
        if (!canAct) {
            setPreviewMove(null);
            setPreviewFace(null);
        }
    }, [canAct]);

    const placeMark = (place: () => void) => {
        playMarkSound();
        vibrate(10);
        place();
    };
    const handleUndo = () => {
        playSfx('UI_TOGGLE');
        onUndoMark();
    };
    const handleConfirm = () => {
        playSfx('UI_SUCCESS');
        onEndTurn();
    };

    // Enter confirms a pending mark; Backspace / Z takes it back.
    useEffect(() => {
        if (!isMyTurn || !pendingAction || isRevealing) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
            if (e.key === 'Enter') {
                if ((e.target as HTMLElement | null)?.tagName === 'BUTTON') return;
                e.preventDefault();
                handleConfirm();
            } else if (e.key === 'Backspace' || e.key === 'z' || e.key === 'Z') {
                e.preventDefault();
                handleUndo();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMyTurn, pendingAction, isRevealing]);

    const handleRotateWithSound = (move: Move) => {
        playRotateSound();
        setPreviewMove(null);
        onRotate(move);
    };

    // Cube click: tap the pending mark to undo, otherwise mark an empty cell.
    const handleStickerClick = (face: number, row: number, col: number) => {
        const idx = indexOf(face, row, col);
        if (pendingIndex === idx) {
            handleUndo();
            return;
        }
        if (canAct && marks[idx] === null) {
            placeMark(() => onMark(face, row, col));
        }
    };

    // Slot-based variants share one click shape: (face, slot).
    const makeCellClick = (flat: (face: number, slot: number) => number, mark?: (face: number, slot: number) => void) =>
        (face: number, slot: number) => {
            const idx = flat(face, slot);
            if (pendingIndex === idx) {
                handleUndo();
                return;
            }
            if (canAct && marks[idx] === null && mark) {
                placeMark(() => mark(face, slot));
            }
        };
    const handleCellClick = makeCellClick(megaIndexOf, onMegaMark);
    const handlePyraCellClick = makeCellClick(pyraIndexOf, onPyraMark);
    const handleOctaCellClick = makeCellClick(octaIndexOf, onOctaMark);
    const handleIcosaCellClick = makeCellClick(icosaIndexOf, onIcosaMark);

    // Slot-based rotations: start the local animation, then let the parent
    // commit (network round-trip or reducer dispatch) in parallel.
    const makeRotate = <D,>(ref: Ref<{ playMove: (face: number, direction: D) => Promise<void> }> | undefined, rotate?: (face: number, direction: D) => void) =>
        (face: number, direction: D) => {
            if (!canAct) return;
            playRotateSound();
            setPreviewFace(null);
            refCurrent(ref)?.playMove(face, direction);
            rotate?.(face, direction);
        };
    const handleMegaRotateWithSound = makeRotate<MegaDirection>(megaRef, onMegaRotate);
    const handlePyraRotateWithSound = makeRotate<PyraDirection>(pyraRef, onPyraRotate);
    const handleOctaRotateWithSound = makeRotate<OctaDirection>(octaRef, onOctaRotate);
    const handleIcosaRotateWithSound = makeRotate<IcosaDirection>(icosaRef, onIcosaRotate);

    const stickerClickActive = isMyTurn && (canAct || hasPending) && !isRevealing;
    const ghost = canAct ? { color: currentColor, design: playerDesigns[currentTurn] ?? currentTurn } : null;
    const sceneFeedback = {
        marks,
        playerColors,
        designs: playerDesigns,
        pendingIndex,
        ghost,
        lastMoveIndex: lastMarkIndex,
        popToken,
        winLines: isRevealing ? winLines : undefined,
    };

    const lastMoveChip = (() => {
        if (!lastAction || !actionType || actionPlayer === null || isRevealing) return null;
        if (actionPlayer === mySlot && pendingAction) return null;
        const who = actionPlayer === mySlot ? 'You' : players[actionPlayer]?.nickname || `Player ${actionPlayer + 1}`;
        const isRotate = actionType.endsWith('rotate');
        const face = isCube && actionType === 'rotate'
            ? CUBE_MOVE_FACE[String(lastAction.move)[0]] ?? 0
            : (lastAction.face as number);
        const faceName = isCube ? CUBE_FACE_NAMES[face] ?? 'a face' : `face ${face + 1}`;
        const arrow = isRotate
            ? (isCube ? String(lastAction.move).endsWith("'") : lastAction.direction === 'ccw') ? ' ↺' : ' ↻'
            : '';
        return {
            face,
            color: players[actionPlayer]?.avatar_color ?? '#6b7280',
            text: `${who} ${isRotate ? 'rotated' : 'marked'} ${faceName}${arrow}`,
        };
    })();

    const moveProgress = moveLimit > 0 ? Math.min(1, moveCount / moveLimit) : 0;

    const rotateControls = isCube ? (
        <RotateControls onRotate={handleRotateWithSound} disabled={!canAct} onPreview={setPreviewMove} />
    ) : isPyraminx ? (
        <PyraRotateControls onRotate={handlePyraRotateWithSound} disabled={!canAct} onPreview={setPreviewFace} />
    ) : isOctahedron ? (
        <OctaRotateControls onRotate={handleOctaRotateWithSound} disabled={!canAct} onPreview={setPreviewFace} />
    ) : isIcosahedron ? (
        <IcosaRotateControls onRotate={handleIcosaRotateWithSound} disabled={!canAct} onPreview={setPreviewFace} />
    ) : null;

    return (
        <div className="relative flex h-full w-full flex-col overflow-hidden">
            {/* Top bar: leave button + move progress */}
            <div className="flex items-center justify-between gap-3 px-4 pt-3 sm:px-6">
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

                <div
                    className="flex min-w-[9rem] flex-col items-center gap-1 rounded-full bg-white/80 px-4 py-1.5 shadow-md backdrop-blur-xs"
                    title={`${moveLimit - moveCount} moves left before a draw`}
                >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-700">
                        Move {moveCount} / {moveLimit}
                    </span>
                    <span className="h-1 w-full overflow-hidden rounded-full bg-gray-200" aria-hidden="true">
                        <span
                            className="block h-full rounded-full transition-[width] duration-500"
                            style={{
                                width: `${moveProgress * 100}%`,
                                backgroundColor: moveProgress > 0.85 ? '#ef4444' : moveProgress > 0.6 ? '#f59e0b' : '#10b981',
                            }}
                        />
                    </span>
                </div>

                <span className="h-9 w-9" />
            </div>

            {/* Turn banner */}
            <div className="mt-3 flex flex-col items-center px-4">
                <div
                    key={turnPulse}
                    className={`text-center text-3xl font-black leading-none drop-shadow-xs sm:text-4xl ${
                        isRevealing ? 'motion-safe:animate-winReveal' : 'motion-safe:animate-turnPop'
                    }`}
                    style={{ color: bannerColor }}
                    aria-live="polite"
                >
                    {turnLabel}
                </div>
                <div className="mt-1 text-center text-[11px] font-bold uppercase tracking-[0.3em] text-gray-600">
                    {subLabel}
                </div>
                {lastMoveChip && (
                    <button
                        type="button"
                        onClick={() => activeHandle()?.lookAtFace(lastMoveChip.face)}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold text-gray-700 shadow-sm backdrop-blur-xs transition hover:bg-white hover:shadow-md"
                        title="Turn the view to this face"
                    >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: lastMoveChip.color }} aria-hidden="true" />
                        {lastMoveChip.text}
                        <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12C4 7.5 7.7 4.5 12 4.5s8 3 9.5 7.5c-1.5 4.5-5.2 7.5-9.5 7.5s-8-3-9.5-7.5z" />
                        </svg>
                    </button>
                )}
            </div>

            {/* 3D canvas */}
            <div className="relative flex-1 min-h-0">
                <Suspense
                    fallback={
                        <div className="flex h-full items-center justify-center">
                            <div className="h-40 w-40 animate-pulse rounded-3xl bg-white/40 shadow-inner" aria-label="Loading board" />
                        </div>
                    }
                >
                    {isMegaminx ? (
                        <MegaminxScene
                            ref={megaRef}
                            {...sceneFeedback}
                            onCellClick={stickerClickActive ? handleCellClick : undefined}
                            onRotate={canAct ? handleMegaRotateWithSound : undefined}
                            interactive={stickerClickActive || canAct}
                            remoteMove={remotePolyMove}
                        />
                    ) : isPyraminx ? (
                        <PyraminxScene
                            ref={pyraRef}
                            {...sceneFeedback}
                            onCellClick={stickerClickActive ? handlePyraCellClick : undefined}
                            interactive={stickerClickActive}
                            highlightFace={previewFace}
                            remoteMove={remotePolyMove}
                        />
                    ) : isOctahedron ? (
                        <OctahedronScene
                            ref={octaRef}
                            {...sceneFeedback}
                            onCellClick={stickerClickActive ? handleOctaCellClick : undefined}
                            interactive={stickerClickActive}
                            highlightFace={previewFace}
                            remoteMove={remotePolyMove}
                        />
                    ) : isIcosahedron ? (
                        <IcosahedronScene
                            ref={icosaRef}
                            {...sceneFeedback}
                            onCellClick={stickerClickActive ? handleIcosaCellClick : undefined}
                            interactive={stickerClickActive}
                            highlightFace={previewFace}
                            remoteMove={remotePolyMove}
                        />
                    ) : (
                        <CubeScene
                            ref={cubeRef}
                            {...sceneFeedback}
                            onStickerClick={stickerClickActive ? handleStickerClick : undefined}
                            interactive={stickerClickActive}
                            highlightMove={previewMove}
                            remoteMove={remoteCubeMove}
                        />
                    )}
                </Suspense>

                {!isMyTurn && !turnLabelOverride && !isRevealing && (
                    <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-600 shadow-md backdrop-blur-xs">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ backgroundColor: currentColor }} aria-hidden="true" />
                            waiting for {currentPlayer?.nickname || 'opponent'}
                        </div>
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => activeHandle()?.resetView()}
                    className="absolute left-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/80 text-gray-600 shadow-md backdrop-blur-xs transition hover:bg-white hover:text-gray-900"
                    aria-label="Reset view"
                    title="Reset view"
                >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5.6 15A7.5 7.5 0 0018.4 17M18.4 9A7.5 7.5 0 005.6 7" />
                    </svg>
                </button>

                {isMyTurn && pendingAction && !isRevealing && (
                    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-4">
                        <div className="pointer-events-auto flex items-center gap-2 motion-safe:animate-slideIn">
                            <button
                                type="button"
                                onClick={handleUndo}
                                aria-label="Undo mark"
                                title="Undo — Backspace or Z"
                                className="inline-flex items-center gap-2 rounded-full border-2 border-gray-300 bg-white px-5 py-2.5 text-sm font-black uppercase tracking-[0.2em] text-gray-700 shadow-md transition hover:border-gray-400 hover:bg-gray-50 active:scale-95"
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3" />
                                </svg>
                                Undo
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirm}
                                aria-label="End turn"
                                title="Confirm — Enter"
                                className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-emerald-500 to-teal-500 px-6 py-2.5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-lg border-b-4 border-emerald-700 transition hover:scale-[1.03] hover:from-emerald-600 hover:to-teal-600 active:scale-95 motion-safe:animate-turnPop"
                                style={{ boxShadow: `0 8px 22px ${hexWithAlpha(currentColor, 0.35)}` }}
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                Confirm Turn
                            </button>
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
            <div className="flex flex-col gap-3 border-t-2 border-yellow-600/30 bg-white/80 px-4 py-3 backdrop-blur-xs sm:px-6 sm:py-4">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                    {players.map((p, slot) => (
                        <PlayerBadge
                            key={slot}
                            player={p}
                            slot={slot}
                            isActive={currentTurn === slot && !isRevealing}
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

                {rotateControls && (
                    <>
                        <button
                            type="button"
                            onClick={() => setRotateDrawerOpen((open) => !open)}
                            aria-expanded={rotateDrawerOpen}
                            className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-gray-700 shadow-md transition hover:bg-gray-50 sm:hidden"
                        >
                            Rotate a face
                            <svg
                                className={`h-3.5 w-3.5 transition-transform ${rotateDrawerOpen ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.6}
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                            </svg>
                        </button>
                        <div className={`${rotateDrawerOpen ? 'block' : 'hidden'} sm:block`}>
                            {rotateControls}
                        </div>
                    </>
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
    const design = player.design ?? slot;

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
                        <SlotGlyph design={design} className="h-5 w-5" />
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
                <SlotGlyph design={player.design ?? slot} className="h-4 w-4" />
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
function ShortcutHints({ variant }: { variant: 'cube' | 'megaminx' | 'pyraminx' | 'octahedron' | 'icosahedron' }) {
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
            <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-700">
                <span className="inline-flex items-center gap-0.5">
                    <Kbd>Enter</Kbd>
                    <span className="text-gray-400">/</span>
                    <Kbd>Z</Kbd>
                </span>
                <span className="text-gray-500">confirm / undo mark</span>
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
            {variant === 'octahedron' && (
                <>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-700">
                        <span className="inline-flex items-center gap-0.5">
                            <Kbd>1</Kbd>
                            <Kbd>2</Kbd>
                            <Kbd>3</Kbd>
                            <Kbd>4</Kbd>
                            <Kbd>5</Kbd>
                            <Kbd>6</Kbd>
                            <Kbd>7</Kbd>
                            <Kbd>8</Kbd>
                        </span>
                        <span className="text-gray-500">rotate face</span>
                    </div>
                    <div className="mt-1 text-[9px] font-semibold tracking-wide text-gray-400">
                        +Shift for counter-clockwise
                    </div>
                </>
            )}
            {variant === 'icosahedron' && (
                <>
                    <div className="mt-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-700">
                        <span className="inline-flex items-center gap-0.5">
                            <Kbd>1</Kbd>
                            <Kbd>2</Kbd>
                            <Kbd>3</Kbd>
                            <Kbd>4</Kbd>
                            <Kbd>5</Kbd>
                            <Kbd>6</Kbd>
                            <Kbd>7</Kbd>
                            <Kbd>8</Kbd>
                            <Kbd>9</Kbd>
                        </span>
                        <span className="text-gray-500">rotate face 1–9</span>
                    </div>
                    <div className="mt-1 text-[9px] font-semibold tracking-wide text-gray-400">
                        +Shift for counter-clockwise · faces 10–20 use buttons
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

