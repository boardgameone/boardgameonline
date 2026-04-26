import { GameState } from '@/types';
import DieDisplay from './DieDisplay';

interface MouseNotesProps {
    gameState: GameState;
}

export default function MouseNotes({ gameState }: MouseNotesProps) {
    const me = gameState.players.find((p) => p.id === gameState.current_player_id);
    if (!me?.die_value) {
        return null;
    }

    if (gameState.current_hour === 9) {
        return null;
    }

    return (
        <div className="inline-flex items-center gap-3 rounded-2xl border border-amber-200/40 bg-amber-50/90 px-4 py-2 shadow-sm">
            <DieDisplay value={me.die_value} size="sm" />
            <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                    Your wake hour
                </span>
                <span className="text-base font-bold text-amber-900">
                    {me.die_value} AM
                </span>
            </div>
        </div>
    );
}
