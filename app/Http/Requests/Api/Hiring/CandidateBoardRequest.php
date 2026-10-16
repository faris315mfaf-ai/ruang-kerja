<?php

namespace App\Http\Requests\Api\Hiring;

use App\Domain\Hiring\Enums\CandidateStage;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * GET /api/v1/hiring/kandidat?lowongan=&q=&tahap= — filters of the Kandidat
 * tab. Access is checked by the controller (HiringPositionPolicy::viewAny);
 * an unknown or invisible `lowongan` is ignored like on the web.
 */
class CandidateBoardRequest extends FormRequest
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
            'lowongan' => ['nullable', 'string', 'max:40'],
            'q' => ['nullable', 'string', 'max:100'],
            'tahap' => ['nullable', 'string', Rule::in(CandidateStage::values())],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['lowongan' => 'lowongan', 'q' => 'kata kunci', 'tahap' => 'tahap'];
    }

    public function position(): ?string
    {
        return $this->filled('lowongan') ? $this->string('lowongan')->toString() : null;
    }

    public function search(): ?string
    {
        $search = trim($this->string('q')->toString());

        return $search === '' ? null : $search;
    }

    public function stage(): ?CandidateStage
    {
        return $this->filled('tahap') ? CandidateStage::from($this->string('tahap')->toString()) : null;
    }
}
