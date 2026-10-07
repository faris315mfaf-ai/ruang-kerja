import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { fieldClasses, Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import { Textarea } from '@/components/ui/textarea';
import { HiringShell } from '@/features/hiring/hiring-shell';
import { hiringUrls, POSITION_STATUS_LABELS } from '@/features/hiring/lib';
import { PeoplePicker } from '@/features/hiring/people-picker';
import { QuestionList } from '@/features/hiring/question-list';
import type {
    FieldMap,
    PositionSettingsProps,
    PositionStatus,
} from '@/features/hiring/types';
import { WebhookPanel } from '@/features/hiring/webhook-panel';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn, focusRing } from '@/lib/utils';

const FIELDS: { key: keyof FieldMap; label: string; guess: string }[] = [
    { key: 'full_name', label: 'Nama lengkap', guess: 'Nama lengkap' },
    { key: 'email', label: 'Email', guess: 'Email' },
    { key: 'phone', label: 'No. HP', guess: 'No. HP' },
    { key: 'cv_url', label: 'CV', guess: 'CV' },
];

/**
 * /hiring/lowongan/{id} (HR): details & status, interviewers ("tim luar")
 * and final approvers, interview questions, Google Form connection and the
 * mapping of Form questions to candidate fields.
 */
export default function HiringPositionSettings({
    hiring,
    position,
    questions,
    employees,
    divisions,
}: PositionSettingsProps) {
    const mobile = useBreakpoint() === 'mobile';
    const form = useForm({
        title: position.title,
        division_id: position.division_id ?? '',
        description: position.description ?? '',
        status: position.status,
        interviewer_ids: position.interviewer_ids,
        final_approver_ids: position.final_approver_ids,
        field_map: {
            full_name: position.field_map.full_name ?? '',
            email: position.field_map.email ?? '',
            phone: position.field_map.phone ?? '',
            cv_url: position.field_map.cv_url ?? '',
        },
    });

    const submit = (event: React.FormEvent) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            division_id: data.division_id || null,
        }));
        form.put(hiringUrls.position(position.id), { preserveScroll: true });
    };

    return (
        <>
            <Head title={`${position.title} · Lowongan`} />
            <HiringShell overview={hiring} tab="positions">
                <Link
                    href={hiringUrls.positions}
                    className={cn(
                        'hidden w-fit items-center gap-2 rounded-sm text-[15px] font-semibold text-link md:inline-flex',
                        focusRing,
                    )}
                >
                    <ArrowLeft aria-hidden className="size-4" />
                    Semua lowongan
                </Link>
                <h2 className="text-h3 break-words">{position.title}</h2>

                <form onSubmit={submit} className="flex flex-col gap-5">
                    <Panel title="Detail lowongan" bodyClassName="gap-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="flex flex-col gap-2 md:col-span-2">
                                <Label htmlFor="title">Judul lowongan</Label>
                                <Input
                                    id="title"
                                    value={form.data.title}
                                    maxLength={150}
                                    onChange={(event) =>
                                        form.setData(
                                            'title',
                                            event.target.value,
                                        )
                                    }
                                    required
                                />
                                <InputError message={form.errors.title} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="division">Divisi</Label>
                                <select
                                    id="division"
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
                                <Label htmlFor="status">Status</Label>
                                <select
                                    id="status"
                                    value={form.data.status}
                                    onChange={(event) =>
                                        form.setData(
                                            'status',
                                            event.target
                                                .value as PositionStatus,
                                        )
                                    }
                                    className={cn(fieldClasses, 'h-control')}
                                >
                                    {(
                                        Object.keys(
                                            POSITION_STATUS_LABELS,
                                        ) as PositionStatus[]
                                    ).map((status) => (
                                        <option key={status} value={status}>
                                            {POSITION_STATUS_LABELS[status]}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-meta text-text-muted">
                                    Draf & Dibuka menerima jawaban formulir;
                                    Ditutup menolaknya.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 md:col-span-2">
                                <Label htmlFor="description">Deskripsi</Label>
                                <Textarea
                                    id="description"
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
                    </Panel>

                    <Panel title="Tim penilai" bodyClassName="gap-6">
                        <div className="grid gap-6 lg:grid-cols-2">
                            <PeoplePicker
                                label="Pewawancara"
                                description="Karyawan yang mewawancarai, mengisi poin, dan checklist pewawancara (tim luar HR)."
                                people={employees}
                                value={form.data.interviewer_ids}
                                onChange={(ids) =>
                                    form.setData('interviewer_ids', ids)
                                }
                                max={30}
                                error={form.errors.interviewer_ids}
                            />
                            <PeoplePicker
                                label="Penyetuju akhir"
                                description="Semua harus menyetujui agar kandidat diterima; satu penolakan menolak kandidat."
                                people={employees}
                                value={form.data.final_approver_ids}
                                onChange={(ids) =>
                                    form.setData('final_approver_ids', ids)
                                }
                                max={10}
                                error={form.errors.final_approver_ids}
                            />
                        </div>
                    </Panel>

                    <Panel
                        title="Pemetaan field formulir"
                        bodyClassName="gap-4"
                    >
                        <p className="text-[15px] text-text-muted">
                            Tulis judul pertanyaan Google Form untuk setiap data
                            kandidat, persis seperti di formulir. Kosongkan
                            untuk memakai tebakan bawaan.
                        </p>
                        <div className="grid gap-4 md:grid-cols-2">
                            {FIELDS.map((field) => (
                                <div
                                    key={field.key}
                                    className="flex flex-col gap-2"
                                >
                                    <Label htmlFor={`map-${field.key}`}>
                                        {field.label}
                                    </Label>
                                    <Input
                                        id={`map-${field.key}`}
                                        value={form.data.field_map[field.key]}
                                        maxLength={500}
                                        placeholder={`Bawaan: "${field.guess}"`}
                                        onChange={(event) =>
                                            form.setData('field_map', {
                                                ...form.data.field_map,
                                                [field.key]: event.target.value,
                                            })
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    </Panel>

                    <div
                        className={cn(
                            'flex justify-end',
                            mobile &&
                                'sticky bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom)+8px)] z-20',
                        )}
                    >
                        <Button
                            type="submit"
                            size={mobile ? 'lg' : 'default'}
                            disabled={form.processing || !form.isDirty}
                            className={cn(mobile && 'w-full shadow-float')}
                        >
                            Simpan pengaturan
                        </Button>
                    </div>
                </form>

                <Panel title="Pertanyaan wawancara">
                    <QuestionList
                        positionId={position.id}
                        questions={questions}
                    />
                </Panel>

                <Panel title="Sambungan Google Form">
                    <WebhookPanel
                        positionId={position.id}
                        initialUrl={position.webhook_url}
                    />
                </Panel>

                {position.candidates_count === 0 && (
                    <Panel title="Hapus lowongan">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-[15px] text-text-muted">
                                Hanya lowongan tanpa kandidat yang bisa dihapus.
                            </p>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => {
                                    if (
                                        window.confirm(
                                            `Hapus lowongan ${position.title}?`,
                                        )
                                    ) {
                                        router.delete(
                                            hiringUrls.position(position.id),
                                        );
                                    }
                                }}
                            >
                                <Trash2 aria-hidden />
                                Hapus lowongan
                            </Button>
                        </div>
                    </Panel>
                )}
            </HiringShell>
        </>
    );
}

HiringPositionSettings.layout = {
    breadcrumbs: [
        { title: 'Hiring', href: '/hiring' },
        { title: 'Lowongan', href: '/hiring/lowongan' },
        { title: 'Pengaturan', href: '/hiring/lowongan' },
    ],
    title: 'Pengaturan lowongan',
    back: '/hiring/lowongan',
};
