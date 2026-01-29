interface GameIconProps {
    name: IconName;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    className?: string;
}

type IconName =
    | 'target'
    | 'party'
    | 'x'
    | 'sparkles'
    | 'trophy'
    | 'crown'
    | 'book'
    | 'card'
    | 'gamepad'
    | 'refresh'
    | 'home'
    | 'eye'
    | 'star'
    | 'dice'
    | 'cheese'
    | 'link'
    | 'user'
    | 'users'
    | 'rocket'
    | 'microphone'
    | 'chat'
    | 'thought'
    | 'chess'
    | 'wave'
    | 'lightbulb'
    | 'key'
    | 'hourglass'
    | 'moon'
    | 'eyes'
    | 'sleep'
    | 'ninja'
    | 'sad'
    | 'mouse'
    | 'handshake'
    | 'ballot'
    | 'muted'
    | 'speaker'
    | 'question'
    | 'circle';

const sizeClasses = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
    '2xl': 'h-16 w-16',
};

const icons: Record<IconName, JSX.Element> = {
    target: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z M12 2v2m0 16v2m10-10h-2M4 12H2m15.364-6.364l-1.414 1.414M6.05 17.95l-1.414 1.414m12.728 0l-1.414-1.414M6.05 6.05L4.636 4.636"
        />
    ),
    party: (
        <>
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 3l3.057 11.293A2 2 0 0010 16h.172a2 2 0 001.714-1.293L15 3"
            />
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l2-2m16 0l-2-2M8 3l.5-1M16 3l-.5-1M10 1l.25 1M14 1l-.25 1"
            />
            <circle cx="6" cy="6" r="1" fill="currentColor" />
            <circle cx="18" cy="6" r="1" fill="currentColor" />
            <circle cx="10" cy="4" r="0.75" fill="currentColor" />
            <circle cx="14" cy="4" r="0.75" fill="currentColor" />
        </>
    ),
    x: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
        />
    ),
    sparkles: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l1.5 4.5L19 9l-4.5 1.5L13 15l-1.5-4.5L7 9l4.5-1.5L13 3z"
        />
    ),
    trophy: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 3h14M5 3a2 2 0 00-2 2v2a4 4 0 004 4h0M5 3v8a6 6 0 006 6h2a6 6 0 006-6V3m0 0a2 2 0 012 2v2a4 4 0 01-4 4M8 21h8M12 17v4"
        />
    ),
    crown: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 17l3-9 4 4 2-6 2 6 4-4 3 9H3zM5 17h14v2H5v-2z"
        />
    ),
    book: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        />
    ),
    card: (
        <>
            <rect x="4" y="3" width="16" height="18" rx="2" strokeWidth={2} fill="none" stroke="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h.01M16 17h.01" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10l-1.5 2.5L12 15l1.5-2.5L12 10z" />
        </>
    ),
    gamepad: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
    ),
    refresh: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
    ),
    home: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
    ),
    eye: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
    ),
    star: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
    ),
    dice: (
        <>
            <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={2} fill="none" stroke="currentColor" />
            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
            <circle cx="16" cy="8" r="1.5" fill="currentColor" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            <circle cx="8" cy="16" r="1.5" fill="currentColor" />
            <circle cx="16" cy="16" r="1.5" fill="currentColor" />
        </>
    ),
    cheese: (
        <>
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 17l9-14 9 14H3z"
            />
            <circle cx="8" cy="14" r="1.5" fill="currentColor" />
            <circle cx="14" cy="12" r="1" fill="currentColor" />
            <circle cx="11" cy="15" r="1" fill="currentColor" />
        </>
    ),
    link: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
    ),
    user: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
    ),
    users: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
    ),
    rocket: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
        />
    ),
    microphone: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
        />
    ),
    chat: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
    ),
    thought: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
        />
    ),
    chess: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 2v2m0 0a3 3 0 013 3v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V7a3 3 0 013-3zm-4 8h8l1 9H7l1-9zm-1 9h10"
        />
    ),
    wave: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
        />
    ),
    lightbulb: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
    ),
    key: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
        />
    ),
    hourglass: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
    ),
    moon: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
    ),
    eyes: (
        <>
            <circle cx="9" cy="12" r="2" strokeWidth={2} fill="none" stroke="currentColor" />
            <circle cx="15" cy="12" r="2" strokeWidth={2} fill="none" stroke="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
        </>
    ),
    sleep: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14 4h6v6M18 4l-7 7M6 14h4v4M6 18l5-5"
        />
    ),
    ninja: (
        <>
            <circle cx="12" cy="10" r="7" strokeWidth={2} fill="none" stroke="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10h14" />
            <circle cx="9" cy="9" r="1" fill="currentColor" />
            <circle cx="15" cy="9" r="1" fill="currentColor" />
        </>
    ),
    sad: (
        <>
            <circle cx="12" cy="12" r="10" strokeWidth={2} fill="none" stroke="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 15s1.5-2 4-2 4 2 4 2" />
            <circle cx="9" cy="9" r="1" fill="currentColor" />
            <circle cx="15" cy="9" r="1" fill="currentColor" />
        </>
    ),
    mouse: (
        <>
            <ellipse cx="12" cy="14" rx="6" ry="5" strokeWidth={2} fill="none" stroke="currentColor" />
            <circle cx="9" cy="13" r="1" fill="currentColor" />
            <circle cx="15" cy="13" r="1" fill="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v1M6 10a6 6 0 0112 0" />
            <circle cx="7" cy="7" r="2" strokeWidth={2} fill="none" stroke="currentColor" />
            <circle cx="17" cy="7" r="2" strokeWidth={2} fill="none" stroke="currentColor" />
        </>
    ),
    handshake: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 11l5-5 5 5M7 11v6l5 3 5-3v-6M12 6V3"
        />
    ),
    ballot: (
        <>
            <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth={2} fill="none" stroke="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
        </>
    ),
    muted: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
        />
    ),
    speaker: (
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
        />
    ),
    question: (
        <>
            <circle cx="12" cy="12" r="10" strokeWidth={2} fill="none" stroke="currentColor" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
            <circle cx="12" cy="17" r="1" fill="currentColor" />
        </>
    ),
    circle: (
        <circle cx="12" cy="12" r="8" strokeWidth={2} fill="currentColor" stroke="currentColor" />
    ),
};

export default function GameIcon({ name, size = 'md', className = '' }: GameIconProps) {
    return (
        <svg
            className={`${sizeClasses[size]} ${className} flex-shrink-0`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            {icons[name]}
        </svg>
    );
}
