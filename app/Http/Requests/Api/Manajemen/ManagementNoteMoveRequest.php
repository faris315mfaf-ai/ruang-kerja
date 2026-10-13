<?php

namespace App\Http\Requests\Api\Manajemen;

use App\Models\ManagementNote;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * POST /api/v1/catatan-tindakan/{id}/pindah — "Naikkan" / "Turunkan" one open
 * note by one place. Owner only (ManagementNotePolicy: anyone else's note is
 * a 404 before validation, so nothing leaks).
 */
class ManagementNoteMoveRequest extends FormRequest
{
    public function authorize(): bool
    {
        $note = $this->route('managementNote');

        if ($note instanceof ManagementNote) {
            Gate::authorize('update', $note);
        }

        return true;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return ['arah' => ['required', 'in:naik,turun']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return ['arah.*' => 'Pilih naikkan atau turunkan.'];
    }

    public function up(): bool
    {
        return $this->string('arah')->toString() === 'naik';
    }
}
