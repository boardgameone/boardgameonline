import { router } from '@inertiajs/react';
import { useState } from 'react';
import { TwentyEightGameState } from '@/types';
import PlayingCard from './components/PlayingCard';

interface TrumpSelectionPhaseProps {
    gameState: TwentyEightGameState;
    roomCode: string;
    gameSlug: string;
    currentPlayerId?: number;
}

export default function TrumpSelectionPhase({
    gameState,
    roomCode,
    gameSlug,
    currentPlayerId,
}: TrumpSelectionPhaseProps) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [processing, setProcessing] = useState(false);

    const myPlayer = gameState.players.find(p => p.id === currentPlayerId);
    const isBidWinner = gameState.permissions.can_select_trump;
    const bidWinner = gameState.players.find(p => p.is_bid_winner);

    const handleSelectTrump = () => {
        if (selectedIndex === null || processing) return;
        setProcessing(true);
        router.post(
            route('rooms.twentyEight.selectTrump', [gameSlug, roomCode]),
            { card_index: selectedIndex },
            { onFinish: () => setProcessing(false) },
        );
    };

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            {/* Status banner */}
            <div className={`rounded-xl p-4 border-2 ${
                isBidWinner
                    ? 'bg-gradient-to-r from-amber-50 to-yellow-100 border-amber-400'
                    : 'bg-blue-50 border-blue-200'
            }`}>
                <div className="text-center">
                    <h3 className="text-lg font-black text-gray-900 mb-1">
                        Trump Selection
                    </h3>
                    <p className="text-sm text-gray-600">
                        {bidWinner?.nickname} won the bid with <span className="font-bold text-amber-600">{gameState.bid_value}</span>
                    </p>
                </div>
            </div>

            {isBidWinner && myPlayer?.hand ? (
                <div className="rounded-xl bg-white shadow-lg border-2 border-amber-300 p-6">
                    <h4 className="text-center font-bold text-gray-800 mb-1">
                        Select your trump card
                    </h4>
                    <p className="text-center text-sm text-gray-500 mb-4">
                        The suit of this card becomes the hidden trump. This card will be set aside until trump is revealed.
                    </p>

                    <div className="flex flex-wrap gap-3 justify-center mb-4">
                        {myPlayer.hand.map((card, idx) => (
                            <div
                                key={`${card.rank}-${card.suit}-${idx}`}
                                className={`transition-all duration-200 ${
                                    selectedIndex === idx ? '-translate-y-3' : ''
                                }`}
                            >
                                <PlayingCard
                                    card={card}
                                    faceUp
                                    size="lg"
                                    highlighted={selectedIndex === idx}
                                    onClick={() => setSelectedIndex(idx)}
                                    showPoints
                                />
                            </div>
                        ))}
                    </div>

                    {selectedIndex !== null && myPlayer.hand[selectedIndex] && (
                        <div className="text-center mb-4">
                            <span className="text-sm text-gray-600">
                                Trump suit will be: <span className="font-bold text-amber-600">
                                    {myPlayer.hand[selectedIndex].suit.charAt(0).toUpperCase() + myPlayer.hand[selectedIndex].suit.slice(1)}
                                </span>
                            </span>
                        </div>
                    )}

                    <button
                        onClick={handleSelectTrump}
                        disabled={selectedIndex === null || processing}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold shadow-lg hover:from-amber-600 hover:to-amber-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 disabled:hover:scale-100 border-b-4 border-amber-700 disabled:border-gray-600"
                    >
                        {processing ? 'Setting trump...' : 'Confirm Trump'}
                    </button>
                </div>
            ) : (
                <div className="text-center py-8">
                    <div className="inline-flex items-center gap-2 text-gray-500">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="font-medium">
                            Waiting for {bidWinner?.nickname} to select trump...
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
