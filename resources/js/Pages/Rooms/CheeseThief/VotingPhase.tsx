import { GameState, GameStatePlayer } from '@/types';
import { router } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { useSound, useRandomSound } from '@/hooks/useSound';
import GameTable from './components/GameTable';
import MouseNotes from './components/MouseNotes';

interface VotingPhaseProps {
    gameState: GameState;
    roomCode: string;
    gameSlug: string;
}

export default function VotingPhase({ gameState, roomCode, gameSlug }: VotingPhaseProps) {
    const [selectedPlayer, setSelectedPlayer] = useState<GameStatePlayer | null>(null);
    const [isVoting, setIsVoting] = useState(false);

    const currentPlayer = gameState.players.find((p) => p.id === gameState.current_player_id);
    const canVote = gameState.can_vote;
    const hasVoted = currentPlayer?.has_voted ?? false;

    const { play: playChatter, stop: stopChatter } = useSound('/sounds/cheese-thief/voting-chatter.mp3', {
        volume: 0.3,
        loop: true,
    });
    const { playRandom: playSqueak } = useRandomSound(
        [
            '/sounds/cheese-thief/mouse-squeak-1.mp3',
            '/sounds/cheese-thief/mouse-squeak-2.mp3',
            '/sounds/cheese-thief/mouse-squeak-3.mp3',
        ],
        { volume: 0.6 },
    );

    useEffect(() => {
        playChatter();
        return () => stopChatter();
    }, []);

    const votablePlayerIds = canVote
        ? gameState.players
            .filter((p) => p.id !== gameState.current_player_id)
            .map((p) => p.id)
        : [];

    const handleVote = () => {
        if (!selectedPlayer || isVoting) {
            return;
        }
        playSqueak();
        router.post(
            route('rooms.vote', [gameSlug, roomCode]),
            { voted_for_player_id: selectedPlayer.id },
            {
                onStart: () => setIsVoting(true),
                onFinish: () => setIsVoting(false),
                onSuccess: () => setSelectedPlayer(null),
            },
        );
    };

    const handlePlayerClick = (player: GameStatePlayer) => {
        if (canVote && player.id !== gameState.current_player_id) {
            setSelectedPlayer(player);
        }
    };

    return (
        <div className="flex flex-col items-center gap-5 pb-28">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-100">
                    {'\u{1F5F3}'} Time to Vote
                </h2>
                <p className="mt-2 text-slate-300">Who do you think is the thief?</p>
            </div>

            {gameState.cheese_stolen && (
                <div className="rounded-lg bg-yellow-100 px-6 py-3 text-yellow-800">
                    🧀 <strong>The cheese was stolen during the night.</strong>
                </div>
            )}

            <div
                className={`
                    rounded-2xl p-4 text-center
                    ${gameState.is_thief
                        ? 'bg-red-50 border-2 border-red-200'
                        : gameState.is_accomplice
                            ? 'bg-orange-50 border-2 border-orange-200'
                            : 'bg-blue-50 border-2 border-blue-200'}
                `}
            >
                {gameState.is_thief ? (
                    <p className="text-red-700">
                        {'\u{1F977}'} You are the <strong>thief</strong>. Avoid suspicion!
                    </p>
                ) : gameState.is_accomplice ? (
                    <p className="text-orange-700">
                        {'\u{1F91D}'} You are the <strong>accomplice</strong>. Help the thief escape!
                    </p>
                ) : (
                    <p className="text-blue-700">
                        {'\u{1F401}'} You are an <strong>innocent mouse</strong>. Find the thief!
                    </p>
                )}
            </div>

            {hasVoted ? (
                <div className="rounded-xl bg-emerald-100 px-6 py-3 text-emerald-700 ring-1 ring-emerald-300">
                    ✓ You have voted. Waiting for others…
                </div>
            ) : (
                <p className="text-slate-300 text-sm">Tap a glowing mouse to cast your vote.</p>
            )}

            <MouseNotes gameState={gameState} />

            <GameTable
                players={gameState.players}
                currentPlayerId={gameState.current_player_id}
                awakePlayerIds={[]}
                currentHour={gameState.current_hour}
                onPlayerClick={handlePlayerClick}
                clickablePlayerIds={votablePlayerIds}
                selectedPlayerId={selectedPlayer?.id ?? null}
                showDice={true}
            >
                <div className="flex flex-col items-center justify-center gap-2 rounded-3xl bg-slate-900/70 px-5 py-4 text-center shadow-inner ring-1 ring-indigo-300/20">
                    <span className="text-3xl">{'\u{1F5F3}'}</span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-200/85">
                        Cast Your Vote
                    </span>
                    <span className="text-xs text-slate-300">
                        {gameState.total_votes_cast}/{gameState.total_players} voted
                    </span>
                </div>
            </GameTable>

            <div
                className={`
                    pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4
                    transition-[transform,opacity] duration-300 ease-out
                    ${canVote && selectedPlayer ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
                `}
            >
                <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-indigo-600/95 px-4 py-3 shadow-2xl ring-1 ring-indigo-300/60 backdrop-blur">
                    <span className="text-sm font-semibold text-white">
                        Vote for <strong>{selectedPlayer?.nickname ?? '...'}</strong>?
                    </span>
                    <button
                        onClick={handleVote}
                        disabled={isVoting || !selectedPlayer}
                        className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-indigo-700 shadow hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isVoting ? 'Voting…' : `${'\u{1F5F3}'} Cast Vote`}
                    </button>
                    <button
                        onClick={() => setSelectedPlayer(null)}
                        disabled={isVoting}
                        className="text-xs text-indigo-100 underline disabled:opacity-60"
                    >
                        cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
