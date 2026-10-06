/** Shapes of App\Domain\Announcements\Queries\AnnouncementFeed (keputusan pemilik 6 Okt 2026). */

export type AnnouncementAudience = 'all' | 'division' | 'team';

export type Announcement = {
    id: string;
    title: string;
    body: string;
    audience: AnnouncementAudience;
    /** "Semua karyawan" · "Divisi Operasional" · "Tim Gudang". */
    audience_label: string;
    author: { id: string; name: string; avatar: string | null } | null;
    published_at: string;
    expires_at: string | null;
    active: boolean;
    /** Closed from my dashboards (the Inbox notification stays). */
    dismissed: boolean;
    can_delete: boolean;
};

export type AnnouncementBannerData = {
    items: Announcement[];
    /** All active, received, not-closed announcements (for "Lihat semua"). */
    total: number;
};

export type AnnouncementOptions = {
    audiences: { value: AnnouncementAudience; label: string }[];
    divisions: { id: string; name: string }[];
    teams: { id: string; name: string }[];
};
