import WaitingPhase from './WaitingPhase';
import PlayingPhase from './PlayingPhase';
import FinishedPhase from './FinishedPhase';

interface Player {
    id: number;
    nickname: string;
    avatar_color: string;
    is_host: boolean;
    is_connected: boolean;
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

interface TrioGameState {
    room: {
        room_code: string;
        status: 'waiting' | 'playing' | 'finished';
        current_turn_player_id: number;
        winner: string | null;
    };
    players: Player[];
    middle_grid: MiddleCard[];
    current_turn: CurrentTurn;
    permissions: Permissions;
}

interface TrioGameProps {
    gameState: TrioGameState | null;
    roomCode: string;
    gameSlug: string;
    players: Player[];
    isHost: boolean;
    currentPlayerId?: number;
    minPlayers: number;
    maxPlayers: number;
}

export default function TrioGame({
    gameState,
    roomCode,
    gameSlug,
    players,
    isHost,
    currentPlayerId,
    minPlayers,
    maxPlayers,
}: TrioGameProps) {
    const status = gameState?.room.status || 'waiting';

    // Render appropriate phase
    if (status === 'waiting') {
        return (
            <WaitingPhase
                roomCode={roomCode}
                gameSlug={gameSlug}
                players={players}
                isHost={isHost}
                minPlayers={minPlayers}
                maxPlayers={maxPlayers}
            />
        );
    }

    if (status === 'playing' && gameState) {
        return (
            <PlayingPhase
                roomCode={roomCode}
                gameSlug={gameSlug}
                players={gameState.players}
                middleGrid={gameState.middle_grid}
                currentTurn={gameState.current_turn}
                permissions={gameState.permissions}
                currentPlayerId={currentPlayerId}
            />
        );
    }

    if (status === 'finished' && gameState) {
        return (
            <FinishedPhase
                roomCode={roomCode}
                gameSlug={gameSlug}
                players={gameState.players}
                winner={gameState.room.winner}
            />
        );
    }

    // Fallback
    return (
        <div className="text-center text-gray-500 py-12">
            <p className="text-lg">Unknown game status: {status}</p>
        </div>
    );
}
