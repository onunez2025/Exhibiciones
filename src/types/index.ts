export interface User {
    id: number;
    username: string;
    full_name: string;
    email?: string;
    celular?: string;
    zona?: string;
    role_id: number | null;
    role_name: string;
    is_active?: boolean;
    avatar_url?: string;
    permissions: string[];
}
