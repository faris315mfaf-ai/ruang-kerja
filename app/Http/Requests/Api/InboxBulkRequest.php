<?php

namespace App\Http\Requests\Api;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST /api/v1/inbox/massal — the same action on up to 50 selected
 * notifications (the mobile app's multi-select mode).
 */
class InboxBulkRequest extends FormRequest
{
    public const array ACTIONS = ['baca', 'belum-baca', 'arsip'];

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
            'ids' => ['required', 'array', 'min:1', 'max:50'],
            'ids.*' => ['required', 'uuid', 'distinct'],
            'aksi' => ['required', 'string', Rule::in(self::ACTIONS)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'ids.required' => 'Pilih minimal satu notifikasi.',
            'ids.array' => 'Daftar notifikasi tidak valid.',
            'ids.min' => 'Pilih minimal satu notifikasi.',
            'ids.max' => 'Maksimal 50 notifikasi sekali proses.',
            'ids.*.uuid' => 'Id notifikasi tidak valid.',
            'ids.*.distinct' => 'Id notifikasi tidak boleh ganda.',
            'aksi.required' => 'Pilih aksi.',
            'aksi.in' => 'Aksi tidak dikenal. Pilih baca, belum-baca, atau arsip.',
        ];
    }

    /**
     * @return list<string>
     */
    public function ids(): array
    {
        /** @var list<string> $ids */
        $ids = array_values((array) $this->input('ids', []));

        return $ids;
    }

    public function action(): string
    {
        return $this->string('aksi')->toString();
    }
}
