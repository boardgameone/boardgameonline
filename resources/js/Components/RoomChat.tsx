import { ChatMessage } from '@/types';
import axios from 'axios';
import { FormEventHandler, useCallback, useEffect, useRef, useState } from 'react';

interface Props {
    roomCode: string;
    currentPlayerId: number | null;
}

export default function RoomChat({ roomCode, currentPlayerId }: Readonly<Props>) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [isOpen, setIsOpen] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const lastMessageIdRef = useRef(0);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const fetchMessages = useCallback(async () => {
        if (!currentPlayerId) return;

        try {
            const response = await axios.get(route('rooms.messages', roomCode), {
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
    }, [roomCode, currentPlayerId]);

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
        try {
            const response = await axios.post(route('rooms.chat', roomCode), {
                message: newMessage.trim(),
            });

            if (response.data.success) {
                const msg = response.data.message as ChatMessage;
                setMessages((prev) => [...prev, msg]);
                lastMessageIdRef.current = msg.id;
                setNewMessage('');
                setTimeout(scrollToBottom, 100);
            }
        } catch {
            // Handle error silently
        } finally {
            setSending(false);
        }
    };

    if (!currentPlayerId) return null;

    return (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 flex items-center justify-between"
            >
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {'\u{1F4AC}'} Chat
                </h3>
                <svg
                    className={`h-5 w-5 text-white transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div className="flex flex-col h-80">
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
                                                ? 'bg-blue-500 text-white rounded-2xl rounded-tr-sm'
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
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                                maxLength={500}
                                className="flex-1 px-4 py-2 rounded-full border-2 border-gray-200 focus:border-blue-400 focus:ring-blue-400 text-sm"
                                disabled={sending}
                            />
                            <button
                                type="submit"
                                disabled={sending || !newMessage.trim()}
                                className="rounded-full bg-blue-600 px-4 py-2 text-white font-bold shadow-md hover:bg-blue-700 transition hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
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
            )}
        </div>
    );
}
