export type DemoAccount = {
    email: string;
    name: string;
    role_label: string;
};

export type GoogleLoginState = {
    /** GOOGLE_CLIENT_ID/SECRET are set (config/services.php). */
    enabled: boolean;
    /** companies.google_domain, e.g. "perusahaan.co.id". */
    domain: string | null;
    /** Address Google returned when the sign-in was refused. */
    rejectedEmail: string | null;
};
