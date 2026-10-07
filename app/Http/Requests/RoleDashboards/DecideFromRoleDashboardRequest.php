<?php

namespace App\Http\Requests\RoleDashboards;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Approve (note optional) / reject & revision (note required) from a job
 * dashboard. Authorization: EmployeeRequestPolicy::decide in the controller.
 */
class DecideFromRoleDashboardRequest extends FormRequest
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
        $required = $this->routeIs('roles.approvals.reject', 'roles.approvals.revise') ? 'required' : 'nullable';

        return [
            'note' => [$required, 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'note.required' => $this->routeIs('roles.approvals.reject') ? 'Alasan wajib diisi saat menolak.' : 'Catatan wajib diisi saat meminta revisi.',
            'note.max' => 'Catatan maksimal :max karakter.',
        ];
    }

    public function note(): ?string
    {
        $note = $this->string('note')->trim()->toString();

        return $note === '' ? null : $note;
    }
}
