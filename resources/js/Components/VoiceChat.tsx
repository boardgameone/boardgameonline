// Re-export VoiceChatProvider and hooks from the context
// This file is kept for backwards compatibility during migration
export { VoiceChatProvider, useVoiceChat, useVoiceChatOptional } from '@/Contexts/VoiceChatContext';
export type { VoicePlayer, VoiceChatContextValue } from '@/Contexts/VoiceChatContext';
