<?php

namespace App\Http\Requests\Api;

use App\Domain\Notifications\Data\InboxFilters;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * GET /api/v1/inbox — tab (semua · perlu-tindakan · diarsipkan), the
 * "belum-dibaca" chip, the kind chip (jenis) and paging. Also the scope of
 * POST /inbox/baca-semua (tab, jenis, belum-dibaca ignored there).
 * Authorization is InboxNotificationPolicy::viewAny in the controller.
 */
class InboxIndexApiRequest extends FormRequest
{
    public const array TABS = ['semua', 'perlu-tindakan', 'diarsipkan'];

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
            'tab' => ['nullable', 'string', Rule::in(self::TABS)],
            'belum-dibaca' => ['nullable', 'boolean'],
            'jenis' => ['nullable', 'string', Rule::in(InboxFilters::kinds())],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'tab.in' => 'Tab Inbox tidak dikenal. Pilih semua, perlu-tindakan, atau diarsipkan.',
            'belum-dibaca.boolean' => 'Filter belum dibaca tidak valid.',
            'jenis.in' => 'Jenis notifikasi tidak dikenal.',
            'page.integer' => 'Nomor halaman tidak valid.',
            'page.min' => 'Nomor halaman tidak valid.',
            'per_page.integer' => 'Jumlah per halaman tidak valid.',
            'per_page.min' => 'Jumlah per halaman minimal 1.',
            'per_page.max' => 'Jumlah per halaman maksimal 50.',
        ];
    }

    public function filters(): InboxFilters
    {
        $tab = $this->string('tab', 'semua')->toString();

        return new InboxFilters(
            tab: $tab === 'perlu-tindakan' ? 'action' : 'all',
            kind: $this->filled('jenis') ? $this->string('jenis')->toString() : null,
            archived: $tab === 'diarsipkan',
            unreadOnly: $this->boolean('belum-dibaca'),
        );
    }

    public function perPage(): int
    {
        return $this->integer('per_page', 20) ?: 20;
    }
}
