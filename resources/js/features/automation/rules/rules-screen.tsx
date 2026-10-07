import { Link } from '@inertiajs/react';
import {
    CheckCircle2,
    CircleSlash,
    Copy,
    History,
    MoreHorizontal,
    Pencil,
    Plus,
    Trash2,
    Workflow,
    XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/mobile/fab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { KpiCard } from '@/components/ui/kpi-card';
import { Panel } from '@/components/ui/panel';
import { Switch } from '@/components/ui/switch';
import { AutomationNav } from '@/features/automation/automation-nav';
import { ConfirmDelete } from '@/features/automation/confirm-delete';
import { SelectField } from '@/features/automation/form-fields';
import { mutate } from '@/features/automation/mutation';
import { PageHeading } from '@/features/automation/preview-state';
import { RuleBuilder } from '@/features/automation/rules/rule-builder';
import { describeRule } from '@/features/automation/rules';
import type { RuleContext } from '@/features/automation/rules';
import type {
    AutomationProps,
    AutomationRule,
    RuleRun,
    RunResult,
} from '@/features/automation/types';
import { formatDateTime, formatRelative } from '@/lib/format';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';
import rulesRoutes from '@/routes/automation/rules';

const ONLY = ['automation'];

const RESULT: Record<
    RunResult,
    {
        label: string;
        tone: 'success' | 'danger' | 'neutral';
        icon: typeof CheckCircle2;
    }
> = {
    success: { label: 'Berhasil', tone: 'success', icon: CheckCircle2 },
    failed: { label: 'Gagal', tone: 'danger', icon: XCircle },
    skipped: { label: 'Dilewati', tone: 'neutral', icon: CircleSlash },
};

/** "OPS-112" → /w/OPS/tasks/112 (keys never contain "-"). */
function taskUrl(key: string): string {
    const [workspace, number] = key.split('-');

    return `/w/${workspace}/tasks/${number}`;
}

/**
 * /otomasi — rules of the workspaces the person belongs to, the run log of
 * the last 7 days and its counts. Only owners/admins of a workspace get the
 * switch, "Ubah", "Duplikat" and "Hapus" (AutomationRulePolicy).
 */
export function RulesScreen({
    props,
    mobile,
}: {
    props: AutomationProps;
    mobile: boolean;
}) {
    // Optimistic switch state until the reloaded props arrive (rolled back on error).
    const [pending, setPending] = useState<Record<string, boolean>>({});
    const rules = props.rules.map((rule) =>
        rule.id in pending ? { ...rule, is_active: pending[rule.id] } : rule,
    );
    const runs = props.runs;
    const [builderOpen, setBuilderOpen] = useState(false);
    const [builderKey, setBuilderKey] = useState(0);
    const [editing, setEditing] = useState<AutomationRule | null>(null);
    const [deleting, setDeleting] = useState<AutomationRule | null>(null);
    const [removing, setRemoving] = useState(false);
    const [logRule, setLogRule] = useState<string>('all');
    const manageable = props.workspaces.filter((w) => w.can_manage);
    const ctx: RuleContext = {
        workspaces: props.workspaces,
        labels: props.labels,
        people: props.people,
    };
    const builderCtx: RuleContext = { ...ctx, workspaces: manageable };

    const openBuilder = (rule: AutomationRule | null = null) => {
        setEditing(rule);
        setBuilderKey((k) => k + 1);
        setBuilderOpen(true);
    };

    const toggle = (rule: AutomationRule, on: boolean) => {
        setPending((map) => ({ ...map, [rule.id]: on }));
        mutate(
            'patch',
            rulesRoutes.active.url(rule.id),
            { is_active: on },
            {
                only: ONLY,
                onFinish: () =>
                    setPending((map) => {
                        const next = { ...map };
                        delete next[rule.id];

                        return next;
                    }),
            },
        );
    };

    const duplicate = (rule: AutomationRule) =>
        mutate('post', rulesRoutes.duplicate.url(rule.id), {}, { only: ONLY });

    const remove = () => {
        if (!deleting) {
            return;
        }

        setRemoving(true);
        mutate(
            'delete',
            rulesRoutes.destroy.url(deleting.id),
            {},
            {
                only: ONLY,
                onSuccess: () => {
                    setDeleting(null);
                    setLogRule('all');
                },
                onFinish: () => setRemoving(false),
            },
        );
    };

    const active = rules.filter((r) => r.is_active).length;
    const visibleRuns = useMemo(
        () =>
            logRule === 'all'
                ? runs
                : runs.filter((r) => r.rule_id === logRule),
        [logRule, runs],
    );

    const newButton =
        manageable.length > 0 ? (
            <Button onClick={() => openBuilder()}>
                <Plus aria-hidden />
                Aturan baru
            </Button>
        ) : undefined;

    let body;

    if (rules.length === 0) {
        body = (
            <EmptyState
                icon={Workflow}
                title="Belum ada aturan otomasi"
                description={
                    manageable.length > 0
                        ? 'Contoh: saat tugas pindah ke Selesai, beri tahu Kepala Divisi dan tambah label Ditinjau.'
                        : 'Aturan dibuat oleh owner atau admin workspace. Aturan di workspace Anda akan tampil di sini.'
                }
                action={newButton}
            />
        );
    } else {
        const list = (
            <ul className="divide-y divide-divider">
                {rules.map((rule) => (
                    <RuleRow
                        key={rule.id}
                        rule={rule}
                        ctx={ctx}
                        now={props.now}
                        onToggle={(on) => toggle(rule, on)}
                        onLog={() => setLogRule(rule.id)}
                        onEdit={() => openBuilder(rule)}
                        onDuplicate={() => duplicate(rule)}
                        onDelete={() => setDeleting(rule)}
                    />
                ))}
            </ul>
        );
        const log = (
            <RunLog
                runs={visibleRuns}
                rules={rules}
                filter={logRule}
                now={props.now}
                onFilter={setLogRule}
            />
        );

        body = mobile ? (
            <div className="flex flex-col gap-4">
                <p className="px-1 text-[15px] text-text-muted tnum">
                    {active} aktif dari {rules.length} · {props.stats.runs_7d}{' '}
                    eksekusi 7 hari · {props.stats.failed_7d} gagal
                </p>
                <section
                    aria-label="Daftar aturan"
                    className="overflow-hidden rounded-[22px] border border-border bg-surface"
                >
                    {list}
                </section>
                {log}
            </div>
        ) : (
            <div className="flex flex-col gap-5">
                <div className="grid gap-4 sm:grid-cols-3">
                    <KpiCard
                        label="Aturan aktif"
                        value={active}
                        suffix={`/ ${rules.length}`}
                        note="Dijeda tidak berjalan"
                    />
                    <KpiCard
                        label="Eksekusi 7 hari"
                        value={props.stats.runs_7d}
                        note={`${props.stats.success_7d} berhasil`}
                    />
                    <KpiCard
                        label="Gagal 7 hari"
                        value={props.stats.failed_7d}
                        valueClassName={
                            props.stats.failed_7d > 0
                                ? 'text-danger'
                                : undefined
                        }
                        note={
                            props.stats.failed_7d > 0
                                ? 'Periksa log eksekusi'
                                : 'Semua lancar'
                        }
                    />
                </div>
                <div className="flex flex-wrap items-start gap-5">
                    <Panel
                        title="Aturan"
                        action={
                            <span className="text-[15px] text-text-muted">
                                {rules.length} aturan
                            </span>
                        }
                        flush
                        className="min-w-0 flex-[1.5_1_560px] pb-2"
                    >
                        {list}
                    </Panel>
                    <div className="min-w-0 flex-[1_1_360px]">{log}</div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5 md:gap-6">
            <PageHeading
                title="Otomasi"
                description={
                    'Aturan "jika … maka …" yang bekerja sendiri di workspace Anda.'
                }
                actions={!mobile && rules.length > 0 ? newButton : undefined}
            />
            <AutomationNav />
            {body}
            {mobile && rules.length > 0 && manageable.length > 0 && (
                <Fab label="Aturan baru" onClick={() => openBuilder()} />
            )}
            {builderOpen && (
                <RuleBuilder
                    key={builderKey}
                    open={builderOpen}
                    onOpenChange={setBuilderOpen}
                    ctx={builderCtx}
                    mobile={mobile}
                    rule={editing}
                />
            )}
            <ConfirmDelete
                open={deleting !== null}
                onOpenChange={(open) => !open && setDeleting(null)}
                title={`Hapus aturan "${deleting?.name ?? ''}"?`}
                description="Aturan dan log eksekusinya dihapus. Perubahan yang sudah dibuat aturan ini pada tugas tetap ada."
                processing={removing}
                mobile={mobile}
                onConfirm={remove}
            />
        </div>
    );
}

function RuleRow({
    rule,
    ctx,
    now,
    onToggle,
    onLog,
    onEdit,
    onDuplicate,
    onDelete,
}: {
    rule: AutomationRule;
    ctx: RuleContext;
    now: string;
    onToggle: (on: boolean) => void;
    onLog: () => void;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
}) {
    const workspace = ctx.workspaces.find((w) => w.id === rule.workspace_id);
    const tone = palette(workspace?.color);

    return (
        <li className="flex items-start gap-3.5 px-4 py-4 md:gap-4 md:px-7">
            <Switch
                size="md"
                checked={rule.is_active}
                onCheckedChange={onToggle}
                disabled={!rule.can_manage}
                aria-label={`Aktifkan aturan ${rule.name}`}
                className="mt-0.5"
            />
            <div
                className={cn(
                    'flex min-w-0 flex-1 flex-col gap-1',
                    !rule.is_active && 'opacity-70',
                )}
            >
                <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 text-[17px] leading-6 font-semibold break-words text-text">
                        {rule.name}
                    </p>
                    {workspace && (
                        <Badge
                            variant="label"
                            className={cn(
                                tone.soft,
                                tone.text,
                                'h-6 px-2 text-[13px]',
                            )}
                        >
                            {workspace.key}
                        </Badge>
                    )}
                    {!rule.is_active && (
                        <Badge
                            variant="status"
                            tone="neutral"
                            className="h-6 px-2 text-[13px]"
                        >
                            Dijeda
                        </Badge>
                    )}
                </div>
                <p className="text-[15px] leading-[22px] text-text-muted">
                    {describeRule(ctx, rule)}
                </p>
                <p className="text-meta text-text-muted tnum">
                    {rule.last_run_at ? (
                        <time
                            dateTime={rule.last_run_at}
                            title={formatDateTime(rule.last_run_at)}
                        >
                            Terakhir berjalan{' '}
                            {formatRelative(rule.last_run_at, now)}
                        </time>
                    ) : (
                        'Belum pernah berjalan'
                    )}{' '}
                    · {rule.run_count} kali
                </p>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Menu aturan ${rule.name}`}
                        className="-mt-1 -mr-2"
                    >
                        <MoreHorizontal aria-hidden />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={onLog}>
                        <History aria-hidden />
                        Lihat log
                    </DropdownMenuItem>
                    {rule.can_manage && (
                        <>
                            <DropdownMenuItem onSelect={onEdit}>
                                <Pencil aria-hidden />
                                Ubah
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={onDuplicate}>
                                <Copy aria-hidden />
                                Duplikat
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                variant="destructive"
                                onSelect={onDelete}
                            >
                                <Trash2 aria-hidden />
                                Hapus
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    );
}

function RunLog({
    runs,
    rules,
    filter,
    now,
    onFilter,
}: {
    runs: RuleRun[];
    rules: AutomationRule[];
    filter: string;
    now: string;
    onFilter: (value: string) => void;
}) {
    return (
        <Panel title="Log eksekusi · 7 hari" bodyClassName="gap-3" flush>
            <div className="px-5 md:px-6">
                <SelectField
                    label="Tampilkan log untuk"
                    hideLabel
                    value={filter}
                    onChange={onFilter}
                    options={[
                        { value: 'all', label: 'Semua aturan' },
                        ...rules.map((r) => ({ value: r.id, label: r.name })),
                    ]}
                />
            </div>
            {runs.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={History}
                    title="Belum ada eksekusi"
                    description="Log muncul setelah aturan berjalan."
                    className="mx-5 md:mx-6"
                />
            ) : (
                <ol className="divide-y divide-divider">
                    {runs.map((entry) => {
                        const result = RESULT[entry.result];
                        const Icon = result.icon;

                        return (
                            <li
                                key={entry.id}
                                className="flex gap-3 px-5 py-3 md:px-6"
                            >
                                <Icon
                                    aria-hidden
                                    className={cn(
                                        'mt-0.5 size-5 shrink-0',
                                        entry.result === 'success' &&
                                            'text-success',
                                        entry.result === 'failed' &&
                                            'text-danger',
                                        entry.result === 'skipped' &&
                                            'text-text-subtle',
                                    )}
                                />
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <p className="flex flex-wrap items-baseline gap-x-2 text-[15px] leading-[22px]">
                                        {entry.task_id ? (
                                            <Link
                                                href={taskUrl(entry.task_key)}
                                                className="font-mono text-[14px] font-semibold text-link hover:underline"
                                            >
                                                {entry.task_key}
                                            </Link>
                                        ) : (
                                            <span className="font-mono text-[14px] font-semibold text-text">
                                                {entry.task_key}
                                            </span>
                                        )}
                                        <span className="min-w-0 truncate font-semibold text-text">
                                            {entry.task_title}
                                        </span>
                                    </p>
                                    <p className="text-meta break-words text-text-muted">
                                        <span
                                            className={cn(
                                                'font-semibold',
                                                entry.result === 'failed'
                                                    ? 'text-danger'
                                                    : 'text-text',
                                            )}
                                        >
                                            {result.label}
                                        </span>{' '}
                                        · {entry.detail}
                                    </p>
                                </div>
                                <time
                                    dateTime={entry.ran_at}
                                    title={formatDateTime(entry.ran_at)}
                                    className="shrink-0 text-meta text-text-muted"
                                >
                                    {formatRelative(entry.ran_at, now)}
                                </time>
                            </li>
                        );
                    })}
                </ol>
            )}
        </Panel>
    );
}
