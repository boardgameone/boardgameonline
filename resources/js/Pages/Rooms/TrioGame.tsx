import RoomChat from '@/Components/RoomChat';
import VoiceChat from '@/Components/VoiceChat';
import GameLayout from '@/Layouts/GameLayout';
import { GamePlayer, GameRoom, PageProps } from '@/types';
import { Head, Link, useForm, usePoll } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import TrioGame from './Trio/TrioGame';

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
        is_host: boolean;
        is_connected: boolean;
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

export default function TrioGamePage({ auth, room, currentPlayer, isHost, gameState }: Props) {
    usePoll(2500, {}, { keepAlive: room.status !== 'finished' });

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
    const minPlayers = room.game?.min_players || 3;
    const maxPlayers = room.game?.max_players || 8;

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
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Main content */}
                        <div className="lg:col-span-2">
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

                            {/* Use new component-based game structure */}
                            {(!needsToJoin || !isGuest) && (
                                <TrioGame
                                    gameState={gameState}
                                    roomCode={room.room_code}
                                    gameSlug={gameSlug}
                                    players={gameState?.players || connectedPlayers.map(p => ({
                                        ...p,
                                        hand: null,
                                        hand_count: 0,
                                        collected_trios: [],
                                        trios_count: 0,
                                        is_current_turn: false,
                                    }))}
                                    isHost={isHost}
                                    currentPlayerId={currentPlayer?.id}
                                    minPlayers={minPlayers}
                                    maxPlayers={maxPlayers}
                                />
                            )}
                        </div>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            {/* Room Code & Link */}
                            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                                <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 px-6 py-4">
                                    <h3 className="text-lg font-bold text-yellow-900 flex items-center gap-2">
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

                            {/* Voice Chat */}
                            {currentPlayer && (
                                <VoiceChat gameSlug={gameSlug} roomCode={room.room_code} currentPlayerId={currentPlayer.id} />
                            )}

                            {/* Chat */}
                            {currentPlayer && (
                                <RoomChat gameSlug={gameSlug} roomCode={room.room_code} currentPlayerId={currentPlayer.id} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </GameLayout>
    );
}

function getGameEmoji(slug?: string): string {
    if (!slug) return '\u{1F3B2}';
    const emojis: Record<string, string> = {
        'cheese-thief': '\u{1F9C0}',
        'trio': '\u{1F3B4}',
    };
    return emojis[slug] || '\u{1F3B2}';
}
