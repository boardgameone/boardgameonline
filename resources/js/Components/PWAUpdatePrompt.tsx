import { useRegisterSW } from 'virtual:pwa-register/react';

export default function PWAUpdatePrompt() {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        offlineReady: [offlineReady, setOfflineReady],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered:', r);
        },
        onRegisterError(error) {
            console.log('SW registration error', error);
        },
    });

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    if (!offlineReady && !needRefresh) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg bg-slate-800 p-4 shadow-lg">
            <div className="mb-2 text-sm text-white">
                {offlineReady ? (
                    <span>App ready to work offline</span>
                ) : (
                    <span>
                        New content available, click on reload button to update.
                    </span>
                )}
            </div>
            <div className="flex gap-2">
                {needRefresh && (
                    <button
                        className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
                        onClick={() => updateServiceWorker(true)}
                    >
                        Reload
                    </button>
                )}
                <button
                    className="rounded bg-slate-600 px-3 py-1 text-sm text-white hover:bg-slate-700"
                    onClick={close}
                >
                    Close
                </button>
            </div>
        </div>
    );
}
