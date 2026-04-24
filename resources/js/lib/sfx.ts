import { useCallback } from 'react';
import { useSoundContext } from '@/Contexts/SoundContext';

export const SFX = {
    UI_CLICK: '/sounds/ui/click.mp3',
    UI_TOGGLE: '/sounds/ui/toggle.mp3',
    UI_MODAL_OPEN: '/sounds/ui/modal-open.mp3',
    UI_MODAL_CLOSE: '/sounds/ui/modal-close.mp3',
    UI_SUCCESS: '/sounds/ui/success.mp3',
    UI_ERROR: '/sounds/ui/error.mp3',
    UI_NOTIFY: '/sounds/ui/notify.mp3',
    LOBBY_JOIN: '/sounds/ui/join.mp3',
    LOBBY_LEAVE: '/sounds/ui/leave.mp3',
} as const;

export type SfxKey = keyof typeof SFX;

interface PlayOptions {
    volume?: number;
}

export function useSfx() {
    const { playSfx } = useSoundContext();

    const play = useCallback(
        (key: SfxKey, options?: PlayOptions) => {
            playSfx(SFX[key], options);
        },
        [playSfx]
    );

    return { play };
}
