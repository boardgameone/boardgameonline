import {
    CircleGrid,
    DiagonalLines,
    DiamondGrid,
    CrossPattern,
    DotsScattered,
    VerticalStripes,
    ChevronPattern,
    ConcentricCircles,
    SquareGrid,
    StarBurst,
    WavePattern,
    HexagonGrid,
} from './patterns';

interface CardPatternProps {
    cardValue: number;
    patternColor: string;
}

export function CardPattern({ cardValue, patternColor }: CardPatternProps) {
    return (
        <svg
            className="absolute inset-0 w-full h-full opacity-25"
            viewBox="0 0 200 200"
            preserveAspectRatio="xMidYMid slice"
        >
            {cardValue === 1 && <CircleGrid color={patternColor} />}
            {cardValue === 2 && <DiagonalLines color={patternColor} />}
            {cardValue === 3 && <DiamondGrid color={patternColor} />}
            {cardValue === 4 && <CrossPattern color={patternColor} />}
            {cardValue === 5 && <DotsScattered color={patternColor} />}
            {cardValue === 6 && <VerticalStripes color={patternColor} />}
            {cardValue === 7 && <ChevronPattern color={patternColor} />}
            {cardValue === 8 && <ConcentricCircles color={patternColor} />}
            {cardValue === 9 && <SquareGrid color={patternColor} />}
            {cardValue === 10 && <StarBurst color={patternColor} />}
            {cardValue === 11 && <WavePattern color={patternColor} />}
            {cardValue === 12 && <HexagonGrid color={patternColor} />}
        </svg>
    );
}
