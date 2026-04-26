/**
 * Top-level Inertia page for CubeTac online matches.
 *
 * Polls at 2.5s while the game is active, routes to the right phase
 * component, and wires up the controller actions (mark / rotate / reset).
 */

import GameLayout from '@/Layouts/GameLayout';
import WaitingPhase from '@/Pages/Rooms/CubeTac/WaitingPhase';
import PlayingPhase from '@/Pages/Rooms/CubeTac/PlayingPhase';
import FinishedPhase from '@/Pages/Rooms/CubeTac/FinishedPhase';
import type { CubeSceneHandle } from '@/Pages/Rooms/CubeTac/CubeScene';
import type { MegaminxSceneHandle } from '@/Pages/Rooms/CubeTac/MegaminxScene';
import { VoiceChatProvider } from '@/Contexts/VoiceChatContext';
import VoiceGalleryPanel from '@/Components/VoiceGalleryPanel';
import { GamePlayer, GameRoom, PageProps } from '@/types';
import { Head, Link, router, useForm, usePoll } from '@inertiajs/react';
import { FormEventHandler, ReactNode, useRef } from 'react';
import { Marks, Move } from '@/lib/rubikCube';
import type { Direction as MegaDirection } from '@/lib/megaminx';

interface CubeTacPlayer {
    id: number;
    nickname: string;
    avatar_color: string;
    is_host: boolean;
    is_connected: boolean;
    wins: number;
    design: number;
}

interface CubeTacGameState {
    status: 'playing' | 'finished';
    /** Which gameplay surface this room is using. Defaults to "cube" on legacy rows. */
    variant: 'cube' | 'megaminx';
    /**
     * Length is 54 for the cube variant and 132 for the megaminx variant —
     * the consumer must read `variant` before indexing.
     */
    marks: Marks;
    current_turn: number;
    move_count: number;
    move_limit: number;
    winner: number | 'draw' | null;
    /**
     * For the cube variant, `cells` are `[row, col]` pairs on a single face.
     * For the megaminx variant, `cells` are 3 flat sticker indices on the same face.
     */
    winning_lines: Array<{
        face: number;
        cells: Array<[number, number]> | [number, number, number];
        player: number;
    }>;
    last_action: Record<string, unknown> | null;
    move_history: Array<Record<string, unknown>>;
    player_ids: Array<number | null>;
    current_player_id: number | null;
    is_my_turn: boolean;
    pending_action: boolean;
    my_slot: number | null;
    /** One entry per slot (0..N-1). `null` means that slot's player disconnected. */
    players: Array<CubeTacPlayer | null>;
}

interface Props extends PageProps {
    room: GameRoom;
    currentPlayer: GamePlayer | null;
    isHost: boolean;
    gameState: CubeTacGameState | null;
}

export default function CubeTacGamePage({ auth, room, currentPlayer, isHost, gameState }: Props) {
    usePoll(2500, {}, { keepAlive: room.status !== 'finished' });

    const cubeRef = useRef<CubeSceneHandle>(null);
    const megaRef = useRef<MegaminxSceneHandle>(null);

    const variant: 'cube' | 'megaminx' = gameState?.variant ?? (room.variant === 'megaminx' ? 'megaminx' : 'cube');

    const gameSlug = room.game?.slug || 'cubetac';
    const isGuest = !auth.user;
    const needsToJoin = !currentPlayer && room.status === 'waiting' && !room.is_full;
    const wasKicked = currentPlayer !== null && !currentPlayer.is_connected && room.status === 'waiting';

    const { data, setData, post, processing, errors } = useForm({
        nickname: '',
    });

    const handleJoin: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('rooms.joinDirect', [gameSlug, room.room_code]));
    };

    const handleMark = (face: number, row: number, col: number) => {
        router.post(
            route('rooms.cubetac.mark', [gameSlug, room.room_code]),
            { face, row, col },
            { preserveScroll: true, preserveState: true },
        );
    };

    const handleRotate = (move: Move) => {
        // Start the visual animation immediately; the server round-trip runs
        // in parallel. CubeScene holds `displayedMarks` during the animation
        // so the incoming prop update won't cause a mid-rotation snap.
        cubeRef.current?.playMove(move);
        router.post(
            route('rooms.cubetac.rotate', [gameSlug, room.room_code]),
            { move },
            { preserveScroll: true, preserveState: true },
        );
    };

    const handleMegaMark = (face: number, slot: number) => {
        router.post(
            route('rooms.cubetac.megaMark', [gameSlug, room.room_code]),
            { face, slot },
            { preserveScroll: true, preserveState: true },
        );
    };

    const handleMegaRotate = (face: number, direction: MegaDirection) => {
        // The megaminx scene's playMove is invoked by MegaminxPlayingPhase
        // itself (see its internal handleRotate) so we don't need to call
        // ref.current here.
        router.post(
            route('rooms.cubetac.megaRotate', [gameSlug, room.room_code]),
            { face, direction },
            { preserveScroll: true, preserveState: true },
        );
    };

    const handleEndTurn = () => {
        router.post(
            route('rooms.cubetac.endTurn', [gameSlug, room.room_code]),
            {},
            { preserveScroll: true, preserveState: true },
        );
    };

    const handleUndoMark = () => {
        router.post(
            route('rooms.cubetac.undoMark', [gameSlug, room.room_code]),
            {},
            { preserveScroll: true, preserveState: true },
        );
    };

    const handleRematch = () => {
        router.post(
            route('rooms.cubetac.reset', [gameSlug, room.room_code]),
            {},
            { preserveScroll: true },
        );
    };

    const handleLeave = () => {
        router.post(route('rooms.leave', [gameSlug, room.room_code]));
    };

    const connectedPlayers = (room.players ?? []).filter((p) => p.is_connected);

    const content: ReactNode = wasKicked ? (
        <KickedNotice gameSlug={gameSlug} />
    ) : needsToJoin && isGuest ? (
        <GuestJoinForm
            nickname={data.nickname}
            onChange={(v) => setData('nickname', v)}
            onSubmit={handleJoin}
            processing={processing}
            error={errors.nickname}
        />
    ) : room.status === 'waiting' ? (
        <WaitingPhase
            room={room}
            currentPlayer={currentPlayer}
            players={connectedPlayers}
            isHost={isHost}
            gameSlug={gameSlug}
        />
    ) : gameState && room.status === 'playing' ? (
        <PlayingPhase
            cubeRef={cubeRef}
            megaRef={megaRef}
            variant={variant}
            marks={gameState.marks}
            currentTurn={gameState.current_turn}
            moveCount={gameState.move_count}
            moveLimit={gameState.move_limit}
            players={gameState.players.map((p, slot) => toPlayerInfo(p, slot))}
            mySlot={gameState.my_slot}
            currentPlayerId={currentPlayer?.id ?? null}
            isMyTurn={gameState.is_my_turn}
            pendingAction={gameState.pending_action}
            lastAction={gameState.last_action}
            onMark={handleMark}
            onRotate={handleRotate}
            onMegaMark={handleMegaMark}
            onMegaRotate={handleMegaRotate}
            onEndTurn={handleEndTurn}
            onUndoMark={handleUndoMark}
            onLeave={handleLeave}
            gamesPlayed={room.games_played ?? 0}
        />
    ) : gameState && room.status === 'finished' ? (
        <FinishedPhase
            variant={variant}
            marks={gameState.marks}
            winner={gameState.winner ?? 'draw'}
            winningLines={gameState.winning_lines.map((l) => ({
                face: l.face,
                cells: l.cells as Array<[number, number]> | number[],
                player: l.player,
            }))}
            players={gameState.players.map((p, slot) => ({
                id: p?.id ?? null,
                nickname: p?.nickname ?? `Player ${slot + 1}`,
                avatar_color: p?.avatar_color ?? '#5b9bd5',
                design: p?.design ?? slot,
                wins: p?.wins ?? 0,
            }))}
            mySlot={gameState.my_slot}
            canRematch={isHost}
            onRematch={handleRematch}
            onLeave={handleLeave}
            leaveLabel="Leave room"
        />
    ) : (
        <div className="flex h-full items-center justify-center font-techDisplay text-sm uppercase tracking-widest text-white/40">
            Loading…
        </div>
    );

    return (
        <GameLayout fullHeight={true}>
            <Head title={`CubeTac — ${room.room_code}`} />

            <div className="relative flex h-full flex-col">
                {currentPlayer ? (
                    <VoiceChatProvider
                        gameSlug={gameSlug}
                        roomCode={room.room_code}
                        currentPlayerId={currentPlayer.id}
                    >
                        {content}
                        <VoiceGalleryPanel currentPlayerId={currentPlayer.id} />
                    </VoiceChatProvider>
                ) : (
                    content
                )}
            </div>
        </GameLayout>
    );
}

// -----------------------------------------------------------------------------

interface GuestJoinFormProps {
    nickname: string;
    onChange: (v: string) => void;
    onSubmit: FormEventHandler;
    processing: boolean;
    error?: string;
}

function GuestJoinForm({ nickname, onChange, onSubmit, processing, error }: GuestJoinFormProps) {
    return (
        <div className="flex h-full items-center justify-center px-6">
            <form
                onSubmit={onSubmit}
                className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-white p-8 shadow-xl border-2 border-yellow-300 dark:bg-gray-800 dark:border-yellow-600/60"
            >
                <h3 className="text-3xl font-black text-yellow-900 dark:text-yellow-300">Join Match</h3>
                <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-gray-500 dark:text-gray-400">
                    Pick a nickname to sit down
                </p>
                <input
                    type="text"
                    value={nickname}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder="Your nickname"
                    maxLength={20}
                    autoFocus
                    required
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-center text-lg font-bold text-gray-900 focus:border-teal-400 focus:ring-teal-400 transition dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                />
                {error && <p className="text-xs font-bold text-red-600 dark:text-red-400">{error}</p>}
                <button
                    type="submit"
                    disabled={processing || nickname.length < 2}
                    className="w-full rounded-full bg-linear-to-r from-orange-500 via-red-500 to-pink-600 px-6 py-3 text-lg font-black text-white shadow-lg border-b-4 border-red-700 transition hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
                >
                    {processing ? 'Joining…' : 'Join'}
                </button>
            </form>
        </div>
    );
}

function toPlayerInfo(p: CubeTacPlayer | null, slot: number) {
    if (!p) return { id: null, nickname: 'Waiting…', avatar_color: '#5b9bd5', design: slot, wins: 0 };
    return { id: p.id, nickname: p.nickname, avatar_color: p.avatar_color, design: p.design ?? slot, wins: p.wins };
}

function KickedNotice({ gameSlug }: { gameSlug: string }) {
    return (
        <div className="flex h-full items-center justify-center px-6">
            <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-white p-8 shadow-xl border-2 border-red-300 dark:bg-gray-800 dark:border-red-600/60">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
                <h3 className="text-2xl font-black text-red-700 dark:text-red-300">Removed from lobby</h3>
                <p className="text-center text-sm font-bold text-gray-600 dark:text-gray-300">
                    You were removed from the lobby by the host.
                </p>
                <Link
                    href={route('games.show', gameSlug)}
                    className="w-full rounded-full bg-linear-to-r from-orange-500 via-red-500 to-pink-600 px-6 py-3 text-center text-lg font-black text-white shadow-lg border-b-4 border-red-700 transition hover:scale-[1.02]"
                >
                    Back to game
                </Link>
            </div>
        </div>
    );
}

export type { CubeTacPlayer, CubeTacGameState };
