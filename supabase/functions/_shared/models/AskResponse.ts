export interface AskSource {
    index: number;
    video_id: string;
    chunk_id: string;
    title: string | null;
    thumbnail_url: string | null;
    channel_name: string | null;
    snippet: string;
    start_seconds: number;
    similarity: number;
}

export interface AskResponse {
    answer: string;
    sources: AskSource[];
}
