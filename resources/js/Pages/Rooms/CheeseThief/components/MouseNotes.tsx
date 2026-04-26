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

    // Don't pollute the results phase — at hour 9 every die is revealed by the
    // server, which would make the "peeked" list look like everyone was peeked.
    if (gameState.current_hour === 9) {
        return null;
    }

    return (
        <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50/80 p-3 shadow-sm">
            <div className="flex items-center gap-3">
                <DieDisplay value={me.die_value} size="md" />
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        Your wake hour
                    </span>
                    <span className="text-lg font-bold text-amber-900">
                        {me.die_value} AM
                    </span>
                </div>
            </div>

            {peeked.length > 0 && (
                <div className="mt-3 border-t border-amber-200 pt-2">
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                        {'\u{1F441}'} Peeked mice
                    </div>
                    <ul className="space-y-1">
                        {peeked.map((p) => (
                            <li
                                key={p.id}
                                className="flex items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 shadow-sm ring-1 ring-indigo-100"
                            >
                                <span className="truncate text-sm font-medium text-slate-800">
                                    {p.nickname}
                                </span>
                                <span className="flex items-center gap-2">
                                    <DieDisplay value={p.die_value!} size="sm" />
                                    <span className="text-xs font-semibold text-slate-700">
                                        {p.die_value} AM
                                    </span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
