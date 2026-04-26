/**
 * MarkGlyph — six 3D extruded glyph shapes (X, O, △, ▢, ✚, ⬡) used to
 * render a player's mark on a sticker / piece. Shared between CubeScene
 * (regular Rubik's-style board) and MegaminxScene (dodecahedral board).
 *
 * The cube uses fill-color = glow-color so the glyph reads as a single
 * saturated, self-lit shape on a near-white sticker. The megaminx renders
 * dark fill on a player-colored piece for contrast and passes the player
 * color in `glowColor` to keep the same emissive "pop".
 */

import * as THREE from 'three';
import { useMemo } from 'react';

// Sticker half-width that the glyph geometries below were tuned for.
// Megaminx pieces have varying radii — divide a piece's radius by this
// constant to get the local scale that matches the cube's glyph fit.
export const GLYPH_REFERENCE_HALF_WIDTH = 0.42;

const GLYPH_OFFSET = 0.06;

interface MarkGlyphProps {
    design: number;
    color: string;
    opacity?: number;
    glowColor?: string;
}

export default function MarkGlyph({ design, color, opacity = 1, glowColor }: MarkGlyphProps) {
    switch (design) {
        case 0: return <XGlyph color={color} opacity={opacity} glowColor={glowColor} />;
        case 1: return <OGlyph color={color} opacity={opacity} glowColor={glowColor} />;
        case 2: return <TriangleGlyph color={color} opacity={opacity} glowColor={glowColor} />;
        case 3: return <SquareGlyph color={color} opacity={opacity} glowColor={glowColor} />;
        case 4: return <PlusGlyph color={color} opacity={opacity} glowColor={glowColor} />;
        case 5: return <HexagonGlyph color={color} opacity={opacity} glowColor={glowColor} />;
        default: return null;
    }
}

interface ShapeProps {
    color: string;
    opacity: number;
    glowColor?: string;
}

/**
 * Saturated base color with a strong self-lit halo. `glowColor` lets the
 * caller decouple emissive from fill — useful when the glyph fill must
 * stay dark for contrast (Megaminx) but the halo should still match the
 * player's color.
 */
function glyphMaterial(color: string, opacity = 1, glowColor: string = color) {
    const isTransparent = opacity < 1;
    return (
        <meshStandardMaterial
            color={color}
            emissive={glowColor}
            emissiveIntensity={isTransparent ? 0.8 : 1.15}
            metalness={0.15}
            roughness={0.22}
            toneMapped={false}
            transparent={isTransparent}
            opacity={opacity}
        />
    );
}

// Plus-sign outline used by both XGlyph (rotated 45°) and PlusGlyph (un-rotated).
// Built as a single 12-point polygon so the glyph is one mesh — two overlapping
// transparent meshes at the same depth produced an unstable alpha sort, which
// made the intersection appear to flicker while the mark was pending.
function createPlusShape(): THREE.Shape {
    const L = 0.36; // half-length of each bar
    const T = 0.08; // half-thickness of each bar
    const s = new THREE.Shape();
    s.moveTo(L, -T);
    s.lineTo(L, T);
    s.lineTo(T, T);
    s.lineTo(T, L);
    s.lineTo(-T, L);
    s.lineTo(-T, T);
    s.lineTo(-L, T);
    s.lineTo(-L, -T);
    s.lineTo(-T, -T);
    s.lineTo(-T, -L);
    s.lineTo(T, -L);
    s.lineTo(T, -T);
    s.closePath();
    return s;
}

function XGlyph({ color, opacity, glowColor }: ShapeProps) {
    const shape = useMemo(createPlusShape, []);
    return (
        <mesh position={[0, 0, GLYPH_OFFSET - 0.05]} rotation={[0, 0, Math.PI / 4]}>
            <extrudeGeometry args={[shape, { depth: 0.1, bevelEnabled: false }]} />
            {glyphMaterial(color, opacity, glowColor)}
        </mesh>
    );
}

function OGlyph({ color, opacity, glowColor }: ShapeProps) {
    return (
        <mesh position={[0, 0, GLYPH_OFFSET]}>
            <torusGeometry args={[0.29, 0.1, 20, 40]} />
            {glyphMaterial(color, opacity, glowColor)}
        </mesh>
    );
}

function TriangleGlyph({ color, opacity, glowColor }: ShapeProps) {
    const shape = useMemo(() => {
        const outerR = 0.36;
        const innerR = 0.20;
        const s = new THREE.Shape();
        for (let i = 0; i < 3; i++) {
            const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
            const x = outerR * Math.cos(a);
            const y = outerR * Math.sin(a);
            if (i === 0) { s.moveTo(x, y); } else { s.lineTo(x, y); }
        }
        s.closePath();
        const hole = new THREE.Path();
        for (let i = 2; i >= 0; i--) {
            const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
            const x = innerR * Math.cos(a);
            const y = innerR * Math.sin(a);
            if (i === 2) { hole.moveTo(x, y); } else { hole.lineTo(x, y); }
        }
        hole.closePath();
        s.holes.push(hole);
        return s;
    }, []);
    return (
        <mesh position={[0, -0.02, GLYPH_OFFSET - 0.05]}>
            <extrudeGeometry args={[shape, { depth: 0.1, bevelEnabled: false }]} />
            {glyphMaterial(color, opacity, glowColor)}
        </mesh>
    );
}

function SquareGlyph({ color, opacity, glowColor }: ShapeProps) {
    const shape = useMemo(() => {
        const outer = 0.28;
        const inner = 0.18;
        const s = new THREE.Shape();
        s.moveTo(-outer, -outer);
        s.lineTo( outer, -outer);
        s.lineTo( outer,  outer);
        s.lineTo(-outer,  outer);
        s.closePath();
        const hole = new THREE.Path();
        hole.moveTo(-inner, -inner);
        hole.lineTo(-inner,  inner);
        hole.lineTo( inner,  inner);
        hole.lineTo( inner, -inner);
        hole.closePath();
        s.holes.push(hole);
        return s;
    }, []);
    return (
        <mesh position={[0, 0, GLYPH_OFFSET - 0.05]}>
            <extrudeGeometry args={[shape, { depth: 0.1, bevelEnabled: false }]} />
            {glyphMaterial(color, opacity, glowColor)}
        </mesh>
    );
}

function PlusGlyph({ color, opacity, glowColor }: ShapeProps) {
    const shape = useMemo(createPlusShape, []);
    return (
        <mesh position={[0, 0, GLYPH_OFFSET - 0.05]}>
            <extrudeGeometry args={[shape, { depth: 0.1, bevelEnabled: false }]} />
            {glyphMaterial(color, opacity, glowColor)}
        </mesh>
    );
}

function HexagonGlyph({ color, opacity, glowColor }: ShapeProps) {
    const shape = useMemo(() => {
        const outerR = 0.34;
        const innerR = 0.22;
        const s = new THREE.Shape();
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            const x = outerR * Math.cos(a);
            const y = outerR * Math.sin(a);
            if (i === 0) { s.moveTo(x, y); } else { s.lineTo(x, y); }
        }
        s.closePath();
        const hole = new THREE.Path();
        for (let i = 5; i >= 0; i--) {
            const a = (i * Math.PI) / 3;
            const x = innerR * Math.cos(a);
            const y = innerR * Math.sin(a);
            if (i === 5) { hole.moveTo(x, y); } else { hole.lineTo(x, y); }
        }
        hole.closePath();
        s.holes.push(hole);
        return s;
    }, []);
    return (
        <mesh position={[0, 0, GLYPH_OFFSET - 0.05]}>
            <extrudeGeometry args={[shape, { depth: 0.1, bevelEnabled: false }]} />
            {glyphMaterial(color, opacity, glowColor)}
        </mesh>
    );
}
