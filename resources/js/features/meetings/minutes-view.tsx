import { Link } from '@inertiajs/react';
import {
    AlertCircle,
    BellRing,
    Check,
    ChevronDown,
    FileDown,
    ListPlus,
    Lock,
    Plus,
    Trash2,
    X,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useId, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
    actionStatus,
    dueLabel,
    durationLabel,
    durationMinutes,
    firstName,
    minutesProgress,
    officeDate,
    personById,
    PLATFORM_LABEL,
    RECURRENCE_LABEL,
    shortDate,
    timeRange,
} from './lib';
import { useMeetingsContext } from './meetings-context';
import type { ActionItem, Minutes } from './types';
import type { MinutesData } from './use-minutes';

/** Grows a small control's hit area to 44px without changing the layout. */
const HIT_AREA = 'relative after:absolute after:-inset-2.5 after:content-[""]';

function StatusBadge({ minutes }: { minutes: Minutes }) {
    return minutes.status === 'final' ? (
        <Badge variant="status" tone="success" dot className="h-[34px]">
            Final · dibagikan
        </Badge>
    ) : (
        <Badge variant="status" tone="warning" dot className="h-[34px]">
            Draf
        </Badge>
    );
}

function SaveIndicator({ data }: { data: MinutesData }) {
    const minutes = data.minutes;

    return (
        <span
            role="status"
            aria-live="polite"
            className="text-[14px] font-semibold text-text-muted"
        >
            {data.saving
                ? 'Menyimpan…'
                : data.unsaved
                  ? 'Perubahan belum tersimpan'
                  : minutes.saved_at
                    ? `Disimpan ${formatTime(minutes.saved_at)} · ${minutes.version_count} versi`
                    : 'Draf baru · belum disimpan'}
        </span>
    );
}

function ProblemList({ problems }: { problems: string[] }) {
    if (problems.length === 0) {
        return null;
    }

    return (
        <div
            role="alert"
            className="flex gap-3 rounded-[18px] bg-danger-soft px-[18px] py-3.5 text-danger"
        >
            <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0" />
            <div className="flex flex-col gap-1">
                <span className="text-[16px] font-bold">
                    Lengkapi dulu sebelum difinalkan
                </span>
                <ul className="list-disc pl-5 text-[15px]">
                    {problems.map((problem) => (
                        <li key={problem}>{problem}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

/** Attendance chips: pressed = present (DNotulen "Kehadiran"). */
function AttendanceChips({ data }: { data: MinutesData }) {
    const minutes = data.minutes;
    const { people } = useMeetingsContext();

    if (minutes.attendance.length === 0) {
        return (
            <p className="text-[15px] text-text-muted">
                Belum ada peserta internal yang tercatat.
            </p>
        );
    }

    return (
        <div className="flex flex-wrap gap-2">
            {minutes.attendance.map((mark) => {
                const person = personById(people, mark.user_id);
                const name = person ? firstName(person.name) : 'Peserta';

                return (
                    <button
                        key={mark.user_id}
                        type="button"
                        aria-pressed={mark.present}
                        disabled={data.readOnly}
                        onClick={() => data.toggleAttendance(mark.user_id)}
                        aria-label={`${person?.name ?? name}: ${mark.present ? 'hadir' : `tidak hadir${mark.reason ? ` (${mark.reason})` : ''}`}`}
                        className={cn(
                            'inline-flex h-11 items-center gap-2 rounded-full pr-3.5 pl-1.5 text-[15px] font-semibold transition-colors duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring disabled:cursor-default md:h-10',
                            mark.present
                                ? 'border border-brand-200 bg-link-soft text-brand-800 dark:border-brand-800 dark:text-link'
                                : 'border border-dashed border-border-strong bg-background text-text-subtle',
                        )}
                    >
                        <UserAvatar
                            name={person?.name ?? name}
                            className={cn(
                                'size-7 text-[11px]',
                                !mark.present && 'opacity-60',
                            )}
                        />
                        <span className={cn(!mark.present && 'line-through')}>
                            {name}
                        </span>
                        {!mark.present && mark.reason && (
                            <span>· {mark.reason}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

function AddLine({
    label,
    placeholder,
    onAdd,
    icon: Icon = Plus,
}: {
    label: string;
    placeholder: string;
    onAdd: (text: string) => void;
    icon?: typeof Plus;
}) {
    const [text, setText] = useState('');
    const id = useId();

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (text.trim()) {
            onAdd(text);
            setText('');
        }
    };

    return (
        <form onSubmit={submit} className="flex items-center gap-2">
            <label htmlFor={id} className="sr-only">
                {label}
            </label>
            <Input
                id={id}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={placeholder}
                className="border-dashed"
            />
            <Button type="submit" variant="tonal" disabled={!text.trim()}>
                <Icon aria-hidden />
                {label}
            </Button>
        </form>
    );
}

function Sections({
    data,
    compact = false,
}: {
    data: MinutesData;
    compact?: boolean;
}) {
    const minutes = data.minutes;

    return (
        <div className={cn('flex flex-col', compact ? 'gap-4' : 'gap-[22px]')}>
            {minutes.sections.map((section, index) => (
                <div key={`${section.title}-${index}`} className="flex gap-4">
                    <span
                        aria-hidden
                        className="flex size-9 shrink-0 items-center justify-center rounded-control bg-grad-merek text-[16px] font-extrabold text-on-brand"
                    >
                        {index + 1}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <span
                            className="text-[19px] leading-7 font-bold"
                            id={`section-${index}`}
                        >
                            {section.title}
                        </span>
                        {data.readOnly ? (
                            <p className="text-[17px] leading-7 whitespace-pre-line text-text">
                                {section.body || (
                                    <span className="text-text-subtle">
                                        Tidak ada catatan.
                                    </span>
                                )}
                            </p>
                        ) : (
                            <Textarea
                                aria-labelledby={`section-${index}`}
                                value={section.body}
                                onChange={(event) =>
                                    data.updateSection(
                                        index,
                                        event.target.value,
                                    )
                                }
                                placeholder="Catat poin pembahasan…"
                                className="min-h-24 text-[17px] leading-7"
                            />
                        )}
                    </div>
                </div>
            ))}
            {!data.readOnly && (
                <AddLine
                    label="Tambah agenda"
                    placeholder="Judul butir agenda baru"
                    onAdd={data.addSection}
                    icon={ListPlus}
                />
            )}
        </div>
    );
}

function Decisions({ data }: { data: MinutesData }) {
    const minutes = data.minutes;

    return (
        <div className="flex flex-col gap-3">
            {minutes.decisions.length === 0 && (
                <p className="text-[16px] text-text-muted">
                    Belum ada keputusan dicatat.
                </p>
            )}
            <ul className="flex flex-col">
                {minutes.decisions.map((decision, index) => (
                    <li
                        key={`${decision}-${index}`}
                        className="flex items-start gap-3 border-t border-divider py-2.5 first:border-t-0"
                    >
                        <span
                            aria-hidden
                            className="mt-0.5 flex size-[26px] shrink-0 items-center justify-center rounded-full bg-success-soft text-success"
                        >
                            <Check className="size-[15px]" strokeWidth={3} />
                        </span>
                        <span className="flex-1 text-[17px] leading-[26px]">
                            {decision}
                        </span>
                        {!data.readOnly && (
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="max-md:size-11"
                                aria-label={`Hapus keputusan ${index + 1}`}
                                onClick={() => data.removeDecision(index)}
                            >
                                <X aria-hidden />
                            </Button>
                        )}
                    </li>
                ))}
            </ul>
            {!data.readOnly && (
                <AddLine
                    label="Tambah"
                    placeholder="Tulis keputusan rapat"
                    onAdd={data.addDecision}
                />
            )}
        </div>
    );
}

function TaskKey({ item }: { item: ActionItem }) {
    const chip =
        'inline-flex h-8 items-center rounded-sm bg-success-soft px-2.5 font-mono text-[14px] font-bold text-success';

    return item.task_url ? (
        <Link
            href={item.task_url}
            className={cn(chip, 'hover:underline')}
            aria-label={`Buka tugas ${item.task_key}`}
        >
            {item.task_key}
        </Link>
    ) : (
        <span className={chip}>{item.task_key}</span>
    );
}

function TaskCell({ item, data }: { item: ActionItem; data: MinutesData }) {
    if (item.task_key) {
        return <TaskKey item={item} />;
    }

    if (!data.canEdit) {
        return null;
    }

    return (
        <Button
            variant="outline"
            size="sm"
            disabled={
                !item.text.trim() ||
                data.processing ||
                item.id.startsWith('tmp-') ||
                (!data.meeting.workspace && !data.workspaceId)
            }
            onClick={() => data.makeTask(item.id)}
        >
            Jadikan tugas
        </Button>
    );
}

/** Target workspace of "Jadikan tugas" for a meeting without one. */
function WorkspacePicker({ data }: { data: MinutesData }) {
    if (data.meeting.workspace || !data.canEdit) {
        return null;
    }

    if (data.workspaces.length === 0) {
        return (
            <span className="text-[14px] text-text-muted">
                Tidak ada workspace tempat Anda dapat membuat tugas.
            </span>
        );
    }

    return (
        <Select
            value={data.workspaceId ?? undefined}
            onValueChange={(value) => value && data.setWorkspaceId(value)}
        >
            <SelectTrigger
                aria-label="Workspace tugas tindak lanjut"
                className="h-control-sm w-[220px]"
            >
                <SelectValue placeholder="Pilih workspace" />
            </SelectTrigger>
            <SelectContent>
                {data.workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                        {workspace.key} · {workspace.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/** Follow-up table (DNotulen "Tindak lanjut"). */
function ActionTable({ data }: { data: MinutesData }) {
    const minutes = data.minutes;
    const { people, me } = useMeetingsContext();
    const pending = minutes.action_items.filter(
        (item) => !item.task_key && item.text.trim(),
    ).length;

    return (
        <section
            aria-labelledby="actions-title"
            className="rounded-panel border border-border bg-surface pt-6 pb-2 shadow-card"
        >
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-3 md:px-7">
                <h2
                    id="actions-title"
                    className="text-[20px] leading-7 font-bold md:text-[22px]"
                >
                    Tindak lanjut
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                    <WorkspacePicker data={data} />
                    {pending > 0 && data.canEdit && (
                        <Button
                            variant="tonal"
                            size="sm"
                            onClick={data.makeAllTasks}
                            disabled={
                                data.processing ||
                                (!data.meeting.workspace && !data.workspaceId)
                            }
                        >
                            Jadikan semua tugas
                        </Button>
                    )}
                </div>
            </div>
            {minutes.action_items.length === 0 ? (
                <div className="px-6 pb-4 md:px-7">
                    <EmptyState
                        size="sm"
                        icon={ListPlus}
                        title="Belum ada tindak lanjut"
                    >
                        Tambahkan butir dengan penanggung jawab dan tenggat,
                        lalu jadikan tugas.
                    </EmptyState>
                </div>
            ) : (
                <div
                    role="table"
                    aria-labelledby="actions-title"
                    className="flex flex-col"
                >
                    <div
                        role="row"
                        className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1fr)_150px] gap-3.5 bg-background px-7 py-2.5 text-[14px] font-bold text-text-muted lg:grid"
                    >
                        <span role="columnheader">Butir</span>
                        <span role="columnheader">Penanggung jawab</span>
                        <span role="columnheader">Tenggat</span>
                        <span role="columnheader" className="text-right">
                            Tugas
                        </span>
                    </div>
                    {minutes.action_items.map((item, index) => {
                        const person = personById(people, item.assignee_id);
                        const status = actionStatus(item, data.today);

                        return (
                            <div
                                key={item.id}
                                role="row"
                                className="grid grid-cols-1 items-center gap-x-3.5 gap-y-2 border-t border-divider px-6 py-3 sm:grid-cols-2 md:px-7 lg:min-h-16 lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.3fr)_minmax(0,1fr)_150px]"
                            >
                                <span
                                    role="cell"
                                    className="flex items-center gap-2.5 sm:col-span-2 lg:col-span-1"
                                >
                                    {data.readOnly ? (
                                        <>
                                            <Checkbox
                                                checked={item.done}
                                                onCheckedChange={() =>
                                                    data.toggleDone(item.id)
                                                }
                                                disabled={!data.canTick(item)}
                                                aria-label={`Selesai: ${item.text}`}
                                                className={HIT_AREA}
                                            />
                                            <span
                                                className={cn(
                                                    'text-[16px] font-semibold',
                                                    item.done &&
                                                        'text-text-muted line-through',
                                                )}
                                            >
                                                {item.text}
                                            </span>
                                        </>
                                    ) : (
                                        <Input
                                            aria-label={`Butir tindak lanjut ${index + 1}`}
                                            value={item.text}
                                            onChange={(event) =>
                                                data.updateItem(item.id, {
                                                    text: event.target.value,
                                                })
                                            }
                                            placeholder="Apa yang harus dikerjakan"
                                            aria-invalid={
                                                (data.problems.length > 0 &&
                                                    !item.text.trim()) ||
                                                undefined
                                            }
                                            className="font-semibold"
                                        />
                                    )}
                                </span>
                                <span role="cell">
                                    {data.readOnly ? (
                                        <span className="text-[16px]">
                                            {person?.name ?? '–'}
                                        </span>
                                    ) : (
                                        <Select
                                            value={
                                                item.assignee_id ?? undefined
                                            }
                                            onValueChange={(value) =>
                                                value &&
                                                data.updateItem(item.id, {
                                                    assignee_id: value,
                                                })
                                            }
                                        >
                                            <SelectTrigger
                                                aria-label={`Penanggung jawab butir ${index + 1}`}
                                                className="w-full"
                                            >
                                                <SelectValue placeholder="Pilih orang" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {people.map((p) => (
                                                    <SelectItem
                                                        key={p.id}
                                                        value={p.id}
                                                    >
                                                        {p.id === me
                                                            ? `${p.name} (Anda)`
                                                            : p.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </span>
                                <span role="cell">
                                    {data.readOnly ? (
                                        <span
                                            className={cn(
                                                'text-[16px]',
                                                status === 'late' &&
                                                    'font-bold text-danger',
                                            )}
                                        >
                                            {dueLabel(
                                                item.due_date,
                                                data.today,
                                            )}
                                        </span>
                                    ) : (
                                        <Input
                                            type="date"
                                            aria-label={`Tenggat butir ${index + 1}`}
                                            value={item.due_date ?? ''}
                                            onChange={(event) =>
                                                data.updateItem(item.id, {
                                                    due_date:
                                                        event.target.value ||
                                                        null,
                                                })
                                            }
                                        />
                                    )}
                                </span>
                                <span
                                    role="cell"
                                    className="flex items-center justify-start gap-1 sm:col-span-2 lg:col-span-1 lg:justify-end"
                                >
                                    <TaskCell item={item} data={data} />
                                    {!data.readOnly && !item.task_key && (
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            className="max-md:size-11"
                                            aria-label={`Hapus butir ${index + 1}`}
                                            onClick={() =>
                                                data.removeItem(item.id)
                                            }
                                        >
                                            <Trash2 aria-hidden />
                                        </Button>
                                    )}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
            {!data.readOnly && (
                <div className="border-t border-divider px-5 py-2 md:px-6">
                    <Button variant="quiet" onClick={data.addItem}>
                        <Plus aria-hidden />
                        Tambah tindak lanjut
                    </Button>
                </div>
            )}
        </section>
    );
}

/** /rapat/{id}/notulen on desktop & tablet (design DNotulen). */
export function MinutesDesktop({ data }: { data: MinutesData }) {
    const { meeting, minutes } = data;
    const { people } = useMeetingsContext();
    const taker = personById(people, meeting.minute_taker_id);
    const present = minutes.attendance.filter((mark) => mark.present).length;
    const absentReasons = minutes.attendance.filter(
        (mark) => !mark.present && mark.reason,
    );
    const info: [string, string, boolean?][] = [
        [
            'Platform',
            meeting.location ?? PLATFORM_LABEL[meeting.platform],
            true,
        ],
        [
            'Penyelenggara',
            personById(people, meeting.organizer_id)?.name ?? '–',
        ],
        ['Workspace', meeting.workspace?.name ?? '–', true],
        ['Berulang', RECURRENCE_LABEL[meeting.recurrence]],
        [
            'Durasi',
            durationLabel(durationMinutes(meeting.starts_at, meeting.ends_at)),
        ],
        [
            'Versi',
            minutes.saved_at
                ? `Disimpan ${formatTime(minutes.saved_at)} · ${minutes.version_count} versi`
                : 'Belum disimpan',
        ],
    ];

    return (
        <div className="flex flex-col gap-[22px]">
            <section className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-[32px] leading-10 font-extrabold tracking-[-0.025em] lg:text-[40px] lg:leading-[48px]">
                            {meeting.title}
                        </h1>
                        <StatusBadge minutes={minutes} />
                    </div>
                    <p className="text-[17px] text-text-muted">
                        {shortDate(officeDate(meeting.starts_at))} ·{' '}
                        {timeRange(meeting.starts_at, meeting.ends_at)} ·{' '}
                        {PLATFORM_LABEL[meeting.platform]}
                        {taker ? ` · notulis ${taker.name}` : ''}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {!data.readOnly && <SaveIndicator data={data} />}
                    <Button
                        variant="outline"
                        size="lg"
                        disabled
                        title="Ekspor ke Google Docs ditahan"
                    >
                        <FileDown aria-hidden />
                        Ekspor ke Google Docs · Ditahan
                    </Button>
                    {minutes.status === 'final' &&
                        data.canEdit &&
                        data.openOwners.length > 0 && (
                            <Button
                                variant="tonal"
                                size="lg"
                                onClick={data.remind}
                                disabled={data.processing || data.reminded}
                            >
                                <BellRing aria-hidden />
                                {data.reminded
                                    ? 'PIC sudah diingatkan'
                                    : `Ingatkan ${data.openOwners.length} PIC`}
                            </Button>
                        )}
                    {minutes.status === 'final' && data.canReopen && (
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={data.reopen}
                            disabled={data.processing}
                        >
                            <Lock aria-hidden />
                            Buka kembali draf
                        </Button>
                    )}
                    {!data.readOnly && (
                        <Button
                            size="lg"
                            onClick={data.finalize}
                            disabled={data.processing}
                        >
                            {data.processing && <Spinner />}
                            Finalkan & bagikan
                        </Button>
                    )}
                </div>
            </section>

            <ProblemList problems={data.problems} />

            <section className="flex flex-wrap items-start gap-5">
                <div className="flex min-w-0 flex-[999_1_660px] flex-col gap-5">
                    <Panel
                        title="Kehadiran"
                        action={
                            <span className="text-[16px] font-bold text-link">
                                {present} dari {minutes.attendance.length} hadir
                            </span>
                        }
                    >
                        <AttendanceChips data={data} />
                        <p className="mt-3.5 text-[14px] text-text-muted">
                            Diisi otomatis dari peserta yang tidak menolak
                            undangan
                            {data.readOnly ? '.' : '; klik untuk mengubah.'}
                            {absentReasons.length > 0 &&
                                ` ${absentReasons.map((mark) => `${firstName(personById(people, mark.user_id)?.name ?? '')} ${mark.reason}`).join(', ')}.`}
                        </p>
                    </Panel>
                    <Panel title="Agenda & catatan">
                        <Sections data={data} />
                    </Panel>
                    <Panel title="Keputusan">
                        <Decisions data={data} />
                    </Panel>
                    <ActionTable data={data} />
                </div>
                <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
                    <dl className="rounded-panel border border-border bg-surface px-[22px] py-2 shadow-card">
                        {info.map(([key, value, teal]) => (
                            <div
                                key={key}
                                className="flex min-h-[54px] items-center justify-between gap-3 border-t border-divider text-[15px] first:border-t-0"
                            >
                                <dt className="font-semibold text-text-muted">
                                    {key}
                                </dt>
                                <dd
                                    className={cn(
                                        'text-right font-bold',
                                        teal && 'text-link',
                                    )}
                                >
                                    {value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                    <Panel
                        title={
                            data.readOnly
                                ? 'Sudah difinalkan'
                                : 'Setelah difinalkan'
                        }
                    >
                        <p className="text-[15px] leading-[22px] text-text-muted">
                            Notulen terkunci dan dikirim ke peserta lewat Inbox
                            dan email. Tindak lanjut yang sudah jadi tugas
                            muncul di Tugas saya masing-masing; butir lain bisa
                            dicentang penanggung jawabnya.
                        </p>
                    </Panel>
                </aside>
            </section>
        </div>
    );
}

/** /rapat/{id}/notulen on phones (designs MNotulen, MgPNotulen). */
export function MinutesMobile({ data }: { data: MinutesData }) {
    const { meeting, minutes } = data;
    const [showNotes, setShowNotes] = useState(false);
    const [showAttendance, setShowAttendance] = useState(false);
    const { people, me } = useMeetingsContext();
    const present = minutes.attendance.filter((mark) => mark.present).length;
    const progress = minutesProgress(minutes);
    const owners = data.openOwners.length;
    const bar =
        !data.readOnly ||
        (data.canEdit && owners > 0 && !data.reminded) ||
        (minutes.status === 'final' && data.canReopen);

    return (
        <div className={cn('flex flex-col gap-3.5', bar && 'pb-24')}>
            <div className="flex flex-wrap items-center gap-2">
                <StatusBadge minutes={minutes} />
                {!data.readOnly && <SaveIndicator data={data} />}
            </div>
            <div className="flex flex-col gap-1">
                <h2 className="text-[26px] leading-[33px] font-extrabold tracking-[-0.02em]">
                    {meeting.title}
                </h2>
                <span className="text-[15px] text-text-muted">
                    {shortDate(officeDate(meeting.starts_at))} ·{' '}
                    {formatTime(meeting.starts_at)} · {present} dari{' '}
                    {minutes.attendance.length} hadir
                </span>
            </div>
            <ProblemList problems={data.problems} />

            <section
                aria-labelledby="m-decisions"
                className="flex flex-col gap-2.5 rounded-[22px] border border-border bg-surface p-4"
            >
                <h3 id="m-decisions" className="text-[17px] font-extrabold">
                    {minutes.decisions.length} keputusan
                </h3>
                <Decisions data={data} />
            </section>

            <section
                aria-labelledby="m-actions"
                className="flex flex-col rounded-[22px] border border-border bg-surface px-4 pt-3.5 pb-1"
            >
                <div className="flex items-baseline justify-between pb-1.5">
                    <h3 id="m-actions" className="text-[17px] font-extrabold">
                        Tindak lanjut
                    </h3>
                    <span className="text-[13px] font-extrabold text-text-muted">
                        {progress.done}/{progress.total} selesai
                    </span>
                </div>
                {minutes.action_items.length === 0 && (
                    <p className="py-3 text-[15px] text-text-muted">
                        Belum ada tindak lanjut.
                    </p>
                )}
                <ul className="flex flex-col">
                    {minutes.action_items.map((item) => {
                        const person = personById(people, item.assignee_id);
                        const late = actionStatus(item, data.today) === 'late';

                        return (
                            <li
                                key={item.id}
                                className="flex min-h-[62px] items-center gap-3 border-t border-divider py-2"
                            >
                                <Checkbox
                                    checked={item.done}
                                    onCheckedChange={() =>
                                        data.toggleDone(item.id)
                                    }
                                    disabled={!data.canTick(item)}
                                    aria-label={`Selesai: ${item.text || 'butir baru'}`}
                                    className={cn(
                                        'size-[26px] rounded-[8px]',
                                        HIT_AREA,
                                    )}
                                />
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span
                                        className={cn(
                                            'text-[16px] font-semibold',
                                            item.done &&
                                                'text-text-muted line-through',
                                        )}
                                    >
                                        {item.text || 'Butir baru'}
                                    </span>
                                    <span className="text-[13px] text-text-muted">
                                        {person
                                            ? person.id === me
                                                ? 'Anda'
                                                : firstName(person.name)
                                            : '–'}{' '}
                                        ·{' '}
                                        <span
                                            className={cn(
                                                late && 'font-bold text-danger',
                                            )}
                                        >
                                            {dueLabel(
                                                item.due_date,
                                                data.today,
                                            )}
                                        </span>
                                        {item.task_key && (
                                            <span className="font-mono font-semibold">
                                                {' '}
                                                · {item.task_key}
                                            </span>
                                        )}
                                    </span>
                                </span>
                                {!item.task_key &&
                                    item.text.trim() &&
                                    data.canEdit &&
                                    (data.meeting.workspace ||
                                        data.workspaceId) && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-11"
                                            onClick={() =>
                                                data.makeTask(item.id)
                                            }
                                            disabled={data.processing}
                                        >
                                            Jadikan tugas
                                        </Button>
                                    )}
                            </li>
                        );
                    })}
                </ul>
            </section>

            <section className="rounded-[18px] border border-border bg-surface">
                <button
                    type="button"
                    aria-expanded={showAttendance}
                    onClick={() => setShowAttendance((open) => !open)}
                    className="flex min-h-[52px] w-full items-center justify-between rounded-[18px] px-4 text-left text-[16px] font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                    Kehadiran · {present} dari {minutes.attendance.length}
                    <ChevronDown
                        aria-hidden
                        className={cn(
                            'size-5 text-text-subtle transition-transform duration-180 ease-brand',
                            showAttendance && 'rotate-180',
                        )}
                    />
                </button>
                {showAttendance && (
                    <div className="px-4 pb-4">
                        <AttendanceChips data={data} />
                    </div>
                )}
            </section>

            <section className="rounded-[18px] border border-border bg-surface">
                <button
                    type="button"
                    aria-expanded={showNotes}
                    onClick={() => setShowNotes((open) => !open)}
                    className="flex min-h-[52px] w-full items-center justify-between rounded-[18px] px-4 text-left text-[16px] font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
                >
                    Catatan lengkap per agenda
                    <ChevronDown
                        aria-hidden
                        className={cn(
                            'size-5 text-text-subtle transition-transform duration-180 ease-brand',
                            showNotes && 'rotate-180',
                        )}
                    />
                </button>
                {showNotes && (
                    <div className="px-4 pb-4">
                        <Sections data={data} compact />
                    </div>
                )}
            </section>

            {bar && (
                <div className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 border-x-0 border-b-0 px-4 py-3">
                    {data.readOnly ? (
                        data.canEdit && owners > 0 && !data.reminded ? (
                            <Button
                                size="lg"
                                className="w-full font-extrabold"
                                onClick={data.remind}
                                disabled={data.processing}
                            >
                                Ingatkan {owners} PIC yang belum selesai
                            </Button>
                        ) : (
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-full font-extrabold"
                                onClick={data.reopen}
                                disabled={data.processing}
                            >
                                <Lock aria-hidden />
                                Buka kembali draf
                            </Button>
                        )
                    ) : (
                        <Button
                            size="lg"
                            className="w-full font-extrabold"
                            onClick={data.finalize}
                            disabled={data.processing}
                        >
                            {data.processing && <Spinner />}
                            Finalkan & bagikan
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
