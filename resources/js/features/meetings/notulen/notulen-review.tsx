import { Link, router } from '@inertiajs/react';
import {
    Check,
    Clock,
    FileText,
    Flag,
    RefreshCw,
    Search,
    Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/features/tasks/lib/api';
import { formatTime } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { dueLabel, officeDate, shortDate } from '../lib';
import type { Person } from '../types';
import { notulenApi } from './api';
import {
    filterSegments,
    formatDuration,
    formatOffset,
    speakingShare,
    TRANSCRIPT_TONE,
} from './lib';
import type {
    DraftAction,
    NotulenPageProps,
    NotulenSummary,
    SourceRef,
    TranscriptSegment,
} from './types';
import type { NotulenState } from './use-notulen';
import { useNotulen } from './use-notulen';

type Clocker = (ms: number) => string;

/**
 * "09.14": wall-clock time of a transcript line (start of the recording +
 * offset) in the office timezone; "01:05" offsets when the start is unknown.
 */
function useClock(summary: NotulenSummary): Clocker {
    const started = summary.transcript?.started_at;

    return (ms: number) =>
        started
            ? formatTime(new Date(Date.parse(started) + ms))
            : formatOffset(ms);
}

/** Who said it: the employee from the server list (audit N-01/R-05). */
function speakerOf(
    people: Map<string, Person>,
    segment: Pick<TranscriptSegment, 'user_id' | 'speaker_name'>,
): { name: string; first: string; avatar: string | null } {
    const person = segment.user_id ? people.get(segment.user_id) : undefined;
    const name = person?.name ?? segment.speaker_name;

    return {
        name,
        first: name.split(' ')[0] ?? name,
        avatar: person?.avatar_url ?? null,
    };
}

function Overline({ children }: { children: ReactNode }) {
    return (
        <h3 className="text-[12px] font-bold tracking-[0.1em] text-text-subtle uppercase">
            {children}
        </h3>
    );
}

/** Timestamp link "09.24" → jumps to and highlights the source line. */
function SourceLink({
    source,
    clock,
    onJump,
}: {
    source: SourceRef;
    clock: Clocker;
    onJump: (i: number) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onJump(source.i)}
            className={cn(
                'hit-area rounded-[4px] font-mono text-[12px] font-semibold tnum underline underline-offset-2',
                focusRing,
            )}
            aria-label={`Lihat transkrip pukul ${clock(source.start_ms)}`}
        >
            {clock(source.start_ms)}
        </button>
    );
}

/** Left card: searchable transcript, source lines tinted, footer on retention. */
function TranscriptCard({
    props,
    summary,
    segments,
    error,
    highlight,
    sourceLines,
    clock,
}: {
    props: NotulenPageProps;
    summary: NotulenSummary;
    segments: TranscriptSegment[] | null;
    error: string | null;
    highlight: number | null;
    sourceLines: Set<number>;
    clock: Clocker;
}) {
    const [query, setQuery] = useState('');
    const people = useMemo(
        () => new Map(props.people.map((p) => [p.id, p])),
        [props.people],
    );
    const shown = useMemo(
        () => (segments ? filterSegments(segments, query) : []),
        [segments, query],
    );
    const transcript = summary.transcript;
    const shares = speakingShare(transcript?.speakers ?? []);

    return (
        <section
            aria-labelledby="transkrip-title"
            className="flex min-h-0 min-w-0 flex-col gap-3 rounded-panel border border-border bg-surface p-[18px] shadow-card"
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="transkrip-title" className="text-[16px] font-bold">
                    Transkrip
                </h2>
                <span className="text-[12px] text-text-subtle">
                    {transcript?.model?.includes('turbo')
                        ? 'Whisper turbo'
                        : 'Whisper'}{' '}
                    · bahasa Indonesia
                </span>
            </div>
            {transcript && transcript.speakers.length > 0 && (
                <p
                    className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-text-muted"
                    aria-label="Waktu bicara menurut transkrip"
                >
                    {transcript.speakers.map((speaker) => (
                        <span key={speaker.identity}>
                            {
                                speakerOf(people, {
                                    user_id: speaker.user_id,
                                    speaker_name: speaker.name,
                                }).first
                            }{' '}
                            <b className="tnum">{shares[speaker.identity]}%</b>
                        </span>
                    ))}
                </p>
            )}
            <label className="flex h-10 items-center gap-2 rounded-control bg-surface-2 px-3 text-text-subtle focus-within:ring-2 focus-within:ring-ring">
                <Search aria-hidden className="size-4 shrink-0" />
                <span className="sr-only">Cari di transkrip</span>
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari di transkrip…"
                    className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-text-subtle max-md:text-[16px]"
                />
            </label>
            <div className="min-h-0 flex-1 overflow-y-auto lg:max-h-[calc(100dvh-340px)]">
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
                    <ol className="flex flex-col gap-1">
                        {shown.map((segment) => {
                            const speaker = speakerOf(people, segment);
                            const source = sourceLines.has(segment.i);

                            return (
                                <li
                                    key={segment.i}
                                    id={`baris-${segment.i}`}
                                    tabIndex={-1}
                                    className={cn(
                                        'flex scroll-mt-4 items-start gap-2.5 rounded-control px-2.5 py-2 outline-none',
                                        source && 'bg-success-soft',
                                        highlight === segment.i &&
                                            'ring-2 ring-primary',
                                    )}
                                >
                                    <span className="w-10 shrink-0 pt-[3px] font-mono text-[12px] text-text-subtle tnum">
                                        {clock(segment.start_ms)}
                                    </span>
                                    <UserAvatar
                                        name={speaker.name}
                                        src={speaker.avatar}
                                        className="size-[26px] shrink-0 text-[10px]"
                                    />
                                    <span className="flex min-w-0 flex-col gap-px">
                                        <b className="text-[13px]">
                                            {speaker.first}
                                        </b>
                                        <span
                                            className={cn(
                                                'text-[14px] leading-5 break-words',
                                                source && 'text-success',
                                            )}
                                        >
                                            {segment.text}
                                        </span>
                                    </span>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </div>
            <p className="mt-auto text-[12px] text-text-subtle">
                Audio sudah dihapus setelah transkripsi. Transkrip hanya bisa
                dibuka peserta, disimpan {summary.retention_days} hari.
            </p>
        </section>
    );
}

function SuggestionRow({
    action,
    state,
    people,
    canManage,
    workspaceId,
    needsWorkspace,
    today,
}: {
    action: DraftAction;
    state: NotulenState;
    people: Map<string, Person>;
    canManage: boolean;
    workspaceId: string | null;
    needsWorkspace: boolean;
    today: string;
}) {
    const owner = action.penanggung_jawab
        ? speakerOf(people, {
              user_id: action.penanggung_jawab.user_id,
              speaker_name: action.penanggung_jawab.nama,
          })
        : null;

    return (
        <li className="flex items-center gap-2.5 rounded-control border border-border px-3 py-2.5 text-[14px]">
            {owner ? (
                <UserAvatar
                    name={owner.name}
                    src={owner.avatar}
                    className="size-[26px] shrink-0 text-[10px]"
                />
            ) : (
                <span
                    aria-hidden
                    className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-warning-soft text-[12px] font-bold text-warning"
                >
                    ?
                </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col">
                <span>{action.judul}</span>
                <span className="text-[12px] text-text-subtle">
                    {owner
                        ? owner.first
                        : action.penanggung_jawab_teks
                          ? `${action.penanggung_jawab_teks} (bukan peserta)`
                          : 'Tanpa penanggung jawab'}
                    {' · '}
                    {action.tenggat
                        ? dueLabel(action.tenggat, today)
                        : 'Tanpa tenggat'}
                </span>
            </span>
            {action.task ? (
                <Link
                    href={action.task.href}
                    className={cn(
                        'inline-flex items-center gap-1 text-[13px] font-semibold text-success hover:underline',
                        focusRing,
                    )}
                >
                    <Check aria-hidden className="size-3.5" />
                    {action.task.key}
                </Link>
            ) : (
                canManage && (
                    <Button
                        variant="tonal"
                        size="sm"
                        className="h-8 bg-info-soft px-2.5 text-[13px] text-info hover:bg-info-soft/80"
                        disabled={
                            state.busy !== null ||
                            (needsWorkspace && !workspaceId)
                        }
                        onClick={() => void state.toTask(action, workspaceId)}
                    >
                        Jadikan tugas
                    </Button>
                )
            )}
        </li>
    );
}

/** Right card: AI draft (summary, decisions, suggested follow-ups, checks). */
function DraftCard({
    props,
    state,
    summary,
    clock,
    onJump,
}: {
    props: NotulenPageProps;
    state: NotulenState;
    summary: NotulenSummary;
    clock: Clocker;
    onJump: (i: number) => void;
}) {
    const draft = summary.draft;
    const people = useMemo(
        () => new Map(props.people.map((p) => [p.id, p])),
        [props.people],
    );
    const [workspaceId, setWorkspaceId] = useState<string | null>(
        props.meeting.workspace?.id ?? props.workspaces[0]?.id ?? null,
    );
    const needsWorkspace = props.meeting.workspace === null;
    const canManage = summary.can_manage;
    const today = officeDate(Date.now());

    const head = (
        <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[16px] font-bold">Draf notulen</h2>
            <span className="inline-flex items-center gap-1.5 text-[12px] text-text-subtle">
                <Sparkles aria-hidden className="size-3.5" />
                Diringkas AI · periksa sebelum final
            </span>
        </div>
    );

    if (!draft || (draft.status !== 'ready' && draft.status !== 'inserted')) {
        return (
            <section className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-5 shadow-card">
                {head}
                {draft ? (
                    <>
                        <Badge
                            variant="status"
                            tone={
                                draft.status === 'failed' ? 'danger' : 'neutral'
                            }
                            dot
                            className="self-start"
                        >
                            {draft.status_label}
                        </Badge>
                        {draft.error && (
                            <p className="text-[15px] text-danger">
                                {draft.error}
                            </p>
                        )}
                        {canManage &&
                            summary.llm.enabled &&
                            draft.status !== 'pending' && (
                                <Button
                                    variant="outline"
                                    className="self-start"
                                    disabled={state.busy !== null}
                                    onClick={() => void state.resummarize()}
                                >
                                    <RefreshCw aria-hidden />
                                    Ringkas ulang
                                </Button>
                            )}
                    </>
                ) : (
                    <EmptyState
                        size="sm"
                        icon={FileText}
                        title="Draf belum ada"
                        description={
                            summary.transcript?.status === 'ready'
                                ? 'Ringkasan AI tidak aktif di server ini; transkrip tetap bisa dibaca.'
                                : 'Draf disusun setelah transkrip selesai.'
                        }
                    />
                )}
            </section>
        );
    }

    return (
        <section
            aria-label="Draf notulen otomatis"
            className="flex min-w-0 flex-col gap-3.5 rounded-panel border border-border bg-surface p-5 shadow-card"
        >
            {head}
            {draft.ringkasan && (
                <p className="text-[14px] leading-[1.55] text-text-muted">
                    <b className="text-text">Ringkasan.</b> {draft.ringkasan}
                </p>
            )}

            {draft.keputusan.length > 0 && (
                <>
                    <Overline>Keputusan</Overline>
                    <ul className="flex flex-col gap-2">
                        {draft.keputusan.map((decision, index) => (
                            <li
                                key={index}
                                className="flex items-start gap-2.5 rounded-control bg-success-soft px-3 py-2.5 text-[14px] text-success"
                            >
                                <Flag
                                    aria-hidden
                                    className="mt-0.5 size-4 shrink-0"
                                />
                                <span className="flex-1 text-text">
                                    {decision.teks}
                                </span>
                                {decision.sumber[0] && (
                                    <SourceLink
                                        source={decision.sumber[0]}
                                        clock={clock}
                                        onJump={onJump}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                </>
            )}

            {draft.tindak_lanjut.length > 0 && (
                <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <Overline>Usulan tindak lanjut</Overline>
                        {needsWorkspace &&
                            canManage &&
                            props.workspaces.length > 0 && (
                                <Select
                                    value={workspaceId ?? undefined}
                                    onValueChange={setWorkspaceId}
                                >
                                    <SelectTrigger
                                        aria-label="Workspace untuk tugas"
                                        className="h-control-sm w-[220px]"
                                    >
                                        <SelectValue placeholder="Pilih workspace tugas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {props.workspaces.map((workspace) => (
                                            <SelectItem
                                                key={workspace.id}
                                                value={workspace.id}
                                            >
                                                {workspace.key} ·{' '}
                                                {workspace.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                    </div>
                    <ul className="flex flex-col gap-2">
                        {draft.tindak_lanjut.map((action) => (
                            <SuggestionRow
                                key={action.id}
                                action={action}
                                state={state}
                                people={people}
                                canManage={canManage}
                                workspaceId={workspaceId}
                                needsWorkspace={needsWorkspace}
                                today={today}
                            />
                        ))}
                    </ul>
                </>
            )}

            {draft.perlu_dicek.map((item) => (
                <p
                    key={item}
                    className="flex items-start gap-2.5 rounded-control bg-warning-soft px-3 py-2.5 text-[14px] text-warning"
                >
                    <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
                    <span>
                        <b>Perlu dicek:</b> {item}
                    </span>
                </p>
            ))}

            {draft.agenda.length > 0 && (
                <details className="rounded-control border border-border px-3 py-2 text-[14px]">
                    <summary className="cursor-pointer font-semibold">
                        Poin per agenda ({draft.agenda.length})
                    </summary>
                    <div className="mt-2 flex flex-col gap-2">
                        {draft.agenda.map((item) => (
                            <div
                                key={item.judul}
                                className="flex flex-col gap-1"
                            >
                                <b>{item.judul}</b>
                                <ul className="list-disc pl-5 text-text-muted">
                                    {item.poin.map((point, index) => (
                                        <li key={index}>
                                            {point.teks}{' '}
                                            {point.sumber[0] && (
                                                <SourceLink
                                                    source={point.sumber[0]}
                                                    clock={clock}
                                                    onJump={onJump}
                                                />
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </section>
    );
}

/**
 * /rapat/{id}/notulen-otomatis — arah C "Notulen otomatis": after the
 * meeting, the transcript with speaker names (left) and the AI draft for
 * the minute taker (right): summary, decisions with timestamp links,
 * suggested follow-ups with "Jadikan tugas" (the existing convert-to-task
 * flow behind the notulen endpoint), "Perlu dicek"; header actions "Buang
 * draf" / "Masukkan ke notulen". Phone: tabs Draf | Transkrip.
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
    const clock = useClock(summary);
    const [segments, setSegments] = useState<TranscriptSegment[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [highlight, setHighlight] = useState<number | null>(null);
    const [tab, setTab] = useState<'draf' | 'transkrip'>('draf');
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

    const draft = summary.draft;
    const sourceLines = useMemo(
        () =>
            new Set(
                (draft?.keputusan ?? []).flatMap((decision) =>
                    decision.sumber.map((source) => source.i),
                ),
            ),
        [draft],
    );

    const jump = (i: number) => {
        setTab('transkrip');
        setHighlight(i);
        window.setTimeout(() => {
            const line = document.getElementById(`baris-${i}`);
            const reduce = window.matchMedia(
                '(prefers-reduced-motion: reduce)',
            ).matches;
            line?.scrollIntoView({
                block: 'center',
                behavior: reduce ? 'auto' : 'smooth',
            });
            line?.focus({ preventScroll: true });
        }, 50);
    };

    const transcript = summary.transcript;
    const ended = transcript?.started_at
        ? formatTime(
              new Date(
                  Date.parse(transcript.started_at) +
                      (transcript.duration_seconds ?? 0) * 1000,
              ),
          )
        : null;
    const canAct =
        summary.can_manage && draft !== null && draft.status === 'ready';
    const meta = [
        shortDate(props.meeting.occurrence_date),
        ended && `selesai ${ended}`,
        transcript?.duration_seconds &&
            formatDuration(transcript.duration_seconds),
        `${props.people.length} peserta`,
        summary.optout_count > 0 &&
            `${summary.optout_count} orang memilih tidak ditranskrip`,
    ]
        .filter(Boolean)
        .join(' · ');

    const header = (
        <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col">
                <span className="text-[12px] font-bold tracking-[0.12em] text-link uppercase">
                    Notulen otomatis ·{' '}
                    {draft?.status === 'inserted'
                        ? 'sudah dimasukkan'
                        : draft?.status === 'discarded'
                          ? 'draf dibuang'
                          : 'draf'}
                </span>
                <h1 className="text-[24px] leading-8 font-extrabold tracking-[-0.01em]">
                    {props.meeting.title}
                </h1>
                <p
                    className="text-[14px] text-text-muted"
                    data-testid="review-meta"
                >
                    {meta}
                </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
                {transcript && (
                    <Badge
                        variant="status"
                        tone={TRANSCRIPT_TONE[transcript.status]}
                        className="h-8 text-[13px]"
                    >
                        {transcript.status === 'ready' && (
                            <Check aria-hidden className="size-4" />
                        )}
                        {transcript.status === 'ready'
                            ? 'Transkrip siap'
                            : transcript.status_label}
                    </Badge>
                )}
                {canAct ? (
                    <>
                        <Button
                            variant="outline"
                            disabled={state.busy !== null}
                            onClick={() => void state.discard()}
                        >
                            Buang draf
                        </Button>
                        <Button
                            disabled={state.busy !== null}
                            onClick={async () => {
                                const result = await state.insert();

                                if (result) {
                                    router.visit(result.minutes_href);
                                }
                            }}
                        >
                            <FileText aria-hidden />
                            Masukkan ke notulen
                        </Button>
                    </>
                ) : (
                    <Button variant="outline" asChild>
                        <Link href={props.meeting.minutes_href}>
                            <FileText aria-hidden />
                            Buka notulen
                        </Link>
                    </Button>
                )}
            </div>
        </header>
    );

    if (!transcript) {
        return (
            <div className="flex flex-col gap-5">
                {header}
                <EmptyState
                    icon={FileText}
                    title="Belum ada transkrip"
                    description="Transkrip muncul setelah rapat video dengan notulen otomatis selesai."
                />
            </div>
        );
    }

    const transcriptCard = (
        <TranscriptCard
            props={props}
            summary={summary}
            segments={segments}
            error={error}
            highlight={highlight}
            sourceLines={sourceLines}
            clock={clock}
        />
    );
    const draftCard = (
        <DraftCard
            props={props}
            state={state}
            summary={summary}
            clock={clock}
            onJump={jump}
        />
    );

    if (mobile) {
        return (
            <div className="flex flex-col gap-4">
                {header}
                <div
                    role="tablist"
                    aria-label="Tampilan"
                    className="grid grid-cols-2 gap-1 rounded-[14px] bg-surface-2 p-1"
                >
                    {(['draf', 'transkrip'] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            role="tab"
                            aria-selected={tab === value}
                            onClick={() => setTab(value)}
                            className={cn(
                                'h-11 rounded-[10px] text-[16px] font-semibold',
                                tab === value
                                    ? 'bg-surface text-text shadow-segment'
                                    : 'text-text-muted',
                                focusRing,
                            )}
                        >
                            {value === 'draf' ? 'Draf notulen' : 'Transkrip'}
                        </button>
                    ))}
                </div>
                {tab === 'draf' ? draftCard : transcriptCard}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {header}
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
                {transcriptCard}
                {draftCard}
            </div>
        </div>
    );
}
