import { useForm } from '@inertiajs/react';
import type { FormEvent } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Textarea } from '@/components/ui/textarea';
import type { ProjectSummaryProps } from '@/features/portfolio/types';
import { store as storeDirection } from '@/routes/projects/directions';
import { DirectionList } from './update-panel';

/** Id of the direction textarea ("Beri arahan" scrolls here and focuses it). */
export const DIRECTION_FIELD_ID = 'direction-body';

/**
 * "Arahan untuk PIC" (DProyek #arahan): gradient-bordered form for Direksi
 * plus the directions given so far. Viewers without steer rights only see
 * the list (nothing when empty).
 */
export function DirectionsBox({ props }: { props: ProjectSummaryProps }) {
    const form = useForm({ body: '' });
    const lead = props.project.lead;
    const canSteer = props.project_can.steer;

    const submit = (event: FormEvent) => {
        event.preventDefault();
        form.submit(storeDirection(props.project.key), {
            preserveScroll: true,
            onSuccess: () => form.reset(),
        });
    };

    if (!canSteer) {
        return props.directions.length > 0 ? (
            <Panel id="arahan" title="Arahan Direksi" className="scroll-mt-24">
                <DirectionList directions={props.directions} />
            </Panel>
        ) : null;
    }

    return (
        <section
            id="arahan"
            className="scroll-mt-24 rounded-panel bg-primary bg-grad-merek p-0.5"
        >
            <form
                onSubmit={submit}
                className="flex flex-col gap-3 rounded-[22px] bg-surface px-6 py-[22px]"
            >
                <label
                    htmlFor={DIRECTION_FIELD_ID}
                    className="text-[20px] leading-7 font-bold"
                >
                    Arahan untuk PIC
                </label>
                <Textarea
                    id={DIRECTION_FIELD_ID}
                    rows={3}
                    className="resize-none"
                    placeholder={`Tulis arahan; ${lead?.name ?? 'pemilik proyek'} mendapat notifikasi`}
                    value={form.data.body}
                    maxLength={2000}
                    aria-invalid={Boolean(form.errors.body)}
                    onChange={(event) =>
                        form.setData('body', event.target.value)
                    }
                />
                <InputError message={form.errors.body} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-meta text-text-muted">
                        Tercatat di Aktivitas proyek.
                    </p>
                    <Button
                        type="submit"
                        disabled={
                            form.processing || form.data.body.trim() === ''
                        }
                    >
                        Kirim arahan
                    </Button>
                </div>
                <DirectionList directions={props.directions} />
            </form>
        </section>
    );
}
