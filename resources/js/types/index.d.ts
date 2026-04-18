export interface User {
    id: number;
    name: string;
    email: string;
    email_verified_at?: string;
}

export interface Game {
    id: number;
    slug: string;
    name: string;
    description: string;
    thumbnail: string | null;
    min_players: number;
    max_players: number;
    estimated_duration_minutes: number | null;
    rules: Record<string, unknown> | null;
    is_active: boolean;
    sort_order: number;
    active_rooms_count?: number;
}

export interface GameRoom {
    id: number;
    game_id: number;
    host_user_id: number | null;
    room_code: string;
    name: string | null;
    status: 'waiting' | 'playing' | 'finished';
    current_hour: number;
    started_at: string | null;
    ended_at: string | null;
    games_played: number;
    game?: Game;
    host?: User;
    players?: GamePlayer[];
    connected_players_count?: number;
    is_full?: boolean;
}

export interface GamePlayer {
    id: number;
    game_room_id: number;
    user_id: number | null;
    session_id: string;
    nickname: string;
    avatar_color: string;
    is_host: boolean;
    is_thief: boolean;
    is_accomplice: boolean;
    die_value: number | null;
    has_stolen_cheese: boolean;
    is_connected: boolean;
    is_muted: boolean;
    turn_order: number | null;
    game_data: Record<string, unknown> | null;
    wins: number;
    user?: User;
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User | null;
    };
};

// Game State Types for Cheese Thief
export interface GameStatePlayer {
    id: number;
    nickname: string;
    avatar_color: string;
    is_host: boolean;
    is_connected: boolean;
    turn_order: number | null;
    die_value: number | null; // Only visible to self, if peeked, or game over
    is_thief: boolean | null; // Only visible to thief or game over
    is_accomplice: boolean | null; // Only visible to thief, accomplice, or game over
    has_confirmed_roll: boolean;
    has_voted: boolean;
    has_stolen_cheese: boolean;
}

export interface ChatMessage {
    id: number;
    message: string;
    created_at: string;
    player: {
        id: number;
        nickname: string;
        avatar_color: string;
    };
}

// Twenty-Eight Game Types
export interface TwentyEightCard {
    rank: 'J' | '9' | 'A' | '10' | 'K' | 'Q' | '8' | '7';
    suit: 'hearts' | 'diamonds' | 'clubs' | 'spades';
}

export interface TwentyEightPlayer {
    id: number;
    nickname: string;
    avatar_color: string;
    is_host: boolean;
    is_connected: boolean;
    team: 'team_a' | 'team_b' | null;
    seat_position: number;
    hand: TwentyEightCard[] | null;
    hand_count: number;
    is_current_turn: boolean;
    has_passed: boolean;
    is_bid_winner: boolean;
    playable_card_indices: number[];
}

export interface TwentyEightTrickPlay {
    player_id: number;
    card: TwentyEightCard;
}

export interface TwentyEightCompletedTrick {
    number: number;
    cards: TwentyEightTrickPlay[];
    winner_id: number;
    points: number;
}

export interface TwentyEightGameState {
    phase: 'bidding' | 'trump_selection' | 'playing' | 'round_end' | 'game_over';
    round_number: number;
    dealer_index: number;
    players: TwentyEightPlayer[];
    teams: {
        team_a: number[];
        team_b: number[];
    };
    player_order: number[];
    bidding: {
        current_bidder_id: number | null;
        highest_bid: number;
        highest_bidder_id: number | null;
        passed_players: number[];
    };
    trump: {
        revealed: boolean;
        suit: string | null;
    };
    current_trick: {
        number: number;
        cards: TwentyEightTrickPlay[];
        lead_suit: string | null;
        lead_player_id: number | null;
    };
    last_completed_trick: TwentyEightCompletedTrick | null;
    tricks_won: {
        team_a: number;
        team_b: number;
    };
    points: {
        team_a: number;
        team_b: number;
    };
    game_scores: {
        team_a: number;
        team_b: number;
    };
    bid_value: number;
    bid_team: 'team_a' | 'team_b' | null;
    round_history: Array<{
        round_number: number;
        bid_value: number;
        bid_team: string;
        points: { team_a: number; team_b: number };
        game_scores: { team_a: number; team_b: number };
    }>;
    permissions: {
        can_bid: boolean;
        can_pass: boolean;
        can_select_trump: boolean;
        can_play_card: boolean;
        can_call_trump: boolean;
        must_call_trump: boolean;
    };
}

export interface GameState {
    current_hour: number; // 0=rolling, 1-6=night, 7=accomplice, 8=voting, 9=results
    players: GameStatePlayer[];
    awake_player_ids: number[];
    can_peek: boolean;
    can_skip_peek: boolean;
    can_select_accomplice: boolean;
    can_vote: boolean;
    cheese_stolen: boolean;
    winner: 'mice' | 'thief' | null;
    thief_player_id: number | null; // Only visible when game over
    accomplice_player_id: number | null; // Only visible to thief, accomplice, or game over
    vote_counts: Record<number, number>; // Only visible when game over
    total_votes_cast: number;
    total_players: number;
    current_player_id: number | null;
    is_thief: boolean;
    is_accomplice: boolean;
    isHost: boolean;
    hour_started_at: string | null;
    hour_timer_duration: number;
}
