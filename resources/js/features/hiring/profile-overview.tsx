import { ExternalLink, FileText, Mail, Phone } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Progress } from '@/components/ui/progress';
import { formatDateTime } from '@/lib/format';
import {
    checklistProgress,
    formatScore,
    safeHref,
    scoreTotal,
    SOURCE_LABELS,
} from './lib';
import type { CandidateProfileProps } from './types';

function ExternalAnchor({ href, label }: { href: string; label: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 font-semibold break-all text-link underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
        >
            {label}
            <ExternalLink aria-hidden className="size-4 shrink-0" />
            <span className="sr-only">(membuka tab baru)</span>
        </a>
    );
}

/** "Buka CV" (opens the stored link in a new tab; no file is kept here). */
export function CvButton({
    url,
    size = 'default',
    className,
}: {
    url: string | null;
    size?: 'default' | 'lg';
    className?: string;
}) {
    const href = safeHref(url);

    if (!href) {
        return null;
    }

    return (
        <Button asChild variant="outline" size={size} className={className}>
            <a href={href} target="_blank" rel="noopener noreferrer">
                <FileText aria-hidden />
                Buka CV
                <span className="sr-only">(membuka tab baru)</span>
            </a>
        </Button>
    );
}

/** Contact data, attachments and the Google Form answers (tab Profil). */
export function ProfileTab({
    candidate,
}: Pick<CandidateProfileProps, 'candidate'>) {
    const email = candidate.email;
    const phone = candidate.phone;
    const attachments = candidate.attachments
        .map((file) => ({ ...file, href: safeHref(file.url) }))
        .filter(
            (file): file is { label: string; url: string; href: string } =>
                file.href !== null,
        );

    return (
        <div className="flex flex-col gap-5">
            <Panel title="Data kandidat">
                <dl className="grid gap-x-6 gap-y-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                        <dt className="text-meta text-text-muted">Email</dt>
                        <dd className="text-body break-all text-text">
                            {email ? (
                                <a
                                    href={`mailto:${email}`}
                                    className="inline-flex items-center gap-2 text-link hover:underline"
                                >
                                    <Mail aria-hidden className="size-4" />
                                    {email}
                                </a>
                            ) : (
                                '—'
                            )}
                        </dd>
                    </div>
                    <div className="flex flex-col gap-1">
                        <dt className="text-meta text-text-muted">No. HP</dt>
                        <dd className="text-body text-text">
                            {phone ? (
                                <a
                                    href={`tel:${phone.replace(/[^\d+]/g, '')}`}
                                    className="inline-flex items-center gap-2 text-link hover:underline"
                                >
                                    <Phone aria-hidden className="size-4" />
                                    {phone}
                                </a>
                            ) : (
                                '—'
                            )}
                        </dd>
                    </div>
                    <div className="flex flex-col gap-1">
                        <dt className="text-meta text-text-muted">Melamar</dt>
                        <dd className="text-body text-text">
                            {formatDateTime(candidate.applied_at)}
                        </dd>
                    </div>
                    <div className="flex flex-col gap-1">
                        <dt className="text-meta text-text-muted">Sumber</dt>
                        <dd className="text-body text-text">
                            {SOURCE_LABELS[candidate.source]}
                        </dd>
                    </div>
                    <div className="flex flex-col gap-1 md:col-span-2">
                        <dt className="text-meta text-text-muted">CV</dt>
                        <dd className="text-body">
                            {safeHref(candidate.cv_url) ? (
                                <ExternalAnchor
                                    href={safeHref(candidate.cv_url) ?? ''}
                                    label="Buka CV"
                                />
                            ) : (
                                <span className="text-text-muted">
                                    Belum ada tautan CV.
                                </span>
                            )}
                        </dd>
                    </div>
                </dl>
            </Panel>

            {attachments.length > 0 && (
                <Panel title="Berkas dari formulir">
                    <ul className="flex flex-col gap-1">
                        {attachments.map((file, index) => (
                            <li key={`${file.href}-${index}`}>
                                <ExternalAnchor
                                    href={file.href}
                                    label={file.label}
                                />
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}

            <Panel title="Jawaban formulir">
                {candidate.form_answers.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={FileText}
                        title="Tidak ada jawaban formulir"
                        description="Kandidat ini ditambahkan manual oleh HR."
                    />
                ) : (
                    <dl className="flex flex-col divide-y divide-divider">
                        {candidate.form_answers.map((row, index) => (
                            <div
                                key={index}
                                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
                            >
                                <dt className="text-meta font-semibold text-text-muted">
                                    {row.question}
                                </dt>
                                <dd className="text-body break-words whitespace-pre-wrap text-text">
                                    {row.answer === '' ? '—' : row.answer}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
            </Panel>
        </div>
    );
}

/** Right column on desktop / top of tab Profil on phones. */
export function ProfileSummary({
    candidate,
    questions,
    checklist,
    decisions,
    can,
}: Pick<
    CandidateProfileProps,
    'candidate' | 'questions' | 'checklist' | 'decisions' | 'can'
>) {
    const progress = checklistProgress(checklist);
    const total = can.see_all_scores ? scoreTotal(questions) : null;
    const decided = decisions.filter((row) => row.decision !== null).length;

    return (
        <Panel title="Ringkasan">
            <dl className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    <dt className="flex items-baseline justify-between text-meta text-text-muted">
                        Checklist wajib
                        <span className="font-semibold text-text tnum">
                            {progress.done}/{progress.total}
                        </span>
                    </dt>
                    <dd>
                        <Progress
                            value={
                                progress.total === 0
                                    ? 0
                                    : (progress.done / progress.total) * 100
                            }
                            label="Checklist wajib selesai"
                        />
                    </dd>
                </div>
                {can.see_all_scores && (
                    <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-meta text-text-muted">
                            Total poin wawancara
                        </dt>
                        <dd className="text-title font-bold text-text tnum">
                            {total
                                ? `${formatScore(total.total)} / ${total.max}`
                                : '—'}
                        </dd>
                    </div>
                )}
                <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-meta text-text-muted">
                        Keputusan akhir
                    </dt>
                    <dd>
                        <Badge
                            variant="status"
                            tone={
                                decided === decisions.length &&
                                decisions.length > 0
                                    ? 'success'
                                    : 'neutral'
                            }
                            className="h-7 text-[14px]"
                        >
                            {decided}/{decisions.length} penyetuju
                        </Badge>
                    </dd>
                </div>
                {candidate.position.division && (
                    <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-meta text-text-muted">Divisi</dt>
                        <dd className="text-body text-text">
                            {candidate.position.division}
                        </dd>
                    </div>
                )}
            </dl>
        </Panel>
    );
}
