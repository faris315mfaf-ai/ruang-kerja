<?php

namespace App\Http\Requests\Workspaces;

use App\Domain\Workspaces\Enums\WorkspaceRole;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Add a member (user_id + role) or change a role (role only).
 * Authorization: WorkspacePolicy::manageMembers.
 */
class WorkspaceMemberRequest extends FormRequest
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
        $roles = array_map(fn (WorkspaceRole $role): string => $role->value, WorkspaceRole::assignable());

        return [
            'user_id' => [$this->isMethod('post') ? 'required' : 'prohibited', 'string', Rule::exists('users', 'id')],
            'role' => ['required', Rule::in($roles)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'user_id.required' => 'Pilih karyawan yang akan diundang.',
            'user_id.exists' => 'Karyawan tidak ditemukan.',
            'role.required' => 'Pilih peran.',
            'role.in' => 'Peran tidak valid.',
        ];
    }

    public function role(): WorkspaceRole
    {
        return WorkspaceRole::from($this->string('role')->toString());
    }
}
