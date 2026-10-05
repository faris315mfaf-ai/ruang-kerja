<?php

namespace App\Http\Requests\Admin;

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Enums\ApproverType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveApprovalFlowRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:120'],
            'skip_self_approval' => ['sometimes', 'boolean'],
            'allow_delegation' => ['sometimes', 'boolean'],
            'leave_type_id' => ['nullable', 'string', 'ulid'],
            'steps' => ['required', 'array', 'min:1', 'max:8'],
            'steps.*.approver_type' => ['required', Rule::enum(ApproverType::class)],
            'steps.*.approver_role' => ['nullable', 'required_if:steps.*.approver_type,role', Rule::enum(Role::class)],
            'steps.*.approver_user_id' => ['nullable', 'required_if:steps.*.approver_type,user', 'string', 'ulid'],
            'steps.*.condition' => ['nullable', 'array'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama alur wajib diisi.',
            'steps.required' => 'Alur minimal punya satu langkah.',
            'steps.min' => 'Alur minimal punya satu langkah.',
            'steps.max' => 'Maksimal :max langkah.',
            'steps.*.approver_role.required_if' => 'Pilih peran penyetuju.',
            'steps.*.approver_user_id.required_if' => 'Pilih karyawan penyetuju.',
        ];
    }

    /**
     * @return array{name: string, skip_self_approval?: bool, allow_delegation?: bool, steps: list<array{approver_type: string, approver_role?: string|null, approver_user_id?: string|null, condition?: array<string, mixed>|null}>, leave_type_id?: string|null}
     */
    public function flowData(): array
    {
        /** @var array{name: string, skip_self_approval?: bool, allow_delegation?: bool, steps: list<array{approver_type: string, approver_role?: string|null, approver_user_id?: string|null, condition?: array<string, mixed>|null}>, leave_type_id?: string|null} $data */
        $data = $this->validated();

        return $data;
    }
}
