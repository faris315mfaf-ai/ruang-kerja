import { Sparkles } from 'lucide-react';
import type { FormEvent } from 'react';
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
import { Spinner } from '@/components/ui/spinner';
import { ListSkeleton, PreviewBar } from './meeting-ui';
import {
    ConflictCard,
    MeetingFormFields,
    MeetingSummary,
    RemindersCard,
    SavedCard,
} from './meeting-form';
import type { MeetingForm } from './use-meeting-form';

const PREVIEWS = { without: ['Kosong'], extra: [] };

function focusFirstError() {
    window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
}

/** /rapat/baru on desktop & tablet (design DRapatBaru). */
export function CreateMeetingDesktop({ form }: { form: MeetingForm }) {
    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!form.review()) {
            focusFirstError();
        }
    };

    return (
        <div className="flex flex-col gap-[22px]">
            <PreviewBar {...PREVIEWS} />
            <section className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-display">Jadwalkan rapat</h1>
                    <p className="text-[18px] text-text-muted">
                        Undangan dikirim lewat Google Calendar dengan tautan
                        rapat dan agenda.
                    </p>
                </div>
                <Button variant="tonal" onClick={form.fillSample}>
                    <Sparkles aria-hidden />
                    Isi contoh
                </Button>
            </section>

            {form.saved && <SavedCard form={form} />}

            {form.state === 'memuat' ? (
                <ListSkeleton rows={6} />
            ) : (
                <form
                    noValidate
                    onSubmit={submit}
                    className="flex flex-wrap items-start gap-5"
                >
                    <div className="min-w-0 flex-[999_1_640px] rounded-panel border border-border bg-surface p-6 shadow-card md:p-7">
                        <MeetingFormFields form={form} />
                    </div>
                    <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
                        <RemindersCard form={form} />
                        <ConflictCard form={form} />
                        <Button
                            type="submit"
                            size="xl"
                            className="font-extrabold"
                        >
                            Periksa & kirim undangan
                        </Button>
                        <p className="text-center text-[14px] leading-5 text-text-muted">
                            Undangan masuk ke Google Calendar peserta dan Inbox
                            RuangKerja.
                        </p>
                    </aside>
                </form>
            )}

            <Dialog open={form.summaryOpen} onOpenChange={form.setSummaryOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Periksa sebelum mengirim</DialogTitle>
                        <DialogDescription>
                            Peserta menerima undangan kalender dan pengingat
                            sesuai pilihan Anda.
                        </DialogDescription>
                    </DialogHeader>
                    <MeetingSummary form={form} />
                    <DialogFooter>
                        <Button
                            variant="quiet"
                            onClick={() => form.setSummaryOpen(false)}
                        >
                            Ubah lagi
                        </Button>
                        <Button onClick={form.send} disabled={form.processing}>
                            {form.processing && <Spinner />}
                            Kirim undangan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** /rapat/baru on phones: stacked fields + sticky send bar. */
export function CreateMeetingMobile({ form }: { form: MeetingForm }) {
    const submit = (event?: FormEvent) => {
        event?.preventDefault();

        if (!form.review()) {
            focusFirstError();
        }
    };

    return (
        <div className="flex flex-col gap-4 pb-24">
            <PreviewBar {...PREVIEWS} />
            <Button
                variant="tonal"
                size="lg"
                className="self-start"
                onClick={form.fillSample}
            >
                <Sparkles aria-hidden />
                Isi contoh
            </Button>
            {form.saved && <SavedCard form={form} />}
            {form.state === 'memuat' ? (
                <ListSkeleton rows={6} />
            ) : (
                <form
                    id="meeting-form"
                    noValidate
                    onSubmit={submit}
                    className="flex flex-col gap-4"
                >
                    <div className="rounded-[22px] border border-border bg-surface p-4">
                        <MeetingFormFields form={form} />
                    </div>
                    <ConflictCard form={form} />
                    <RemindersCard form={form} />
                </form>
            )}
            <div className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 border-x-0 border-b-0 px-4 py-3">
                <Button
                    type="submit"
                    form="meeting-form"
                    size="lg"
                    className="w-full font-extrabold"
                >
                    Periksa & kirim undangan
                </Button>
            </div>
            <BottomSheet
                open={form.summaryOpen}
                onOpenChange={form.setSummaryOpen}
                title="Periksa sebelum mengirim"
                description="Peserta menerima undangan kalender dan pengingat."
                footer={
                    <div className="grid grid-cols-2 gap-2.5">
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => form.setSummaryOpen(false)}
                        >
                            Ubah lagi
                        </Button>
                        <Button
                            size="lg"
                            onClick={form.send}
                            disabled={form.processing}
                        >
                            {form.processing && <Spinner />}
                            Kirim
                        </Button>
                    </div>
                }
            >
                <MeetingSummary form={form} />
            </BottomSheet>
        </div>
    );
}
