import { router } from '@inertiajs/react';
import { useState } from 'react';
import { TwentyEightGameState, TwentyEightPlayer } from '@/types';
import PlayingCard from './components/PlayingCard';
import CardHand from './components/CardHand';
import TrickArea from './components/TrickArea';
import PlayerSeat from './components/PlayerSeat';
import ScoreBoard from './components/ScoreBoard';
import TrumpIndicator from './components/TrumpIndicator';
import LastTrickModal from './components/LastTrickModal';

interface PlayingPhaseProps {
    gameState: TwentyEightGameState;
    roomCode: string;
    gameSlug: string;
    currentPlayerId?: number;
}

export default function PlayingPhase({
    gameState,
    roomCode,
    gameSlug,
    currentPlayerId,
}: PlayingPhaseProps) {
    const [showLastTrick, setShowLastTrick] = useState(false);
    const [playingCard, setPlayingCard] = useState(false);

    const myPlayer = gameState.players.find(p => p.id === currentPlayerId);
    const isMyTurn = gameState.permissions.can_play_card;

    // Arrange players relative to current player
    const getRelativePlayer = (offset: number): TwentyEightPlayer | undefined => {
        const myIndex = gameState.player_order.indexOf(currentPlayerId ?? 0);
        const targetIndex = (myIndex + offset) % 4;
        const targetId = gameState.player_order[targetIndex];
        return gameState.players.find(p => p.id === targetId);
    };

    const bottomPlayer = getRelativePlayer(0); // Me
    const leftPlayer = getRelativePlayer(1);
    const topPlayer = getRelativePlayer(2);   // Partner
    const rightPlayer = getRelativePlayer(3);

    const getPlayedCard = (playerId: number) => {
        return gameState.current_trick.cards.find(c => c.player_id === playerId) ?? null;
    };

    const handlePlayCard = (cardIndex: number) => {
        if (playingCard) return;
        setPlayingCard(true);
        router.post(
            route('rooms.twentyEight.playCard', [gameSlug, roomCode]),
            { card_index: cardIndex },
            { onFinish: () => setPlayingCard(false) },
        );
    };

    const handleCallTrump = () => {
        router.post(route('rooms.twentyEight.callTrump', [gameSlug, roomCode]));
    };

    const dealerPlayer = gameState.players[gameState.dealer_index];
    const currentTurnPlayer = gameState.players.find(p => p.is_current_turn);

    return (
        <div className="h-full flex flex-col gap-2">
            {/* Top status bar */}
            <div className="flex items-center justify-between rounded-lg bg-white/90 backdrop-blur px-3 py-2 shadow-sm border border-gray-200 flex-shrink-0 dark:bg-gray-800/90 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${
                        currentTurnPlayer?.id === currentPlayerId ? 'text-amber-700 dark:text-amber-300' : 'text-gray-700 dark:text-gray-300'
                    }`}>
                        {currentTurnPlayer?.id === currentPlayerId
                            ? "Your turn!"
                            : `${currentTurnPlayer?.nickname}'s turn`
                        }
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                        Trick {gameState.current_trick.number}/8 &middot; Round {gameState.round_number}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <TrumpIndicator
                        revealed={gameState.trump.revealed}
                        suit={gameState.trump.suit}
                        compact
                    />
                    {gameState.last_completed_trick && (
                        <button
                            onClick={() => setShowLastTrick(true)}
                            className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium transition"
                        >
                            Last Trick
                        </button>
                    )}
                </div>
            </div>

            {/* Main game area */}
            <div className="flex-1 flex flex-col lg:flex-row gap-2 min-h-0">
                {/* Game table */}
                <div className="flex-1 flex flex-col items-center justify-center min-h-0">
                    {/* Top player (partner) */}
                    <div className="flex-shrink-0 mb-2">
                        {topPlayer && (
                            <PlayerSeat
                                player={topPlayer}
                                playedCard={getPlayedCard(topPlayer.id)}
                                position="top"
                                isDealer={topPlayer.id === dealerPlayer?.id}
                                isBidWinner={topPlayer.is_bid_winner}
                            />
                        )}
                    </div>

                    {/* Middle row: Left player - Trick Area - Right player */}
                    <div className="flex items-center justify-center gap-4 sm:gap-8">
                        <div className="flex-shrink-0">
                            {leftPlayer && (
                                <PlayerSeat
                                    player={leftPlayer}
                                    playedCard={getPlayedCard(leftPlayer.id)}
                                    position="left"
                                    isDealer={leftPlayer.id === dealerPlayer?.id}
                                    isBidWinner={leftPlayer.is_bid_winner}
                                />
                            )}
                        </div>

                        <TrickArea
                            cards={gameState.current_trick.cards}
                            playerOrder={gameState.player_order}
                            currentPlayerId={currentPlayerId}
                            trickNumber={gameState.current_trick.number}
                        />

                        <div className="flex-shrink-0">
                            {rightPlayer && (
                                <PlayerSeat
                                    player={rightPlayer}
                                    playedCard={getPlayedCard(rightPlayer.id)}
                                    position="right"
                                    isDealer={rightPlayer.id === dealerPlayer?.id}
                                    isBidWinner={rightPlayer.is_bid_winner}
                                />
                            )}
                        </div>
                    </div>

                    {/* Bottom player (me) info */}
                    <div className="flex-shrink-0 mt-2">
                        {bottomPlayer && (
                            <div className="flex items-center gap-2">
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md ${
                                        bottomPlayer.is_current_turn ? 'ring-2 ring-amber-400 ring-offset-1' : ''
                                    }`}
                                    style={{ backgroundColor: bottomPlayer.avatar_color }}
                                >
                                    {bottomPlayer.nickname.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-bold text-gray-700">{bottomPlayer.nickname} (You)</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar: Scoreboard */}
                <div className="flex-shrink-0 lg:w-56">
                    <ScoreBoard
                        points={gameState.points}
                        gameScores={gameState.game_scores}
                        bidValue={gameState.bid_value}
                        bidTeam={gameState.bid_team}
                        tricksWon={gameState.tricks_won}
                    />
                </div>
            </div>

            {/* Call Trump button */}
            {gameState.permissions.can_call_trump && (
                <div className="flex-shrink-0 text-center py-2">
                    <button
                        onClick={handleCallTrump}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-lg hover:from-purple-600 hover:to-purple-700 transition-all hover:scale-105 active:scale-95 border-b-4 border-purple-700"
                    >
                        Call Trump (Reveal Hidden Trump)
                    </button>
                    {gameState.permissions.must_call_trump && (
                        <p className="text-xs text-purple-600 mt-1 font-medium">
                            You must call trump before playing
                        </p>
                    )}
                </div>
            )}

            {/* Player's hand */}
            <div className="flex-shrink-0 rounded-xl bg-gradient-to-br from-sky-50 to-blue-100 p-3 shadow-lg border-2 border-sky-300">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-sky-900 text-sm">Your Hand</h3>
                    <ScoreBoard
                        points={gameState.points}
                        gameScores={gameState.game_scores}
                        bidValue={gameState.bid_value}
                        bidTeam={gameState.bid_team}
                        tricksWon={gameState.tricks_won}
                        compact
                    />
                </div>
                {myPlayer?.hand ? (
                    <CardHand
                        cards={myPlayer.hand}
                        playableIndices={myPlayer.playable_card_indices}
                        canPlay={gameState.permissions.can_play_card && !playingCard}
                        onPlayCard={handlePlayCard}
                    />
                ) : (
                    <div className="text-center text-sky-400 text-sm py-2">
                        No cards in hand
                    </div>
                )}
            </div>

            {/* Last trick modal */}
            {showLastTrick && gameState.last_completed_trick && (
                <LastTrickModal
                    trick={gameState.last_completed_trick}
                    players={gameState.players}
                    onClose={() => setShowLastTrick(false)}
                />
            )}
        </div>
    );
}
