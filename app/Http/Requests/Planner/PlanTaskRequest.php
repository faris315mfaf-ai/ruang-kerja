<?php

namespace App\Http\Requests\Planner;

use App\Domain\Planner\Enums\PlanBucket;
use App\Http\Requests\Concerns\HidesInvisibleWorkspaces;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * PUT /ruang-saya/tugas/{task} — accept or move a task in Ruang saya:
 *   bucket     today | week | later
 *   after_id   planned task directly above the new place (optional)
 *   before_id  planned task directly below the new place (optional)
 * Neither neighbour → end of the planned part of the lane.
 */
class PlanTaskRequest extends FormRequest
{
    use HidesInvisibleWorkspaces;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'bucket' => ['required', 'string', Rule::enum(PlanBucket::class)],
            'after_id' => ['nullable', 'string', 'size:26'],
            'before_id' => ['nullable', 'string', 'size:26'],
        ];
    }

    public function bucket(): PlanBucket
    {
        return PlanBucket::from($this->string('bucket')->toString());
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'bucket.required' => 'Pilih Hari ini, Minggu ini, atau Nanti.',
            'bucket.enum' => 'Pilih Hari ini, Minggu ini, atau Nanti.',
        ];
    }
}
