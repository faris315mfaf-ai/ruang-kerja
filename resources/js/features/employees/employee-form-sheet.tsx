import { useForm } from '@inertiajs/react';
import { Info, Lock } from 'lucide-react';
import { useMemo } from 'react';
import InputError from '@/components/input-error';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { RoleName } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { store, update } from '@/routes/admin/employees';
import type { WorkMode } from '@/types/auth';
import { NativeSelect } from './native-select';
import { ManagerCombobox } from './manager-combobox';
import type {
    DivisionOption,
    EmployeeFormValues,
    EnumOptions,
    FormOptions,
} from './types';

type Mode = { type: 'create' } | { type: 'edit'; id: string };

/** Mockup order: Anggota, Kepala Divisi, HR, Direksi, then Super Admin. */
const ROLE_FORM_ORDER: RoleName[] = [
    'anggota',
    'kepala_divisi',
    'hr',
    'direksi',
    'super_admin',
];

function sortedRoles<T extends { value: RoleName }>(roles: T[]): T[] {
    return [...roles].sort(
        (a, b) =>
            ROLE_FORM_ORDER.indexOf(a.value) - ROLE_FORM_ORDER.indexOf(b.value),
    );
}

type Props = {
    mode: Mode | null;
    editing: EmployeeFormValues | null;
    formOptions: FormOptions | null;
    divisions: DivisionOption[];
    options: EnumOptions;
    canAssignSuperAdmin: boolean;
    companyDomain: string;
    onClose: () => void;
    onCreated: () => void;
    onDeactivate: (employee: EmployeeFormValues) => void;
    onReactivate: (employee: EmployeeFormValues) => void;
};

/**
 * Right-hand panel to add or edit an employee (mockup `Karyawan`, 420px).
 */
export function EmployeeFormSheet(props: Props) {
    const { mode, editing, onClose } = props;
    const open = mode !== null;
    const loading = mode?.type === 'edit' && editing?.id !== mode.id;

    return (
        <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
            <SheetContent
                side="right"
                className="w-full gap-0 p-0 sm:max-w-[440px]"
                onEscapeKeyDown={(event) => {
                    // Escape closes an open picker first.
                    if (
                        document.activeElement?.closest('[cmdk-root]') !== null
                    ) {
                        event.preventDefault();
                    }
                }}
            >
                {mode === null ? null : loading || !props.formOptions ? (
                    <FormSkeleton />
                ) : (
                    <EmployeeForm
                        key={mode.type === 'edit' ? mode.id : 'create'}
                        {...props}
                        mode={mode}
                        editing={mode.type === 'edit' ? editing : null}
                        formOptions={props.formOptions}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}

function FormSkeleton() {
    return (
        <div className="space-y-5 p-5" aria-busy>
            <SheetTitle className="sr-only">Memuat data karyawan</SheetTitle>
            <SheetDescription className="sr-only">
                Data karyawan sedang dimuat.
            </SheetDescription>
            <Skeleton className="h-8 w-56" />
            {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ))}
        </div>
    );
}

type FormData = {
    name: string;
    email: string;
    division_id: string;
    team_id: string;
    position_id: string;
    manager_id: string | null;
    work_mode: WorkMode;
    joined_at: string;
    roles: RoleName[];
    employee_number: string;
    phone: string;
    nik: string;
};

function EmployeeForm({
    mode,
    editing,
    formOptions,
    divisions,
    options,
    canAssignSuperAdmin,
    companyDomain,
    onClose,
    onCreated,
    onDeactivate,
    onReactivate,
}: Omit<Props, 'mode' | 'formOptions'> & {
    mode: Mode;
    formOptions: FormOptions;
}) {
    const isEdit = mode.type === 'edit' && editing !== null;

    const form = useForm<FormData>({
        name: editing?.name ?? '',
        email: editing?.email ?? '',
        division_id: editing?.division_id ?? '',
        team_id: editing?.team_id ?? '',
        position_id: editing?.position_id ?? '',
        manager_id: editing?.manager_id ?? null,
        work_mode: editing?.work_mode ?? 'office',
        joined_at: editing?.joined_at ?? '',
        roles: editing?.roles ?? ['anggota'],
        employee_number: editing?.employee_number ?? '',
        phone: editing?.phone ?? '',
        nik: '',
    });
    const { data, setData, errors, processing } = form;

    const teams = formOptions.teams.filter(
        (team) => team.division_id === data.division_id,
    );

    // An inactive current manager is not in the active list: keep it visible.
    const managers = useMemo(() => {
        const current = editing?.manager;

        if (
            current &&
            !formOptions.managers.some((option) => option.id === current.id)
        ) {
            return [current, ...formOptions.managers];
        }

        return formOptions.managers;
    }, [editing?.manager, formOptions.managers]);

    const roleErrors = Object.entries(errors)
        .filter(([key]) => key === 'roles' || key.startsWith('roles.'))
        .map(([, message]) => message);
    const firstName = (data.name || editing?.name || 'karyawan').split(' ')[0];

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                if (!isEdit) onCreated();
            },
        };

        if (isEdit && editing) {
            form.put(update.url(editing.id), options);
        } else {
            form.post(store.url(), options);
        }
    };

    const toggleRole = (role: RoleName, checked: boolean) => {
        setData(
            'roles',
            checked
                ? [...data.roles, role]
                : data.roles.filter((current) => current !== role),
        );
    };

    return (
        <form onSubmit={submit} className="flex h-full min-h-0 flex-col">
            <header className="flex items-center gap-3 border-b border-border px-5 py-4 pr-12">
                {isEdit && editing && (
                    <UserAvatar
                        name={editing.name}
                        src={editing.avatar_url}
                        className="size-8"
                    />
                )}
                <div className="min-w-0">
                    <SheetTitle className="truncate text-base">
                        {isEdit && editing ? (
                            <>
                                Ubah karyawan
                                <span className="font-normal text-text-muted">
                                    {' '}
                                    · {editing.name}
                                </span>
                            </>
                        ) : (
                            'Tambah karyawan'
                        )}
                    </SheetTitle>
                    <SheetDescription className="sr-only">
                        Formulir data karyawan, penempatan organisasi, dan
                        peran.
                    </SheetDescription>
                </div>
            </header>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                <Field id="name" label="Nama lengkap" error={errors.name}>
                    <Input
                        id="name"
                        value={data.name}
                        onChange={(event) =>
                            setData('name', event.target.value)
                        }
                        autoComplete="off"
                        required
                        maxLength={150}
                        aria-invalid={Boolean(errors.name) || undefined}
                    />
                </Field>

                <Field
                    id="email"
                    label="Email Google"
                    error={errors.email}
                    hint={
                        editing?.email_locked
                            ? 'Terkunci karena karyawan sudah pernah masuk dengan akun Google ini.'
                            : `Dipakai untuk masuk. Hanya email berdomain @${companyDomain} yang diterima.`
                    }
                >
                    <div className="relative">
                        <Input
                            id="email"
                            type="email"
                            inputMode="email"
                            value={data.email}
                            onChange={(event) =>
                                setData('email', event.target.value)
                            }
                            placeholder={`nama@${companyDomain}`}
                            readOnly={editing?.email_locked}
                            className={
                                editing?.email_locked
                                    ? 'bg-surface-2 pr-9 text-text-muted'
                                    : undefined
                            }
                            required
                            aria-invalid={Boolean(errors.email) || undefined}
                        />
                        {editing?.email_locked && (
                            <Lock
                                aria-hidden
                                className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-text-subtle"
                            />
                        )}
                    </div>
                </Field>

                <div className="grid grid-cols-2 gap-3">
                    <Field
                        id="division_id"
                        label="Divisi"
                        error={errors.division_id}
                    >
                        <NativeSelect
                            id="division_id"
                            value={data.division_id}
                            onChange={(event) => {
                                const division = event.target.value;
                                setData((current) => ({
                                    ...current,
                                    division_id: division,
                                    team_id: formOptions.teams.some(
                                        (team) =>
                                            team.id === current.team_id &&
                                            team.division_id === division,
                                    )
                                        ? current.team_id
                                        : '',
                                }));
                            }}
                            aria-invalid={
                                Boolean(errors.division_id) || undefined
                            }
                        >
                            <option value="">Tanpa divisi</option>
                            {divisions.map((division) => (
                                <option key={division.id} value={division.id}>
                                    {division.name}
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>
                    <Field id="team_id" label="Tim" error={errors.team_id}>
                        <NativeSelect
                            id="team_id"
                            value={data.team_id}
                            onChange={(event) =>
                                setData('team_id', event.target.value)
                            }
                            disabled={teams.length === 0}
                            aria-invalid={Boolean(errors.team_id) || undefined}
                        >
                            <option value="">Tanpa tim</option>
                            {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                    {team.name}
                                </option>
                            ))}
                        </NativeSelect>
                    </Field>
                </div>

                <Field
                    id="position_id"
                    label="Jabatan"
                    error={errors.position_id}
                >
                    <NativeSelect
                        id="position_id"
                        value={data.position_id}
                        onChange={(event) =>
                            setData('position_id', event.target.value)
                        }
                        aria-invalid={Boolean(errors.position_id) || undefined}
                    >
                        <option value="">Belum ditentukan</option>
                        {formOptions.positions.map((position) => (
                            <option key={position.id} value={position.id}>
                                {position.name}
                            </option>
                        ))}
                    </NativeSelect>
                </Field>

                <Field
                    id="manager_id"
                    label="Atasan langsung"
                    error={errors.manager_id}
                    hint={`Menjadi penyetuju langkah 1 untuk semua pengajuan ${firstName}.`}
                >
                    <ManagerCombobox
                        id="manager_id"
                        value={data.manager_id}
                        onChange={(value) => setData('manager_id', value)}
                        options={managers}
                        excludeId={editing?.id}
                        invalid={Boolean(errors.manager_id)}
                    />
                </Field>

                <div className="space-y-2">
                    <Label id="work_mode_label">Mode kerja</Label>
                    <ToggleGroup
                        type="single"
                        aria-labelledby="work_mode_label"
                        value={data.work_mode}
                        onValueChange={(value) =>
                            value && setData('work_mode', value as WorkMode)
                        }
                        className="grid w-full grid-cols-4 rounded-lg bg-surface-2 p-1"
                    >
                        {options.workModes.map((mode) => (
                            <ToggleGroupItem
                                key={mode.value}
                                value={mode.value}
                                className="h-9 rounded-md! text-[13px] text-text-muted data-[state=on]:bg-background data-[state=on]:text-text data-[state=on]:shadow-xs"
                            >
                                {mode.label}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                    <InputError message={errors.work_mode} />
                </div>

                <Field
                    id="joined_at"
                    label="Tanggal bergabung"
                    error={errors.joined_at}
                >
                    <Input
                        id="joined_at"
                        type="date"
                        value={data.joined_at}
                        onChange={(event) =>
                            setData('joined_at', event.target.value)
                        }
                        aria-invalid={Boolean(errors.joined_at) || undefined}
                    />
                </Field>

                <fieldset className="space-y-2">
                    <legend className="mb-2 text-sm leading-none font-medium">
                        Peran
                    </legend>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {sortedRoles(options.roles).map((role) => {
                            const locked =
                                role.value === 'super_admin' &&
                                !canAssignSuperAdmin;

                            return (
                                <label
                                    key={role.value}
                                    className={cn(
                                        'flex min-h-9 items-center gap-2 text-sm whitespace-nowrap has-[button:disabled]:opacity-60',
                                        role.value === 'super_admin' &&
                                            'col-span-2',
                                    )}
                                >
                                    <Checkbox
                                        checked={data.roles.includes(
                                            role.value,
                                        )}
                                        onCheckedChange={(checked) =>
                                            toggleRole(
                                                role.value,
                                                checked === true,
                                            )
                                        }
                                        disabled={locked}
                                    />
                                    {role.label}
                                    {role.value === 'super_admin' && (
                                        <span className="text-xs text-text-subtle">
                                            {locked
                                                ? 'hanya bisa diberikan oleh Super Admin'
                                                : 'wajib 2FA'}
                                        </span>
                                    )}
                                </label>
                            );
                        })}
                    </div>
                    {roleErrors.map((message) => (
                        <InputError key={message} message={message} />
                    ))}
                </fieldset>

                <section className="space-y-4 border-t border-border pt-5">
                    <h3 className="text-[11px] font-medium tracking-[.04em] text-text-muted uppercase">
                        Data pribadi
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <Field
                            id="employee_number"
                            label="Nomor karyawan"
                            error={errors.employee_number}
                        >
                            <Input
                                id="employee_number"
                                value={data.employee_number}
                                onChange={(event) =>
                                    setData(
                                        'employee_number',
                                        event.target.value,
                                    )
                                }
                                maxLength={30}
                                autoComplete="off"
                            />
                        </Field>
                        <Field id="phone" label="Telepon" error={errors.phone}>
                            <Input
                                id="phone"
                                type="tel"
                                inputMode="tel"
                                value={data.phone}
                                onChange={(event) =>
                                    setData('phone', event.target.value)
                                }
                                placeholder="+62 812…"
                                autoComplete="off"
                            />
                        </Field>
                    </div>
                    <Field
                        id="nik"
                        label="NIK"
                        error={errors.nik}
                        hint={
                            editing?.nik_masked
                                ? `Tersimpan: ${editing.nik_masked}. Isi hanya untuk mengganti.`
                                : '16 digit sesuai KTP. Disimpan terenkripsi.'
                        }
                    >
                        <Input
                            id="nik"
                            value={data.nik}
                            onChange={(event) =>
                                setData('nik', event.target.value)
                            }
                            inputMode="numeric"
                            autoComplete="off"
                            spellCheck={false}
                            placeholder={editing?.nik_masked ?? ''}
                            maxLength={24}
                            className="font-mono"
                        />
                    </Field>
                </section>

                {!isEdit && (
                    <p className="flex gap-2 rounded-lg bg-info/10 px-3 py-2.5 text-[13px] text-info">
                        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                        Karyawan masuk memakai akun Google kantornya; tidak ada
                        sandi yang perlu dibuat.
                    </p>
                )}
            </div>

            <footer className="flex items-center gap-2 border-t border-border px-5 py-3">
                {isEdit &&
                    editing?.can.deactivate &&
                    (editing.status === 'active' ? (
                        <Button
                            type="button"
                            variant="outline"
                            className="border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
                            onClick={() => onDeactivate(editing)}
                        >
                            Nonaktifkan
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onReactivate(editing)}
                        >
                            Aktifkan kembali
                        </Button>
                    ))}
                <div className="ml-auto flex gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Batal
                    </Button>
                    <Button type="submit" disabled={processing}>
                        {isEdit ? 'Simpan perubahan' : 'Tambah karyawan'}
                    </Button>
                </div>
            </footer>
        </form>
    );
}

function Field({
    id,
    label,
    error,
    hint,
    children,
}: {
    id: string;
    label: string;
    error?: string;
    hint?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{label}</Label>
            {children}
            {error ? (
                <InputError message={error} />
            ) : (
                hint && <p className="text-xs text-text-muted">{hint}</p>
            )}
        </div>
    );
}
