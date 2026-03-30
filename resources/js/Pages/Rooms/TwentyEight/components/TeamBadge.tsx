interface TeamBadgeProps {
    team: 'team_a' | 'team_b' | null;
    size?: 'sm' | 'md';
}

export default function TeamBadge({ team, size = 'sm' }: TeamBadgeProps) {
    if (!team) return null;

    const isTeamA = team === 'team_a';
    const sizeClasses = size === 'sm' ? 'text-[0.6rem] px-1.5 py-0.5' : 'text-xs px-2 py-1';

    return (
        <span className={`${sizeClasses} rounded-full font-bold ${
            isTeamA
                ? 'bg-blue-100 text-blue-700 border border-blue-300'
                : 'bg-rose-100 text-rose-700 border border-rose-300'
        }`}>
            {isTeamA ? 'Team A' : 'Team B'}
        </span>
    );
}
