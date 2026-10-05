<?php

namespace App\Http\Requests\Projects;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Create / edit a milestone. Linked tasks outside the workspace are dropped
 * by SaveMilestone.
 */
class MilestoneRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:1000'],
            'target_date' => ['required', 'date_format:Y-m-d'],
            'task_ids' => ['sometimes', 'array', 'max:100'],
            'task_ids.*' => ['string', 'size:26'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama milestone wajib diisi.',
            'name.max' => 'Nama milestone maksimal 160 karakter.',
            'target_date.required' => 'Target tanggal wajib diisi.',
            'target_date.date_format' => 'Target tanggal tidak valid.',
        ];
    }

    /**
     * @return array{name: string, description: string|null, target_date: string, task_ids?: list<string>}
     */
    public function payload(): array
    {
        $description = $this->string('description')->trim()->toString();
        $payload = [
            'name' => $this->string('name')->trim()->toString(),
            'description' => $description === '' ? null : $description,
            'target_date' => $this->string('target_date')->toString(),
        ];

        if ($this->has('task_ids')) {
            $ids = $this->input('task_ids');
            $payload['task_ids'] = is_array($ids) ? array_values(array_filter($ids, 'is_string')) : [];
        }

        return $payload;
    }
}
