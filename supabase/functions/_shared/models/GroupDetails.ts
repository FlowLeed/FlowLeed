export interface GroupDetails {
    id: string;
    name: string;
    description: string | null;
    group_type: string;
    meeting_day: string | null;
    meeting_time: string | null;
    meeting_frequency: string | null;
    location: string | null;
    capacity: number | null;
    member_count: number;
    is_full: boolean;
    image_url: string | null;
    allow_public_signup: boolean;
}
