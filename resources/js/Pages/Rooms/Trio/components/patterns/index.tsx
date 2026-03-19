// Simple geometric SVG patterns for Trio cards

interface PatternProps {
    color: string;
}

export function CircleGrid({ color }: PatternProps) {
    return (
        <>
            {[0, 1, 2, 3].map((row) =>
                [0, 1, 2, 3].map((col) => (
                    <circle
                        key={`${row}-${col}`}
                        cx={25 + col * 50}
                        cy={25 + row * 50}
                        r="15"
                        fill={color}
                    />
                ))
            )}
        </>
    );
}

export function DiagonalLines({ color }: PatternProps) {
    return (
        <>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <line
                    key={i}
                    x1={i * 30 - 50}
                    y1="0"
                    x2={i * 30 + 150}
                    y2="200"
                    stroke={color}
                    strokeWidth="8"
                />
            ))}
        </>
    );
}

export function DiamondGrid({ color }: PatternProps) {
    return (
        <>
            {[0, 1, 2].map((row) =>
                [0, 1, 2, 3].map((col) => (
                    <polygon
                        key={`${row}-${col}`}
                        points={`${50 + col * 50},${20 + row * 60} ${70 + col * 50},${40 + row * 60} ${50 + col * 50},${60 + row * 60} ${30 + col * 50},${40 + row * 60}`}
                        fill={color}
                    />
                ))
            )}
        </>
    );
}

export function CrossPattern({ color }: PatternProps) {
    return (
        <>
            {[0, 1, 2].map((row) =>
                [0, 1, 2, 3].map((col) => (
                    <g key={`${row}-${col}`}>
                        <line
                            x1={35 + col * 50}
                            y1={30 + row * 60}
                            x2={65 + col * 50}
                            y2={30 + row * 60}
                            stroke={color}
                            strokeWidth="6"
                        />
                        <line
                            x1={50 + col * 50}
                            y1={15 + row * 60}
                            x2={50 + col * 50}
                            y2={45 + row * 60}
                            stroke={color}
                            strokeWidth="6"
                        />
                    </g>
                ))
            )}
        </>
    );
}

export function DotsScattered({ color }: PatternProps) {
    const dots = [
        [20, 15], [80, 25], [140, 20], [180, 35],
        [35, 55], [110, 65], [165, 55], [50, 45],
        [25, 95], [95, 105], [155, 95], [70, 85],
        [40, 135], [120, 145], [175, 135], [85, 125],
        [15, 175], [105, 185], [160, 175], [55, 165]
    ];

    return (
        <>
            {dots.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r="8" fill={color} />
            ))}
        </>
    );
}

export function VerticalStripes({ color }: PatternProps) {
    return (
        <>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <rect
                    key={i}
                    x={i * 30}
                    y="0"
                    width="12"
                    height="200"
                    fill={color}
                />
            ))}
        </>
    );
}

export function ChevronPattern({ color }: PatternProps) {
    return (
        <>
            {[0, 1, 2, 3, 4].map((i) => (
                <polyline
                    key={i}
                    points={`0,${i * 40} 100,${20 + i * 40} 200,${i * 40}`}
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                />
            ))}
        </>
    );
}

export function ConcentricCircles({ color }: PatternProps) {
    return (
        <>
            {[20, 40, 60, 80, 100].map((r) => (
                <circle
                    key={r}
                    cx="100"
                    cy="100"
                    r={r}
                    fill="none"
                    stroke={color}
                    strokeWidth="6"
                />
            ))}
        </>
    );
}

export function SquareGrid({ color }: PatternProps) {
    return (
        <>
            {[0, 1, 2, 3].map((row) =>
                [0, 1, 2, 3].map((col) => (
                    <rect
                        key={`${row}-${col}`}
                        x={10 + col * 50}
                        y={10 + row * 50}
                        width="30"
                        height="30"
                        fill={color}
                    />
                ))
            )}
        </>
    );
}

export function StarBurst({ color }: PatternProps) {
    return (
        <>
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle) => {
                const rad = (angle * Math.PI) / 180;
                const x2 = 100 + Math.cos(rad) * 90;
                const y2 = 100 + Math.sin(rad) * 90;
                return (
                    <line
                        key={angle}
                        x1="100"
                        y1="100"
                        x2={x2}
                        y2={y2}
                        stroke={color}
                        strokeWidth="5"
                    />
                );
            })}
        </>
    );
}

export function WavePattern({ color }: PatternProps) {
    return (
        <>
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <path
                    key={i}
                    d={`M 0 ${20 + i * 30} Q 50 ${10 + i * 30} 100 ${20 + i * 30} T 200 ${20 + i * 30}`}
                    fill="none"
                    stroke={color}
                    strokeWidth="6"
                />
            ))}
        </>
    );
}

export function HexagonGrid({ color }: PatternProps) {
    const hexPoints = (cx: number, cy: number, size: number) => {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = cx + size * Math.cos(angle);
            const y = cy + size * Math.sin(angle);
            points.push(`${x},${y}`);
        }
        return points.join(' ');
    };

    return (
        <>
            {[0, 1, 2].map((row) =>
                [0, 1, 2, 3].map((col) => (
                    <polygon
                        key={`${row}-${col}`}
                        points={hexPoints(
                            30 + col * 50 + (row % 2) * 25,
                            30 + row * 45,
                            18
                        )}
                        fill={color}
                    />
                ))
            )}
        </>
    );
}
