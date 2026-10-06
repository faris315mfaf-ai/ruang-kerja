import { Head, useForm } from '@inertiajs/react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { HiringShell } from '@/features/hiring/hiring-shell';
import { hiringUrls, ROLE_LABELS } from '@/features/hiring/lib';
import { PeoplePicker } from '@/features/hiring/people-picker';
import type {
    ChecklistTemplate,
    HiringSettingsProps,
    ReviewerRole,
} from '@/features/hiring/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';

const ROLE_HINTS: Record<ReviewerRole, string> = {
    hr: 'Dicentang oleh HR mana pun.',
    interviewer:
        'Satu set per pewawancara lowongan; masing-masing mencentang miliknya.',
    approver:
        'Satu set per penyetuju akhir; wajib dicentang sebelum menyetujui.',
};

const ROLES: ReviewerRole[] = ['hr', 'interviewer', 'approver'];

/**
 * /hiring/pengaturan (HR): default final approvers of new positions (e.g.
 * Faris & Dio) and the checklist template per reviewer role. Changes apply
 * to new positions / new candidates only.
 */
export default function HiringSettings({
    hiring,
    settings,
    employees,
}: HiringSettingsProps) {
    const mobile = useBreakpoint() === 'mobile';
    const form = useForm<{
        default_final_approver_ids: string[];
        checklist_template: ChecklistTemplate;
    }>({
        default_final_approver_ids: settings.default_final_approver_ids,
        checklist_template: settings.checklist_template,
    });

    const setItems = (
        role: ReviewerRole,
        items: ChecklistTemplate[ReviewerRole],
    ) =>
        form.setData('checklist_template', {
            ...form.data.checklist_template,
            [role]: items,
        });

    return (
        <>
            <Head title="Pengaturan · Hiring" />
            <HiringShell overview={hiring} tab="settings">
                <form
                    className="flex flex-col gap-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.transform((data) => ({
                            ...data,
                            checklist_template: Object.fromEntries(
                                ROLES.map((role) => [
                                    role,
                                    data.checklist_template[role].filter(
                                        (item) => item.label.trim() !== '',
                                    ),
                                ]),
                            ) as ChecklistTemplate,
                        }));
                        form.put(hiringUrls.settings, { preserveScroll: true });
                    }}
                >
                    <Panel title="Penyetuju akhir bawaan">
                        <PeoplePicker
                            label="Penyetuju akhir"
                            description="Dipakai untuk lowongan baru; bisa diubah per lowongan."
                            people={employees}
                            value={form.data.default_final_approver_ids}
                            onChange={(ids) =>
                                form.setData('default_final_approver_ids', ids)
                            }
                            max={10}
                            error={form.errors.default_final_approver_ids}
                        />
                    </Panel>

                    <Panel title="Templat checklist" bodyClassName="gap-6">
                        <p className="text-[15px] text-text-muted">
                            Butir ini dibuat untuk setiap kandidat baru. Butir
                            wajib HR & pewawancara harus selesai sebelum
                            kandidat masuk Keputusan akhir.
                        </p>
                        {ROLES.map((role) => {
                            const items = form.data.checklist_template[role];

                            return (
                                <fieldset
                                    key={role}
                                    className="flex flex-col gap-3"
                                >
                                    <legend className="text-title font-bold text-text">
                                        {ROLE_LABELS[role]}
                                    </legend>
                                    <p className="-mt-1 text-meta text-text-muted">
                                        {ROLE_HINTS[role]}
                                    </p>
                                    {items.length === 0 && (
                                        <p className="text-meta text-text-muted">
                                            Tidak ada butir.
                                        </p>
                                    )}
                                    <ul className="flex flex-col gap-2">
                                        {items.map((item, index) => (
                                            <li
                                                key={index}
                                                className="flex flex-wrap items-center gap-3 md:flex-nowrap"
                                            >
                                                <Input
                                                    value={item.label}
                                                    maxLength={200}
                                                    aria-label={`Butir ${index + 1} ${ROLE_LABELS[role]}`}
                                                    onChange={(event) =>
                                                        setItems(
                                                            role,
                                                            items.map(
                                                                (row, i) =>
                                                                    i === index
                                                                        ? {
                                                                              ...row,
                                                                              label: event
                                                                                  .target
                                                                                  .value,
                                                                          }
                                                                        : row,
                                                            ),
                                                        )
                                                    }
                                                    className="min-w-0 flex-1 basis-full md:basis-auto"
                                                />
                                                <label className="flex min-h-11 items-center gap-2 text-[15px] text-text">
                                                    <Checkbox
                                                        checked={item.required}
                                                        onCheckedChange={(
                                                            state,
                                                        ) =>
                                                            setItems(
                                                                role,
                                                                items.map(
                                                                    (row, i) =>
                                                                        i ===
                                                                        index
                                                                            ? {
                                                                                  ...row,
                                                                                  required:
                                                                                      state ===
                                                                                      true,
                                                                              }
                                                                            : row,
                                                                ),
                                                            )
                                                        }
                                                    />
                                                    Wajib
                                                </label>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label={`Hapus butir ${index + 1}`}
                                                    onClick={() =>
                                                        setItems(
                                                            role,
                                                            items.filter(
                                                                (_, i) =>
                                                                    i !== index,
                                                            ),
                                                        )
                                                    }
                                                >
                                                    <Trash2 aria-hidden />
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                    <div>
                                        <Button
                                            type="button"
                                            variant="tonal"
                                            size="sm"
                                            disabled={items.length >= 12}
                                            onClick={() =>
                                                setItems(role, [
                                                    ...items,
                                                    {
                                                        label: '',
                                                        required: true,
                                                    },
                                                ])
                                            }
                                        >
                                            <Plus aria-hidden />
                                            Tambah butir
                                        </Button>
                                    </div>
                                </fieldset>
                            );
                        })}
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
            </HiringShell>
        </>
    );
}

HiringSettings.layout = {
    breadcrumbs: [
        { title: 'Hiring', href: '/hiring' },
        { title: 'Pengaturan', href: '/hiring/pengaturan' },
    ],
    title: 'Pengaturan hiring',
    back: '/hiring',
};
