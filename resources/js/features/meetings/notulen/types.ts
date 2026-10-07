/**
 * Notulen otomatis — data shapes of docs/fitur/notulen-otomatis-kontrak.md
 * (NotulenSummary §2.1, TranscriptSegments §2.2, page props §2.3). Times are
 * ISO strings (UTC); `start_ms` counts from `transcript.started_at`.
 */
import type { Person, PersonId } from '../types';

export type TranscriptStatus =
    | 'recording'
    | 'transcribing'
    | 'summarizing'
    | 'ready'
    | 'failed';

export type DraftStatus =
    | 'pending'
    | 'ready'
    | 'failed'
    | 'disabled'
    | 'inserted'
    | 'discarded';

export type Speaker = {
    identity: string;
    user_id: PersonId | null;
    name: string;
    seconds: number;
};

export type SourceRef = { i: number; start_ms: number };

export type DraftPoint = { teks: string; sumber: SourceRef[] };

export type DraftDecision = DraftPoint & { agenda: string | null };

export type DraftAction = {
    id: string;
    judul: string;
    agenda: string | null;
    penanggung_jawab: { user_id: PersonId; nama: string } | null;
    penanggung_jawab_teks: string | null;
    tenggat: string | null;
    sumber: SourceRef[];
    action_item_id: string | null;
    task: { id: string; key: string; href: string } | null;
};

export type NotulenDraft = {
    status: DraftStatus;
    status_label: string;
    error: string | null;
    model: string | null;
    generated_at: string | null;
    inserted_at: string | null;
    discarded_at: string | null;
    ringkasan: string;
    agenda: { judul: string; poin: DraftPoint[] }[];
    keputusan: DraftDecision[];
    tindak_lanjut: DraftAction[];
    perlu_dicek: string[];
};

export type TranscriptInfo = {
    id: string;
    status: TranscriptStatus;
    status_label: string;
    error: string | null;
    language: string | null;
    model: string | null;
    duration_seconds: number | null;
    segment_count: number;
    speakers: Speaker[];
    started_at: string | null;
    updated_at: string | null;
    purge_after: string | null;
};

export type NotulenSummary = {
    available: boolean;
    auto_minutes: boolean;
    can_configure: boolean;
    can_manage: boolean;
    can_view_transcript: boolean;
    notice: string | null;
    consent: { opted_out: boolean; can_change: boolean; attribute: string };
    llm: { enabled: boolean; provider: string; outside_indonesia: boolean };
    retention_days: number;
    links: {
        page: string;
        status: string;
        transcript: string;
        settings: string;
        consent: string;
        insert: string;
        discard: string;
        resummarize: string;
        /** `{id}` = suggestion id ("tl-1"). */
        task: string;
        minutes: string;
    };
    transcript: TranscriptInfo | null;
    draft: NotulenDraft | null;
};

export type TranscriptSegment = {
    i: number;
    speaker_identity: string;
    user_id: PersonId | null;
    speaker_name: string;
    start_ms: number;
    end_ms: number;
    text: string;
};

export type TranscriptSegments = {
    transcript_id: string;
    status: TranscriptStatus;
    language: string | null;
    duration_seconds: number | null;
    speakers: Speaker[];
    segments: TranscriptSegment[];
};

export type NotulenPageProps = {
    meeting: {
        id: string;
        title: string;
        occurrence_date: string;
        starts_at: string;
        ends_at: string;
        href: string;
        minutes_href: string;
        agenda: string[];
        workspace: { id: string; key: string; name: string } | null;
    };
    people: Person[];
    notulen: NotulenSummary;
    workspaces: { id: string; key: string; name: string }[];
};
