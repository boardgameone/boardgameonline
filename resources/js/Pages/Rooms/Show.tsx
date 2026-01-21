import GameLayout from '@/Layouts/GameLayout';
import { GamePlayer, GameRoom, GameState, PageProps } from '@/types';
import { Head, Link, router, usePoll } from '@inertiajs/react';
import CheeseThiefGame from './CheeseThief/CheeseThiefGame';

interface Props extends PageProps {
    room: GameRoom;
    currentPlayer: GamePlayer | null;
    isHost: boolean;
    gameState: GameState | null;
}

export default function Show({ room, currentPlayer, isHost, gameState }: Props) {
    // Poll for real-time updates when the room is waiting or playing
    usePoll(2500, {}, { keepAlive: room.status !== 'finished' });

    const handleStart = () => {
        router.post(route('rooms.start', room.room_code));
    };

    const handleLeave = () => {
        router.post(route('rooms.leave', room.room_code));
    };

    const copyRoomCode = () => {
        navigator.clipboard.writeText(room.room_code);
    };

    const connectedPlayers = room.players?.filter((p) => p.is_connected) || [];
    const minPlayers = room.game?.min_players || 4;
    const maxPlayers = room.game?.max_players || 10;
    const canStart = connectedPlayers.length >= minPlayers && room.status === 'waiting';

    return (
        <GameLayout
            header={
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href={room.game ? route('games.show', room.game.slug) : route('games.index')}
                            className="text-gray-500 hover:text-gray-700"
                        >
                            <svg
                                className="h-5 w-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 19l-7-7 7-7"
                                />
                            </svg>
                        </Link>
                        <h2 className="text-xl font-semibold leading-tight text-gray-800">
                            {room.name || room.game?.name || 'Game Room'}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            room.status === 'waiting'
                                ? 'bg-yellow-100 text-yellow-800'
                                : room.status === 'playing'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                        }`}>
                            {room.status.charAt(0).toUpperCase() + room.status.slice(1)}
                        </span>
                    </div>
                </div>
            }
        >
            <Head title={`Room ${room.room_code}`} />

            <div className="py-12">
                <div className="mx-auto max-w-4xl sm:px-6 lg:px-8">
                    <div className="grid gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <div className="overflow-hidden rounded-xl bg-white p-6 shadow">
                                {/* Show lobby player list when waiting */}
                                {room.status === 'waiting' && (
                                    <>
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-lg font-bold text-gray-900">
                                                Players ({connectedPlayers.length}/{maxPlayers})
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                Need {Math.max(0, minPlayers - connectedPlayers.length)} more to start
                                            </p>
                                        </div>

                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {connectedPlayers.map((player) => (
                                                <PlayerCard
                                                    key={player.id}
                                                    player={player}
                                                    isCurrentUser={player.id === currentPlayer?.id}
                                                />
                                            ))}
                                            {Array.from({
                                                length: Math.max(0, minPlayers - connectedPlayers.length),
                                            }).map((_, i) => (
                                                <EmptySlot key={`empty-${i}`} />
                                            ))}
                                        </div>
                                    </>
                                )}

                                {/* Show game UI when playing or finished */}
                                {(room.status === 'playing' || room.status === 'finished') && gameState && (
                                    <div className="mt-6">
                                        <CheeseThiefGame
                                            gameState={gameState}
                                            roomCode={room.room_code}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="overflow-hidden rounded-xl bg-white p-6 shadow">
                                <h3 className="text-lg font-bold text-gray-900">Room Code</h3>
                                <div className="mt-3 flex items-center gap-2">
                                    <code className="flex-1 rounded-lg bg-gray-100 px-4 py-3 text-center text-2xl font-mono font-bold tracking-widest text-gray-900">
                                        {room.room_code}
                                    </code>
                                    <button
                                        onClick={copyRoomCode}
                                        className="rounded-lg bg-gray-100 p-3 text-gray-600 hover:bg-gray-200"
                                        title="Copy room code"
                                    >
                                        <svg
                                            className="h-6 w-6"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                                            />
                                        </svg>
                                    </button>
                                </div>
                                <p className="mt-2 text-sm text-gray-500">
                                    Share this code with friends to join
                                </p>
                            </div>

                            {room.status === 'waiting' && (
                                <div className="overflow-hidden rounded-xl bg-white p-6 shadow">
                                    <h3 className="text-lg font-bold text-gray-900">Actions</h3>
                                    <div className="mt-4 space-y-3">
                                        {isHost && (
                                            <button
                                                onClick={handleStart}
                                                disabled={!canStart}
                                                className="w-full rounded-md bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {canStart ? 'Start Game' : `Need ${minPlayers} players to start`}
                                            </button>
                                        )}
                                        {!isHost && (
                                            <p className="text-center text-sm text-gray-500">
                                                Waiting for the host to start...
                                            </p>
                                        )}
                                        <button
                                            onClick={handleLeave}
                                            className="w-full rounded-md bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                                        >
                                            Leave Room
                                        </button>
                                    </div>
                                </div>
                            )}

                            {room.game && (
                                <div className="overflow-hidden rounded-xl bg-gray-50 p-6 shadow">
                                    <div className="flex items-center gap-3">
                                        <span className="text-3xl">
                                            {getGameEmoji(room.game.slug)}
                                        </span>
                                        <div>
                                            <h3 className="font-bold text-gray-900">
                                                {room.game.name}
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                {room.game.min_players}-{room.game.max_players} players
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </GameLayout>
    );
}

function PlayerCard({
    player,
    isCurrentUser,
}: {
    player: GamePlayer;
    isCurrentUser: boolean;
}) {
    return (
        <div
            className={`flex items-center gap-3 rounded-lg border-2 p-4 ${
                isCurrentUser
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white'
            }`}
        >
            <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-white font-bold"
                style={{ backgroundColor: player.avatar_color }}
            >
                {player.nickname.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                    {player.nickname}
                    {isCurrentUser && ' (You)'}
                </p>
                {player.is_host && (
                    <span className="inline-flex items-center text-xs text-yellow-600">
                        {'\u{1F451}'} Host
                    </span>
                )}
            </div>
            {player.is_connected ? (
                <span className="h-2 w-2 rounded-full bg-green-500" title="Online" />
            ) : (
                <span className="h-2 w-2 rounded-full bg-gray-300" title="Offline" />
            )}
        </div>
    );
}

function EmptySlot() {
    return (
        <div className="flex items-center gap-3 rounded-lg border-2 border-dashed border-gray-200 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                </svg>
            </div>
            <p className="text-sm text-gray-400">Waiting for player...</p>
        </div>
    );
}

function getGameEmoji(slug: string): string {
    const emojis: Record<string, string> = {
        'cheese-thief': '\u{1F9C0}',
    };
    return emojis[slug] || '\u{1F3B2}';
}
