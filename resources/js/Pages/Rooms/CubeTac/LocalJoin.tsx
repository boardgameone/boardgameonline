/**
 * Phone controller for a local CubeTac game.
 *
 * Reached by scanning the QR on the host screen. The phone takes a seat,
 * then shows the same board as the host, driven by the host's snapshots;
 * taps are sent back as actions for the host to apply.
 */

import GameLayout from '@/Layouts/GameLayout';
import SlotGlyph from '@/Pages/Rooms/CubeTac/components/SlotGlyph';
import {
    CubeLocalBoard,
    IcosahedronLocalBoard,
    MegaminxLocalBoard,
    OctahedronLocalBoard,
    PyraminxLocalBoard,
    type BoardProps,
} from '@/Pages/Rooms/CubeTac/LocalGame';
import {
    PALETTE,
    TOKEN_HEADER,
    type LocalVariant,
    type RemoteLink,
    type Seat,
} from '@/Pages/Rooms/CubeTac/localSession';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

const POLL_INTERVAL_MS = 1000;
const NICKNAME_KEY = 'cubetac-local-nickname';

interface StateResponse {
    version: number;
    variant: LocalVariant | null;
    player_count: number | null;
    unchanged: boolean;
    state: unknown;
    seats: Seat[];
    my_slot: number | null;
    host_online: boolean;
}

interface Lobby {
    variant: LocalVariant | null;
    playerCount: number | null;
    seats: Seat[];
    mySlot: number | null;
    isHostOnline: boolean;
}

function readStored(key: string): string {
    try {
        return window.localStorage.getItem(key) ?? '';
    } catch {
        return '';
    }
}

function writeStored(key: string, value: string | null): void {
    try {
        if (value === null) {
            window.localStorage.removeItem(key);
        } else {
            window.localStorage.setItem(key, value);
        }
    } catch {
        // Private mode or blocked storage: the seat just won't survive a reload.
    }
}

export default function LocalJoin({ code }: { code: string }) {
    const seatKey = `cubetac-local-seat:${code}`;
    const [seatToken, setSeatToken] = useState(() => readStored(seatKey));
    const [lobby, setLobby] = useState<Lobby | null>(null);
    const [snapshot, setSnapshot] = useState<{ version: number; state: unknown } | null>(null);
    const [hasEnded, setHasEnded] = useState(false);
    const [nickname, setNickname] = useState(() => readStored(NICKNAME_KEY));
    const [claimError, setClaimError] = useState<string | null>(null);
    const [isClaiming, setIsClaiming] = useState(false);

    const versionRef = useRef<number | null>(null);
    const headers = useMemo(() => (seatToken ? { [TOKEN_HEADER]: seatToken } : {}), [seatToken]);

    const storeSeatToken = useCallback(
        (token: string) => {
            setSeatToken(token);
            writeStored(seatKey, token === '' ? null : token);
        },
        [seatKey],
    );

    useEffect(() => {
        if (hasEnded) return;

        let inFlight = false;
        let cancelled = false;

        const poll = () => {
            if (inFlight || cancelled || document.hidden) return;
            inFlight = true;
            axios
                .get<StateResponse>(route('cubetac.local.sessions.state', code), {
                    params: versionRef.current === null ? {} : { version: versionRef.current },
                    headers,
                })
                .then(({ data }) => {
                    if (cancelled) return;
                    setLobby({
                        variant: data.variant,
                        playerCount: data.player_count,
                        seats: data.seats,
                        mySlot: data.my_slot,
                        isHostOnline: data.host_online,
                    });
                    if (!data.unchanged) {
                        versionRef.current = data.version;
                        setSnapshot({ version: data.version, state: data.state });
                    }
                })
                .catch((failure) => {
                    if (!cancelled && failure?.response?.status === 404) setHasEnded(true);
                })
                .finally(() => {
                    inFlight = false;
                });
        };

        poll();
        const timer = window.setInterval(poll, POLL_INTERVAL_MS);
        document.addEventListener('visibilitychange', poll);

        return () => {
            cancelled = true;
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', poll);
        };
    }, [code, headers, hasEnded]);

    const claimSeat = (slot: number) => {
        const name = nickname.trim();
        if (name === '') {
            setClaimError('Enter your name first.');
            return;
        }
        setIsClaiming(true);
        setClaimError(null);
        writeStored(NICKNAME_KEY, name);
        axios
            .post(route('cubetac.local.sessions.claimSeat', code), { slot, nickname: name }, { headers })
            .then(({ data }) => {
                storeSeatToken(data.seat_token);
                setLobby((previous) => (previous === null ? previous : { ...previous, mySlot: data.slot }));
            })
            .catch((failure) => {
                setClaimError(failure?.response?.data?.message ?? 'Could not take that seat. Try again.');
            })
            .finally(() => setIsClaiming(false));
    };

    const leaveSeat = useCallback(() => {
        axios.delete(route('cubetac.local.sessions.releaseSeat', code), { headers }).catch(() => {});
        storeSeatToken('');
        setLobby((previous) => (previous === null ? previous : { ...previous, mySlot: null }));
    }, [code, headers, storeSeatToken]);

    const send = useCallback(
        (action: unknown) => {
            axios
                .post(route('cubetac.local.sessions.action', code), { action }, { headers })
                .catch((failure) => {
                    if (failure?.response?.status === 403) storeSeatToken('');
                });
        },
        [code, headers, storeSeatToken],
    );

    const mySlot = lobby?.mySlot ?? null;
    const seats = lobby?.seats;
    const state = snapshot?.state ?? null;

    const link = useMemo<RemoteLink>(
        () => ({ mode: 'remote', seats: seats ?? [], mySlot, state, send }),
        [seats, mySlot, state, send],
    );

    const canShowBoard = lobby !== null
        && lobby.variant !== null
        && lobby.playerCount !== null
        && mySlot !== null
        && state !== null;

    const renderBoard = (variant: LocalVariant, playerCount: number) => {
        const boardProps: BoardProps = {
            playerCount,
            onLeave: leaveSeat,
            onChangeSetup: () => {},
            link,
        };
        const boardKey = `${variant}-${playerCount}`;

        return variant === 'megaminx' ? (
            <MegaminxLocalBoard key={boardKey} {...boardProps} />
        ) : variant === 'pyraminx' ? (
            <PyraminxLocalBoard key={boardKey} {...boardProps} />
        ) : variant === 'octahedron' ? (
            <OctahedronLocalBoard key={boardKey} {...boardProps} />
        ) : variant === 'icosahedron' ? (
            <IcosahedronLocalBoard key={boardKey} {...boardProps} />
        ) : (
            <CubeLocalBoard key={boardKey} {...boardProps} />
        );
    };

    return (
        <GameLayout fullHeight={true}>
            <Head title="CubeTac — Join from phone" />
            {hasEnded ? (
                <Notice
                    title="This game has ended"
                    body="The host screen closed phone play. Ask for a new QR code to join again."
                    actionLabel="Back to CubeTac"
                    onAction={() => router.get(route('games.show', 'cubetac'))}
                />
            ) : lobby === null ? (
                <Notice title="Joining…" body="Connecting to the host screen." />
            ) : canShowBoard && lobby.variant !== null && lobby.playerCount !== null ? (
                <div className="relative h-full">
                    {renderBoard(lobby.variant, lobby.playerCount)}
                    {!lobby.isHostOnline && (
                        <div className="absolute inset-x-4 top-16 z-30 rounded-xl bg-red-600 px-4 py-2 text-center text-xs font-bold text-white shadow-lg">
                            Host screen disconnected. Waiting for it to come back…
                        </div>
                    )}
                </div>
            ) : mySlot !== null ? (
                <Notice
                    title="You're in"
                    body="Waiting for the host screen to start the game."
                    actionLabel="Leave seat"
                    onAction={leaveSeat}
                />
            ) : (
                <SeatPicker
                    playerCount={lobby.playerCount}
                    seats={lobby.seats}
                    nickname={nickname}
                    onNicknameChange={setNickname}
                    onClaim={claimSeat}
                    isClaiming={isClaiming}
                    error={claimError}
                />
            )}
        </GameLayout>
    );
}

interface NoticeProps {
    title: string;
    body: string;
    actionLabel?: string;
    onAction?: () => void;
}

function Notice({ title, body, actionLabel, onAction }: NoticeProps) {
    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <h2 className="text-2xl font-black text-yellow-900">{title}</h2>
            <p className="max-w-xs text-sm font-bold text-yellow-900/70">{body}</p>
            {actionLabel && onAction && (
                <button
                    type="button"
                    onClick={onAction}
                    className="mt-2 rounded-full bg-white/80 px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-yellow-900 shadow-md transition hover:bg-white"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
}

interface SeatPickerProps {
    playerCount: number | null;
    seats: Seat[];
    nickname: string;
    onNicknameChange: (nickname: string) => void;
    onClaim: (slot: number) => void;
    isClaiming: boolean;
    error: string | null;
}

function SeatPicker({
    playerCount,
    seats,
    nickname,
    onNicknameChange,
    onClaim,
    isClaiming,
    error,
}: SeatPickerProps) {
    const handleSubmit = (event: FormEvent) => event.preventDefault();

    return (
        <form
            onSubmit={handleSubmit}
            className="flex h-full w-full flex-col items-center justify-center gap-4 overflow-auto px-6 py-6"
        >
            <h2 className="text-2xl font-black text-yellow-900">Take a seat</h2>
            <label className="flex w-full max-w-xs flex-col gap-1 text-left">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-yellow-900/70">
                    Your name
                </span>
                <input
                    type="text"
                    value={nickname}
                    maxLength={20}
                    autoComplete="nickname"
                    onChange={(event) => onNicknameChange(event.target.value)}
                    className="rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-base font-bold text-gray-900 focus:border-yellow-400 focus:outline-hidden"
                />
            </label>

            {error !== null && <p className="text-sm font-bold text-red-700">{error}</p>}

            {playerCount === null ? (
                <p className="max-w-xs text-center text-sm font-bold text-yellow-900/70">
                    The host is still choosing the game. Seats will appear here.
                </p>
            ) : (
                <div className="grid w-full max-w-xs grid-cols-2 gap-3">
                    {Array.from({ length: playerCount }, (_, slot) => {
                        const seat = seats.find((candidate) => candidate.slot === slot);
                        return (
                            <button
                                key={slot}
                                type="button"
                                disabled={seat !== undefined || isClaiming}
                                onClick={() => onClaim(slot)}
                                className="flex flex-col items-center gap-1 rounded-2xl border-2 border-gray-200 bg-white px-4 py-4 shadow-md transition enabled:hover:border-yellow-400 disabled:opacity-50"
                            >
                                <span style={{ color: PALETTE[slot] }}>
                                    <SlotGlyph design={slot} className="h-8 w-8" />
                                </span>
                                <span className="max-w-full truncate text-sm font-black text-yellow-900">
                                    {seat?.nickname ?? `Player ${slot + 1}`}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                                    {seat ? 'Taken' : 'Free'}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </form>
    );
}
