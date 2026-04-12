import RoomChat from '@/Components/RoomChat';
import { VoiceChatProvider } from '@/Contexts/VoiceChatContext';
import GameLayout from '@/Layouts/GameLayout';
import { GamePlayer, GameRoom, PageProps, TwentyEightGameState } from '@/types';
import { Head, useForm, usePoll } from '@inertiajs/react';
import { FormEventHandler, useState } from 'react';
import TwentyEightGame from './TwentyEight/TwentyEightGame';
import GameIcon from '@/Components/GameIcon';

interface Props extends PageProps {
    room: GameRoom;
    currentPlayer: GamePlayer | null;
    isHost: boolean;
    gameState: TwentyEightGameState | null;
}

export default function TwentyEightGamePage({ auth, room, currentPlayer, isHost, gameState }: Props) {
    usePoll(2500, {}, { keepAlive: room.status !== 'finished' });

    const gameSlug = room.game?.slug || '';
    const roomLink = route('rooms.show', [gameSlug, room.room_code]);

    const { data, setData, post, processing, errors } = useForm({
        nickname: '',
    });

    const handleJoin: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('rooms.joinDirect', [gameSlug, room.room_code]));
    };

    const needsToJoin = !currentPlayer && room.status === 'waiting' && !room.is_full;
    const isGuest = !auth.user;

    const connectedPlayers = room.players?.filter((p) => p.is_connected) || [];
    const minPlayers = room.game?.min_players || 4;
    const maxPlayers = room.game?.max_players || 4;

    const useFullHeight = room.status === 'playing' || room.status === 'finished';

    const content = (
        <div className={useFullHeight ? 'h-full py-2' : 'py-8'}>
            <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${
                useFullHeight ? 'max-w-full h-full' : 'max-w-5xl'
            }`}>
                {needsToJoin && isGuest && (
                    <div className="rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
                        <div className="text-center py-8">
                            <div className="inline-flex items-center justify-center w-20 h-20 bg-linear-to-br from-amber-400 to-amber-500 rounded-full mb-4 shadow-lg text-white">
                                <GameIcon name="wave" size="xl" />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 mb-2 dark:text-gray-100">
                                Join Twenty-Eight!
                            </h3>
                            <p className="text-gray-500 mb-6 dark:text-gray-400">
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
                                        className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-amber-400 focus:ring-amber-400 transition-colors font-medium text-center dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
                                        autoFocus
                                        required
                                    />
                                    {errors.nickname && (
                                        <p className="mt-2 text-sm text-red-600 font-medium dark:text-red-400">
                                            {errors.nickname}
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={processing || data.nickname.length < 2}
                                    className="w-full rounded-full bg-amber-500 px-6 py-3 font-bold text-white shadow-lg transition hover:scale-105 hover:bg-amber-600 border-b-4 border-amber-700 disabled:opacity-50 disabled:hover:scale-100"
                                >
                                    {processing ? 'Joining...' : 'Join Room'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {(!needsToJoin || !isGuest) && (
                    <TwentyEightGame
                        gameState={gameState}
                        roomCode={room.room_code}
                        gameSlug={gameSlug}
                        players={gameState?.players || connectedPlayers.map(p => ({
                            ...p,
                            team: null,
                            seat_position: 0,
                            hand: null,
                            hand_count: 0,
                            is_current_turn: false,
                            has_passed: false,
                            is_bid_winner: false,
                            playable_card_indices: [],
                        }))}
                        isHost={isHost}
                        currentPlayerId={currentPlayer?.id}
                        minPlayers={minPlayers}
                        maxPlayers={maxPlayers}
                    />
                )}

                {currentPlayer && (
                    <RoomChat gameSlug={gameSlug} roomCode={room.room_code} currentPlayerId={currentPlayer.id} />
                )}
            </div>
        </div>
    );

    return (
        <GameLayout fullHeight={useFullHeight}>
            <Head title={`Twenty-Eight - Room ${room.room_code}`} />

            {currentPlayer ? (
                <VoiceChatProvider
                    gameSlug={gameSlug}
                    roomCode={room.room_code}
                    currentPlayerId={currentPlayer.id}
                >
                    {content}
                </VoiceChatProvider>
            ) : (
                content
            )}
        </GameLayout>
    );
}
