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

    // Anyone other than you whose die value is now revealed = peeked.
    const peeked = gameState.players.filter(
        (p) => p.id !== me.id && p.die_value !== null && p.die_value !== undefined,
    );

    return (
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50/80 p-3 shadow-sm">
            <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                    Your hour
                </span>
                <DieDisplay value={me.die_value} size="sm" />
                <span className="text-sm font-semibold text-amber-900">
                    {me.die_value} AM
                </span>
            </div>

            {peeked.length > 0 && (
                <div className="mt-3 border-t border-amber-200 pt-2">
                    <div className="mb-1 text-xs font-bold uppercase tracking-wider text-indigo-700">
                        {'\u{1F441}'} Peeked
                    </div>
                    <ul className="space-y-1">
                        {peeked.map((p) => (
                            <li
                                key={p.id}
                                className="flex items-center justify-between rounded bg-white px-2 py-1 text-sm shadow-sm"
                            >
                                <span className="truncate font-medium text-slate-800">
                                    {p.nickname}
                                </span>
                                <span className="flex items-center gap-2">
                                    <DieDisplay value={p.die_value!} size="sm" />
                                    <span className="text-xs text-slate-600">{p.die_value} AM</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
