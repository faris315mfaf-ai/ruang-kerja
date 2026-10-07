/**
 * Notulen otomatis (Video RuangKerja) — shapes of docs/fitur/notulen-
 * otomatis-kontrak.md (agent notulen): status + consent + AI draft
 * (`NotulenSummary`, prop `notulen` and GET …/status), transcript segments
 * (GET …/transkrip, audited, never in props) and the review page props.
 * Times are ISO strings (UTC), dates office "YYYY-MM-DD".
 */
import type { Person, PersonId, WorkspaceRef } from '../types';

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

export type TranscriptSpeaker = {
    identity: string;
    user_id: PersonId | null;
    name: string;
    seconds: number;
};

/** Index of a transcript line (`segments[].i`) + its start. */
export type SourceRef = { i: number; start_ms: number };

export type DraftPoint = { teks: string; sumber: SourceRef[] };

export type DraftDecision = {
    teks: string;
    agenda: string | null;
    sumber: SourceRef[];
};

export type DraftFollowUp = {
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
    error: string | null;
    model: string | null;
    generated_at: string | null;
    inserted_at: string | null;
    discarded_at: string | null;
    ringkasan: string;
    agenda: { judul: string; poin: DraftPoint[] }[];
    keputusan: DraftDecision[];
    tindak_lanjut: DraftFollowUp[];
    perlu_dicek: string[];
};

export type NotulenTranscript = {
    id: string;
    status: TranscriptStatus;
    status_label: string;
    error: string | null;
    language: string;
    model: string;
    duration_seconds: number;
    segment_count: number;
    speakers: TranscriptSpeaker[];
    started_at: string;
    updated_at: string;
    purge_after: string | null;
};

export type NotulenLinks = {
    page: string;
    status: string;
    transcript: string;
    settings: string;
    consent: string;
    insert: string;
    discard: string;
    resummarize: string;
    minutes: string;
};

/** contract §2.1 */
export type NotulenSummary = {
    available: boolean;
    auto_minutes: boolean;
    can_configure: boolean;
    can_manage: boolean;
    can_view_transcript: boolean;
    notice: string | null;
    consent: { opted_out: boolean; can_change: boolean; attribute: string };
    llm: {
        enabled: boolean;
        provider: string | null;
        outside_indonesia: boolean;
    };
    retention_days: number;
    links: NotulenLinks;
    transcript: NotulenTranscript | null;
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

/** contract §2.2 — GET …/transkrip */
export type TranscriptSegments = {
    transcript_id: string;
    status: TranscriptStatus;
    language: string;
    duration_seconds: number;
    speakers: TranscriptSpeaker[];
    segments: TranscriptSegment[];
};

/** contract §2.3 — page meetings/notulen-otomatis */
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
        workspace: WorkspaceRef | null;
    };
    people: Person[];
    notulen: NotulenSummary;
    workspaces: WorkspaceRef[];
};
