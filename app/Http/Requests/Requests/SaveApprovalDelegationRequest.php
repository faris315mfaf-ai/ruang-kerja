<?php

namespace App\Http\Requests\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class SaveApprovalDelegationRequest extends FormRequest
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
            'delegate_id' => ['required', 'string', 'ulid'],
            'starts_on' => ['required', 'date_format:Y-m-d'],
            'ends_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:starts_on'],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'delegate_id.required' => 'Pilih rekan sebagai delegasi.',
            'starts_on.required' => 'Tanggal mulai wajib diisi.',
            'ends_on.required' => 'Tanggal selesai wajib diisi.',
            'ends_on.after_or_equal' => 'Tanggal selesai tidak boleh sebelum tanggal mulai.',
        ];
    }

    /**
     * @return array{delegate_id: string, starts_on: string, ends_on: string, reason?: string|null}
     */
    public function delegationData(): array
    {
        /** @var array{delegate_id: string, starts_on: string, ends_on: string, reason?: string|null} */
        return $this->validated();
    }
}
