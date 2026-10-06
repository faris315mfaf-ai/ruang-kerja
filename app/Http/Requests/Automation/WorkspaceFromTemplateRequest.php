<?php

namespace App\Http\Requests\Automation;

use App\Domain\Workspaces\Enums\WorkspaceVisibility;
use App\Domain\Workspaces\Services\WorkspaceKeyGenerator;
use App\Models\User;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * "Pakai template" (workspace): name, task key (docs/DATABASE.md
 * `^[A-Z][A-Z0-9]{1,9}$`, unique in the company including keys used before a
 * rename) and visibility.
 */
class WorkspaceFromTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $key = $this->input('key');

        if (is_string($key)) {
            $this->merge(['key' => mb_strtoupper(trim($key))]);
        }
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'key' => ['required', 'string', 'regex:'.WorkspaceKeyGenerator::PATTERN],
            'visibility' => ['required', Rule::enum(WorkspaceVisibility::class)],
            'description' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Isi nama workspace.',
            'name.max' => 'Nama workspace maksimal 120 karakter.',
            'key.required' => 'Isi kode workspace.',
            'key.regex' => 'Kode 2–10 huruf besar/angka, diawali huruf.',
            'visibility.*' => 'Pilih visibilitas.',
        ];
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->has('key')) {
                return;
            }

            /** @var User $user */
            $user = $this->user();

            if (app(WorkspaceKeyGenerator::class)->taken((string) $user->company_id, $this->string('key')->toString())) {
                $validator->errors()->add('key', 'Kode sudah dipakai workspace lain.');
            }
        }];
    }

    /**
     * @return array{name: string, key: string, visibility: WorkspaceVisibility, description: string|null}
     */
    public function payload(): array
    {
        $description = $this->input('description');

        return [
            'name' => $this->string('name')->trim()->toString(),
            'key' => $this->string('key')->toString(),
            'visibility' => WorkspaceVisibility::from($this->string('visibility')->toString()),
            'description' => is_string($description) && trim($description) !== '' ? trim($description) : null,
        ];
    }
}
