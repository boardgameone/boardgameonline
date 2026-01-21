import { GameState, GameStatePlayer } from '@/types';
import { router } from '@inertiajs/react';
import { useState } from 'react';
import PlayerCircle from './components/PlayerCircle';

interface VotingPhaseProps {
    gameState: GameState;
    roomCode: string;
}

export default function VotingPhase({ gameState, roomCode }: VotingPhaseProps) {
    const [selectedPlayer, setSelectedPlayer] = useState<GameStatePlayer | null>(null);

    const currentPlayer = gameState.players.find((p) => p.id === gameState.current_player_id);
    const canVote = gameState.can_vote;
    const hasVoted = currentPlayer?.has_voted ?? false;

    // Players you can vote for (everyone except yourself)
    const votablePlayerIds = gameState.players
        .filter((p) => p.id !== gameState.current_player_id)
        .map((p) => p.id);

    const handleVote = () => {
        if (selectedPlayer) {
            router.post(route('rooms.vote', roomCode), {
                voted_for_player_id: selectedPlayer.id,
            });
        }
    };

    const handlePlayerClick = (player: GameStatePlayer) => {
        if (canVote && player.id !== gameState.current_player_id) {
            setSelectedPlayer(player);
        }
    };

    return (
        <div className="flex flex-col items-center gap-6">
            {/* Header */}
            <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">
                    {'\u{1F5F3}'} Time to Vote!
                </h2>
                <p className="mt-2 text-gray-600">
                    Who do you think is the thief?
                </p>
            </div>

            {/* Cheese Stolen Alert */}
            {gameState.cheese_stolen && (
                <div className="rounded-lg bg-yellow-100 px-6 py-3 text-yellow-800">
                    {'\u{1F9C0}'} <strong>The cheese was stolen!</strong> The thief was caught peeking!
                </div>
            )}

            {/* Your Role Reminder */}
            <div className={`
                rounded-2xl p-4 text-center
                ${gameState.is_thief ? 'bg-red-50 border-2 border-red-200' : 'bg-blue-50 border-2 border-blue-200'}
            `}>
                {gameState.is_thief ? (
                    <p className="text-red-700">
                        {'\u{1F977}'} You are the <strong>thief</strong>. Try to avoid suspicion!
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

            {/* Voting Status */}
            {hasVoted ? (
                <div className="rounded-xl bg-green-100 px-6 py-4 text-green-700">
                    {'\u2713'} You have voted! Waiting for others...
                </div>
            ) : (
                <div className="text-gray-600">
                    Click on a player to vote for them
                </div>
            )}

            {/* Players */}
            <div className="w-full">
                <h3 className="mb-4 text-center text-lg font-semibold text-gray-700">
                    {canVote ? 'Vote for the suspected thief:' : 'Players'}
                </h3>
                <PlayerCircle
                    players={gameState.players}
                    currentPlayerId={gameState.current_player_id}
                    awakePlayerIds={[]}
                    currentHour={gameState.current_hour}
                    onPlayerClick={handlePlayerClick}
                    clickablePlayerIds={canVote ? votablePlayerIds : []}
                    showDice={true}
                />
            </div>

            {/* Vote Confirmation */}
            {canVote && selectedPlayer && (
                <div className="flex flex-col items-center gap-3">
                    <p className="text-gray-600">
                        Vote for <strong>{selectedPlayer.nickname}</strong> as the thief?
                    </p>
                    <button
                        onClick={handleVote}
                        className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white hover:bg-indigo-700"
                    >
                        {'\u{1F5F3}'} Cast Vote
                    </button>
                </div>
            )}

            {/* Vote Progress */}
            <div className="text-center text-gray-600">
                <p>
                    Votes cast: <strong>{gameState.total_votes_cast}/{gameState.total_players}</strong>
                </p>
            </div>
        </div>
    );
}
