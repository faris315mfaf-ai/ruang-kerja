<?php

namespace App\Http\Requests\Admin;

use App\Models\PasswordResetRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Rejecting a "Lupa kata sandi" request: the reason is shown on the
 * employee's waiting page and audited.
 */
class RejectPasswordResetRequest extends FormRequest
{
    /**
     * HR / Super Admin only; which request may be decided is checked by the
     * controller (404 when not visible, then PasswordResetRequestPolicy::decide).
     */
    public function authorize(): bool
    {
        return Gate::forUser($this->user())->allows('viewAny', PasswordResetRequest::class);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'reason' => ['required', 'string', 'min:3', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['reason' => 'alasan'];
    }

    public function reason(): string
    {
        return trim($this->string('reason')->toString());
    }
}
