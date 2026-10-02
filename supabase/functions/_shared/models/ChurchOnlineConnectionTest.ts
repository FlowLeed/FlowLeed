export interface ChurchOnlineConnectionTest {
    success: boolean;
    error?: string;
    organization?: {
        name: string;
    };
    currentService?: {
        title?: string;
    } | null;
    domain?: string;
}
