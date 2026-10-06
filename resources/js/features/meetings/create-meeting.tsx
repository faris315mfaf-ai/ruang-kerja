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
import {
    ConflictCard,
    MeetingFormFields,
    MeetingSummary,
    RemindersCard,
} from './meeting-form';
import type { MeetingForm } from './use-meeting-form';

function focusFirstError() {
    window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    });
}

function labels(form: MeetingForm) {
    return form.editing
        ? {
              title: 'Ubah rapat',
              intro: 'Peserta diberi tahu bila jadwal berubah dan diminta menjawab ulang kehadirannya.',
              review: 'Periksa & simpan',
              send: 'Simpan perubahan',
              sendShort: 'Simpan',
          }
        : {
              title: 'Jadwalkan rapat',
              intro: 'Undangan dikirim ke Inbox dan email peserta, lengkap dengan agenda dan tautan rapat.',
              review: 'Periksa & kirim undangan',
              send: 'Kirim undangan',
              sendShort: 'Kirim',
          };
}

/** /rapat/baru and /rapat/{id}/ubah on desktop & tablet (design DRapatBaru). */
export function CreateMeetingDesktop({ form }: { form: MeetingForm }) {
    const text = labels(form);
    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!form.review()) {
            focusFirstError();
        }
    };

    return (
        <div className="flex flex-col gap-[22px]">
            <section className="flex flex-col gap-2">
                <h1 className="text-display">{text.title}</h1>
                <p className="text-[18px] text-text-muted">{text.intro}</p>
            </section>

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
                    <Button type="submit" size="xl" className="font-extrabold">
                        {text.review}
                    </Button>
                    <p className="text-center text-[14px] leading-5 text-text-muted">
                        Bentrok jadwal hanya diperiksa terhadap rapat
                        RuangKerja. Kalender Google peserta ditahan.
                    </p>
                </aside>
            </form>

            <Dialog open={form.summaryOpen} onOpenChange={form.setSummaryOpen}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>
                            {form.editing
                                ? 'Periksa sebelum menyimpan'
                                : 'Periksa sebelum mengirim'}
                        </DialogTitle>
                        <DialogDescription>
                            Peserta menerima pemberitahuan dan pengingat sesuai
                            pilihan Anda.
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
                            {text.send}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** /rapat/baru on phones: stacked fields + sticky send bar. */
export function CreateMeetingMobile({ form }: { form: MeetingForm }) {
    const text = labels(form);
    const submit = (event?: FormEvent) => {
        event?.preventDefault();

        if (!form.review()) {
            focusFirstError();
        }
    };

    return (
        <div className="flex flex-col gap-4 pb-24">
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
            <div className="glass fixed inset-x-0 bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))] z-30 border-x-0 border-b-0 px-4 py-3">
                <Button
                    type="submit"
                    form="meeting-form"
                    size="lg"
                    className="w-full font-extrabold"
                >
                    {text.review}
                </Button>
            </div>
            <BottomSheet
                open={form.summaryOpen}
                onOpenChange={form.setSummaryOpen}
                title={
                    form.editing
                        ? 'Periksa sebelum menyimpan'
                        : 'Periksa sebelum mengirim'
                }
                description="Peserta menerima pemberitahuan dan pengingat."
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
                            {text.sendShort}
                        </Button>
                    </div>
                }
            >
                <MeetingSummary form={form} />
            </BottomSheet>
        </div>
    );
}
