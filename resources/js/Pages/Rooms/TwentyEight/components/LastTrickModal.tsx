import { TwentyEightCompletedTrick, TwentyEightPlayer } from '@/types';
import PlayingCard from './PlayingCard';

interface LastTrickModalProps {
    trick: TwentyEightCompletedTrick;
    players: TwentyEightPlayer[];
    onClose: () => void;
}

export default function LastTrickModal({ trick, players, onClose }: LastTrickModalProps) {
    const getPlayerName = (playerId: number) => {
        return players.find(p => p.id === playerId)?.nickname ?? 'Unknown';
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div
                className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                        Last Trick ({trick.points} pts)
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {trick.cards.map((play) => (
                        <div
                            key={play.player_id}
                            className={`flex flex-col items-center gap-1 p-2 rounded-lg ${
                                play.player_id === trick.winner_id
                                    ? 'bg-amber-50 border-2 border-amber-300'
                                    : 'bg-gray-50 border border-gray-200'
                            }`}
                        >
                            <span className="text-xs font-bold text-gray-600">
                                {getPlayerName(play.player_id)}
                                {play.player_id === trick.winner_id && ' \u2B50'}
                            </span>
                            <PlayingCard card={play.card} faceUp size="sm" showPoints />
                        </div>
                    ))}
                </div>

                <div className="mt-4 text-center text-sm text-gray-500">
                    Won by <span className="font-bold text-amber-600">{getPlayerName(trick.winner_id)}</span>
                </div>
            </div>
        </div>
    );
}
