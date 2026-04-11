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
import { GamePlayer, GameRoom, PageProps } from '@/types';
import { Head, router, useForm, usePoll } from '@inertiajs/react';
import { FormEventHandler, useRef } from 'react';
import { Marks, Move } from '@/lib/rubikCube';

interface CubeTacPlayer {
    id: number;
    nickname: string;
    avatar_color: string;
    is_host: boolean;
    is_connected: boolean;
}

interface CubeTacGameState {
    status: 'playing' | 'finished';
    marks: Marks;
    current_turn: number;
    move_count: number;
    move_limit: number;
    winner: number | 'draw' | null;
    winning_lines: Array<{
        face: number;
        cells: Array<[number, number]>;
        player: number;
    }>;
    last_action: Record<string, unknown> | null;
    move_history: Array<Record<string, unknown>>;
    player_ids: Array<number | null>;
    current_player_id: number | null;
    is_my_turn: boolean;
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

    const gameSlug = room.game?.slug || 'cubetac';
    const isGuest = !auth.user;
    const needsToJoin = !currentPlayer && room.status === 'waiting' && !room.is_full;

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

    return (
        <GameLayout fullHeight={true}>
            <Head title={`CubeTac — ${room.room_code}`} />

            <div className="relative flex h-full flex-col">
                {needsToJoin && isGuest ? (
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
                        marks={gameState.marks}
                        currentTurn={gameState.current_turn}
                        moveCount={gameState.move_count}
                        moveLimit={gameState.move_limit}
                        players={gameState.players.map(toPlayerInfo)}
                        mySlot={gameState.my_slot}
                        isMyTurn={gameState.is_my_turn}
                        onMark={handleMark}
                        onRotate={handleRotate}
                        onLeave={handleLeave}
                    />
                ) : gameState && room.status === 'finished' ? (
                    <FinishedPhase
                        marks={gameState.marks}
                        winner={gameState.winner ?? 'draw'}
                        winningLines={gameState.winning_lines}
                        players={gameState.players.map((p, slot) => ({
                            id: p?.id ?? null,
                            nickname: p?.nickname ?? `Player ${slot + 1}`,
                            avatar_color: p?.avatar_color ?? '#5b9bd5',
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
                className="flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-white p-8 shadow-xl border-2 border-yellow-300"
            >
                <h3 className="text-3xl font-black text-yellow-900">Join Match</h3>
                <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-gray-500">
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
                    className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-center text-lg font-bold text-gray-900 focus:border-teal-400 focus:ring-teal-400 transition"
                />
                {error && <p className="text-xs font-bold text-red-600">{error}</p>}
                <button
                    type="submit"
                    disabled={processing || nickname.length < 2}
                    className="w-full rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-pink-600 px-6 py-3 text-lg font-black text-white shadow-lg border-b-4 border-red-700 transition hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
                >
                    {processing ? 'Joining…' : 'Join'}
                </button>
            </form>
        </div>
    );
}

function toPlayerInfo(p: CubeTacPlayer | null) {
    if (!p) return { id: null, nickname: 'Waiting…', avatar_color: '#5b9bd5' };
    return { id: p.id, nickname: p.nickname, avatar_color: p.avatar_color };
}

export type { CubeTacPlayer, CubeTacGameState };
