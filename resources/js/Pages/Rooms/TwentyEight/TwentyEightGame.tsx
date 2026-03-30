import { TwentyEightGameState, TwentyEightPlayer } from '@/types';
import WaitingPhase from './WaitingPhase';
import BiddingPhase from './BiddingPhase';
import TrumpSelectionPhase from './TrumpSelectionPhase';
import PlayingPhase from './PlayingPhase';
import RoundEndPhase from './RoundEndPhase';
import GameOverPhase from './GameOverPhase';

interface TwentyEightGameProps {
    gameState: TwentyEightGameState | null;
    roomCode: string;
    gameSlug: string;
    players: TwentyEightPlayer[];
    isHost: boolean;
    currentPlayerId?: number;
    minPlayers: number;
    maxPlayers: number;
}

export default function TwentyEightGame({
    gameState,
    roomCode,
    gameSlug,
    players,
    isHost,
    currentPlayerId,
    minPlayers,
    maxPlayers,
}: TwentyEightGameProps) {
    const phase = gameState?.phase;

    // Waiting state (no game state yet)
    if (!gameState || !phase) {
        return (
            <WaitingPhase
                roomCode={roomCode}
                gameSlug={gameSlug}
                players={players}
                isHost={isHost}
                currentPlayerId={currentPlayerId}
                minPlayers={minPlayers}
                maxPlayers={maxPlayers}
            />
        );
    }

    return (
        <div className="relative h-full">
            {phase === 'bidding' && (
                <BiddingPhase
                    gameState={gameState}
                    roomCode={roomCode}
                    gameSlug={gameSlug}
                    currentPlayerId={currentPlayerId}
                />
            )}

            {phase === 'trump_selection' && (
                <TrumpSelectionPhase
                    gameState={gameState}
                    roomCode={roomCode}
                    gameSlug={gameSlug}
                    currentPlayerId={currentPlayerId}
                />
            )}

            {phase === 'playing' && (
                <PlayingPhase
                    gameState={gameState}
                    roomCode={roomCode}
                    gameSlug={gameSlug}
                    currentPlayerId={currentPlayerId}
                />
            )}

            {phase === 'round_end' && (
                <RoundEndPhase
                    gameState={gameState}
                    roomCode={roomCode}
                    gameSlug={gameSlug}
                    isHost={isHost}
                />
            )}

            {phase === 'game_over' && (
                <GameOverPhase
                    gameState={gameState}
                    roomCode={roomCode}
                    gameSlug={gameSlug}
                    isHost={isHost}
                    currentPlayerId={currentPlayerId}
                />
            )}
        </div>
    );
}
