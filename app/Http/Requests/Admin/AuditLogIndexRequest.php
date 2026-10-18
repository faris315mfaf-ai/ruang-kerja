<?php

namespace App\Http\Requests\Admin;

use App\Domain\Organization\Enums\AuditSubject;
use App\Domain\Tenancy\Support\CurrentCompany;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Filters of the Audit Log page (query string). Authorization: AuditLogPolicy in the controller.
 */
class AuditLogIndexRequest extends FormRequest
{
    /** Filter value for changes without an actor (console, queue, seeders). */
    public const string SYSTEM_ACTOR = 'sistem';

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
            'aktor' => ['nullable', 'string', 'max:26'],
            'aksi' => ['nullable', 'string', 'max:80', 'regex:/^[a-z_]+(\.[a-z_]*)?$/'],
            'subjek' => ['nullable', Rule::enum(AuditSubject::class)],
            'dari' => ['nullable', 'date_format:Y-m-d'],
            'sampai' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:dari'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'aksi.regex' => 'Aksi tidak valid.',
            'subjek.enum' => 'Subjek tidak valid.',
            'dari.date_format' => 'Tanggal awal tidak valid.',
            'sampai.date_format' => 'Tanggal akhir tidak valid.',
            'sampai.after_or_equal' => 'Tanggal akhir tidak boleh sebelum tanggal awal.',
        ];
    }

    /**
     * @return array{aktor: string|null, aksi: string|null, subjek: string|null, dari: string|null, sampai: string|null}
     */
    public function filters(): array
    {
        $value = fn (string $key): ?string => is_string($this->validated($key)) && $this->validated($key) !== '' ? $this->validated($key) : null;

        return [
            'aktor' => $value('aktor'),
            'aksi' => $value('aksi'),
            'subjek' => $value('subjek'),
            'dari' => $value('dari'),
            'sampai' => $value('sampai'),
        ];
    }

    /**
     * Start of the "dari" day in the office timezone, as UTC.
     */
    public function fromUtc(): ?CarbonImmutable
    {
        $date = $this->filters()['dari'];

        return $date === null ? null : CarbonImmutable::createFromFormat('!Y-m-d', $date, $this->officeTimezone())?->utc();
    }

    /**
     * Start of the day after "sampai" in the office timezone, as UTC (exclusive bound).
     */
    public function untilUtc(): ?CarbonImmutable
    {
        $date = $this->filters()['sampai'];

        return $date === null ? null : CarbonImmutable::createFromFormat('!Y-m-d', $date, $this->officeTimezone())?->addDay()->utc();
    }

    private function officeTimezone(): string
    {
        return CurrentCompany::timezone();
    }
}
