<?php

namespace App\Http\Requests\Hiring;

use App\Domain\Hiring\Enums\CandidateField;
use App\Domain\Hiring\Enums\PositionStatus;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

/**
 * New position (title, division, description) or the full settings form of
 * an existing one (status, reviewers, field mapping).
 */
class PositionRequest extends HiringRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $rules = [
            'title' => ['required', 'string', 'min:3', 'max:150'],
            'division_id' => ['nullable', 'string', 'ulid'],
            'description' => ['nullable', 'string', 'max:5000'],
        ];

        if ($this->isMethod('post')) {
            return $rules;
        }

        $mapRules = [];

        foreach (CandidateField::cases() as $field) {
            $mapRules['field_map.'.$field->value] = ['nullable', 'string', 'max:500'];
        }

        return [
            ...$rules,
            'status' => ['required', Rule::enum(PositionStatus::class)],
            'interviewer_ids' => ['present', 'array', 'max:30'],
            'interviewer_ids.*' => ['string', 'ulid'],
            'final_approver_ids' => ['present', 'array', 'max:10'],
            'final_approver_ids.*' => ['string', 'ulid'],
            'field_map' => ['sometimes', 'array'],
            ...$mapRules,
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'title' => 'judul lowongan',
            'division_id' => 'divisi',
            'description' => 'deskripsi',
            'interviewer_ids' => 'pewawancara',
            'final_approver_ids' => 'penyetuju akhir',
        ];
    }

    /**
     * @return list<string>
     */
    public function ids(string $key): array
    {
        return array_values(array_filter($this->array($key), 'is_string'));
    }

    /**
     * @return array<string, string|null>
     */
    public function fieldMap(): array
    {
        $map = [];

        foreach (CandidateField::cases() as $field) {
            $value = $this->input('field_map.'.$field->value);
            $map[$field->value] = is_string($value) ? $value : null;
        }

        return $map;
    }
}
