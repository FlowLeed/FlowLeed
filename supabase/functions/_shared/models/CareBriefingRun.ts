/** Body of a leader's manual care-agent-run call. */
export interface CareBriefingRunRequest {
    organizationId: string;
    /** The leader's calendar day (YYYY-MM-DD), so the briefing follows their time zone. */
    localDate: string;
}

/** What care-agent-run reports for a manual run. */
export interface CareBriefingRunResult {
    /** Recommendations written for today. */
    created?: number;
    /** Why nothing ran, e.g. "already running" or the church's pause reason. */
    skipped?: string;
    /** Set when the AI stopped partway, e.g. "AI credits are used up". */
    paused?: string | null;
}
