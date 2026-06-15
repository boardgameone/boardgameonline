import { router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import MiddleGrid from './components/MiddleGrid';
import OpponentsAtTable from './components/OpponentsAtTable';
import PlayerStats from './components/PlayerStats';
import TurnReveals from './components/TurnReveals';
import TrioCelebration from './components/TrioCelebration';
import TrioCard from './components/TrioCard';
import SoundToggle from '../CheeseThief/components/SoundToggle';
import { useSound } from '@/hooks/useSound';
import GameIcon from '@/Components/GameIcon';

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
    removed?: boolean;
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
    const [isClaimingTrio, setIsClaimingTrio] = useState(false);
    const [isEndingTurn, setIsEndingTurn] = useState(false);

    const currentTurnPlayer = players.find(p => p.is_current_turn);
    const myPlayer = players.find(p => p.id === currentPlayerId);

    // Filter out cards that have been revealed from my hand this turn
    const myHand = (() => {
        if (!myPlayer?.hand) return null;

        // Get revealed card values from my hand this turn
        const revealedFromMe = currentTurn.reveals
            .filter(r => r.source === `player_${myPlayer.id}`)
            .map(r => r.value);

        // Create a copy of the hand and remove one instance of each revealed card
        const filteredHand = [...myPlayer.hand];
        for (const revealedValue of revealedFromMe) {
            const idx = filteredHand.indexOf(revealedValue);
            if (idx !== -1) {
                filteredHand.splice(idx, 1);
            }
        }

        return filteredHand;
    })();

    const { play: playCardFlip } = useSound('/sounds/trio/card-flip.mp3', { volume: 0.6 });
    const { play: playDeal } = useSound('/sounds/trio/card-flip.mp3', { volume: 0.5 });
    const { play: playMatch } = useSound('/sounds/trio/match.mp3', { volume: 0.7 });
    const { play: playMismatch } = useSound('/sounds/trio/mismatch.mp3', { volume: 0.5 });
    const { play: playTrioClaim } = useSound('/sounds/trio/trio-claim.mp3', { volume: 0.85 });
    const { play: playTurnTransition } = useSound('/sounds/trio/turn-transition.mp3', { volume: 0.5 });

    const prevTurnNumber = useRef(currentTurn.turn_number);
    const prevRevealCount = useRef(currentTurn.reveals.length);
    const hasPlayedDealSound = useRef(false);

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

    // Play deal sound when hand first appears (simulates cards being dealt)
    useEffect(() => {
        if (myHand && myHand.length > 0 && !hasPlayedDealSound.current) {
            hasPlayedDealSound.current = true;

            // Play multiple card flip sounds with slight delays to simulate dealing
            myHand.forEach((_, idx) => {
                setTimeout(() => playDeal(), idx * 80);
            });
        }
    }, [myHand, playDeal]);

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
        if (isClaimingTrio) return;
        setIsClaimingTrio(true);
        router.post(route('rooms.trio.claimTrio', [gameSlug, roomCode]), {}, {
            onFinish: () => setIsClaimingTrio(false),
        });
    };

    const handleEndTurn = () => {
        if (isEndingTurn) return;
        setIsEndingTurn(true);
        router.post(route('rooms.trio.endTurn', [gameSlug, roomCode]), {}, {
            onFinish: () => setIsEndingTurn(false),
        });
    };

    // Blender-rendered green felt playmat that sits on the wooden table (raised, with contact shadow)
    const feltPanel =
        "rounded-2xl bg-[url('/images/trio/table-felt.png')] bg-cover bg-center ring-1 ring-emerald-950/60 shadow-[0_14px_34px_rgba(0,0,0,0.55),inset_0_2px_16px_rgba(0,0,0,0.5)]";
    const feltHeading = 'font-bold text-emerald-50 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]';

    return (
        <div className="relative h-full flex flex-col gap-2 lg:gap-3">
            {/* Immersive table-room backdrop — seated tabletop POV (Blender render) */}
            <div
                aria-hidden
                className="pointer-events-none fixed left-0 right-0 bottom-0 top-16 sm:top-20 z-0 bg-[url('/images/trio/table-room.png')] bg-cover bg-center"
            />
            <div
                aria-hidden
                className="pointer-events-none fixed left-0 right-0 bottom-0 top-16 sm:top-20 z-0 bg-[radial-gradient(ellipse_at_50%_42%,transparent_28%,rgba(12,6,1,0.62))]"
            />
            {/* Compact turn banner */}
            <div className={`relative z-10 rounded-lg px-4 py-2 border transition-all duration-300 shrink-0 backdrop-blur-md ${
                currentTurnPlayer?.id === currentPlayerId
                    ? 'bg-amber-100/80 border-amber-300/70'
                    : 'bg-white/70 border-white/50'
            }`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <span className={`font-bold ${
                            currentTurnPlayer?.id === currentPlayerId ? 'text-yellow-900' : 'text-blue-900'
                        }`}>
                            {currentTurnPlayer?.id === currentPlayerId
                                ? <><GameIcon name="target" className="inline-block mr-1" /> Your turn!</>
                                : `${currentTurnPlayer?.nickname}'s turn`}
                        </span>
                        <span className="text-sm font-medium" style={{
                            color: currentTurnPlayer?.id === currentPlayerId ? '#78350f' : '#1e40af'
                        }}>
                            Turn {currentTurn.turn_number} • {currentTurn.reveals.length} reveal{currentTurn.reveals.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <SoundToggle />
                </div>
            </div>

            {/* Mobile/Tablet: Scrollable vertical layout */}
            <div className="relative z-10 flex-1 overflow-auto lg:overflow-hidden">
                {/* Mobile layout (vertical stacking) */}
                <div className="lg:hidden space-y-4 pb-4">
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
                            isProcessing={isClaimingTrio || isEndingTurn}
                        />
                    )}

                    {/* Middle grid */}
                    <div className={`${feltPanel} p-4`}>
                        <OpponentsAtTable players={players} currentPlayerId={currentPlayerId} reveals={currentTurn.reveals} />
                        <h3 className={`${feltHeading} mb-3 text-center`}>
                            Middle Grid
                        </h3>
                        <MiddleGrid
                            cards={middleGrid}
                            canReveal={permissions.can_reveal}
                            onRevealCard={handleRevealMiddleCard}
                        />
                    </div>

                    {/* Players */}
                    <div className="rounded-xl bg-white/75 backdrop-blur-md p-4 shadow-[0_10px_28px_rgba(0,0,0,0.45)] border border-white/50">
                        <h3 className="font-bold text-slate-800 mb-3">Players</h3>
                        <PlayerStats
                            players={players}
                            currentPlayerId={currentPlayerId}
                            canReveal={permissions.can_reveal}
                            onAskHighest={handleAskHighest}
                            onAskLowest={handleAskLowest}
                            reveals={currentTurn.reveals}
                        />
                    </div>

                    {/* My hand */}
                    {myHand && myHand.length > 0 && (
                        <div className={`${feltPanel} p-4`}>
                            <h3 className={`${feltHeading} mb-3 text-center`}>
                                Your Hand
                            </h3>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {myHand.map((card, idx) => (
                                    <div
                                        key={idx}
                                        className="animate-slideIn"
                                        style={{ animationDelay: `${idx * 50}ms` }}
                                    >
                                        <TrioCard
                                            value={card}
                                            faceUp={true}
                                            size="sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Desktop layout (2-column) */}
                <div className="hidden lg:grid lg:grid-cols-12 gap-3 h-full">
                    {/* Left/Center column: Turn reveals + Middle grid + Your Hand */}
                    <div className="lg:col-span-8 flex flex-col gap-2 min-h-0">
                        {/* Turn reveals - show action buttons */}
                        {currentTurn.reveals.length > 0 && (
                            <div className="shrink-0">
                                <TurnReveals
                                    reveals={currentTurn.reveals}
                                    players={players}
                                    canClaim={permissions.can_claim}
                                    canEndTurn={permissions.can_end_turn}
                                    canContinue={currentTurn.can_continue}
                                    onClaimTrio={handleClaimTrio}
                                    onEndTurn={handleEndTurn}
                                    compact={true}
                                    isProcessing={isClaimingTrio || isEndingTurn}
                                />
                            </div>
                        )}

                        {/* Middle grid - compact, not stretched */}
                        <div className={`${feltPanel} p-3 shrink-0`}>
                            <OpponentsAtTable players={players} currentPlayerId={currentPlayerId} reveals={currentTurn.reveals} />
                            <div className="flex justify-center">
                                <MiddleGrid
                                    cards={middleGrid}
                                    canReveal={permissions.can_reveal}
                                    onRevealCard={handleRevealMiddleCard}
                                    compact={true}
                                />
                            </div>
                        </div>

                        {/* Your Hand - horizontal below middle grid */}
                        <div className={`${feltPanel} p-3 shrink-0`}>
                            <h3 className={`${feltHeading} mb-2 text-center text-sm`}>
                                Your Hand
                            </h3>
                            {myHand && myHand.length > 0 ? (
                                <div className="flex flex-wrap gap-2 justify-center">
                                    {myHand.map((card, idx) => (
                                        <div
                                            key={idx}
                                            className="animate-slideIn"
                                            style={{ animationDelay: `${idx * 50}ms` }}
                                        >
                                            <TrioCard
                                                value={card}
                                                faceUp={true}
                                                size="sm"
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-emerald-100/80 text-sm py-2">
                                    No cards in hand
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right column: Players */}
                    <div className="lg:col-span-4 flex flex-col">
                        <div className="rounded-xl bg-white/75 backdrop-blur-md p-3 shadow-[0_10px_28px_rgba(0,0,0,0.45)] border border-white/50 flex-1 flex flex-col min-h-0">
                            <h3 className="font-bold text-slate-800 mb-2 text-sm shrink-0">Players</h3>
                            <div className="flex-1 overflow-y-auto">
                                <PlayerStats
                                    players={players}
                                    currentPlayerId={currentPlayerId}
                                    canReveal={permissions.can_reveal}
                                    onAskHighest={handleAskHighest}
                                    onAskLowest={handleAskLowest}
                                    compact={true}
                                    reveals={currentTurn.reveals}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

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
