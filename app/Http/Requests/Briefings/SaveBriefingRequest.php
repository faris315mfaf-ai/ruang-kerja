<?php

namespace App\Http\Requests\Briefings;

use App\Domain\Briefings\Enums\BriefingPeriod;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Save briefing minutes (POST /briefing). The office date and the window
 * are derived server-side by SaveBriefing — the client only sends the
 * period and the note. Authorization: BriefingPolicy::create (Gate in the
 * controller) plus the precise recorder/delegate check in the action.
 */
class SaveBriefingRequest extends FormRequest
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
            'period' => ['required', Rule::enum(BriefingPeriod::class)],
            'content' => ['required', 'string', 'max:10000', 'not_regex:/^\s*$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'period.required' => 'Pilih periode briefing.',
            'content.required' => 'Tulis notulensi briefing.',
            'content.not_regex' => 'Tulis notulensi briefing.',
            'content.max' => 'Notulensi maksimal 10000 karakter.',
        ];
    }

    public function period(): BriefingPeriod
    {
        return BriefingPeriod::from($this->string('period')->toString());
    }

    public function content(): string
    {
        return $this->string('content')->toString();
    }
}
