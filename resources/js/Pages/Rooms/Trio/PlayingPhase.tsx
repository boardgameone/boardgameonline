import { router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import MiddleGrid from './components/MiddleGrid';
import PlayerStats from './components/PlayerStats';
import TurnReveals from './components/TurnReveals';
import TrioCelebration from './components/TrioCelebration';
import TrioCard from './components/TrioCard';
import { useSound } from '@/hooks/useSound';

interface Player {
    id: number;
    nickname: string;
    avatar_color: string;
    hand: number[] | null;
    hand_count: number;
    collected_trios: number[][];
    trios_count: number;
    is_current_turn: boolean;
}

interface MiddleCard {
    position: number;
    value: number | null;
    face_up: boolean;
}

interface Reveal {
    value: number;
    source: string;
    reveal_type: string;
}

interface CurrentTurn {
    turn_number: number;
    reveals: Reveal[];
    can_continue: boolean;
    can_claim_trio: boolean;
}

interface Permissions {
    can_reveal: boolean;
    can_claim: boolean;
    can_end_turn: boolean;
}

interface PlayingPhaseProps {
    roomCode: string;
    gameSlug: string;
    players: Player[];
    middleGrid: MiddleCard[];
    currentTurn: CurrentTurn;
    permissions: Permissions;
    currentPlayerId?: number;
}

export default function PlayingPhase({
    roomCode,
    gameSlug,
    players,
    middleGrid,
    currentTurn,
    permissions,
    currentPlayerId,
}: PlayingPhaseProps) {
    const [showCelebration, setShowCelebration] = useState(false);
    const [lastTrioClaimed, setLastTrioClaimed] = useState<{ player: string; cards: number[] } | null>(null);

    const currentTurnPlayer = players.find(p => p.is_current_turn);
    const myPlayer = players.find(p => p.id === currentPlayerId);
    const myHand = myPlayer?.hand;

    const { play: playCardFlip } = useSound('/sounds/trio/card-flip.mp3', { volume: 0.6 });
    const { play: playMatch } = useSound('/sounds/trio/match.mp3', { volume: 0.7 });
    const { play: playMismatch } = useSound('/sounds/trio/mismatch.mp3', { volume: 0.5 });
    const { play: playTrioClaim } = useSound('/sounds/trio/trio-claim.mp3', { volume: 0.85 });
    const { play: playTurnTransition } = useSound('/sounds/trio/turn-transition.mp3', { volume: 0.5 });

    const prevTurnNumber = useRef(currentTurn.turn_number);
    const prevRevealCount = useRef(currentTurn.reveals.length);

    // Detect card reveals and play appropriate sounds
    useEffect(() => {
        const currentRevealCount = currentTurn.reveals.length;

        if (currentRevealCount > prevRevealCount.current) {
            playCardFlip();

            setTimeout(() => {
                if (currentRevealCount >= 2) {
                    const lastReveal = currentTurn.reveals[currentRevealCount - 1];
                    const secondLastReveal = currentTurn.reveals[currentRevealCount - 2];

                    if (lastReveal.value === secondLastReveal.value) {
                        playMatch();
                    } else {
                        playMismatch();
                    }
                }
            }, 200);
        }

        prevRevealCount.current = currentRevealCount;
    }, [currentTurn.reveals.length]);

    // Detect turn transitions
    useEffect(() => {
        if (currentTurn.turn_number > prevTurnNumber.current) {
            playTurnTransition();
        }
        prevTurnNumber.current = currentTurn.turn_number;
    }, [currentTurn.turn_number]);

    // Detect when a trio is claimed
    useEffect(() => {
        const previousTrioCount = myPlayer?.trios_count || 0;
        const currentTrioCount = myPlayer?.trios_count || 0;

        if (currentTrioCount > previousTrioCount && myPlayer?.collected_trios.length) {
            playTrioClaim();

            const latestTrio = myPlayer.collected_trios[myPlayer.collected_trios.length - 1];
            setLastTrioClaimed({
                player: myPlayer.nickname,
                cards: latestTrio,
            });
            setShowCelebration(true);

            // Haptic feedback on mobile
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100]);
            }
        }
    }, [myPlayer?.trios_count]);

    const handleRevealMiddleCard = (position: number) => {
        router.post(route('rooms.trio.revealCard', [gameSlug, roomCode]), {
            reveal_type: 'flip_middle',
            middle_position: position,
            card_value: 0,
        });
    };

    const handleAskHighest = (playerId: number) => {
        router.post(route('rooms.trio.revealCard', [gameSlug, roomCode]), {
            reveal_type: 'ask_highest',
            target_player_id: playerId,
            card_value: 0,
        });
    };

    const handleAskLowest = (playerId: number) => {
        router.post(route('rooms.trio.revealCard', [gameSlug, roomCode]), {
            reveal_type: 'ask_lowest',
            target_player_id: playerId,
            card_value: 0,
        });
    };

    const handleClaimTrio = () => {
        router.post(route('rooms.trio.claimTrio', [gameSlug, roomCode]));
    };

    const handleEndTurn = () => {
        router.post(route('rooms.trio.endTurn', [gameSlug, roomCode]));
    };

    return (
        <div className="space-y-6">
            {/* Current turn banner */}
            <div className={`rounded-xl p-4 text-center border-2 transition-all duration-300 ${
                currentTurnPlayer?.id === currentPlayerId
                    ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-400 animate-pulse'
                    : 'bg-blue-50 border-blue-200'
            }`}>
                <p className={`font-bold text-lg ${
                    currentTurnPlayer?.id === currentPlayerId ? 'text-yellow-900' : 'text-blue-900'
                }`}>
                    {currentTurnPlayer?.id === currentPlayerId
                        ? "🎯 Your turn!"
                        : `${currentTurnPlayer?.nickname}'s turn`}
                </p>
                <p className="text-sm mt-1 font-medium" style={{
                    color: currentTurnPlayer?.id === currentPlayerId ? '#78350f' : '#1e40af'
                }}>
                    Turn {currentTurn.turn_number} • {currentTurn.reveals.length} reveal{currentTurn.reveals.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* Turn reveals */}
            {currentTurn.reveals.length > 0 && (
                <TurnReveals
                    reveals={currentTurn.reveals}
                    players={players}
                    canClaim={permissions.can_claim}
                    canEndTurn={permissions.can_end_turn}
                    canContinue={currentTurn.can_continue}
                    onClaimTrio={handleClaimTrio}
                    onEndTurn={handleEndTurn}
                />
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Middle grid */}
                <div className="rounded-xl bg-white p-6 shadow-lg">
                    <h3 className="font-bold text-gray-900 mb-4 text-center text-lg">
                        Middle Grid
                    </h3>
                    <MiddleGrid
                        cards={middleGrid}
                        canReveal={permissions.can_reveal}
                        onRevealCard={handleRevealMiddleCard}
                    />
                </div>

                {/* Players */}
                <div className="rounded-xl bg-white p-6 shadow-lg">
                    <h3 className="font-bold text-gray-900 mb-4 text-lg">Players</h3>
                    <PlayerStats
                        players={players}
                        currentPlayerId={currentPlayerId}
                        canReveal={permissions.can_reveal}
                        onAskHighest={handleAskHighest}
                        onAskLowest={handleAskLowest}
                    />
                </div>
            </div>

            {/* My hand */}
            {myHand && myHand.length > 0 && (
                <div className="rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 p-6 shadow-lg border-2 border-purple-200">
                    <h3 className="font-bold text-purple-900 mb-4 text-center text-lg">
                        Your Hand
                    </h3>
                    <div className="flex flex-wrap gap-3 justify-center">
                        {myHand.map((card, idx) => (
                            <div
                                key={idx}
                                className="animate-slideIn"
                                style={{ animationDelay: `${idx * 50}ms` }}
                            >
                                <TrioCard
                                    value={card}
                                    faceUp={true}
                                    size="md"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Celebration modal */}
            {lastTrioClaimed && (
                <TrioCelebration
                    show={showCelebration}
                    playerName={lastTrioClaimed.player}
                    trioCards={lastTrioClaimed.cards}
                    onClose={() => setShowCelebration(false)}
                />
            )}
        </div>
    );
}
