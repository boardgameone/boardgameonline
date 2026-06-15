import { useMemo } from 'react';
import GameIcon from '@/Components/GameIcon';

interface Player {
    id: number;
    nickname: string;
    avatar_color: string;
    hand_count: number;
    trios_count: number;
    is_current_turn: boolean;
}

interface Reveal {
    value: number;
    source: string;
    reveal_type: string;
}

interface OpponentsAtTableProps {
    players: Player[];
    currentPlayerId?: number;
    reveals?: Reveal[];
}

/** A downward fan of face-down card backs — the hand an opponent is holding across the table. */
function CardBackFan({ count }: { count: number }) {
    if (count <= 0) {
        return null;
    }

    const width = 26;
    const sliver = 15; // visible edge of each overlapped card
    const step = Math.min(3.5, 30 / Math.max(count - 1, 1)); // total spread <= ~30deg

    return (
        <div className="flex items-start justify-center" aria-hidden>
            {Array.from({ length: count }).map((_, i) => (
                <img
                    key={i}
                    src="/images/trio/card-back.png"
                    alt=""
                    draggable={false}
                    className="select-none rounded-[3px] shadow-[0_3px_7px_rgba(0,0,0,0.5)]"
                    style={{
                        width,
                        marginLeft: i === 0 ? 0 : -(width - sliver),
                        transform: `rotate(${(i - (count - 1) / 2) * step}deg)`,
                        transformOrigin: 'top center',
                        zIndex: i,
                    }}
                />
            ))}
        </div>
    );
}

function OpponentSeat({ player, count }: { player: Player; count: number }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <div
                className={`flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-0.5 backdrop-blur-sm ${
                    player.is_current_turn ? 'bg-yellow-300/90 ring-2 ring-yellow-400' : 'bg-black/35'
                }`}
            >
                <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-white text-xs font-bold shadow"
                    style={{ backgroundColor: player.avatar_color }}
                >
                    {player.nickname.charAt(0).toUpperCase()}
                </div>
                <span
                    className={`text-sm font-bold ${
                        player.is_current_turn ? 'text-yellow-900' : 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                    }`}
                >
                    {player.nickname}
                </span>
                <span
                    className={`flex items-center gap-0.5 text-xs font-semibold ${
                        player.is_current_turn ? 'text-yellow-900' : 'text-yellow-200'
                    }`}
                >
                    <GameIcon name="trophy" size="sm" /> {player.trios_count}
                </span>
            </div>
            <CardBackFan count={count} />
        </div>
    );
}

/** Seats the other players across the top of the table, each holding their face-down hand. */
export default function OpponentsAtTable({ players, currentPlayerId, reveals = [] }: OpponentsAtTableProps) {
    const revealedByPlayer = useMemo(
        () =>
            reveals.reduce(
                (acc, reveal) => {
                    const match = reveal.source.match(/^player_(\d+)$/);
                    if (match) {
                        const id = parseInt(match[1], 10);
                        acc[id] = (acc[id] || 0) + 1;
                    }
                    return acc;
                },
                {} as Record<number, number>,
            ),
        [reveals],
    );

    const opponents = players.filter((p) => p.id !== currentPlayerId);
    if (opponents.length === 0) {
        return null;
    }

    return (
        <div className="mb-3 flex flex-wrap items-start justify-center gap-x-6 gap-y-3 sm:gap-x-10">
            {opponents.map((player) => (
                <OpponentSeat
                    key={player.id}
                    player={player}
                    count={player.hand_count - (revealedByPlayer[player.id] || 0)}
                />
            ))}
        </div>
    );
}
