export type User = {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
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

export type Passkey = {
    id: number;
    name: string;
    authenticator: string | null;
    created_at_diff: string;
    last_used_at_diff: string | null;
};

export type TwoFactorSetupData = {
    svg: string;
    url: string;
};

export type TwoFactorSecretKey = {
    secretKey: string;
};
