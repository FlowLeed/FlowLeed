export interface GroupSignupRequest {
    token: string;
    name: string;
    email: string;
    phone: string | null;
}
