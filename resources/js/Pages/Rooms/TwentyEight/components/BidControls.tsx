import { router } from '@inertiajs/react';
import { useState } from 'react';

interface BidControlsProps {
    gameSlug: string;
    roomCode: string;
    currentBid: number;
    canBid: boolean;
    canPass: boolean;
}

export default function BidControls({
    gameSlug,
    roomCode,
    currentBid,
    canBid,
    canPass,
}: BidControlsProps) {
    const minBid = Math.max(14, currentBid + 1);
    const [bidValue, setBidValue] = useState(minBid);
    const [processing, setProcessing] = useState(false);

    const handleBid = () => {
        if (processing) return;
        setProcessing(true);
        router.post(
            route('rooms.twentyEight.placeBid', [gameSlug, roomCode]),
            { bid_value: bidValue, pass: false },
            { onFinish: () => setProcessing(false) },
        );
    };

    const handlePass = () => {
        if (processing) return;
        setProcessing(true);
        router.post(
            route('rooms.twentyEight.placeBid', [gameSlug, roomCode]),
            { pass: true },
            { onFinish: () => setProcessing(false) },
        );
    };

    if (!canBid && !canPass) return null;

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="text-sm font-bold text-gray-700">
                {currentBid > 0 ? `Current bid: ${currentBid}` : 'No bids yet (min: 14)'}
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={() => setBidValue(v => Math.max(minBid, v - 1))}
                    disabled={bidValue <= minBid || processing}
                    className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-50 font-bold text-gray-700 transition"
                >
                    -
                </button>
                <div className="w-16 text-center">
                    <span className="text-3xl font-black text-amber-600">{bidValue}</span>
                </div>
                <button
                    onClick={() => setBidValue(v => Math.min(28, v + 1))}
                    disabled={bidValue >= 28 || processing}
                    className="w-8 h-8 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-50 font-bold text-gray-700 transition"
                >
                    +
                </button>
            </div>

            {/* Quick bid buttons */}
            <div className="flex gap-1.5 flex-wrap justify-center">
                {[14, 16, 18, 20, 23, 26, 28].filter(v => v >= minBid).slice(0, 5).map(v => (
                    <button
                        key={v}
                        onClick={() => setBidValue(v)}
                        className={`px-3 py-1 rounded-lg text-sm font-bold transition ${
                            bidValue === v
                                ? 'bg-amber-500 text-white'
                                : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        }`}
                    >
                        {v}
                    </button>
                ))}
            </div>

            <div className="flex gap-3 mt-1">
                {canBid && (
                    <button
                        onClick={handleBid}
                        disabled={processing || bidValue > 28}
                        className="px-8 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold shadow-lg hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 transition-all hover:scale-105 active:scale-95 border-b-4 border-amber-700"
                    >
                        {processing ? 'Bidding...' : `Bid ${bidValue}`}
                    </button>
                )}
                {canPass && (
                    <button
                        onClick={handlePass}
                        disabled={processing}
                        className="px-8 py-2.5 rounded-xl bg-gray-200 text-gray-700 font-bold hover:bg-gray-300 disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
                    >
                        {processing ? 'Passing...' : 'Pass'}
                    </button>
                )}
            </div>
        </div>
    );
}
