import { TwentyEightGameState, TwentyEightPlayer } from '@/types';
import PlayingCard from './components/PlayingCard';
import BidControls from './components/BidControls';
import TeamBadge from './components/TeamBadge';

interface BiddingPhaseProps {
    gameState: TwentyEightGameState;
    roomCode: string;
    gameSlug: string;
    currentPlayerId?: number;
}

export default function BiddingPhase({
    gameState,
    roomCode,
    gameSlug,
    currentPlayerId,
}: BiddingPhaseProps) {
    const myPlayer = gameState.players.find(p => p.id === currentPlayerId);
    const currentBidder = gameState.players.find(p => p.id === gameState.bidding.current_bidder_id);
    const isMyTurn = currentPlayerId === gameState.bidding.current_bidder_id;
    const dealerPlayer = gameState.players[gameState.dealer_index];

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            {/* Bidding status banner */}
            <div className={`rounded-xl p-4 border-2 ${
                isMyTurn
                    ? 'bg-linear-to-r from-amber-50 to-yellow-100 border-amber-400 dark:from-amber-900/30 dark:to-yellow-900/30 dark:border-amber-600'
                    : 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
            }`}>
                <div className="text-center">
                    <h3 className="text-lg font-black text-gray-900 mb-1 dark:text-gray-100">
                        Bidding Phase
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Round {gameState.round_number} &middot; Dealer: {dealerPlayer?.nickname}
                    </p>
                </div>
            </div>

            {/* Players bidding status */}
            <div className="rounded-xl bg-white shadow-md border border-gray-200 p-4 dark:bg-gray-800 dark:border-gray-700">
                <h4 className="text-sm font-bold text-gray-600 mb-3 dark:text-gray-400">Players</h4>
                <div className="grid grid-cols-2 gap-2">
                    {gameState.players.map((player) => (
                        <div
                            key={player.id}
                            className={`flex items-center gap-2 p-2 rounded-lg ${
                                player.id === gameState.bidding.current_bidder_id
                                    ? 'bg-amber-50 border border-amber-300 dark:bg-amber-900/30 dark:border-amber-700'
                                    : player.has_passed
                                    ? 'bg-gray-50 opacity-60 dark:bg-gray-900/40'
                                    : 'bg-gray-50 dark:bg-gray-900/40'
                            }`}
                        >
                            <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                                style={{ backgroundColor: player.avatar_color }}
                            >
                                {player.nickname.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-gray-800 truncate dark:text-gray-200">
                                    {player.nickname}
                                    {player.id === currentPlayerId && ' (You)'}
                                </div>
                                <div className="flex items-center gap-1">
                                    <TeamBadge team={player.team} />
                                    {player.has_passed && (
                                        <span className="text-[0.6rem] text-gray-400 font-medium dark:text-gray-500">Passed</span>
                                    )}
                                    {player.id === gameState.bidding.current_bidder_id && (
                                        <span className="text-[0.6rem] text-amber-600 font-bold dark:text-amber-400">Bidding...</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Current bid display */}
            {gameState.bidding.highest_bid > 0 && (
                <div className="text-center bg-amber-50 rounded-lg p-3 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                    <span className="text-sm text-amber-700 dark:text-amber-300">
                        Highest bid: <span className="font-black text-lg text-amber-800 dark:text-amber-200">{gameState.bidding.highest_bid}</span>
                        {' '}by{' '}
                        <span className="font-bold">
                            {gameState.players.find(p => p.id === gameState.bidding.highest_bidder_id)?.nickname}
                        </span>
                    </span>
                </div>
            )}

            {/* My cards */}
            {myPlayer?.hand && myPlayer.hand.length > 0 && (
                <div className="rounded-xl bg-linear-to-br from-sky-50 to-blue-100 p-4 shadow-md border-2 border-sky-300 dark:from-sky-900/30 dark:to-blue-900/30 dark:border-sky-700">
                    <h3 className="font-bold text-sky-900 mb-3 text-center text-sm dark:text-sky-200">
                        Your Cards
                    </h3>
                    <div className="flex flex-wrap gap-2 justify-center">
                        {myPlayer.hand.map((card, idx) => (
                            <PlayingCard
                                key={`${card.rank}-${card.suit}-${idx}`}
                                card={card}
                                faceUp
                                size="md"
                                showPoints
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Bid controls */}
            {isMyTurn && (
                <div className="rounded-xl bg-white shadow-lg border-2 border-amber-300 p-6 dark:bg-gray-800 dark:border-amber-700">
                    <BidControls
                        gameSlug={gameSlug}
                        roomCode={roomCode}
                        currentBid={gameState.bidding.highest_bid}
                        canBid={gameState.permissions.can_bid}
                        canPass={gameState.permissions.can_pass}
                    />
                </div>
            )}

            {/* Waiting message */}
            {!isMyTurn && (
                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    <div className="inline-flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="font-medium">
                            Waiting for {currentBidder?.nickname} to bid...
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
