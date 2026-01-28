import GameLayout from '@/Layouts/GameLayout';
import { GamePlayer, GameRoom, PageProps } from '@/types';
import { Head, Link, router, useForm, usePoll } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';

interface TrioGameState {
    room: {
        room_code: string;
        status: 'waiting' | 'playing' | 'finished';
        current_turn_player_id: number;
        winner: string | null;
    };
    players: Array<{
        id: number;
        nickname: string;
        avatar_color: string;
        hand: number[] | null;
        hand_count: number;
        collected_trios: number[][];
        trios_count: number;
        is_current_turn: boolean;
    }>;
    middle_grid: Array<{
        position: number;
        value: number | null;
        face_up: boolean;
    }>;
    current_turn: {
        turn_number: number;
        reveals: Array<{ value: number; source: string; reveal_type: string }>;
        can_continue: boolean;
        can_claim_trio: boolean;
    };
    permissions: {
        can_reveal: boolean;
        can_claim: boolean;
        can_end_turn: boolean;
    };
}

interface Props extends PageProps {
    room: GameRoom;
    currentPlayer: GamePlayer | null;
    isHost: boolean;
    gameState: TrioGameState | null;
}

export default function TrioGame({ auth, room, currentPlayer, isHost, gameState }: Props) {
    usePoll(2500, {}, { keepAlive: room.status !== 'finished' });

    const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
    const [selectedRevealType, setSelectedRevealType] = useState<'ask_highest' | 'ask_lowest' | null>(null);

    const gameSlug = room.game?.slug || '';

    // Form for guests to join directly
    const { data, setData, post, processing, errors } = useForm({
        nickname: '',
    });

    const handleJoin: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('rooms.joinDirect', [gameSlug, room.room_code]));
    };

    // Check if user needs to join (not a player yet)
    const needsToJoin = !currentPlayer && room.status === 'waiting' && !room.is_full;
    const isGuest = !auth.user;

    const handleStart = () => {
        router.post(route('rooms.trio.start', [gameSlug, room.room_code]));
    };

    const handleRevealPlayerCard = (playerId: number, revealType: 'ask_highest' | 'ask_lowest') => {
        if (!gameState) return;

        const targetPlayer = gameState.players.find(p => p.id === playerId);
        if (!targetPlayer) return;

        router.post(route('rooms.trio.revealCard', [gameSlug, room.room_code]), {
            reveal_type: revealType,
            target_player_id: playerId,
            card_value: 0,
        });
    };

    const handleRevealMiddleCard = (position: number) => {
        if (!gameState) return;

        router.post(route('rooms.trio.revealCard', [gameSlug, room.room_code]), {
            reveal_type: 'flip_middle',
            middle_position: position,
            card_value: 0,
        });
    };

    const handleClaimTrio = () => {
        router.post(route('rooms.trio.claimTrio', [gameSlug, room.room_code]));
    };

    const handleEndTurn = () => {
        router.post(route('rooms.trio.endTurn', [gameSlug, room.room_code]));
    };

    const handleLeave = () => {
        router.post(route('rooms.leave', [gameSlug, room.room_code]));
    };

    const connectedPlayers = room.players?.filter((p) => p.is_connected) || [];
    const minPlayers = room.game?.min_players || 3;
    const canStart = connectedPlayers.length >= minPlayers && room.status === 'waiting';

    const currentTurnPlayer = gameState?.players.find(p => p.is_current_turn);
    const myHand = gameState?.players.find(p => p.id === currentPlayer?.id)?.hand;

    const getRevealSource = (reveal: { value: number; source: string; reveal_type: string }) => {
        if (reveal.source.startsWith('player_')) {
            const playerId = parseInt(reveal.source.replace('player_', ''));
            const player = gameState?.players.find(p => p.id === playerId);
            const revealLabel = reveal.reveal_type === 'ask_highest' ? 'Highest' : 'Lowest';
            return `${revealLabel} from ${player?.nickname || 'Unknown'}`;
        }
        return 'Middle';
    };

    return (
        <GameLayout
            header={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href={room.game ? route('games.show', room.game.slug) : route('games.index')}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </Link>
                        <h2 className="text-xl font-semibold leading-tight text-gray-800">
                            {room.name || 'TRIO'}
                        </h2>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        room.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                        room.status === 'playing' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                        {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                    </span>
                </div>
            }
        >
            <Head title={`TRIO - Room ${room.room_code}`} />

            <div className="py-8">
                <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
                    {/* Show join form for guests who need to enter nickname */}
                    {needsToJoin && isGuest && (
                        <div className="rounded-xl bg-white p-8 shadow-lg">
                            <div className="text-center py-8">
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-green-500 rounded-full mb-4 shadow-lg">
                                    <span className="text-4xl">{'\u{1F44B}'}</span>
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-2">
                                    Join this game!
                                </h3>
                                <p className="text-gray-500 mb-6">
                                    Enter your nickname to join the room
                                </p>
                                <form onSubmit={handleJoin} className="max-w-xs mx-auto space-y-4">
                                    <div>
                                        <input
                                            type="text"
                                            value={data.nickname}
                                            onChange={(e) => setData('nickname', e.target.value)}
                                            placeholder="Your nickname"
                                            maxLength={20}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-green-400 focus:ring-green-400 transition-colors font-medium text-center"
                                            autoFocus
                                            required
                                        />
                                        {errors.nickname && (
                                            <p className="mt-2 text-sm text-red-600 font-medium">
                                                {errors.nickname}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={processing || data.nickname.length < 2}
                                        className="w-full rounded-full bg-green-500 px-6 py-3 font-bold text-white shadow-lg transition hover:scale-105 hover:bg-green-600 border-b-4 border-green-700 disabled:opacity-50 disabled:hover:scale-100"
                                    >
                                        {processing ? 'Joining...' : 'Join Room'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Show lobby when user has joined */}
                    {room.status === 'waiting' && (!needsToJoin || !isGuest) && (
                        <div className="rounded-xl bg-white p-8 shadow-lg">
                            <h3 className="text-2xl font-bold text-gray-900 mb-6">
                                Players ({connectedPlayers.length}/{room.game?.max_players})
                            </h3>
                            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 mb-6">
                                {connectedPlayers.map((player) => (
                                    <div
                                        key={player.id}
                                        className="flex items-center gap-3 rounded-lg border-2 border-gray-200 p-4"
                                    >
                                        <div
                                            className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold"
                                            style={{ backgroundColor: player.avatar_color }}
                                        >
                                            {player.nickname.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-900">{player.nickname}</p>
                                            {player.is_host && (
                                                <span className="text-xs text-gray-500">Host</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {isHost && (
                                <button
                                    onClick={handleStart}
                                    disabled={!canStart}
                                    className="w-full rounded-lg bg-green-600 px-6 py-3 text-lg font-semibold text-white shadow hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {canStart ? 'Start Game' : `Need ${minPlayers} players to start`}
                                </button>
                            )}
                        </div>
                    )}

                    {(room.status === 'playing' || room.status === 'finished') && gameState && (
                        <div className="space-y-6">
                            {/* Winner Banner */}
                            {room.status === 'finished' && (
                                <div className="rounded-xl bg-yellow-100 border-2 border-yellow-400 p-6 text-center">
                                    <h2 className="text-3xl font-bold text-yellow-900">
                                        🎉 {gameState.players.find(p => p.trios_count >= 3)?.nickname} Wins!
                                    </h2>
                                    <p className="text-yellow-800 mt-2">Collected 3 trios!</p>
                                </div>
                            )}

                            {/* Current Turn Info */}
                            {room.status === 'playing' && (
                                <div className="rounded-xl bg-blue-50 border-2 border-blue-200 p-4 text-center">
                                    <p className="text-blue-900 font-semibold">
                                        {currentTurnPlayer?.id === currentPlayer?.id
                                            ? "Your turn!"
                                            : `${currentTurnPlayer?.nickname}'s turn`}
                                    </p>
                                    <p className="text-blue-700 text-sm mt-1">
                                        Turn {gameState.current_turn.turn_number} • {gameState.current_turn.reveals.length} reveals
                                    </p>
                                </div>
                            )}

                            {/* Turn Reveals */}
                            {gameState.current_turn.reveals.length > 0 && (
                                <div className="rounded-xl bg-white p-6 shadow">
                                    <h3 className="font-bold text-gray-900 mb-4">Current Turn Reveals</h3>
                                    <div className="flex flex-wrap gap-4">
                                        {gameState.current_turn.reveals.map((reveal, idx) => (
                                            <div key={idx} className="flex flex-col items-center">
                                                <div className="flex flex-col items-center justify-center w-20 h-24 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white font-bold text-3xl shadow-lg">
                                                    {reveal.value}
                                                </div>
                                                <span className="text-xs text-gray-600 mt-2 text-center max-w-[120px]">
                                                    {getRevealSource(reveal)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    {gameState.permissions.can_claim && (
                                        <button
                                            onClick={handleClaimTrio}
                                            className="mt-4 rounded-lg bg-green-600 px-6 py-2 text-white font-semibold hover:bg-green-500"
                                        >
                                            Claim Trio!
                                        </button>
                                    )}
                                    {gameState.permissions.can_end_turn && !gameState.current_turn.can_continue && (
                                        <button
                                            onClick={handleEndTurn}
                                            className="mt-4 rounded-lg bg-red-600 px-6 py-2 text-white font-semibold hover:bg-red-500"
                                        >
                                            End Turn (cards don't match)
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="grid gap-6 lg:grid-cols-2">
                                {/* Middle Grid */}
                                <div className="rounded-xl bg-white p-6 shadow">
                                    <h3 className="font-bold text-gray-900 mb-4">Middle Grid</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {gameState.middle_grid.map((card) => (
                                            <button
                                                key={card.position}
                                                onClick={() => handleRevealMiddleCard(card.position)}
                                                disabled={!gameState.permissions.can_reveal || card.face_up}
                                                className={`
                                                    aspect-square rounded-lg font-bold text-2xl shadow-lg transition
                                                    ${card.face_up
                                                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                                                        : 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-600 hover:from-gray-400 hover:to-gray-500'
                                                    }
                                                    ${!gameState.permissions.can_reveal || card.face_up ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                                                `}
                                            >
                                                {card.face_up ? card.value : '?'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Players */}
                                <div className="rounded-xl bg-white p-6 shadow">
                                    <h3 className="font-bold text-gray-900 mb-4">Players</h3>
                                    <div className="space-y-3">
                                        {gameState.players.map((player) => (
                                            <div
                                                key={player.id}
                                                className={`rounded-lg border-2 p-4 ${
                                                    player.is_current_turn ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold"
                                                            style={{ backgroundColor: player.avatar_color }}
                                                        >
                                                            {player.nickname.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-gray-900">
                                                                {player.nickname}
                                                                {player.id === currentPlayer?.id && ' (You)'}
                                                            </p>
                                                            <p className="text-sm text-gray-600">
                                                                {player.hand_count} cards • {player.trios_count} trios
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {gameState.permissions.can_reveal && player.hand_count > 0 && (
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleRevealPlayerCard(player.id, 'ask_highest')}
                                                                className="rounded-md bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200"
                                                            >
                                                                High
                                                            </button>
                                                            <button
                                                                onClick={() => handleRevealPlayerCard(player.id, 'ask_lowest')}
                                                                className="rounded-md bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200"
                                                            >
                                                                Low
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Show collected trios */}
                                                {player.collected_trios.length > 0 && (
                                                    <div className="mt-3 flex gap-2">
                                                        {player.collected_trios.map((trio, idx) => (
                                                            <div key={idx} className="flex gap-1">
                                                                {trio.map((card, cardIdx) => (
                                                                    <div
                                                                        key={cardIdx}
                                                                        className="w-8 h-10 rounded bg-green-500 text-white text-sm font-bold flex items-center justify-center"
                                                                    >
                                                                        {card}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* My Hand */}
                            {myHand && myHand.length > 0 && (
                                <div className="rounded-xl bg-white p-6 shadow">
                                    <h3 className="font-bold text-gray-900 mb-4">Your Hand</h3>
                                    <div className="flex flex-wrap gap-3 justify-center">
                                        {myHand.map((card, idx) => (
                                            <div
                                                key={idx}
                                                className="w-16 h-20 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white font-bold text-2xl flex items-center justify-center shadow-lg"
                                            >
                                                {card}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </GameLayout>
    );
}
