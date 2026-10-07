<?php

namespace App\Http\Requests\RoleDashboards;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Dirut "Putuskan": optional decision text, sent to the PIC as a direction.
 * Authorization: ProjectUpdatePolicy::resolveDecision (+ ProjectDirectionPolicy::create) in the controller.
 */
class ResolveRoleDecisionRequest extends FormRequest
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
        return ['decision' => ['nullable', 'string', 'max:2000']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['decision.max' => 'Keputusan maksimal 2.000 karakter.'];
    }

    public function decision(): ?string
    {
        $decision = $this->string('decision')->trim()->toString();

        return $decision === '' ? null : $decision;
    }
}
