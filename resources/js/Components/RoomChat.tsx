import { ChatMessage } from '@/types';
import axios from 'axios';
import { FormEventHandler, useCallback, useEffect, useRef, useState } from 'react';

interface Props {
    gameSlug: string;
    roomCode: string;
    currentPlayerId: number | null;
}

export default function RoomChat({ gameSlug, roomCode, currentPlayerId }: Readonly<Props>) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const lastMessageIdRef = useRef(0);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchMessages = useCallback(async () => {
        if (!currentPlayerId) return;

        try {
            const response = await axios.get(route('rooms.messages', [gameSlug, roomCode]), {
                params: { after_id: lastMessageIdRef.current },
            });

            const newMessages = response.data.messages as ChatMessage[];
            if (newMessages.length > 0) {
                setMessages((prev) => [...prev, ...newMessages]);
                lastMessageIdRef.current = newMessages[newMessages.length - 1].id;
                setTimeout(scrollToBottom, 100);
            }
        } catch {
            // Silently fail - will retry on next poll
        }
    }, [gameSlug, roomCode, currentPlayerId]);

    // Debug logging at component mount
    useEffect(() => {
        console.log('[Chat] Current player ID:', currentPlayerId);
        console.log('[Chat] Game slug:', gameSlug);
        console.log('[Chat] Room code:', roomCode);
    }, [currentPlayerId, gameSlug, roomCode]);

    // Poll for new messages
    useEffect(() => {
        if (!currentPlayerId) return;

        fetchMessages();
        const interval = setInterval(fetchMessages, 2000);
        return () => clearInterval(interval);
    }, [fetchMessages, currentPlayerId]);

    const handleSubmit: FormEventHandler = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || sending || !currentPlayerId) return;

        setSending(true);
        setError(null); // Clear previous errors

        console.log('[Chat] Submitting message:', newMessage.trim());
        console.log('[Chat] POST to:', route('rooms.chat', [gameSlug, roomCode]));

        try {
            const response = await axios.post(route('rooms.chat', [gameSlug, roomCode]), {
                message: newMessage.trim(),
            });

            console.log('[Chat] Response:', response.data);

            if (response.data.success) {
                const msg = response.data.message as ChatMessage;
                setMessages((prev) => [...prev, msg]);
                lastMessageIdRef.current = msg.id;
                setNewMessage('');
                setTimeout(scrollToBottom, 100);
            }
        } catch (err: any) {
            console.error('[Chat] Failed to send message:', err);
            console.error('[Chat] Error details:', {
                status: err.response?.status,
                statusText: err.response?.statusText,
                data: err.response?.data,
                message: err.message,
            });

            // Show user-friendly error message
            if (err.response?.status === 403) {
                setError('You must be a player in this room to send messages.');
            } else if (err.response?.status === 422) {
                setError('Invalid message. Please check your input.');
            } else if (err.response?.data?.message) {
                setError(err.response.data.message);
            } else {
                setError('Failed to send message. Please try again.');
            }

            // Don't clear the message input on error so user can retry
        } finally {
            setSending(false);
        }
    };

    if (!currentPlayerId) return null;

    // Minimized floating button
    if (isMinimized) {
        return (
            <button
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-4 right-4 z-40 bg-gradient-to-r from-brand-teal to-brand-cyan text-white rounded-full p-4 shadow-2xl hover:scale-110 transition-transform group"
                title="Open Chat"
            >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {messages.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                        {messages.length > 9 ? '9+' : messages.length}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 z-40 w-80 bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-teal to-brand-cyan px-4 py-3 flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {'\u{1F4AC}'} Chat
                </h3>
                <button
                    onClick={() => setIsMinimized(true)}
                    className="text-white/80 hover:text-white transition"
                    title="Minimize"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            </div>

            <div className="flex flex-col max-h-[50vh]">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {messages.length === 0 ? (
                            <div className="text-center py-8">
                                <span className="text-4xl opacity-50">{'\u{1F4AD}'}</span>
                                <p className="text-gray-400 text-sm mt-2">No messages yet</p>
                                <p className="text-gray-400 text-xs">Say hi to your fellow players!</p>
                            </div>
                        ) : (
                            messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex gap-2 ${
                                        msg.player.id === currentPlayerId ? 'flex-row-reverse' : ''
                                    }`}
                                >
                                    <div
                                        className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                                        style={{ backgroundColor: msg.player.avatar_color }}
                                    >
                                        {msg.player.nickname.charAt(0).toUpperCase()}
                                    </div>
                                    <div
                                        className={`max-w-[70%] ${
                                            msg.player.id === currentPlayerId
                                                ? 'bg-brand-teal text-white rounded-2xl rounded-tr-sm'
                                                : 'bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm'
                                        } px-4 py-2`}
                                    >
                                        {msg.player.id !== currentPlayerId && (
                                            <p className="text-xs font-bold opacity-70 mb-0.5">
                                                {msg.player.nickname}
                                            </p>
                                        )}
                                        <p className="text-sm break-words">{msg.message}</p>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100">
                        {error && (
                            <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                                {error}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                                maxLength={500}
                                className="flex-1 px-4 py-2 rounded-full border-2 border-gray-200 focus:border-brand-teal focus:ring-brand-teal text-sm"
                                disabled={sending}
                            />
                            <button
                                type="submit"
                                disabled={sending || !newMessage.trim()}
                                className="rounded-full bg-brand-teal px-4 py-2 text-white font-bold shadow-md hover:bg-teal-600 transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                            >
                                {sending ? (
                                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                ) : (
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
        </div>
    );
}
