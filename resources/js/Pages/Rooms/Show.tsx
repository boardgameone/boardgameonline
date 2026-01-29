import RoomChat from '@/Components/RoomChat';
import VoiceChat from '@/Components/VoiceChat';
import GameLayout from '@/Layouts/GameLayout';
import { GamePlayer, GameRoom, GameState, PageProps } from '@/types';
import { Head, Link, router, useForm, usePoll } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import CheeseThiefGame from './CheeseThief/CheeseThiefGame';

interface Props extends PageProps {
    room: GameRoom;
    currentPlayer: GamePlayer | null;
    isHost: boolean;
    gameState: GameState | null;
}

export default function Show({ auth, room, currentPlayer, isHost, gameState }: Props) {
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    const gameSlug = room.game?.slug || '';
    const roomLink = route('rooms.show', [gameSlug, room.room_code]);

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

    // Poll for real-time updates when the room is waiting or playing
    usePoll(2500, {}, { keepAlive: room.status !== 'finished' });

    const handleStart = () => {
        router.post(route('rooms.start', [gameSlug, room.room_code]));
    };

    const handleLeave = () => {
        router.post(route('rooms.leave', [gameSlug, room.room_code]));
    };

    const copyRoomCode = () => {
        navigator.clipboard.writeText(room.room_code);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    };

    const copyRoomLink = () => {
        navigator.clipboard.writeText(roomLink);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const connectedPlayers = room.players?.filter((p) => p.is_connected) || [];
    const minPlayers = room.game?.min_players || 4;
    const maxPlayers = room.game?.max_players || 10;
    const canStart = connectedPlayers.length >= minPlayers && room.status === 'waiting';

    const getStatusBadge = () => {
        if (room.status === 'waiting') {
            return { bg: 'bg-blue-500', text: 'text-white', label: 'Waiting' };
        }
        if (room.status === 'playing') {
            return { bg: 'bg-green-500', text: 'text-white', label: 'Playing' };
        }
        return { bg: 'bg-gray-400', text: 'text-white', label: 'Finished' };
    };

    const status = getStatusBadge();

    return (
        <GameLayout>
            <Head title={`Room ${room.room_code}`} />

            {/* Back button */}
            <div className="mb-6 flex items-center justify-between">
                <Link
                    href={room.game ? route('games.show', room.game.slug) : route('games.index')}
                    className="inline-flex items-center gap-2 text-yellow-900 hover:text-yellow-700 font-bold transition"
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
                    Back
                </Link>
                <span className={`px-4 py-1.5 rounded-full font-bold text-sm ${status.bg} ${status.text} shadow-md`}>
                    {status.label}
                </span>
            </div>

            {/* Playing/Finished: Simplified full-width layout */}
            {(room.status === 'playing' || room.status === 'finished') && gameState && room.game && (
                <div className="mx-auto max-w-5xl">
                    <CheeseThiefGame
                        gameState={gameState}
                        roomCode={room.room_code}
                        gameSlug={room.game.slug}
                    />
                </div>
            )}

            {/* Waiting: Full layout with sidebar */}
            {room.status === 'waiting' && (
                <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                    {/* Main content */}
                    <div>
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                            {/* Room Header */}
                            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
                                <div className="flex items-center gap-4">
                                    <span className="text-4xl">
                                        {getGameEmoji(room.game?.slug)}
                                    </span>
                                    <div>
                                        <h1 className="text-xl font-black text-white">
                                            {room.name || room.game?.name || 'Game Room'}
                                        </h1>
                                        <p className="text-blue-100">
                                            {room.game?.name} - {connectedPlayers.length}/{maxPlayers} players
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6">
                                {/* Show join form for guests who need to enter nickname */}
                                {needsToJoin && isGuest && (
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
                                )}

                                {/* Show lobby player list when waiting and user has joined */}
                                {!needsToJoin || !isGuest ? (
                                    <>
                                        <div className="flex items-center justify-between mb-6">
                                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                {'\u{1F465}'} Players
                                            </h3>
                                            <p className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                                {Math.max(0, minPlayers - connectedPlayers.length) > 0
                                                    ? `Need ${minPlayers - connectedPlayers.length} more`
                                                    : 'Ready to start!'}
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
                                ) : null}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Room Code & Link */}
                        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-6 py-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    {'\u{1F511}'} Invite Friends
                                </h3>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* Room Code */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Room Code
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 rounded-xl bg-gray-100 px-4 py-3 text-center text-2xl font-mono font-black tracking-[0.3em] text-gray-900">
                                            {room.room_code}
                                        </code>
                                        <button
                                            onClick={copyRoomCode}
                                            className={`rounded-xl p-3 transition hover:scale-105 ${
                                                copiedCode
                                                    ? 'bg-green-100 text-green-600'
                                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                            title="Copy room code"
                                        >
                                            {copiedCode ? (
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-200" />
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="bg-white px-3 text-gray-500">or share link</span>
                                    </div>
                                </div>

                                {/* Room Link */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        Direct Link
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 rounded-xl bg-gray-100 px-3 py-3 text-sm text-gray-600 truncate font-medium">
                                            {roomLink}
                                        </div>
                                        <button
                                            onClick={copyRoomLink}
                                            className={`rounded-xl p-3 transition hover:scale-105 ${
                                                copiedLink
                                                    ? 'bg-green-100 text-green-600'
                                                    : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                            }`}
                                            title="Copy link"
                                        >
                                            {copiedLink ? (
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <p className="text-xs text-gray-500 text-center">
                                    Friends can join directly with the link!
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                                {'\u{1F3AE}'} Actions
                            </h3>
                            <div className="space-y-3">
                                {isHost ? (
                                    <button
                                        onClick={handleStart}
                                        disabled={!canStart}
                                        className="w-full rounded-full bg-green-500 px-6 py-3 font-bold text-white shadow-lg transition hover:scale-105 hover:bg-green-600 border-b-4 border-green-700 disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                                    >
                                        {canStart ? "Start Game!" : `Need ${minPlayers} players`}
                                    </button>
                                ) : (
                                    <div className="text-center py-3 bg-yellow-50 rounded-xl">
                                        <p className="text-sm text-yellow-700 font-medium">
                                            {'\u{23F3}'} Waiting for host to start...
                                        </p>
                                    </div>
                                )}
                                <button
                                    onClick={handleLeave}
                                    className="w-full rounded-full bg-gray-100 px-6 py-3 font-bold text-gray-700 shadow-md transition hover:scale-105 hover:bg-gray-200 border-b-4 border-gray-300"
                                >
                                    Leave Room
                                </button>
                            </div>
                        </div>

                        {/* Game Info */}
                        {room.game && (
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 text-3xl shadow-md">
                                        {getGameEmoji(room.game.slug)}
                                    </div>
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
            )}

            {/* Overlay Chat and Voice Components */}
            {currentPlayer && (
                <>
                    <RoomChat gameSlug={gameSlug} roomCode={room.room_code} currentPlayerId={currentPlayer.id} />
                    <VoiceChat gameSlug={gameSlug} roomCode={room.room_code} currentPlayerId={currentPlayer.id} />
                </>
            )}
        </GameLayout>
    );
}

function PlayerCard({
    player,
    isCurrentUser,
}: Readonly<{
    player: GamePlayer;
    isCurrentUser: boolean;
}>) {
    return (
        <div
            className={`flex items-center gap-3 rounded-xl p-4 transition ${
                isCurrentUser
                    ? 'bg-blue-100 border-2 border-blue-400'
                    : 'bg-gray-50 border-2 border-transparent'
            }`}
        >
            <div
                className="flex h-12 w-12 items-center justify-center rounded-full text-white font-bold text-lg shadow-md"
                style={{ backgroundColor: player.avatar_color }}
            >
                {player.nickname.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">
                    {player.nickname}
                    {isCurrentUser && <span className="text-blue-600"> (You)</span>}
                </p>
                {player.is_host && (
                    <span className="inline-flex items-center text-xs text-yellow-600 font-bold">
                        {'\u{1F451}'} Host
                    </span>
                )}
            </div>
            <span
                className={`h-3 w-3 rounded-full ${
                    player.is_connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
                }`}
                title={player.is_connected ? 'Online' : 'Offline'}
            />
        </div>
    );
}

function EmptySlot() {
    return (
        <div className="flex items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 p-4 bg-gray-50/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
                <svg
                    className="h-6 w-6 text-gray-400"
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
            <p className="text-sm text-gray-400 font-medium">Waiting for player...</p>
        </div>
    );
}

function getGameEmoji(slug?: string): string {
    if (!slug) return '\u{1F3B2}';
    const emojis: Record<string, string> = {
        'cheese-thief': '\u{1F9C0}',
    };
    return emojis[slug] || '\u{1F3B2}';
}
