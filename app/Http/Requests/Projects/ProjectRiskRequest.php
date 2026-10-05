<?php

namespace App\Http\Requests\Projects;

use App\Domain\Projects\Enums\RiskLevel;
use App\Domain\Projects\Enums\RiskStatus;
use App\Models\Workspace;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Create / edit a risk. Owner must be a member, task must be in the project.
 */
class ProjectRiskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['owner_id', 'task_id'] as $field) {
            if ($this->input($field) === '') {
                $this->merge([$field => null]);
            }
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $workspace = $this->route('workspace');
        $workspaceId = $workspace instanceof Workspace ? $workspace->id : '';

        return [
            'title' => ['required', 'string', 'max:200'],
            'level' => ['required', Rule::enum(RiskLevel::class)],
            'owner_id' => ['nullable', 'string', Rule::exists('workspace_members', 'user_id')->where('workspace_id', $workspaceId)],
            'task_id' => ['nullable', 'string', Rule::exists('tasks', 'id')->where('workspace_id', $workspaceId)->whereNull('deleted_at')],
            'status' => ['sometimes', Rule::enum(RiskStatus::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'Judul risiko wajib diisi.',
            'title.max' => 'Judul risiko maksimal 200 karakter.',
            'level.required' => 'Pilih level risiko.',
            'owner_id.exists' => 'Pemilik risiko harus anggota workspace.',
            'task_id.exists' => 'Tugas tidak ditemukan di proyek ini.',
        ];
    }

    /**
     * @return array{title: string, level: RiskLevel, owner_id: string|null, task_id: string|null, status?: RiskStatus}
     */
    public function payload(): array
    {
        $owner = $this->input('owner_id');
        $task = $this->input('task_id');
        $payload = [
            'title' => $this->string('title')->trim()->toString(),
            'level' => RiskLevel::from($this->string('level')->toString()),
            'owner_id' => is_string($owner) ? $owner : null,
            'task_id' => is_string($task) ? $task : null,
        ];

        if ($this->has('status')) {
            $payload['status'] = RiskStatus::from($this->string('status')->toString());
        }

        return $payload;
    }
}
