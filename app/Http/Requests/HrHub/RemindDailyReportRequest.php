<?php

namespace App\Http\Requests\HrHub;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * POST /hr/monitoring/ingatkan: `user_ids` (chosen people) or `all = true`
 * (everyone scheduled today who has not sent the daily report).
 */
class RemindDailyReportRequest extends FormRequest
{
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
            'all' => ['sometimes', 'boolean'],
            'user_ids' => ['required_without:all', 'array', 'max:500'],
            'user_ids.*' => ['string', 'size:26'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['user_ids.required_without' => 'Pilih karyawan yang ingin diingatkan.'];
    }

    /**
     * @return list<string>|null null = everyone still missing
     */
    public function targets(): ?array
    {
        if ($this->boolean('all')) {
            return null;
        }

        return array_values(array_map(
            fn (mixed $id): string => strtolower((string) $id),
            array_filter((array) $this->input('user_ids', []), 'is_string'),
        ));
    }
}
