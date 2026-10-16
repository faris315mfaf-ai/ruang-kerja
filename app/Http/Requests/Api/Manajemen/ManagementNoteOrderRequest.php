<?php

namespace App\Http\Requests\Api\Manajemen;

use App\Models\ManagementNote;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * PUT /api/v1/catatan-tindakan/urutan — the full new order of the owner's
 * open notes, top first (ReorderManagementNotes refuses a stale list, 422).
 */
class ManagementNoteOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        Gate::authorize('create', ManagementNote::class);

        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'ids' => ['present', 'array', 'max:'.ManagementNote::LIMIT],
            'ids.*' => ['required', 'string', 'ulid'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['ids.*' => 'Daftar catatan tidak valid.'];
    }

    /**
     * @return list<string>
     */
    public function ids(): array
    {
        $ids = $this->input('ids');

        return is_array($ids) ? array_values(array_map('strtolower', array_filter($ids, 'is_string'))) : [];
    }
}
