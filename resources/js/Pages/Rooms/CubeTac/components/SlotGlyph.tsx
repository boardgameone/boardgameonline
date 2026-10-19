/**
 * 2D twin of the 3D `MarkGlyph` set (X, O, △, ▢, ✚, ⬡) for HUD chips,
 * badges and pickers. Drawn as SVG on one 24×24 grid with matched stroke
 * weights, so every glyph reads at the same size, unlike the Unicode
 * characters this replaces, whose sizes vary wildly from font to font.
 */

interface SlotGlyphProps {
    /** Design index 0..5. Anything else renders a question mark. */
    design: number | null;
    className?: string;
    title?: string;
}

const OUTLINE = 2.6;
const BAR = 3.4;

export default function SlotGlyph({ design, className = 'h-4 w-4', title }: SlotGlyphProps) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            role={title ? 'img' : undefined}
            aria-hidden={title ? undefined : true}
            aria-label={title}
        >
            {glyphPath(design)}
        </svg>
    );
}

function glyphPath(design: number | null) {
    switch (design) {
        case 0:
            return <path strokeWidth={BAR} d="M6.5 6.5l11 11M17.5 6.5l-11 11" />;
        case 1:
            return <circle strokeWidth={OUTLINE} cx="12" cy="12" r="6.8" />;
        case 2:
            return <path strokeWidth={OUTLINE} d="M12 4.6l7.6 13.6H4.4z" />;
        case 3:
            return <rect strokeWidth={OUTLINE} x="5.6" y="5.6" width="12.8" height="12.8" rx="1.6" />;
        case 4:
            return <path strokeWidth={BAR} d="M12 5v14M5 12h14" />;
        case 5:
            return <path strokeWidth={OUTLINE} d="M12 4.4l6.6 3.8v7.6L12 19.6l-6.6-3.8V8.2z" />;
        default:
            return (
                <path
                    strokeWidth={OUTLINE}
                    d="M9.2 9.4a2.9 2.9 0 115 2c-.9.8-2.2 1.3-2.2 2.8M12 17.6h.01"
                />
            );
    }
}
