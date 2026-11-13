/**
 * Phone controllers for local CubeTac.
 *
 * The host screen keeps running the local reducers and stays the source of
 * truth. A small server relay stores its latest snapshot, the seats phones
 * have claimed, and a queue of phone actions:
 *
 *   host  — `useLocalSession` syncs a few times a second while phones are
 *           seated (once a second otherwise): pushes the snapshot when it
 *           changed and pulls queued actions, which the mounted board applies.
 *   phone — `Rooms/CubeTac/LocalJoin` polls the snapshot and renders the same
 *           board through a remote link whose dispatch posts the action.
 *
 * The phone whose turn it is also reports how it has turned the puzzle, and
 * the host screen's camera follows it (`useViewMirror`).
 *
 * `useLocalBoardState` is the board-side seam: a drop-in for `useReducer`
 * that behaves exactly like it when no link is passed.
 */

import axios from 'axios';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

export type LocalVariant = 'cube' | 'megaminx' | 'pyraminx' | 'octahedron' | 'icosahedron';

/** Palette mirrors the backend SLOT_COLORS in CubeTacGameController.php. */
export const PALETTE = ['#ff4d2e', '#3a90ff', '#16a34a', '#a855f7', '#f59e0b', '#c2813a'];

export const TOKEN_HEADER = 'X-Local-Play-Token';

/** Host sync cadence with no phones seated; just a heartbeat. */
const IDLE_SYNC_INTERVAL_MS = 1000;
/** Host sync cadence once a phone is seated, so its moves show up promptly. */
const LIVE_SYNC_INTERVAL_MS = 300;
/** How often a phone checks whether its camera moved. */
const VIEW_SAMPLE_INTERVAL_MS = 150;
/** Camera movement (radians) too small to be worth sending. */
const VIEW_EPSILON = 0.01;
/** How long a phone trusts its own prediction before falling back to the host. */
const OPTIMISTIC_TIMEOUT_MS = 4000;

export interface Seat {
    slot: number;
    nickname: string;
}

/** Orbit angles of a board's camera, in radians. */
export interface BoardView {
    azimuth: number;
    polar: number;
}

/** The part of a scene handle that view mirroring needs. */
export interface ViewScene {
    getView: () => BoardView | null;
    followView: (view: BoardView) => void;
}

type RemoteActionHandler = (slot: number, action: unknown) => void;
type RemoteViewHandler = (slot: number, view: BoardView) => void;

export interface HostLink {
    mode: 'host';
    seats: Seat[];
    publish: (variant: LocalVariant | null, playerCount: number | null, state: unknown) => void;
    setActionHandler: (handler: RemoteActionHandler | null) => void;
    setViewHandler: (handler: RemoteViewHandler | null) => void;
}

export interface RemoteLink {
    mode: 'remote';
    seats: Seat[];
    mySlot: number | null;
    state: unknown;
    send: (action: unknown) => void;
    /** Reports the phone's camera angles. False when it could not be sent yet. */
    sendView: (view: BoardView) => boolean;
}

export type BoardLink = HostLink | RemoteLink;

/** Fields every variant's reducer state shares. */
export interface LocalBoardBaseState {
    marks: unknown[];
    currentTurn: number;
    moveCount: number;
    winner: number | 'draw' | null;
    pendingAction: boolean;
    wins: number[];
}

export interface LocalSessionInfo {
    code: string;
    hostToken: string;
    joinUrl: string;
}

export interface LocalSession {
    info: LocalSessionInfo | null;
    seats: Seat[];
    isOpening: boolean;
    error: string | null;
    open: () => void;
    close: () => void;
    /** Passed to the mounted board; undefined until a session exists. */
    link: HostLink | undefined;
    publish: HostLink['publish'];
}

interface SyncResponse {
    version: number;
    seats: Seat[];
    view: (BoardView & { slot: number; seq: number }) | null;
    actions: { id: number; slot: number; action: unknown }[];
}

function tokenHeaders(token: string): Record<string, string> {
    return { [TOKEN_HEADER]: token };
}

/**
 * Host side. Owns the session lifetime and the once-a-second sync loop.
 */
export function useLocalSession(): LocalSession {
    const [info, setInfo] = useState<LocalSessionInfo | null>(null);
    const [seats, setSeats] = useState<Seat[]>([]);
    const [isOpening, setIsOpening] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const snapshotRef = useRef<{
        variant: LocalVariant | null;
        playerCount: number | null;
        state: unknown;
        dirty: boolean;
    }>({ variant: null, playerCount: null, state: null, dirty: true });
    const handlerRef = useRef<RemoteActionHandler | null>(null);
    const viewHandlerRef = useRef<RemoteViewHandler | null>(null);
    const viewSeqRef = useRef<number | null>(null);
    const seatCountRef = useRef(0);
    seatCountRef.current = seats.length;
    const cursorRef = useRef(0);
    const infoRef = useRef<LocalSessionInfo | null>(null);
    infoRef.current = info;

    const publish = useCallback<HostLink['publish']>((variant, playerCount, state) => {
        snapshotRef.current = { variant, playerCount, state, dirty: true };
    }, []);

    const setActionHandler = useCallback<HostLink['setActionHandler']>((handler) => {
        handlerRef.current = handler;
    }, []);

    const setViewHandler = useCallback<HostLink['setViewHandler']>((handler) => {
        viewHandlerRef.current = handler;
    }, []);

    const open = useCallback(() => {
        if (infoRef.current !== null || isOpening) return;
        setIsOpening(true);
        setError(null);
        const { variant, playerCount } = snapshotRef.current;
        axios
            .post(route('cubetac.local.sessions.store'), { variant, player_count: playerCount })
            .then(({ data }) => {
                cursorRef.current = 0;
                snapshotRef.current.dirty = true;
                setInfo({ code: data.code, hostToken: data.host_token, joinUrl: data.join_url });
            })
            .catch(() => setError('Could not start phone play. Check your connection and try again.'))
            .finally(() => setIsOpening(false));
    }, [isOpening]);

    const close = useCallback(() => {
        const current = infoRef.current;
        if (current === null) return;
        setInfo(null);
        setSeats([]);
        axios
            .delete(route('cubetac.local.sessions.destroy', current.code), {
                headers: tokenHeaders(current.hostToken),
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (info === null) return;

        let cancelled = false;
        let timer: number | undefined;

        const sync = () => {
            if (cancelled) return;
            const snapshot = snapshotRef.current;
            const push = snapshot.dirty;
            snapshot.dirty = false;

            axios
                .post<SyncResponse>(
                    route('cubetac.local.sessions.sync', info.code),
                    {
                        push,
                        variant: snapshot.variant,
                        player_count: snapshot.playerCount,
                        state: snapshot.state,
                        after_id: cursorRef.current,
                    },
                    { headers: tokenHeaders(info.hostToken) },
                )
                .then(({ data }) => {
                    if (cancelled) return;
                    setSeats((previous) =>
                        JSON.stringify(previous) === JSON.stringify(data.seats) ? previous : data.seats,
                    );
                    seatCountRef.current = data.seats.length;
                    for (const queued of data.actions) {
                        cursorRef.current = Math.max(cursorRef.current, queued.id);
                        handlerRef.current?.(queued.slot, queued.action);
                    }
                    if (data.view !== null && data.view.seq !== viewSeqRef.current) {
                        viewSeqRef.current = data.view.seq;
                        viewHandlerRef.current?.(data.view.slot, {
                            azimuth: data.view.azimuth,
                            polar: data.view.polar,
                        });
                    }
                })
                .catch((failure) => {
                    if (push) snapshotRef.current.dirty = true;
                    const status = failure?.response?.status;
                    if (!cancelled && (status === 403 || status === 404)) {
                        setInfo(null);
                        setSeats([]);
                        setError('Phone play ended. Start it again to get a new QR code.');
                    }
                })
                .finally(() => {
                    if (cancelled) return;
                    timer = window.setTimeout(
                        sync,
                        seatCountRef.current > 0 ? LIVE_SYNC_INTERVAL_MS : IDLE_SYNC_INTERVAL_MS,
                    );
                });
        };

        sync();

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [info]);

    useEffect(
        () => () => {
            const current = infoRef.current;
            if (current === null) return;
            axios
                .delete(route('cubetac.local.sessions.destroy', current.code), {
                    headers: tokenHeaders(current.hostToken),
                })
                .catch(() => {});
        },
        [],
    );

    const link = useMemo<HostLink | undefined>(
        () => (info === null ? undefined : { mode: 'host', seats, publish, setActionHandler, setViewHandler }),
        [info, seats, publish, setActionHandler, setViewHandler],
    );

    return { info, seats, isOpening, error, open, close, link, publish };
}

/** The parts of a snapshot that decide whether a phone's prediction came true. */
function fingerprint(state: LocalBoardBaseState): string {
    return JSON.stringify([
        state.marks,
        state.currentTurn,
        state.moveCount,
        state.winner,
        state.pendingAction,
    ]);
}

/**
 * Drop-in for `useReducer(reducer, playerCount, fresh)` in the local boards.
 *
 *  - no link: plain reducer (pass-and-play, unchanged).
 *  - host link: plain reducer, plus the snapshot is published after every
 *    change and queued phone actions are applied when it is that seat's turn.
 *  - remote link: state comes from the host's snapshot; dispatch predicts the
 *    result locally so taps feel instant, then posts the action to the host.
 *
 * `onRemoteAction` runs on the host just before a phone's action is applied,
 * for side effects the local handlers do themselves (e.g. rotate animation).
 */
export function useLocalBoardState<S extends LocalBoardBaseState, A extends { type: string }>(
    reducer: (state: S, action: A) => S,
    playerCount: number,
    fresh: (playerCount: number) => S,
    variant: LocalVariant,
    link: BoardLink | undefined,
    onRemoteAction?: (action: A) => void,
): [S, (action: A) => void] {
    const [localState, localDispatch] = useReducer(reducer, playerCount, fresh);
    const [prediction, setPrediction] = useState<{ state: S; at: number } | null>(null);

    const host = link?.mode === 'host' ? link : undefined;
    const remote = link?.mode === 'remote' ? link : undefined;
    const hostPublish = host?.publish;
    const hostSetActionHandler = host?.setActionHandler;

    const localStateRef = useRef(localState);
    localStateRef.current = localState;
    const onRemoteActionRef = useRef(onRemoteAction);
    onRemoteActionRef.current = onRemoteAction;

    useEffect(() => {
        hostPublish?.(variant, playerCount, localState);
    }, [hostPublish, variant, playerCount, localState]);

    useEffect(() => {
        if (!hostSetActionHandler) return;

        hostSetActionHandler((slot, rawAction) => {
            const action = rawAction as A;
            const current = localStateRef.current;
            const isAllowed = action.type === 'RESET'
                ? current.winner !== null
                : current.winner === null && slot === current.currentTurn;
            if (!isAllowed) return;

            let next: S;
            try {
                next = reducer(current, action);
            } catch {
                return;
            }
            if (next === current || next.marks.length !== current.marks.length) return;

            // Several actions can arrive in one sync; keep the ref ahead of
            // React so the next one is judged against the right turn.
            localStateRef.current = next;
            onRemoteActionRef.current?.(action);
            localDispatch(action);
        });

        return () => hostSetActionHandler(null);
    }, [hostSetActionHandler, reducer]);

    const remoteState = remote ? (remote.state as S) : null;

    useEffect(() => {
        if (prediction === null || remoteState === null) return;
        if (fingerprint(prediction.state) === fingerprint(remoteState)) {
            setPrediction(null);
            return;
        }
        const remaining = prediction.at + OPTIMISTIC_TIMEOUT_MS - Date.now();
        const timer = window.setTimeout(() => setPrediction(null), Math.max(0, remaining));
        return () => window.clearTimeout(timer);
    }, [prediction, remoteState]);

    const shownRemoteState = prediction?.state ?? remoteState;
    const shownRemoteStateRef = useRef(shownRemoteState);
    shownRemoteStateRef.current = shownRemoteState;
    const remoteSend = remote?.send;

    const remoteDispatch = useCallback(
        (action: A) => {
            const current = shownRemoteStateRef.current;
            if (current === null || !remoteSend) return;
            const next = reducer(current, action);
            if (next === current) return;
            shownRemoteStateRef.current = next;
            setPrediction({ state: next, at: Date.now() });
            remoteSend(action);
        },
        [reducer, remoteSend],
    );

    if (remote && shownRemoteState !== null) {
        return [shownRemoteState, remoteDispatch];
    }

    return [localState, localDispatch];
}

function wrapAngle(angle: number): number {
    return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/**
 * Mirrors the camera of the phone whose turn it is onto the host screen.
 *
 *  - remote link: while it is this phone's turn, camera movement is sampled
 *    and sent to the host.
 *  - host link: the host camera eases towards the angles that phone sent.
 *  - no link: does nothing.
 */
export function useViewMirror(
    link: BoardLink | undefined,
    getScene: () => ViewScene | null,
    currentTurn: number,
): void {
    const host = link?.mode === 'host' ? link : undefined;
    const remote = link?.mode === 'remote' ? link : undefined;
    const hostSetViewHandler = host?.setViewHandler;
    const isRemote = remote !== undefined;

    const getSceneRef = useRef(getScene);
    getSceneRef.current = getScene;
    const currentTurnRef = useRef(currentTurn);
    currentTurnRef.current = currentTurn;
    const remoteRef = useRef(remote);
    remoteRef.current = remote;

    useEffect(() => {
        if (!hostSetViewHandler) return;

        hostSetViewHandler((slot, view) => {
            if (slot !== currentTurnRef.current) return;
            getSceneRef.current()?.followView(view);
        });

        return () => hostSetViewHandler(null);
    }, [hostSetViewHandler]);

    useEffect(() => {
        if (!isRemote) return;

        let lastSent: BoardView | null = null;

        const timer = window.setInterval(() => {
            const view = getSceneRef.current()?.getView() ?? null;
            const current = remoteRef.current;
            if (view === null || !current) return;
            if (lastSent === null) {
                lastSent = view;
                return;
            }
            if (current.mySlot !== currentTurnRef.current) return;
            const hasMoved = Math.abs(wrapAngle(view.azimuth - lastSent.azimuth)) > VIEW_EPSILON
                || Math.abs(view.polar - lastSent.polar) > VIEW_EPSILON;
            if (hasMoved && current.sendView(view)) {
                lastSent = view;
            }
        }, VIEW_SAMPLE_INTERVAL_MS);

        return () => window.clearInterval(timer);
    }, [isRemote]);
}

export interface LocalSeating {
    players: {
        id: number | null;
        nickname: string;
        avatar_color: string;
        design: number;
        wins: number;
    }[];
    /** Null on the shared host screen, the phone's seat on a controller. */
    mySlot: number | null;
    isMyTurn: boolean;
    /** Set on the host screen, where the banner always names the player. */
    turnLabel: string | undefined;
    isRemote: boolean;
}

/**
 * Player list and turn ownership for a local board, with phone nicknames
 * filled in for claimed seats.
 */
export function localSeating(
    link: BoardLink | undefined,
    playerCount: number,
    wins: number[],
    currentTurn: number,
): LocalSeating {
    const seats = link?.seats ?? [];
    const players = Array.from({ length: playerCount }, (_, slot) => ({
        id: null as number | null,
        nickname: seats.find((seat) => seat.slot === slot)?.nickname ?? `Player ${slot + 1}`,
        avatar_color: PALETTE[slot] ?? '#5b9bd5',
        design: slot,
        wins: wins[slot] ?? 0,
    }));

    const isRemote = link?.mode === 'remote';
    const mySlot = link?.mode === 'remote' ? link.mySlot : null;

    return {
        players,
        mySlot,
        isMyTurn: isRemote ? mySlot === currentTurn : true,
        turnLabel: isRemote && mySlot !== null
            ? undefined
            : `${players[currentTurn]?.nickname ?? 'Player'}'s Turn`,
        isRemote,
    };
}
