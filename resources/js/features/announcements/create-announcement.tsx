import { useForm } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { AnnouncementAudience, AnnouncementOptions } from './types';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    options: AnnouncementOptions;
    mobile: boolean;
    today: string;
};

/** Targets offered for the chosen audience. */
export function targetsFor(
    options: AnnouncementOptions,
    audience: AnnouncementAudience,
): { id: string; name: string }[] {
    if (audience === 'division') {
        return options.divisions;
    }

    return audience === 'team' ? options.teams : [];
}

/**
 * New announcement (dialog on desktop, bottom sheet on phones): title, text,
 * audience (everyone, divisions or teams the author may address) and an
 * optional last day on the dashboards.
 */
export function CreateAnnouncement({
    open,
    onOpenChange,
    options,
    mobile,
    today,
}: Props) {
    const form = useForm({
        title: '',
        body: '',
        audience: (options.audiences[0]?.value ??
            'all') as AnnouncementAudience,
        target_ids: [] as string[],
        expires_on: '',
    });
    const { data, setData, errors } = form;
    const targets = targetsFor(options, data.audience);
    const control = cn(mobile && 'h-12 text-[17px]');

    const submit = (event?: React.FormEvent) => {
        event?.preventDefault();
        form.post('/pengumuman', {
            preserveScroll: true,
            onSuccess: () => {
                form.reset();
                onOpenChange(false);
            },
        });
    };

    const toggle = (id: string, on: boolean) =>
        setData(
            'target_ids',
            on
                ? [...data.target_ids, id]
                : data.target_ids.filter((value) => value !== id),
        );

    const fields = (
        <form
            id="announcement-form"
            onSubmit={submit}
            className="flex flex-col gap-4"
        >
            <div className="grid gap-2">
                <Label htmlFor="announcement-title">Judul</Label>
                <Input
                    id="announcement-title"
                    className={control}
                    maxLength={160}
                    value={data.title}
                    onChange={(event) => setData('title', event.target.value)}
                />
                <InputError message={errors.title} />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="announcement-body">Isi pengumuman</Label>
                <Textarea
                    id="announcement-body"
                    rows={5}
                    maxLength={5000}
                    className={cn(mobile && 'text-[17px]')}
                    value={data.body}
                    onChange={(event) => setData('body', event.target.value)}
                />
                <InputError message={errors.body} />
            </div>
            <fieldset className="grid gap-2">
                <legend className="pb-2 text-label text-text">Penerima</legend>
                <div
                    role="radiogroup"
                    aria-label="Penerima"
                    className="flex flex-wrap gap-1 rounded-[14px] bg-surface-2 p-1"
                >
                    {options.audiences.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={data.audience === option.value}
                            onClick={() =>
                                form.setData((values) => ({
                                    ...values,
                                    audience: option.value,
                                    target_ids: [],
                                }))
                            }
                            className={cn(
                                'h-10 flex-1 rounded-[10px] px-3 text-[15px] font-semibold whitespace-nowrap transition-[color,background-color,box-shadow] duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                                mobile && 'h-11',
                                data.audience === option.value
                                    ? 'bg-surface text-text shadow-segment'
                                    : 'text-text-muted hover:text-text',
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                {targets.length > 0 && (
                    <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
                        {targets.map((target) => (
                            <li key={target.id}>
                                <label className="flex min-h-11 items-center gap-3 rounded-[10px] px-2 text-[16px] hover:bg-surface-2">
                                    <Checkbox
                                        checked={data.target_ids.includes(
                                            target.id,
                                        )}
                                        onCheckedChange={(value) =>
                                            toggle(target.id, value === true)
                                        }
                                    />
                                    {target.name}
                                </label>
                            </li>
                        ))}
                    </ul>
                )}
                <InputError message={errors.target_ids} />
            </fieldset>
            <div className="grid gap-2">
                <Label htmlFor="announcement-expires">
                    Tampil sampai{' '}
                    <span className="font-normal text-text-muted">
                        (opsional)
                    </span>
                </Label>
                <Input
                    id="announcement-expires"
                    type="date"
                    min={today}
                    className={cn(control, 'md:max-w-60')}
                    value={data.expires_on}
                    onChange={(event) =>
                        setData('expires_on', event.target.value)
                    }
                />
                <p className="text-meta text-text-muted">
                    Setelah tanggal ini pengumuman hilang dari dashboard.
                    Notifikasi di Inbox tetap ada.
                </p>
                <InputError message={errors.expires_on} />
            </div>
        </form>
    );

    const actions = (
        <>
            <Button
                type="button"
                variant="outline"
                size={mobile ? 'lg' : 'default'}
                className={cn(mobile && 'flex-1')}
                onClick={() => onOpenChange(false)}
            >
                Batal
            </Button>
            <Button
                type="submit"
                form="announcement-form"
                size={mobile ? 'lg' : 'default'}
                className={cn(mobile && 'flex-[1.6]')}
                disabled={form.processing}
            >
                Terbitkan
            </Button>
        </>
    );

    if (mobile) {
        return (
            <BottomSheet
                open={open}
                onOpenChange={onOpenChange}
                title="Pengumuman baru"
                description="Penerima mendapat notifikasi dan melihatnya di dashboard."
                footer={<div className="flex gap-3">{actions}</div>}
            >
                {fields}
            </BottomSheet>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Pengumuman baru</DialogTitle>
                    <DialogDescription>
                        Penerima mendapat notifikasi dan melihatnya di
                        dashboard.
                    </DialogDescription>
                </DialogHeader>
                {fields}
                <DialogFooter>{actions}</DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
