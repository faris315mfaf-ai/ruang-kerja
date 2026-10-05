export type ChannelKey = 'in_app' | 'email' | 'whatsapp';

export type MatrixCell = {
    enabled: boolean;
    configurable: boolean;
    supported: boolean;
};

export type MatrixRow = {
    event: string;
    label: string;
    category: string;
    channels: Record<ChannelKey, MatrixCell>;
};

export type ChannelInfo = {
    value: ChannelKey;
    label: string;
    available: boolean;
};

export type CategoryInfo = { value: string; label: string };

export type NotificationSettingsValues = {
    digest_enabled: boolean;
    digest_time: string;
    quiet_hours: boolean;
    pause_while_on_leave: boolean;
};

export type DigestItem = {
    title: string;
    code: string | null;
    detail: string | null;
    trailing: string | null;
    badge: string | null;
    badge_tone: string;
    avatar_name: string | null;
};

export type DigestSection = {
    key: string;
    title: string;
    tile_label: string;
    count: number;
    tone: 'default' | 'danger';
    items: DigestItem[];
    note: string | null;
    more: string | null;
};

export type DigestPreview = { date: string; sections: DigestSection[] };

export type NotificationSettingsProps = {
    matrix: MatrixRow[];
    categories: CategoryInfo[];
    channels: ChannelInfo[];
    settings: NotificationSettingsValues;
    quietWindow: { start: string; end: string };
    digestPreview?: DigestPreview;
    email: string;
};
