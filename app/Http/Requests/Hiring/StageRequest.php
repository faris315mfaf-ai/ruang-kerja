<?php

namespace App\Http\Requests\Hiring;

use App\Domain\Hiring\Enums\CandidateStage;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class StageRequest extends HiringRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'stage' => ['required', Rule::enum(CandidateStage::class)],
            'reason' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['stage' => 'tahap', 'reason' => 'alasan'];
    }
}
