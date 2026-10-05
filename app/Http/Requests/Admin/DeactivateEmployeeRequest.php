<?php

namespace App\Http\Requests\Admin;

use App\Domain\Organization\Enums\UserStatus;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class DeactivateEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        $employee = $this->route('employee');

        return $employee instanceof User && Gate::forUser($this->user())->allows('deactivate', $employee);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::enum(UserStatus::class)->except([UserStatus::Active])],
            'reason' => ['required', 'string', 'min:3', 'max:500'],
            'reassign_reports' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'status' => 'status',
            'reason' => 'alasan',
        ];
    }

    public function status(): UserStatus
    {
        return $this->enum('status', UserStatus::class) ?? UserStatus::Inactive;
    }

    public function reason(): string
    {
        return trim($this->string('reason')->toString());
    }
}
