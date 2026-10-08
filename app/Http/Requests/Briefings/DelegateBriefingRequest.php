<?php

namespace App\Http\Requests\Briefings;

use App\Domain\Briefings\Enums\BriefingPeriod;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Delegate the note-taking of one period to an employee
 * (POST /briefing/delegasi, HR / Super Admin only — BriefingPolicy::delegate).
 * Always for today + the chosen period.
 */
class DelegateBriefingRequest extends FormRequest
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
            'user_id' => ['required', 'string', 'ulid', Rule::exists('users', 'id')],
            'period' => ['required', Rule::enum(BriefingPeriod::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'user_id.required' => 'Pilih karyawan yang ditunjuk.',
            'user_id.exists' => 'Karyawan tidak ditemukan.',
            'period.required' => 'Pilih periode briefing.',
        ];
    }

    public function period(): BriefingPeriod
    {
        return BriefingPeriod::from($this->string('period')->toString());
    }
}
