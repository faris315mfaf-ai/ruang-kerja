<?php

namespace App\Http\Requests\Okr;

use App\Domain\Okr\Enums\KeyResultUnit;
use App\Models\KeyResult;
use Illuminate\Auth\Access\Response;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Gate;

/**
 * Key result check-in: new value, confidence 1–10, optional note.
 */
class CheckinRequest extends FormRequest
{
    /**
     * Before validation, so an invisible key result answers 404, not 422.
     */
    public function authorize(): Response
    {
        $keyResult = $this->route('keyResult');

        return $keyResult instanceof KeyResult ? Gate::inspect('checkin', $keyResult) : Response::denyAsNotFound();
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $keyResult = $this->route('keyResult');
        $percent = $keyResult instanceof KeyResult && $keyResult->unit === KeyResultUnit::Percent;

        return [
            'value' => ['required', 'numeric', 'decimal:0,2', $percent ? 'between:0,100' : 'between:-999999999999.99,999999999999.99'],
            'confidence' => ['nullable', 'integer', 'between:1,10'],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'value.required' => 'Isi nilai berupa angka.',
            'value.numeric' => 'Isi nilai berupa angka.',
            'value.decimal' => 'Maksimal 2 angka di belakang koma.',
            'value.between' => 'Nilai di luar rentang yang diizinkan.',
            'confidence.*' => 'Keyakinan 1–10.',
            'note.max' => 'Catatan maksimal 500 karakter.',
        ];
    }
}
