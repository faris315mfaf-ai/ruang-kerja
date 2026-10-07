import { Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ListChecks,
    NotebookPen,
    RefreshCw,
    Search,
    Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/features/tasks/lib/api';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { notulenApi } from './api';
import {
    filterSegments,
    formatDuration,
    formatOffset,
    TRANSCRIPT_TONE,
} from './lib';
import type {
    DraftAction,
    NotulenPageProps,
    SourceRef,
    TranscriptSegment,
} from './types';
import { type NotulenState, useNotulen } from './use-notulen';

function SourceLinks({
    sources,
    onJump,
}: {
    sources: SourceRef[];
    onJump: (i: number) => void;
}) {
    if (sources.length === 0) {
        return null;
    }

    return (
        <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
            {sources.map((source) => (
                <button
                    key={source.i}
                    type="button"
                    onClick={() => onJump(source.i)}
                    className="min-h-8 rounded-sm px-1.5 text-[13px] font-semibold text-link tnum underline-offset-2 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring"
                    aria-label={`Lihat transkrip menit ${formatOffset(source.start_ms)}`}
                >
                    {formatOffset(source.start_ms)}
                </button>
            ))}
        </span>
    );
}

/** Left column: searchable transcript (fetched on open, audited server-side). */
function TranscriptPane({
    props,
    highlight,
    segments,
    error,
}: {
    props: NotulenPageProps;
    highlight: number | null;
    segments: TranscriptSegment[] | null;
    error: string | null;
}) {
    const [query, setQuery] = useState('');
    const shown = useMemo(
        () => (segments ? filterSegments(segments, query) : []),
        [segments, query],
    );
    const people = useMemo(
        () => new Map(props.people.map((p) => [p.id, p])),
        [props.people],
    );

    return (
        <section
            aria-label="Transkrip"
            className="flex min-w-0 flex-col gap-3 rounded-panel border border-border bg-surface p-4 shadow-card md:p-6"
        >
            <div className="relative">
                <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-text-subtle"
                />
                <Input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari di transkrip"
                    aria-label="Cari di transkrip"
                    className="pl-10"
                />
            </div>
            {error ? (
                <p role="alert" className="text-[15px] text-danger">
                    {error}
                </p>
            ) : segments === null ? (
                <div className="flex flex-col gap-3" aria-busy>
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-4/5" />
                </div>
            ) : shown.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={Search}
                    title={
                        segments.length === 0
                            ? 'Transkrip belum tersedia'
                            : 'Tidak ada yang cocok'
                    }
                />
            ) : (
                <ol className="flex flex-col">
                    {shown.map((segment) => {
                        const person = segment.user_id
                            ? people.get(segment.user_id)
                            : undefined;

                        return (
                            <li
                                key={segment.i}
                                id={`baris-${segment.i}`}
                                className={cn(
                                    'flex gap-3 rounded-control px-2 py-2.5',
                                    highlight === segment.i &&
                                        'bg-warning-soft',
                                )}
                            >
                                <UserAvatar
                                    name={segment.speaker_name}
                                    src={person?.avatar_url}
                                    className="size-8 shrink-0"
                                />
                                <span className="flex min-w-0 flex-col gap-0.5">
                                    <span className="flex items-baseline gap-2 text-[14px]">
                                        <span className="font-bold">
                                            {segment.speaker_name}
                                        </span>
                                        <span className="text-text-subtle tnum">
                                            {formatOffset(segment.start_ms)}
                                        </span>
                                    </span>
                                    <span className="text-[16px] leading-6">
                                        {segment.text}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
            )}
        </section>
    );
}

function ActionRow({
    action,
    state,
    canManage,
    workspaceId,
    needsWorkspace,
    onJump,
}: {
    action: DraftAction;
    state: NotulenState;
    canManage: boolean;
    workspaceId: string | null;
    needsWorkspace: boolean;
    onJump: (i: number) => void;
}) {
    return (
        <li className="flex flex-col gap-2 border-t border-divider py-3 first:border-t-0 sm:flex-row sm:items-center">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[16px] font-semibold">
                    {action.judul}
                    <SourceLinks sources={action.sumber} onJump={onJump} />
                </span>
                <span className="text-[14px] text-text-muted">
                    {action.penanggung_jawab?.nama ??
                        (action.penanggung_jawab_teks
                            ? `${action.penanggung_jawab_teks} (bukan peserta — pilih PIC)`
                            : 'Tanpa penanggung jawab')}
                    {action.tenggat
                        ? ` · tenggat ${formatDate(action.tenggat)}`
                        : ''}
                </span>
            </span>
            {action.task ? (
                <Button variant="outline" size="sm" asChild>
                    <Link href={action.task.href}>{action.task.key}</Link>
                </Button>
            ) : (
                canManage && (
                    <Button
                        variant="outline"
                        className="min-h-11"
                        disabled={
                            state.busy !== null ||
                            (needsWorkspace && !workspaceId)
                        }
                        onClick={() => void state.toTask(action, workspaceId)}
                    >
                        <ListChecks aria-hidden />
                        Jadikan tugas
                    </Button>
                )
            )}
        </li>
    );
}

/** Right column: AI draft + notulis actions. */
function DraftPane({
    props,
    state,
    onJump,
}: {
    props: NotulenPageProps;
    state: NotulenState;
    onJump: (i: number) => void;
}) {
    const summary = state.summary;
    const draft = summary?.draft ?? null;
    const [workspaceId, setWorkspaceId] = useState<string | null>(
        props.workspaces[0]?.id ?? null,
    );
    const needsWorkspace = props.meeting.workspace === null;
    const canManage = summary?.can_manage ?? false;
    const editable = draft?.status === 'ready';

    if (!summary || !draft) {
        return (
            <section className="rounded-panel border border-border bg-surface p-6 shadow-card">
                <EmptyState
                    size="sm"
                    icon={NotebookPen}
                    title="Draf belum ada"
                    description={
                        summary?.transcript?.status === 'ready'
                            ? 'Ringkasan AI tidak aktif di server ini; transkrip tetap bisa dibaca.'
                            : 'Draf disusun setelah transkrip selesai.'
                    }
                />
            </section>
        );
    }

    if (draft.status !== 'ready' && draft.status !== 'inserted') {
        return (
            <section className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-6 shadow-card">
                <Badge
                    variant="status"
                    tone={draft.status === 'failed' ? 'danger' : 'neutral'}
                    dot
                    className="self-start"
                >
                    {draft.status_label}
                </Badge>
                {draft.error && (
                    <p className="text-[15px] text-danger">{draft.error}</p>
                )}
                {canManage &&
                    summary.llm.enabled &&
                    draft.status !== 'pending' && (
                        <Button
                            variant="outline"
                            className="min-h-11 self-start"
                            disabled={state.busy !== null}
                            onClick={() => void state.resummarize()}
                        >
                            <RefreshCw aria-hidden />
                            Ringkas ulang
                        </Button>
                    )}
            </section>
        );
    }

    return (
        <section
            aria-label="Draf notulen otomatis"
            className="flex min-w-0 flex-col gap-5 rounded-panel border border-border bg-surface p-4 shadow-card md:p-6"
        >
            <div className="flex flex-wrap items-center gap-2">
                <Badge
                    variant="status"
                    tone={draft.status === 'inserted' ? 'success' : 'info'}
                    dot
                >
                    {draft.status_label}
                </Badge>
                <span className="text-[14px] text-text-muted">
                    Draf otomatis — periksa sebelum final
                </span>
            </div>

            {draft.ringkasan && (
                <div className="flex flex-col gap-1.5">
                    <h3 className="text-[17px] font-bold">Ringkasan</h3>
                    <p className="text-[16px] leading-6">{draft.ringkasan}</p>
                </div>
            )}

            {draft.agenda.map((item) => (
                <div key={item.judul} className="flex flex-col gap-1.5">
                    <h3 className="text-[17px] font-bold">{item.judul}</h3>
                    <ul className="flex list-disc flex-col gap-1 pl-5 text-[16px] leading-6">
                        {item.poin.map((point, index) => (
                            <li key={index}>
                                {point.teks}
                                <SourceLinks
                                    sources={point.sumber}
                                    onJump={onJump}
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            ))}

            {draft.keputusan.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <h3 className="text-[17px] font-bold">Keputusan</h3>
                    <ul className="flex list-disc flex-col gap-1 pl-5 text-[16px] leading-6">
                        {draft.keputusan.map((decision, index) => (
                            <li key={index}>
                                {decision.teks}
                                <SourceLinks
                                    sources={decision.sumber}
                                    onJump={onJump}
                                />
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {draft.tindak_lanjut.length > 0 && (
                <div className="flex flex-col gap-1.5">
                    <h3 className="text-[17px] font-bold">
                        Usulan tindak lanjut
                    </h3>
                    {needsWorkspace &&
                        canManage &&
                        props.workspaces.length > 0 && (
                            <Select
                                value={workspaceId ?? undefined}
                                onValueChange={setWorkspaceId}
                            >
                                <SelectTrigger
                                    aria-label="Workspace untuk tugas"
                                    className="sm:max-w-80"
                                >
                                    <SelectValue placeholder="Pilih workspace tugas" />
                                </SelectTrigger>
                                <SelectContent>
                                    {props.workspaces.map((workspace) => (
                                        <SelectItem
                                            key={workspace.id}
                                            value={workspace.id}
                                        >
                                            {workspace.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    <ul className="flex flex-col">
                        {draft.tindak_lanjut.map((action) => (
                            <ActionRow
                                key={action.id}
                                action={action}
                                state={state}
                                canManage={canManage}
                                workspaceId={workspaceId}
                                needsWorkspace={needsWorkspace}
                                onJump={onJump}
                            />
                        ))}
                    </ul>
                </div>
            )}

            {draft.perlu_dicek.length > 0 && (
                <div className="flex flex-col gap-1.5 rounded-control bg-warning-soft p-4 text-warning">
                    <h3 className="flex items-center gap-2 text-[17px] font-bold">
                        <AlertTriangle aria-hidden className="size-5" />
                        Perlu dicek
                    </h3>
                    <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] leading-[22px]">
                        {draft.perlu_dicek.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ul>
                </div>
            )}

            {canManage && editable && (
                <div className="flex flex-wrap gap-2.5">
                    <Button
                        className="min-h-11"
                        disabled={state.busy !== null}
                        onClick={async () => {
                            const result = await state.insert();

                            if (result) {
                                router.visit(result.minutes_href);
                            }
                        }}
                    >
                        <NotebookPen aria-hidden />
                        Masukkan ke notulen
                    </Button>
                    <Button
                        variant="outline"
                        className="min-h-11"
                        disabled={state.busy !== null}
                        onClick={() => void state.discard()}
                    >
                        <Trash2 aria-hidden />
                        Buang draf
                    </Button>
                </div>
            )}
        </section>
    );
}

/**
 * /rapat/{id}/notulen-otomatis — transcript (left) + AI draft (right);
 * phone: tabs. Minimal functional version of the arah C "Notulen
 * otomatis" screen (agent rapatui owns the final design).
 */
export function NotulenReview({
    props,
    mobile,
}: {
    props: NotulenPageProps;
    mobile: boolean;
}) {
    const state = useNotulen(props.notulen);
    const summary = state.summary ?? props.notulen;
    const [segments, setSegments] = useState<TranscriptSegment[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [highlight, setHighlight] = useState<number | null>(null);
    const [tab, setTab] = useState<'transkrip' | 'draf'>('draf');
    const transcriptStatus = summary.transcript?.status;
    const loaded = useRef<string | null>(null);

    useEffect(() => {
        const key = `${summary.transcript?.id}:${transcriptStatus}`;

        if (!summary.transcript || loaded.current === key) {
            return;
        }

        loaded.current = key;
        notulenApi
            .transcript(summary)
            .then((data) => setSegments(data.segments))
            .catch((e: unknown) =>
                setError(
                    e instanceof ApiError
                        ? e.message
                        : 'Transkrip gagal dimuat.',
                ),
            );
    }, [summary, transcriptStatus]);

    const jump = (i: number) => {
        setTab('transkrip');
        setHighlight(i);
        window.setTimeout(
            () =>
                document
                    .getElementById(`baris-${i}`)
                    ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
            50,
        );
    };

    const transcript = summary.transcript;
    const header = (
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                    {transcript && (
                        <Badge
                            variant="status"
                            tone={TRANSCRIPT_TONE[transcript.status]}
                            dot
                        >
                            {transcript.status_label}
                        </Badge>
                    )}
                    {transcript && (
                        <span className="text-[14px] text-text-muted">
                            {transcript.speakers.length} pembicara ·{' '}
                            {formatDuration(transcript.duration_seconds)}
                            {summary.optout_count > 0
                                ? ` · ${summary.optout_count} orang memilih tidak ditranskrip`
                                : ''}
                        </span>
                    )}
                </div>
                <h1 className="text-[26px] leading-[34px] font-extrabold tracking-[-0.02em] md:text-[34px] md:leading-[42px]">
                    Notulen otomatis · {props.meeting.title}
                </h1>
                <p className="text-[15px] text-text-muted">
                    {formatDate(props.meeting.occurrence_date)} · Transkrip
                    dihapus otomatis{' '}
                    {transcript?.purge_after
                        ? formatDate(transcript.purge_after)
                        : `setelah ${summary.retention_days} hari`}
                    {summary.llm.enabled && summary.llm.outside_indonesia
                        ? ` · Ringkasan AI oleh ${summary.llm.provider} (di luar Indonesia)`
                        : ''}
                </p>
            </div>
            <Button variant="outline" size="lg" asChild>
                <Link href={props.meeting.minutes_href}>
                    <NotebookPen aria-hidden />
                    Buka notulen
                </Link>
            </Button>
        </div>
    );

    if (!transcript) {
        return (
            <div className="flex flex-col gap-5">
                {header}
                <EmptyState
                    icon={NotebookPen}
                    title="Belum ada transkrip"
                    description="Transkrip muncul setelah rapat video dengan notulen otomatis selesai."
                />
            </div>
        );
    }

    const transcriptPane = (
        <TranscriptPane
            props={props}
            highlight={highlight}
            segments={segments}
            error={error}
        />
    );
    const draftPane = <DraftPane props={props} state={state} onJump={jump} />;

    if (mobile) {
        return (
            <div className="flex flex-col gap-4">
                {header}
                <div
                    role="tablist"
                    aria-label="Tampilan"
                    className="grid grid-cols-2 gap-2"
                >
                    {(['draf', 'transkrip'] as const).map((value) => (
                        <Button
                            key={value}
                            role="tab"
                            aria-selected={tab === value}
                            variant={tab === value ? 'default' : 'outline'}
                            className="min-h-11"
                            onClick={() => setTab(value)}
                        >
                            {value === 'draf' ? 'Draf AI' : 'Transkrip'}
                        </Button>
                    ))}
                </div>
                {tab === 'draf' ? draftPane : transcriptPane}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {header}
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                {transcriptPane}
                {draftPane}
            </div>
        </div>
    );
}
