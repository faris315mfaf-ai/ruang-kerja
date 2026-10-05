/** Mirrors App\Http\Resources\InboxNotificationResource and BaseNotification payloads. */

export type NotificationTone =
    | 'primary'
    | 'info'
    | 'success'
    | 'warning'
    | 'danger'
    | 'neutral';

export type NotificationCategory = 'task' | 'request' | 'attendance' | 'system';

export type NotificationActor = {
    id: string;
    name: string;
    avatar: string | null;
};

export type NotificationSubject = {
    type: string;
    id: string;
    code: string | null;
    title: string | null;
};

/**
 * Documented `meta` keys (NotificationPayload): context, context_tone,
 * open_label, quote. Modules may add more scalar keys.
 */
export type NotificationMeta = {
    context?: string;
    context_tone?: NotificationTone;
    open_label?: string;
    quote?: boolean;
    [key: string]: unknown;
};

export type InboxNotification = {
    id: string;
    type: string;
    category: NotificationCategory;
    icon: string;
    tone: NotificationTone;
    type_label: string;
    title: string;
    body: string | null;
    url: string | null;
    actor: NotificationActor | null;
    subject: NotificationSubject | null;
    meta: NotificationMeta;
    action_required: boolean;
    read_at: string | null;
    archived_at: string | null;
    created_at: string | null;
};

export type InboxTab = 'all' | 'unread' | 'action';

export type InboxFilters = {
    tab: InboxTab;
    kind: string | null;
    archived: boolean;
};

export type InboxCounts = {
    all: number;
    unread: number;
    action: number;
};

export type InboxKind = { value: string; label: string };

/** Payload pushed on private-App.Models.User.{id} (BaseNotification::toBroadcast). */
export type BroadcastedNotification = {
    id: string;
    type: string;
    title: string;
    body: string | null;
    url: string | null;
    actor: NotificationActor | null;
    subject: NotificationSubject | null;
    meta: NotificationMeta | unknown[];
    category: NotificationCategory;
    icon: string;
    tone: NotificationTone;
    action_required: boolean;
    created_at: string;
};

export type NotificationFeed = {
    unread: number;
    notifications: InboxNotification[];
    server_time: string;
};
