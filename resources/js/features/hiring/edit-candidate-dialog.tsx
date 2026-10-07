import { useForm } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { hiringUrls } from './lib';
import type { CandidateDetail } from './types';

/** HR corrects the candidate's contact data or CV link. */
export function EditCandidateDialog({
    candidate,
    open,
    onOpenChange,
}: {
    candidate: CandidateDetail;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const form = useForm({
        full_name: candidate.full_name,
        email: candidate.email ?? '',
        phone: candidate.phone ?? '',
        cv_url: candidate.cv_url ?? '',
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <form
                    className="flex flex-col gap-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.patch(hiringUrls.candidate(candidate.id), {
                            preserveScroll: true,
                            onSuccess: () => onOpenChange(false),
                        });
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>Ubah data kandidat</DialogTitle>
                        <DialogDescription>
                            Perbaiki data bila ada salah ketik di formulir.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="edit-name">Nama lengkap</Label>
                            <Input
                                id="edit-name"
                                value={form.data.full_name}
                                maxLength={150}
                                onChange={(event) =>
                                    form.setData(
                                        'full_name',
                                        event.target.value,
                                    )
                                }
                                required
                            />
                            <InputError message={form.errors.full_name} />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="edit-email">Email</Label>
                                <Input
                                    id="edit-email"
                                    type="email"
                                    value={form.data.email}
                                    onChange={(event) =>
                                        form.setData(
                                            'email',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError message={form.errors.email} />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="edit-phone">No. HP</Label>
                                <Input
                                    id="edit-phone"
                                    type="tel"
                                    value={form.data.phone}
                                    onChange={(event) =>
                                        form.setData(
                                            'phone',
                                            event.target.value,
                                        )
                                    }
                                />
                                <InputError message={form.errors.phone} />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="edit-cv">Tautan CV</Label>
                            <Input
                                id="edit-cv"
                                type="url"
                                value={form.data.cv_url}
                                onChange={(event) =>
                                    form.setData('cv_url', event.target.value)
                                }
                            />
                            <InputError message={form.errors.cv_url} />
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
                            Simpan
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
