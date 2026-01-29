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
                <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
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

                    {/* Game content */}
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

                    {/* Voice Chat and Room Chat - render as floating overlays */}
                    {currentPlayer && (
                        <VoiceChat gameSlug={gameSlug} roomCode={room.room_code} currentPlayerId={currentPlayer.id} />
                    )}
                    {currentPlayer && (
                        <RoomChat gameSlug={gameSlug} roomCode={room.room_code} currentPlayerId={currentPlayer.id} />
                    )}
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
