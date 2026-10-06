import { Head, Link, useForm } from '@inertiajs/react';
import { BriefcaseBusiness, Plus, Settings2, Users } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/mobile/fab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { fieldClasses, Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { HiringShell } from '@/features/hiring/hiring-shell';
import {
    hiringUrls,
    POSITION_STATUS_LABELS,
    POSITION_STATUS_TONES,
    ROLE_LABELS,
} from '@/features/hiring/lib';
import type {
    DivisionOption,
    PositionRow,
    PositionsPageProps,
} from '@/features/hiring/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

function CreatePositionDialog({
    open,
    onOpenChange,
    divisions,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    divisions: DivisionOption[];
}) {
    const form = useForm({ title: '', division_id: '', description: '' });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <form
                    className="flex flex-col gap-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.transform((data) => ({
                            ...data,
                            division_id: data.division_id || null,
                        }));
                        form.post(hiringUrls.positions, {
                            onSuccess: () => onOpenChange(false),
                        });
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>Lowongan baru</DialogTitle>
                        <DialogDescription>
                            Dibuat sebagai draf. Lengkapi pewawancara,
                            pertanyaan, dan sambungan Google Form, lalu buka
                            lowongannya.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="position-title">
                                Judul lowongan
                            </Label>
                            <Input
                                id="position-title"
                                value={form.data.title}
                                maxLength={150}
                                placeholder="Mis. Staf Programmer Backend"
                                onChange={(event) =>
                                    form.setData('title', event.target.value)
                                }
                                required
                            />
                            <InputError message={form.errors.title} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="position-division">Divisi</Label>
                            <select
                                id="position-division"
                                value={form.data.division_id}
                                onChange={(event) =>
                                    form.setData(
                                        'division_id',
                                        event.target.value,
                                    )
                                }
                                className={cn(fieldClasses, 'h-control')}
                            >
                                <option value="">Tanpa divisi</option>
                                {divisions.map((division) => (
                                    <option
                                        key={division.id}
                                        value={division.id}
                                    >
                                        {division.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="position-description">
                                Deskripsi
                            </Label>
                            <Textarea
                                id="position-description"
                                value={form.data.description}
                                maxLength={5000}
                                onChange={(event) =>
                                    form.setData(
                                        'description',
                                        event.target.value,
                                    )
                                }
                            />
                            <InputError message={form.errors.description} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="quiet"
                            onClick={() => onOpenChange(false)}
                        >
                            Batal
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            Buat lowongan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function PositionCard({
    position,
    canManage,
}: {
    position: PositionRow;
    canManage: boolean;
}) {
    return (
        <article className="flex h-full flex-col gap-3.5 rounded-panel border border-border bg-surface p-[18px] shadow-card md:p-[22px]">
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <h2 className="line-clamp-2 text-title font-bold text-text">
                        {position.title}
                    </h2>
                    <p className="truncate text-meta text-text-muted">
                        {position.division ?? 'Tanpa divisi'}
                        {position.opened_at &&
                            ` · dibuka ${formatDate(position.opened_at)}`}
                    </p>
                </div>
                <Badge
                    variant="status"
                    tone={POSITION_STATUS_TONES[position.status]}
                    dot
                    className="h-7 text-[14px]"
                >
                    {POSITION_STATUS_LABELS[position.status]}
                </Badge>
            </div>
            {position.my_roles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {position.my_roles.map((role) => (
                        <Badge
                            key={role}
                            variant="label"
                            tone="link"
                            className="h-7"
                        >
                            Anda: {ROLE_LABELS[role]}
                        </Badge>
                    ))}
                </div>
            )}
            {position.description && (
                <p className="line-clamp-3 text-[15px] whitespace-pre-line text-text-muted">
                    {position.description}
                </p>
            )}
            <dl className="mt-auto grid grid-cols-3 gap-2 border-t border-divider pt-3 text-center">
                <div>
                    <dt className="text-meta text-text-muted">Pelamar</dt>
                    <dd className="text-title font-bold text-text tnum">
                        {formatNumber(position.candidates_count)}
                    </dd>
                </div>
                <div>
                    <dt className="text-meta text-text-muted">Dalam proses</dt>
                    <dd className="text-title font-bold text-text tnum">
                        {formatNumber(position.open_candidates_count)}
                    </dd>
                </div>
                <div>
                    <dt className="text-meta text-text-muted">Diterima</dt>
                    <dd className="text-title font-bold text-text tnum">
                        {formatNumber(position.hired_count)}
                    </dd>
                </div>
            </dl>
            <div className="flex flex-wrap gap-2">
                <Button asChild variant="tonal" size="sm" className="flex-1">
                    <Link href={hiringUrls.index({ position: position.id })}>
                        <Users aria-hidden />
                        Kandidat
                    </Link>
                </Button>
                {canManage && (
                    <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="flex-1"
                    >
                        <Link href={hiringUrls.position(position.id)}>
                            <Settings2 aria-hidden />
                            Pengaturan
                        </Link>
                    </Button>
                )}
            </div>
            <p className="sr-only">
                {position.interviewers_count} pewawancara,{' '}
                {position.approvers_count} penyetuju akhir
            </p>
        </article>
    );
}

/** /hiring/lowongan — tab Lowongan: positions as cards; HR creates and configures them. */
export default function HiringPositions({
    hiring,
    positions,
    divisions,
}: PositionsPageProps) {
    const mobile = useBreakpoint() === 'mobile';
    const [creating, setCreating] = useState(false);

    return (
        <>
            <Head title="Lowongan · Hiring" />
            <HiringShell
                overview={hiring}
                tab="positions"
                actions={
                    hiring.can_manage && !mobile ? (
                        <Button onClick={() => setCreating(true)}>
                            <Plus aria-hidden />
                            Lowongan baru
                        </Button>
                    ) : undefined
                }
            >
                {positions.length === 0 ? (
                    <EmptyState
                        icon={BriefcaseBusiness}
                        title="Belum ada lowongan"
                        description={
                            hiring.can_manage
                                ? 'Buat lowongan pertama untuk mulai menerima pelamar.'
                                : 'Lowongan yang Anda tangani akan muncul di sini.'
                        }
                        action={
                            hiring.can_manage ? (
                                <Button onClick={() => setCreating(true)}>
                                    <Plus aria-hidden />
                                    Lowongan baru
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3 md:gap-4">
                        {positions.map((position) => (
                            <li key={position.id} className="min-w-0">
                                <PositionCard
                                    position={position}
                                    canManage={hiring.can_manage}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </HiringShell>
            {hiring.can_manage && mobile && (
                <Fab label="Lowongan baru" onClick={() => setCreating(true)} />
            )}
            {hiring.can_manage && (
                <CreatePositionDialog
                    open={creating}
                    onOpenChange={setCreating}
                    divisions={divisions}
                />
            )}
        </>
    );
}

HiringPositions.layout = {
    breadcrumbs: [
        { title: 'Hiring', href: '/hiring' },
        { title: 'Lowongan', href: '/hiring/lowongan' },
    ],
    title: 'Lowongan',
    back: '/hiring',
};
