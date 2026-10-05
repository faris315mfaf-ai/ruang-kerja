export type WorkMode = 'office' | 'hybrid' | 'wfh' | 'field';

export type UserStatus = 'active' | 'inactive' | 'resigned';

/** Minimal organization info shared with `auth.user` (HandleInertiaRequests). */
export type UserOrganization = {
    company?: { id: string; name: string } | null;
    division?: { id: string; name: string; code: string } | null;
    position?: { id: string; name: string; level: number } | null;
};

export type User = UserOrganization & {
    id: string;
    name: string;
    email: string;
    /** Google profile photo (users.avatar_url). */
    avatar?: string | null;
    avatar_url?: string | null;
    company_id?: string;
    division_id?: string | null;
    team_id?: string | null;
    position_id?: string | null;
    manager_id?: string | null;
    work_mode?: WorkMode;
    status?: UserStatus;
    joined_at?: string | null;
    theme: 'system' | 'light' | 'dark';
    email_verified_at: string | null;
    two_factor_enabled?: boolean;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User | null;
    roles: string[];
};

export type Branding = {
    name: string;
    companyName: string | null;
    shortName: string;
    logo: string | null;
};
