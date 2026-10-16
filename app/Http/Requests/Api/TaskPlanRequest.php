<?php

namespace App\Http\Requests\Api;

use App\Domain\Planner\Enums\PlanBucket;
use App\Http\Requests\Concerns\HidesInvisibleWorkspaces;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * PUT /api/v1/tugas/{task}/rencana — plan a task in one of the caller's
 * lanes or give it back to the automatic one:
 *   bucket     today | week | later | null (kembalikan otomatis); required key
 *   position   0-based place among the lane's planned tasks (optional)
 *   after_id / before_id   planned neighbours (optional, wins over position)
 * Nothing given → the end of the planned part of the lane. Someone who may not
 * see the task gets 404 first (HidesInvisibleWorkspaces); the controller
 * checks TaskPolicy::plan.
 */
class TaskPlanRequest extends FormRequest
{
    use HidesInvisibleWorkspaces;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'bucket' => ['present', 'nullable', 'string', Rule::enum(PlanBucket::class)],
            'position' => ['sometimes', 'nullable', 'integer', 'between:0,1000'],
            'after_id' => ['sometimes', 'nullable', 'string', 'size:26'],
            'before_id' => ['sometimes', 'nullable', 'string', 'size:26'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'bucket.present' => 'Kirim bucket: today, week, later, atau null.',
            'bucket.enum' => 'Pilih Hari ini, Minggu ini, atau Nanti.',
            'position.integer' => 'Posisi tidak valid.',
            'position.between' => 'Posisi tidak valid.',
        ];
    }

    public function bucket(): ?PlanBucket
    {
        return $this->filled('bucket') ? PlanBucket::from($this->string('bucket')->toString()) : null;
    }
}
