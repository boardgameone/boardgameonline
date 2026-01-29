import { GameState } from '@/types';
import RollingPhase from './RollingPhase';
import NightPhase from './NightPhase';
import AccomplicePhase from './AccomplicePhase';
import VotingPhase from './VotingPhase';
import ResultsPhase from './ResultsPhase';
import SoundToggle from './components/SoundToggle';

interface CheeseThiefGameProps {
    gameState: GameState;
    roomCode: string;
    gameSlug: string;
}

export default function CheeseThiefGame({ gameState, roomCode, gameSlug }: CheeseThiefGameProps) {
    const { current_hour } = gameState;

    // Route to the correct phase component based on current_hour
    // 0 = Rolling, 1-6 = Night, 7 = Accomplice, 8 = Voting, 9 = Results
    const renderPhase = () => {
        if (current_hour === 0) {
            return <RollingPhase gameState={gameState} roomCode={roomCode} gameSlug={gameSlug} />;
        }

        if (current_hour >= 1 && current_hour <= 6) {
            return <NightPhase gameState={gameState} roomCode={roomCode} gameSlug={gameSlug} />;
        }

        if (current_hour === 7) {
            return <AccomplicePhase gameState={gameState} roomCode={roomCode} gameSlug={gameSlug} />;
        }

        if (current_hour === 8) {
            return <VotingPhase gameState={gameState} roomCode={roomCode} gameSlug={gameSlug} />;
        }

        if (current_hour === 9) {
            return <ResultsPhase gameState={gameState} roomCode={roomCode} gameSlug={gameSlug} />;
        }

        // Fallback
        return (
            <div className="text-center text-gray-500">
                Unknown game phase: {current_hour}
            </div>
        );
    };

    return (
        <div className="mx-auto max-w-2xl p-6">
            <div className="flex justify-end mb-4">
                <SoundToggle />
            </div>
            {renderPhase()}
        </div>
    );
}
