<?php

namespace App\Http\Requests\Organization;

use App\Models\Division;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class DivisionRequest extends OrganizationRequest
{
    protected function modelClass(): string
    {
        return Division::class;
    }

    protected function routeKey(): string
    {
        return 'division';
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' => is_string($this->input('name')) ? trim($this->input('name')) : $this->input('name'),
            'code' => $this->normalizedCode(),
            'is_board' => $this->boolean('is_board'),
            'parent_id' => $this->nullableId('parent_id'),
            'head_user_id' => $this->nullableId('head_user_id'),
        ]);
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $companyId = $this->actor()->company_id;
        $division = $this->division();

        return [
            'name' => ['required', 'string', 'max:120'],
            // Unique per company including soft-deleted rows: codes prefix task ids and are never reused.
            'code' => [
                'required', 'string', 'max:10', 'regex:/^[A-Z0-9]+$/',
                Rule::unique('divisions', 'code')->where('company_id', $companyId)->ignore($division?->id),
            ],
            'is_board' => ['boolean', $this->singleBoard($companyId, $division)],
            'parent_id' => [
                'nullable', 'string',
                Rule::exists('divisions', 'id')->where('company_id', $companyId)->whereNull('deleted_at'),
                $this->noBoardParent(),
                $this->noCycle($division),
            ],
            // Only a changed head must be active: an already-inactive current head
            // must not block unrelated edits.
            'head_user_id' => ['nullable', 'string', ...$this->unlessUnchanged($division?->head_user_id, 'head_user_id')],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.required' => 'Nama divisi wajib diisi.',
            'name.max' => 'Nama divisi maksimal 120 karakter.',
            'code.required' => 'Kode divisi wajib diisi.',
            'code.max' => 'Kode divisi maksimal 10 karakter.',
            'code.regex' => 'Kode divisi hanya boleh berisi huruf dan angka, tanpa spasi.',
            'code.unique' => 'Kode :input sudah dipakai divisi lain (termasuk yang sudah dihapus).',
            'parent_id.exists' => 'Induk divisi tidak ditemukan.',
            'head_user_id.exists' => 'Kepala divisi harus karyawan aktif di perusahaan ini.',
        ];
    }

    /**
     * @return array{name: string, code: string, parent_id: string|null, head_user_id: string|null, is_board: bool}
     */
    public function payload(): array
    {
        return [
            'name' => $this->string('name')->toString(),
            'code' => $this->string('code')->toString(),
            'parent_id' => $this->nullableId('parent_id'),
            'head_user_id' => $this->nullableId('head_user_id'),
            'is_board' => $this->boolean('is_board'),
        ];
    }

    private function division(): ?Division
    {
        $division = $this->route('division');

        return $division instanceof Division ? $division : null;
    }

    private function singleBoard(string $companyId, ?Division $division): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($companyId, $division): void {
            if (! $value) {
                return;
            }

            $board = Division::query()
                ->where('company_id', $companyId)
                ->where('is_board', true)
                ->when($division !== null, fn ($query) => $query->whereKeyNot($division?->id))
                ->first();

            if ($board !== null) {
                $fail("Unit Direksi sudah ada ({$board->name}). Hanya boleh ada satu unit Direksi.");
            }
        };
    }

    private function noBoardParent(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if ($value !== null && $this->boolean('is_board')) {
                $fail('Unit Direksi berada di puncak bagan dan tidak boleh memiliki induk.');
            }
        };
    }

    private function noCycle(?Division $division): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($division): void {
            if ($division === null || ! is_string($value)) {
                return;
            }

            if (in_array($value, Division::withDescendantIds([$division->id]), true)) {
                $fail('Induk divisi tidak boleh divisi ini sendiri atau sub-divisinya.');
            }
        };
    }
}
