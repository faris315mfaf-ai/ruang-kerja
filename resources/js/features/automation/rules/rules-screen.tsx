import {
    CheckCircle2,
    CircleSlash,
    Copy,
    History,
    MoreHorizontal,
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
import { SelectField } from '@/features/automation/form-fields';
import {
    PageHeading,
    PreviewBar,
    PreviewError,
    PreviewSkeleton,
} from '@/features/automation/preview-state';
import type { PreviewState } from '@/features/automation/preview-state';
import { RuleBuilder } from '@/features/automation/rules/rule-builder';
import { describeRule } from '@/features/automation/rules';
import type { RuleContext, RuleDraft } from '@/features/automation/rules';
import type {
    AutomationProps,
    AutomationRule,
    RuleRun,
    RunResult,
} from '@/features/automation/types';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { formatDateTime, formatRelative } from '@/lib/format';
import { palette } from '@/lib/palette';
import { cn } from '@/lib/utils';

/** Reference "now" of the sample data: Mon 5 Oct 2026, 12.00 WIB. */
const NOW = '2026-10-05T05:00:00Z';

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

export function RulesScreen({
    props,
    state,
    mobile,
}: {
    props: AutomationProps;
    state: PreviewState;
    mobile: boolean;
}) {
    const [rules, setRules] = useState<AutomationRule[]>(
        state === 'empty' ? [] : props.rules,
    );
    const runs = state === 'empty' ? [] : props.runs;
    const [builderOpen, setBuilderOpen] = useState(false);
    const [builderKey, setBuilderKey] = useState(0);
    const [logRule, setLogRule] = useState<string>('all');
    const { run } = useFakeMutation();
    const ctx: RuleContext = {
        workspaces: props.workspaces,
        labels: props.labels,
        people: props.people,
    };

    const openBuilder = () => {
        setBuilderKey((k) => k + 1);
        setBuilderOpen(true);
    };

    const toggle = (rule: AutomationRule, on: boolean) =>
        void run(
            () =>
                setRules((list) =>
                    list.map((r) =>
                        r.id === rule.id ? { ...r, is_active: on } : r,
                    ),
                ),
            {
                delay: 250,
                success: on ? `"${rule.name}" aktif` : `"${rule.name}" dijeda`,
            },
        );

    const duplicate = (rule: AutomationRule) =>
        void run(
            () =>
                setRules((list) => [
                    ...list,
                    {
                        ...rule,
                        id: `copy-${Date.now()}`,
                        name: `${rule.name} (salinan)`,
                        is_active: false,
                        run_count: 0,
                        last_run_at: null,
                    },
                ]),
            { delay: 300, success: 'Salinan dibuat (nonaktif)' },
        );

    const remove = (rule: AutomationRule) =>
        void run(
            () => setRules((list) => list.filter((r) => r.id !== rule.id)),
            {
                delay: 300,
                success: `"${rule.name}" dihapus`,
            },
        );

    const save = (draft: RuleDraft) =>
        setRules((list) => [
            {
                ...draft,
                id: `new-${Date.now()}`,
                is_active: true,
                last_run_at: null,
                run_count: 0,
                created_by: props.people[0].id,
            },
            ...list,
        ]);

    const active = rules.filter((r) => r.is_active).length;
    const failed = runs.filter((r) => r.result === 'failed').length;
    const visibleRuns = useMemo(
        () =>
            logRule === 'all'
                ? runs
                : runs.filter((r) => r.rule_id === logRule),
        [logRule, runs],
    );

    const newButton = (
        <Button onClick={openBuilder}>
            <Plus aria-hidden />
            Aturan baru
        </Button>
    );

    let body;

    if (state === 'loading') {
        body = <PreviewSkeleton kpis={mobile ? 0 : 3} />;
    } else if (state === 'error') {
        body = <PreviewError what="Aturan otomasi" />;
    } else if (rules.length === 0) {
        body = (
            <EmptyState
                icon={Workflow}
                title="Belum ada aturan otomasi"
                description="Contoh: saat tugas pindah ke Selesai, beri tahu Kepala Divisi dan tambah label Ditinjau."
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
                        onToggle={(on) => toggle(rule, on)}
                        onLog={() => setLogRule(rule.id)}
                        onDuplicate={() => duplicate(rule)}
                        onDelete={() => remove(rule)}
                    />
                ))}
            </ul>
        );
        const log = (
            <RunLog
                runs={visibleRuns}
                rules={rules}
                filter={logRule}
                onFilter={setLogRule}
            />
        );

        body = mobile ? (
            <div className="flex flex-col gap-4">
                <p className="px-1 text-[15px] text-text-muted tnum">
                    {active} aktif dari {rules.length} · {runs.length} eksekusi
                    7 hari · {failed} gagal
                </p>
                <section
                    aria-label="Daftar aturan"
                    className="overflow-hidden rounded-[22px] border border-border bg-surface"
                >
                    {list}
                </section>
                {log}
                <Fab label="Aturan baru" onClick={openBuilder} />
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
                        value={runs.length}
                        note={`${runs.filter((r) => r.result === 'success').length} berhasil`}
                    />
                    <KpiCard
                        label="Gagal"
                        value={failed}
                        valueClassName={failed > 0 ? 'text-danger' : undefined}
                        note={
                            failed > 0 ? 'Periksa log eksekusi' : 'Semua lancar'
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
            <PreviewBar />
            <PageHeading
                title="Otomasi"
                description={
                    'Aturan "jika … maka …" yang bekerja sendiri di workspace Anda.'
                }
                actions={
                    !mobile && state === 'ready' && rules.length > 0
                        ? newButton
                        : undefined
                }
            />
            <AutomationNav />
            {body}
            <RuleBuilder
                key={builderKey}
                open={builderOpen}
                onOpenChange={setBuilderOpen}
                ctx={ctx}
                mobile={mobile}
                onSaved={save}
            />
        </div>
    );
}

function RuleRow({
    rule,
    ctx,
    onToggle,
    onLog,
    onDuplicate,
    onDelete,
}: {
    rule: AutomationRule;
    ctx: RuleContext;
    onToggle: (on: boolean) => void;
    onLog: () => void;
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
                    <p className="text-[17px] leading-6 font-semibold text-text">
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
                            {formatRelative(rule.last_run_at, NOW)}
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
                    <DropdownMenuItem onSelect={onDuplicate}>
                        <Copy aria-hidden />
                        Duplikat
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                        <Trash2 aria-hidden />
                        Hapus
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </li>
    );
}

function RunLog({
    runs,
    rules,
    filter,
    onFilter,
}: {
    runs: RuleRun[];
    rules: AutomationRule[];
    filter: string;
    onFilter: (value: string) => void;
}) {
    return (
        <Panel title="Log eksekusi" bodyClassName="gap-3" flush>
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
                    description="Log muncul setelah aturan berjalan pertama kali."
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
                                        <span className="font-mono text-[14px] font-semibold text-text">
                                            {entry.task_key}
                                        </span>
                                        <span className="min-w-0 truncate font-semibold text-text">
                                            {entry.task_title}
                                        </span>
                                    </p>
                                    <p className="text-meta text-text-muted">
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
                                    {formatRelative(entry.ran_at, NOW)}
                                </time>
                            </li>
                        );
                    })}
                </ol>
            )}
        </Panel>
    );
}
