import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatRupiah } from '@/lib/requests';
import { cn } from '@/lib/utils';
import type { RequestFormState } from './use-request-form';

/** quantity × unit price from the typed text, or null while incomplete. */
export function procurementTotal(
    quantity: string,
    unitPrice: string,
): number | null {
    const q = Number(quantity);
    const p = Number(unitPrice);

    if (
        quantity.trim() === '' ||
        unitPrice.trim() === '' ||
        !Number.isInteger(q) ||
        !Number.isInteger(p) ||
        q < 1 ||
        p < 0
    ) {
        return null;
    }

    return q * p;
}

const URGENCY = [
    { value: 'biasa', label: 'Biasa' },
    { value: 'mendesak', label: 'Mendesak' },
] as const;

/**
 * Pengajuan barang (keputusan pemilik 6 Okt 2026): item, quantity, unit,
 * estimated unit price (total computed), reference link and urgency.
 */
export function ProcurementFields({
    state,
    mobile = false,
}: {
    state: RequestFormState;
    mobile?: boolean;
}) {
    const { data, setData, errors } = state.form;
    const control = cn(mobile && 'h-12 text-[17px]');
    const error = (field: string) =>
        (errors as Record<string, string | undefined>)[field] ??
        state.preview?.errors?.[field];
    const total = procurementTotal(data.quantity, data.unit_price);

    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-2">
                <Label htmlFor="item_name">Nama barang</Label>
                <Input
                    id="item_name"
                    className={control}
                    value={data.item_name}
                    maxLength={160}
                    placeholder="Mis. Monitor 24 inci"
                    onChange={(e) => setData('item_name', e.target.value)}
                />
                <InputError message={error('item_name')} />
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-[120px_160px_1fr]">
                <div className="grid content-start gap-2">
                    <Label htmlFor="quantity">Jumlah</Label>
                    <Input
                        id="quantity"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        className={cn(control, 'tnum')}
                        value={data.quantity}
                        onChange={(e) => setData('quantity', e.target.value)}
                    />
                    <InputError message={error('quantity')} />
                </div>
                <div className="grid content-start gap-2">
                    <Label htmlFor="unit">Satuan</Label>
                    <Input
                        id="unit"
                        className={control}
                        value={data.unit}
                        maxLength={30}
                        placeholder="unit, rim, buah"
                        onChange={(e) => setData('unit', e.target.value)}
                    />
                    <InputError message={error('unit')} />
                </div>
                <div className="col-span-2 grid content-start gap-2 md:col-span-1">
                    <Label htmlFor="unit_price">
                        Perkiraan harga satuan (Rp)
                    </Label>
                    <Input
                        id="unit_price"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        className={cn(control, 'tnum')}
                        value={data.unit_price}
                        placeholder="Mis. 2150000"
                        onChange={(e) => setData('unit_price', e.target.value)}
                    />
                    <InputError message={error('unit_price')} />
                </div>
            </div>

            <p
                className="flex items-baseline justify-between gap-3 rounded-lg bg-surface-2 px-4 py-3 text-[16px]"
                aria-live="polite"
            >
                <span className="text-text-muted">Perkiraan total</span>
                <b className="text-text tnum">{formatRupiah(total)}</b>
            </p>

            <div className="grid gap-2">
                <Label htmlFor="reference_url">
                    Tautan referensi{' '}
                    <span className="font-normal text-text-muted">
                        (opsional)
                    </span>
                </Label>
                <Input
                    id="reference_url"
                    type="url"
                    inputMode="url"
                    className={control}
                    value={data.reference_url}
                    maxLength={500}
                    placeholder="https://…"
                    onChange={(e) => setData('reference_url', e.target.value)}
                />
                <InputError message={error('reference_url')} />
            </div>

            <div className="grid gap-2">
                <span id="urgency-label" className="text-label text-text">
                    Tingkat kebutuhan
                </span>
                <div
                    role="radiogroup"
                    aria-labelledby="urgency-label"
                    className="inline-flex w-fit gap-1 rounded-[14px] bg-surface-2 p-1"
                >
                    {URGENCY.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={data.urgency === option.value}
                            onClick={() => setData('urgency', option.value)}
                            className={cn(
                                'h-[38px] rounded-[10px] px-[18px] text-[15px] font-semibold transition-[color,background-color,box-shadow] duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                                mobile && 'h-11',
                                data.urgency === option.value
                                    ? 'bg-surface text-text shadow-segment'
                                    : 'text-text-muted hover:text-text',
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <InputError message={error('urgency')} />
            </div>
        </div>
    );
}
