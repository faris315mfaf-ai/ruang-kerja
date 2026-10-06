import { useForm } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
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
import { cn } from '@/lib/utils';
import { hiringUrls, POSITION_STATUS_LABELS } from './lib';
import type { PositionOption } from './types';

const DESCRIPTION =
    'Untuk pelamar yang tidak lewat Google Form (rujukan, email). Kandidat masuk ke tahap Masuk.';

/** "Tambah kandidat manual" (HR): dialog on desktop, bottom sheet on phones. */
export function AddCandidateDialog({
    open,
    onOpenChange,
    positions,
    defaultPosition,
    mobile,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    positions: PositionOption[];
    defaultPosition: string | null;
    mobile: boolean;
}) {
    const usable = positions.filter((position) => position.status !== 'closed');
    const form = useForm({
        position_id: defaultPosition ?? usable[0]?.id ?? '',
        full_name: '',
        email: '',
        phone: '',
        cv_url: '',
    });

    const submit = (event?: React.FormEvent) => {
        event?.preventDefault();
        form.post(hiringUrls.candidates, {
            onSuccess: () => {
                form.reset();
                onOpenChange(false);
            },
        });
    };

    const fields = (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
                <Label htmlFor="candidate-position">Lowongan</Label>
                <select
                    id="candidate-position"
                    value={form.data.position_id}
                    onChange={(event) =>
                        form.setData('position_id', event.target.value)
                    }
                    className={cn(fieldClasses, 'h-control')}
                    required
                >
                    {usable.length === 0 && (
                        <option value="">Belum ada lowongan aktif</option>
                    )}
                    {usable.map((position) => (
                        <option key={position.id} value={position.id}>
                            {position.title} ·{' '}
                            {POSITION_STATUS_LABELS[position.status]}
                        </option>
                    ))}
                </select>
                <InputError message={form.errors.position_id} />
            </div>
            <div className="flex flex-col gap-2">
                <Label htmlFor="candidate-name">Nama lengkap</Label>
                <Input
                    id="candidate-name"
                    value={form.data.full_name}
                    onChange={(event) =>
                        form.setData('full_name', event.target.value)
                    }
                    autoComplete="off"
                    maxLength={150}
                    required
                />
                <InputError message={form.errors.full_name} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <Label htmlFor="candidate-email">Email</Label>
                    <Input
                        id="candidate-email"
                        type="email"
                        value={form.data.email}
                        onChange={(event) =>
                            form.setData('email', event.target.value)
                        }
                        autoComplete="off"
                    />
                    <InputError message={form.errors.email} />
                </div>
                <div className="flex flex-col gap-2">
                    <Label htmlFor="candidate-phone">No. HP</Label>
                    <Input
                        id="candidate-phone"
                        type="tel"
                        value={form.data.phone}
                        onChange={(event) =>
                            form.setData('phone', event.target.value)
                        }
                        autoComplete="off"
                    />
                    <InputError message={form.errors.phone} />
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <Label htmlFor="candidate-cv">Tautan CV</Label>
                <Input
                    id="candidate-cv"
                    type="url"
                    inputMode="url"
                    placeholder="https://drive.google.com/…"
                    value={form.data.cv_url}
                    onChange={(event) =>
                        form.setData('cv_url', event.target.value)
                    }
                />
                <InputError message={form.errors.cv_url} />
            </div>
        </div>
    );

    const actions = (
        <>
            <Button
                type="button"
                variant="quiet"
                size={mobile ? 'lg' : 'default'}
                onClick={() => onOpenChange(false)}
            >
                Batal
            </Button>
            <Button
                type={mobile ? 'button' : 'submit'}
                size={mobile ? 'lg' : 'default'}
                disabled={form.processing || usable.length === 0}
                onClick={mobile ? () => submit() : undefined}
                className={cn(mobile && 'flex-1')}
            >
                Tambah kandidat
            </Button>
        </>
    );

    if (mobile) {
        return (
            <BottomSheet
                open={open}
                onOpenChange={onOpenChange}
                title="Tambah kandidat manual"
                description={DESCRIPTION}
                footer={<div className="flex gap-3">{actions}</div>}
            >
                <form
                    onSubmit={submit}
                    className="flex flex-col gap-4 [&_input]:text-[17px] [&_select]:text-[17px]"
                >
                    {fields}
                </form>
            </BottomSheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <form onSubmit={submit} className="flex flex-col gap-5">
                    <DialogHeader>
                        <DialogTitle>Tambah kandidat manual</DialogTitle>
                        <DialogDescription>{DESCRIPTION}</DialogDescription>
                    </DialogHeader>
                    {fields}
                    <DialogFooter>{actions}</DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
