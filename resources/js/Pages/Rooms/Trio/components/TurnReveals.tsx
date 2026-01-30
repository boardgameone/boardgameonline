import { useEffect, useRef, useState } from 'react';
import TrioCard from './TrioCard';
import GameIcon from '@/Components/GameIcon';

interface Reveal {
    value: number;
    source: string;
    reveal_type: string;
}

interface Player {
    id: number;
    nickname: string;
}

interface TurnRevealsProps {
    reveals: Reveal[];
    players: Player[];
    canClaim: boolean;
    canEndTurn: boolean;
    canContinue: boolean;
    onClaimTrio: () => void;
    onEndTurn: () => void;
    compact?: boolean;
}

export default function TurnReveals({
    reveals,
    players,
    canClaim,
    canEndTurn,
    canContinue,
    onClaimTrio,
    onEndTurn,
    compact = false,
}: TurnRevealsProps) {
    const [autoActionCountdown, setAutoActionCountdown] = useState<number | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const actionTriggeredRef = useRef(false);

    // Auto-trigger Claim Trio or End Turn after 1 second when they're the only option
    useEffect(() => {
        const shouldAutoClaimTrio = canClaim;
        const shouldAutoEndTurn = canEndTurn && !canContinue;

        if ((shouldAutoClaimTrio || shouldAutoEndTurn) && !actionTriggeredRef.current) {
            setAutoActionCountdown(1);

            timerRef.current = setTimeout(() => {
                actionTriggeredRef.current = true;
                if (shouldAutoClaimTrio) {
                    onClaimTrio();
                } else if (shouldAutoEndTurn) {
                    onEndTurn();
                }
            }, 1000);
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
            setAutoActionCountdown(null);
        };
    }, [canClaim, canEndTurn, canContinue, onClaimTrio, onEndTurn]);

    // Reset the action triggered flag when reveals change (new turn started)
    useEffect(() => {
        actionTriggeredRef.current = false;
    }, [reveals.length]);

    if (reveals.length === 0) {
        return null;
    }

    const getRevealSource = (reveal: Reveal, showFull: boolean = false) => {
        if (reveal.source.startsWith('player_')) {
            const playerId = parseInt(reveal.source.replace('player_', ''));
            const player = players.find(p => p.id === playerId);
            const revealLabel = reveal.reveal_type === 'ask_highest' ? 'High' : 'Low';
            if (showFull || !compact) {
                return `${revealLabel}: ${player?.nickname || 'Unknown'}`;
            }
            return revealLabel.charAt(0);
        }
        return showFull || !compact ? 'Middle' : 'M';
    };

    const isTrioValid = reveals.length === 3;

    if (compact) {
        return (
            <div className={`rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 shadow-lg border-2 ${isTrioValid && canClaim ? 'border-green-500' : 'border-amber-300'} animate-slideIn`}>
                <div className="p-3">
                    {/* Title */}
                    <h3 className="font-bold text-amber-900 text-sm mb-2 flex items-center gap-2">
                        <span>Current Reveals</span>
                        {isTrioValid && canClaim && (
                            <GameIcon name="sparkles" size="sm" className="text-green-600 animate-pulse" />
                        )}
                    </h3>

                    <div className="flex items-center gap-4">
                        {/* Cards display inline */}
                        <div className="flex gap-3 flex-1">
                            {reveals.map((reveal, idx) => (
                                <div
                                    key={idx}
                                    className="flex flex-col items-center animate-slideIn"
                                    style={{ animationDelay: `${idx * 100}ms` }}
                                >
                                    <TrioCard
                                        value={reveal.value}
                                        faceUp={true}
                                        size="sm"
                                    />
                                    <span className="text-xs text-amber-700 mt-1 font-medium text-center">
                                        {getRevealSource(reveal, true)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                            {canClaim && (
                                <button
                                    onClick={onClaimTrio}
                                    className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-4 py-2 text-white text-sm font-bold shadow hover:from-green-600 hover:to-green-700 transition-all duration-200 hover:scale-105 active:scale-95 relative overflow-hidden"
                                >
                                    {autoActionCountdown !== null && (
                                        <span className="absolute inset-0 bg-green-400 opacity-30 animate-pulse" />
                                    )}
                                    <span className="relative">
                                        <GameIcon name="party" size="sm" className="inline-block mr-1" />
                                        Claim!{autoActionCountdown !== null && ' (auto)'}
                                    </span>
                                </button>
                            )}
                            {canEndTurn && !canContinue && (
                                <button
                                    onClick={onEndTurn}
                                    className="rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-4 py-2 text-white text-sm font-bold shadow hover:from-red-600 hover:to-red-700 transition-all duration-200 hover:scale-105 active:scale-95 relative overflow-hidden"
                                >
                                    {autoActionCountdown !== null && (
                                        <span className="absolute inset-0 bg-red-400 opacity-30 animate-pulse" />
                                    )}
                                    <span className="relative">
                                        <GameIcon name="x" size="sm" className="inline-block mr-1" />
                                        End{autoActionCountdown !== null && ' (auto)'}
                                    </span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
                {!canContinue && reveals.length > 0 && !canClaim && (
                    <p className="px-3 pb-2 text-xs text-red-600 font-medium">
                        No match - end turn
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className={`rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-lg border-2 ${isTrioValid && canClaim ? 'border-green-500' : 'border-amber-300'} animate-slideIn`}>
            <h3 className="font-bold text-amber-900 mb-4 flex items-center gap-2">
                <span>Current Turn Reveals</span>
                {isTrioValid && canClaim && (
                    <GameIcon name="sparkles" size="sm" className="text-green-600 animate-pulse" />
                )}
            </h3>

            {/* Horizontal scrollable cards */}
            <div className="flex gap-4 overflow-x-auto pb-2 mb-4">
                {reveals.map((reveal, idx) => (
                    <div
                        key={idx}
                        className="flex flex-col items-center flex-shrink-0 animate-slideIn"
                        style={{ animationDelay: `${idx * 100}ms` }}
                    >
                        <TrioCard
                            value={reveal.value}
                            faceUp={true}
                            size="sm"
                        />
                        <span className="text-xs text-amber-700 mt-2 text-center max-w-[100px] font-medium">
                            {getRevealSource(reveal)}
                        </span>
                    </div>
                ))}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
                {canClaim && (
                    <button
                        onClick={onClaimTrio}
                        className="flex-1 rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-6 py-3 text-white font-bold shadow-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 hover:scale-105 active:scale-95 border-b-4 border-green-700 relative overflow-hidden"
                    >
                        {autoActionCountdown !== null && (
                            <span className="absolute inset-0 bg-green-400 opacity-30 animate-pulse" />
                        )}
                        <span className="relative">
                            <GameIcon name="party" className="inline-block mr-1" />
                            Claim Trio!{autoActionCountdown !== null && ' (auto)'}
                        </span>
                    </button>
                )}
                {canEndTurn && !canContinue && (
                    <button
                        onClick={onEndTurn}
                        className="flex-1 rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-6 py-3 text-white font-bold shadow-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 hover:scale-105 active:scale-95 border-b-4 border-red-700 animate-shake relative overflow-hidden"
                    >
                        {autoActionCountdown !== null && (
                            <span className="absolute inset-0 bg-red-400 opacity-30 animate-pulse" />
                        )}
                        <span className="relative">
                            <GameIcon name="x" className="inline-block mr-1" />
                            End Turn{autoActionCountdown !== null && ' (auto)'}
                        </span>
                    </button>
                )}
            </div>

            {!canContinue && reveals.length > 0 && !canClaim && (
                <p className="mt-3 text-sm text-red-600 font-medium text-center">
                    Cards don't match - end your turn
                </p>
            )}
        </div>
    );
}
