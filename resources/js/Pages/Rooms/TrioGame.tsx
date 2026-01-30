import GameIcon from '@/Components/GameIcon';
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

    // Use fullHeight mode during playing and finished phases
    const useFullHeight = room.status === 'playing' || room.status === 'finished';

    return (
        <GameLayout fullHeight={useFullHeight}>
            <Head title={`Trio - Room ${room.room_code}`} />

            <div className={useFullHeight ? 'h-full py-2' : 'py-8'}>
                <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${
                    useFullHeight ? 'max-w-full h-full' : 'max-w-5xl'
                }`}>
                    {/* Show join form for guests who need to enter nickname */}
                    {needsToJoin && isGuest && (
                        <div className="rounded-xl bg-white p-8 shadow-lg">
                            <div className="text-center py-8">
                                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-green-500 rounded-full mb-4 shadow-lg text-white">
                                    <GameIcon name="wave" size="xl" />
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

