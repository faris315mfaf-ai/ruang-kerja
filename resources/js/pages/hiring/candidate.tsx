import { Head, Link } from '@inertiajs/react';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SegmentedTabs } from '@/components/ui/tabs';
import { ChecklistTab } from '@/features/hiring/checklist-tab';
import { DecisionTab } from '@/features/hiring/decision-tab';
import { EditCandidateDialog } from '@/features/hiring/edit-candidate-dialog';
import { InterviewScheduleCard } from '@/features/hiring/interview-schedule-card';
import { InterviewTab } from '@/features/hiring/interview-tab';
import {
    checklistProgress,
    hiringUrls,
    SOURCE_LABELS,
    STAGE_LABELS,
    STAGE_TONES,
} from '@/features/hiring/lib';
import { NotesTab } from '@/features/hiring/notes-tab';
import {
    CvButton,
    ProfileSummary,
    ProfileTab,
} from '@/features/hiring/profile-overview';
import { StageMenu } from '@/features/hiring/stage-control';
import type { CandidateProfileProps } from '@/features/hiring/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatDate } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';

const TABS = [
    'profil',
    'wawancara',
    'checklist',
    'notulensi',
    'keputusan',
] as const;

type Tab = (typeof TABS)[number];

function isTab(value: string | null): value is Tab {
    return value !== null && (TABS as readonly string[]).includes(value);
}

/**
 * /hiring/kandidat/{id}: candidate profile (data & CV, Form answers),
 * interview questions with answers and points, checklist per reviewer,
 * notulensi and the final decision. Desktop: tabs + summary column; phone:
 * one column, summary at the top of Profil.
 */
export default function HiringCandidate(props: CandidateProfileProps) {
    const { candidate, can, checklist, notes, decisions, initialTab } = props;
    const breakpoint = useBreakpoint();
    const mobile = breakpoint === 'mobile';
    const [tab, setTab] = useState<Tab>(
        isTab(initialTab) ? initialTab : 'profil',
    );
    const [editing, setEditing] = useState(false);
    const progress = checklistProgress(checklist);
    const pendingDecision = decisions.filter(
        (row) => row.decision === null,
    ).length;

    const select = (next: Tab) => {
        setTab(next);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', next);
        window.history.replaceState(window.history.state, '', url);
    };

    const content = (() => {
        switch (tab) {
            case 'wawancara':
                return <InterviewTab {...props} />;
            case 'checklist':
                return <ChecklistTab {...props} />;
            case 'notulensi':
                return <NotesTab {...props} />;
            case 'keputusan':
                return <DecisionTab {...props} mobile={mobile} />;
            default:
                return (
                    <div className="flex flex-col gap-5">
                        {breakpoint !== 'desktop' && (
                            <>
                                <InterviewScheduleCard
                                    candidateId={candidate.id}
                                    interview={candidate.interview}
                                />
                                <ProfileSummary {...props} />
                            </>
                        )}
                        <ProfileTab candidate={candidate} />
                    </div>
                );
        }
    })();

    return (
        <>
            <Head title={candidate.full_name} />
            <div className="flex flex-col gap-5 md:gap-6">
                <Link
                    href={hiringUrls.index()}
                    className={cn(
                        'hidden w-fit items-center gap-2 rounded-sm text-[15px] font-semibold text-link md:inline-flex',
                        focusRing,
                    )}
                >
                    <ArrowLeft aria-hidden className="size-4" />
                    Kandidat
                </Link>
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-2">
                        <h1 className="text-h2 break-words md:text-h1">
                            {candidate.full_name}
                        </h1>
                        <p className="text-body text-text-muted">
                            {candidate.position.title}
                            {candidate.position.division
                                ? ` · ${candidate.position.division}`
                                : ''}
                            {' · '}
                            {SOURCE_LABELS[candidate.source]},{' '}
                            {formatDate(candidate.applied_at)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge
                                variant="status"
                                tone={STAGE_TONES[candidate.stage]}
                                dot
                            >
                                {STAGE_LABELS[candidate.stage]}
                            </Badge>
                            {candidate.stage === 'final_review' &&
                                pendingDecision > 0 && (
                                    <Badge variant="status" tone="warning">
                                        {pendingDecision} penyetuju belum
                                        memutus
                                    </Badge>
                                )}
                        </div>
                    </div>
                    <div
                        className={cn(
                            'flex flex-wrap gap-2',
                            mobile && 'w-full [&>*]:flex-1',
                        )}
                    >
                        <CvButton
                            url={candidate.cv_url}
                            size={mobile ? 'lg' : 'default'}
                        />
                        {can.manage && (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size={mobile ? 'lg' : 'default'}
                                    onClick={() => setEditing(true)}
                                >
                                    <Pencil aria-hidden />
                                    Ubah data
                                </Button>
                                <StageMenu
                                    candidateId={candidate.id}
                                    candidateName={candidate.full_name}
                                    stage={candidate.stage}
                                    size={mobile ? 'lg' : 'default'}
                                />
                            </>
                        )}
                    </div>
                </header>

                {candidate.stage === 'rejected' &&
                    candidate.rejected_reason && (
                        <div className="rounded-lg border border-danger-soft bg-danger-soft px-5 py-4 text-danger">
                            <p className="text-label">Alasan penolakan</p>
                            <p className="text-[15px] break-words whitespace-pre-wrap">
                                {candidate.rejected_reason}
                            </p>
                        </div>
                    )}

                <div className="-mx-4 [scrollbar-width:none] overflow-x-auto px-4 md:mx-0 md:px-0">
                    <SegmentedTabs<Tab>
                        label="Bagian profil kandidat"
                        value={tab}
                        onValueChange={select}
                        options={[
                            {
                                value: 'profil',
                                label: 'Profil',
                                id: 'tab-profil',
                                controls: 'panel-kandidat',
                            },
                            {
                                value: 'wawancara',
                                label: 'Wawancara',
                                id: 'tab-wawancara',
                                controls: 'panel-kandidat',
                            },
                            {
                                value: 'checklist',
                                label: `Checklist ${progress.done}/${progress.total}`,
                                id: 'tab-checklist',
                                controls: 'panel-kandidat',
                            },
                            {
                                value: 'notulensi',
                                label: `Notulensi${notes.length > 0 ? ` ${notes.length}` : ''}`,
                                id: 'tab-notulensi',
                                controls: 'panel-kandidat',
                            },
                            {
                                value: 'keputusan',
                                label: 'Keputusan',
                                id: 'tab-keputusan',
                                controls: 'panel-kandidat',
                            },
                        ]}
                    />
                </div>

                {breakpoint === null ? (
                    <Skeleton className="h-96 w-full rounded-panel" />
                ) : (
                    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
                        <div
                            id="panel-kandidat"
                            role="tabpanel"
                            aria-labelledby={`tab-${tab}`}
                            className="min-w-0"
                        >
                            {content}
                        </div>
                        {breakpoint === 'desktop' && (
                            <aside className="flex flex-col gap-5">
                                <InterviewScheduleCard
                                    candidateId={candidate.id}
                                    interview={candidate.interview}
                                />
                                <ProfileSummary {...props} />
                            </aside>
                        )}
                    </div>
                )}
            </div>
            {can.manage && (
                <EditCandidateDialog
                    key={`${candidate.full_name}|${candidate.email}|${candidate.phone}|${candidate.cv_url}`}
                    candidate={candidate}
                    open={editing}
                    onOpenChange={setEditing}
                />
            )}
        </>
    );
}

HiringCandidate.layout = {
    width: 'wide',
    breadcrumbs: [
        { title: 'Hiring', href: '/hiring' },
        { title: 'Kandidat', href: '/hiring' },
    ],
    title: 'Kandidat',
    back: '/hiring',
};
