/**
 * Shared interaction + feedback primitives for every CubeTac 3D scene.
 *
 * - `isTap` filters out orbit drags so a drag that starts and ends on the
 *   same cell never places a mark (R3F fires onClick regardless of travel).
 * - `useCellHover` drives the pointer cursor and the hover ghost.
 * - `PopIn`, `PulseOutline` and `WinLines` are the small in-scene effects.
 * - `SceneCamera` wraps OrbitControls with held-arrow-key orbit plus an
 *   imperative `lookAt` / `reset` tween used by the last-move chip and the
 *   reset-view button.
 */

import { ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
    ReactNode,
    forwardRef,
    useEffect,
    useImperativeHandle,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';

export type Vec3 = [number, number, number];

/** Max pointer travel (px) between down and up that still counts as a tap. */
const TAP_SLOP_PX = 6;

export function isTap(e: ThreeEvent<MouseEvent>): boolean {
    return e.delta <= TAP_SLOP_PX;
}

export function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function marksEqual<T>(a: readonly T[], b: readonly T[]): boolean {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/**
 * Resolves once `isBusy()` reports false, checking every animation frame.
 * Backs each scene handle's `idle()`.
 */
export function waitUntilIdle(isBusy: () => boolean): Promise<void> {
    return new Promise((resolve) => {
        const check = () => {
            if (isBusy()) {
                requestAnimationFrame(check);
            } else {
                resolve();
            }
        };
        check();
    });
}

// -----------------------------------------------------------------------------
// Hover
// -----------------------------------------------------------------------------

export interface CellHover {
    /** True while a mouse pointer is over the cell (never set by touch). */
    hovered: boolean;
    onPointerOver: (e: ThreeEvent<PointerEvent>) => void;
    onPointerOut: (e: ThreeEvent<PointerEvent>) => void;
}

export function useCellHover(clickable: boolean): CellHover {
    const [hovered, setHovered] = useState(false);

    useEffect(() => {
        if (!hovered) return;
        document.body.style.cursor = clickable ? 'pointer' : '';
        return () => {
            document.body.style.cursor = '';
        };
    }, [hovered, clickable]);

    return {
        hovered,
        onPointerOver: (e) => {
            e.stopPropagation();
            if (e.pointerType === 'mouse') setHovered(true);
        },
        onPointerOut: () => setHovered(false),
    };
}

// -----------------------------------------------------------------------------
// PopIn — springy scale-in for a freshly placed glyph
// -----------------------------------------------------------------------------

/**
 * Tokens that have already animated. Glyphs remount whenever their sticker
 * moves between the static and rotating groups, so the "play once" memory
 * has to live outside the component.
 */
const playedPopTokens = new Set<string>();
const POP_MS = 260;

function easeOutBack(t: number): number {
    const c1 = 1.9;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

export function PopIn({ token, children }: { token: string | null; children: ReactNode }) {
    const groupRef = useRef<THREE.Group>(null);
    const startRef = useRef<number | null>(null);

    useLayoutEffect(() => {
        if (!token || playedPopTokens.has(token)) return;
        playedPopTokens.add(token);
        if (prefersReducedMotion()) return;
        startRef.current = performance.now();
        groupRef.current?.scale.setScalar(0.001);
    }, [token]);

    useFrame(() => {
        const start = startRef.current;
        const group = groupRef.current;
        if (start === null || !group) return;
        const t = Math.min(1, (performance.now() - start) / POP_MS);
        group.scale.setScalar(Math.max(0.001, easeOutBack(t)));
        if (t >= 1) {
            group.scale.setScalar(1);
            startRef.current = null;
        }
    });

    return <group ref={groupRef}>{children}</group>;
}

// -----------------------------------------------------------------------------
// PulseOutline — breathing outline around the most recent mark
// -----------------------------------------------------------------------------

interface LineLike {
    material: { opacity: number; transparent: boolean };
}

export function PulseOutline({ points, color, width = 3 }: { points: Vec3[]; color: string; width?: number }) {
    const lineRef = useRef<LineLike>(null);
    const closed = [...points, points[0]];

    useFrame(({ clock }) => {
        const line = lineRef.current;
        if (!line) return;
        line.material.transparent = true;
        line.material.opacity = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 5));
    });

    return (
        <Line
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ref={lineRef as any}
            points={closed}
            color={color}
            lineWidth={width}
            transparent
        />
    );
}

// -----------------------------------------------------------------------------
// WinLines — glowing strokes through each winning line's cells
// -----------------------------------------------------------------------------

export interface WinLineSpec {
    points: Vec3[];
    color: string;
}

export function WinLines({ lines, width = 7 }: { lines: WinLineSpec[]; width?: number }) {
    const lineRefs = useRef<Array<LineLike | null>>([]);
    const reduced = prefersReducedMotion();

    useFrame(({ clock }) => {
        if (reduced) return;
        const opacity = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 4));
        for (const line of lineRefs.current) {
            if (!line) continue;
            line.material.transparent = true;
            line.material.opacity = opacity;
        }
    });

    return (
        <>
            {lines.map((line, i) => (
                <group key={i}>
                    <Line
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ref={((el: LineLike | null) => { lineRefs.current[i] = el; }) as any}
                        points={line.points}
                        color={line.color}
                        lineWidth={width}
                        transparent
                        depthTest={false}
                        renderOrder={10}
                    />
                    {line.points.map((p, j) => (
                        <mesh key={j} position={p} renderOrder={11}>
                            <sphereGeometry args={[0.06, 16, 16]} />
                            <meshBasicMaterial color="#ffffff" depthTest={false} />
                        </mesh>
                    ))}
                </group>
            ))}
        </>
    );
}

// -----------------------------------------------------------------------------
// SceneCamera — OrbitControls + held-arrow orbit + lookAt/reset tween
// -----------------------------------------------------------------------------

export interface SceneCameraHandle {
    /** Ease the camera so it looks at the cube from `direction`. */
    lookAt: (direction: Vec3) => void;
    /** Ease back to the opening camera angle. */
    reset: () => void;
}

interface SceneCameraProps {
    minDistance: number;
    maxDistance: number;
    minPolarAngle?: number;
    maxPolarAngle?: number;
    autoRotate?: boolean;
    enabled?: boolean;
    /** Respond to held arrow keys. Off for decorative previews. */
    arrowKeys?: boolean;
}

/** Subset of three-stdlib's OrbitControls that we drive directly. */
interface OrbitControlsImpl {
    getAzimuthalAngle: () => number;
    getPolarAngle: () => number;
    setAzimuthalAngle: (angle: number) => void;
    setPolarAngle: (angle: number) => void;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
}

const ORBIT_SPEED_RAD_PER_SEC = Math.PI * 6;

function wrapAngle(a: number): number {
    return Math.atan2(Math.sin(a), Math.cos(a));
}

export const SceneCamera = forwardRef<SceneCameraHandle, SceneCameraProps>(function SceneCamera(
    {
        minDistance,
        maxDistance,
        minPolarAngle = 0,
        maxPolarAngle = Math.PI,
        autoRotate = false,
        enabled = true,
        arrowKeys = true,
    },
    ref,
) {
    const controlsRef = useRef<OrbitControlsImpl | null>(null);
    const heldKeysRef = useRef<Set<string>>(new Set());
    const tweenRef = useRef<{ azimuth: number; polar: number } | null>(null);
    const camera = useThree((s) => s.camera);
    const homeRef = useRef<{ azimuth: number; polar: number } | null>(null);

    if (homeRef.current === null) {
        const p = camera.position;
        homeRef.current = {
            azimuth: Math.atan2(p.x, p.z),
            polar: Math.acos(THREE.MathUtils.clamp(p.y / p.length(), -1, 1)),
        };
    }

    useImperativeHandle(ref, () => ({
        lookAt(direction) {
            const len = Math.hypot(direction[0], direction[1], direction[2]) || 1;
            const polar = Math.acos(THREE.MathUtils.clamp(direction[1] / len, -1, 1));
            tweenRef.current = {
                azimuth: Math.atan2(direction[0], direction[2]),
                polar: THREE.MathUtils.clamp(polar, minPolarAngle + 0.05, maxPolarAngle - 0.05),
            };
        },
        reset() {
            tweenRef.current = homeRef.current ? { ...homeRef.current } : null;
        },
    }), [minPolarAngle, maxPolarAngle]);

    // A user drag cancels any in-flight camera tween.
    useEffect(() => {
        const controls = controlsRef.current;
        if (!controls) return;
        const cancel = () => {
            tweenRef.current = null;
        };
        controls.addEventListener('start', cancel);
        return () => controls.removeEventListener('start', cancel);
    }, []);

    useEffect(() => {
        if (!arrowKeys) return;
        const isArrow = (key: string) =>
            key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';
        const onKeyDown = (e: KeyboardEvent) => {
            if (!isArrow(e.key)) return;
            const target = e.target as HTMLElement | null;
            if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) {
                return;
            }
            e.preventDefault();
            tweenRef.current = null;
            heldKeysRef.current.add(e.key);
        };
        const onKeyUp = (e: KeyboardEvent) => {
            if (isArrow(e.key)) heldKeysRef.current.delete(e.key);
        };
        const onBlur = () => heldKeysRef.current.clear();
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
        };
    }, [arrowKeys]);

    useFrame((_, delta) => {
        const controls = controlsRef.current;
        if (!controls) return;

        const held = heldKeysRef.current;
        if (held.size > 0) {
            const step = ORBIT_SPEED_RAD_PER_SEC * delta;
            let dx = 0;
            let dy = 0;
            if (held.has('ArrowLeft')) dx -= step;
            if (held.has('ArrowRight')) dx += step;
            if (held.has('ArrowUp')) dy -= step;
            if (held.has('ArrowDown')) dy += step;
            if (dx !== 0) controls.setAzimuthalAngle(controls.getAzimuthalAngle() - dx);
            if (dy !== 0) controls.setPolarAngle(controls.getPolarAngle() - dy);
            return;
        }

        const tween = tweenRef.current;
        if (!tween) return;
        const azimuth = controls.getAzimuthalAngle();
        const polar = controls.getPolarAngle();
        const dAz = wrapAngle(tween.azimuth - azimuth);
        const dPolar = tween.polar - polar;
        const k = prefersReducedMotion() ? 1 : 1 - Math.exp(-delta * 7);
        controls.setAzimuthalAngle(azimuth + dAz * k);
        controls.setPolarAngle(polar + dPolar * k);
        if (Math.abs(dAz) < 0.003 && Math.abs(dPolar) < 0.003) {
            tweenRef.current = null;
        }
    });

    return (
        <OrbitControls
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ref={controlsRef as any}
            makeDefault
            enabled={enabled}
            enablePan={false}
            minDistance={minDistance}
            maxDistance={maxDistance}
            minPolarAngle={minPolarAngle}
            maxPolarAngle={maxPolarAngle}
            rotateSpeed={0.7}
            zoomSpeed={0.6}
            autoRotate={autoRotate}
            autoRotateSpeed={1.6}
        />
    );
});

/** Common imperative API every CubeTac scene handle exposes on top of `playMove`. */
export interface SceneViewHandle {
    /** Resolves once no rotation is playing or queued. */
    idle: () => Promise<void>;
    /** Ease the camera to face `face` head-on. */
    lookAtFace: (face: number) => void;
    /** Ease the camera back to its opening angle. */
    resetView: () => void;
}
