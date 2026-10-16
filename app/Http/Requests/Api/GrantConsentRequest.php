<?php

namespace App\Http\Requests\Api;

use App\Domain\Attendance\Enums\ConsentType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * POST /api/v1/persetujuan — consent to location AND selfie processing for the
 * current policy version. A GPS + selfie check-in needs both, and the web
 * action records them together, so both types must be listed.
 */
class GrantConsentRequest extends FormRequest
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
        $required = array_map(fn (ConsentType $type): string => $type->value, ConsentType::requiredForCheckIn());

        return [
            'types' => ['required', 'array', 'min:1'],
            'types.*' => ['required', 'string', Rule::in($required), 'distinct'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'types.required' => 'Jenis persetujuan wajib dikirim.',
            'types.array' => 'Jenis persetujuan tidak valid.',
            'types.min' => 'Jenis persetujuan wajib dikirim.',
            'types.*.in' => 'Jenis persetujuan tidak dikenal.',
            'types.*.distinct' => 'Jenis persetujuan terduplikasi.',
        ];
    }

    /**
     * @param  Validator  $validator
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $types = $this->input('types', []);

            if (! is_array($types) || count($types) !== count(ConsentType::requiredForCheckIn())) {
                $validator->errors()->add('types', 'Persetujuan lokasi dan selfie harus diberikan bersama untuk check-in GPS + selfie.');
            }
        });
    }
}
