<?php

namespace App\Http\Requests\Reports;

use App\Domain\Reports\Actions\SaveDailyReport;
use App\Domain\Reports\Data\DailyReportInput;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Daily report form (autosave and "Kirim"). Rules that need the database
 * (task visibility, move permission, the locked date) are in the actions.
 */
class SaveDailyReportRequest extends FormRequest
{
    public const int NOTE_MAX = 2000;

    public const int TEXT_MAX = 5000;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'report_date' => ['required', 'date_format:Y-m-d'],
            'summary' => ['nullable', 'string', 'max:'.self::TEXT_MAX],
            'blockers' => ['nullable', 'string', 'max:'.self::TEXT_MAX],
            'notes' => ['nullable', 'string', 'max:'.self::TEXT_MAX],
            'items' => ['present', 'array', 'max:'.SaveDailyReport::MAX_ITEMS],
            'items.*' => ['array'],
            'items.*.task_id' => ['nullable', 'string', 'ulid'],
            'items.*.progress_note' => ['nullable', 'string', 'max:'.self::NOTE_MAX],
            'items.*.percent' => ['nullable', 'integer', 'min:0', 'max:100'],
            'items.*.hours' => ['nullable', 'numeric', 'min:0.25', 'max:24'],
            'items.*.move_status_id' => ['nullable', 'string', 'ulid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'report_date.required' => 'Tanggal laporan tidak ada. Muat ulang halaman.',
            '*.max' => 'Teks terlalu panjang (maksimal :max karakter).',
            'items.max' => 'Maksimal :max baris pekerjaan.',
            'items.*.progress_note.max' => 'Catatan progres maksimal :max karakter.',
            'items.*.percent.integer' => 'Persen harus bilangan bulat.',
            'items.*.percent.min' => 'Persen 0–100.',
            'items.*.percent.max' => 'Persen 0–100.',
            'items.*.hours.numeric' => 'Jam harus angka.',
            'items.*.hours.min' => 'Jam minimal 0,25.',
            'items.*.hours.max' => 'Jam maksimal 24.',
            'items.*.task_id.ulid' => 'Tugas tidak valid.',
            'items.*.move_status_id.ulid' => 'Kolom tujuan tidak valid.',
        ];
    }

    public function toInput(): DailyReportInput
    {
        /** @var array<string, mixed> $data */
        $data = $this->validated();

        return DailyReportInput::fromArray($data);
    }
}
