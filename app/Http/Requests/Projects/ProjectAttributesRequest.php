<?php

namespace App\Http\Requests\Projects;

use App\Domain\Organization\Enums\Role;
use App\Domain\Projects\Enums\ProjectStatus;
use App\Models\Workspace;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Pengaturan › Proyek. Authorization: WorkspacePolicy::update (controller).
 * PIC must be a member of the workspace; sponsor must hold the Direksi role.
 */
class ProjectAttributesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['lead_user_id', 'sponsor_user_id', 'division_id', 'start_date', 'target_date'] as $field) {
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
        $workspace = $this->workspace();

        return [
            'lead_user_id' => ['nullable', 'string', Rule::exists('workspace_members', 'user_id')->where('workspace_id', $workspace->id)],
            'sponsor_user_id' => ['nullable', 'string', Rule::exists('users', 'id')->where('company_id', $workspace->company_id)->where(
                fn ($query) => $query->whereIn('id', fn ($roles) => $roles->select('model_id')->from('model_has_roles')
                    ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
                    ->where('roles.name', Role::Direksi->value)),
            )],
            'division_id' => ['nullable', 'string', Rule::exists('divisions', 'id')->where('company_id', $workspace->company_id)->whereNull('deleted_at')],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'target_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'project_status' => ['required', Rule::enum(ProjectStatus::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'lead_user_id.exists' => 'PIC harus anggota workspace ini.',
            'sponsor_user_id.exists' => 'Sponsor harus anggota Direksi.',
            'division_id.exists' => 'Divisi tidak ditemukan.',
            'start_date.date_format' => 'Tanggal mulai tidak valid.',
            'target_date.date_format' => 'Target selesai tidak valid.',
            'target_date.after_or_equal' => 'Target selesai tidak boleh sebelum tanggal mulai.',
            'project_status.required' => 'Pilih status proyek.',
        ];
    }

    /**
     * @return array{lead_user_id: string|null, sponsor_user_id: string|null, division_id: string|null, start_date: string|null, target_date: string|null, project_status: ProjectStatus}
     */
    public function projectAttributes(): array
    {
        return [
            'lead_user_id' => $this->nullableString('lead_user_id'),
            'sponsor_user_id' => $this->nullableString('sponsor_user_id'),
            'division_id' => $this->nullableString('division_id'),
            'start_date' => $this->nullableString('start_date'),
            'target_date' => $this->nullableString('target_date'),
            'project_status' => ProjectStatus::from($this->string('project_status')->toString()),
        ];
    }

    private function nullableString(string $key): ?string
    {
        $value = $this->input($key);

        return is_string($value) && $value !== '' ? $value : null;
    }

    private function workspace(): Workspace
    {
        $workspace = $this->route('workspace');
        abort_unless($workspace instanceof Workspace, 404);

        return $workspace;
    }
}
