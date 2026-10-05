<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

class ReactivateEmployeeRequest extends FormRequest
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
            'reason' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function reason(): ?string
    {
        $reason = trim($this->string('reason')->toString());

        return $reason === '' ? null : $reason;
    }
}
