<?php

namespace App\Http\Requests\Announcements;

use App\Domain\Announcements\Enums\AnnouncementAudience;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * New announcement. Who may target what is checked by PublishAnnouncement.
 */
class StoreAnnouncementRequest extends FormRequest
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
            'title' => ['required', 'string', 'max:160'],
            'body' => ['required', 'string', 'max:5000'],
            'audience' => ['required', Rule::enum(AnnouncementAudience::class)],
            'target_ids' => ['nullable', 'array', 'max:50'],
            'target_ids.*' => ['string', 'ulid'],
            'expires_on' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'Judul wajib diisi.',
            'title.max' => 'Judul maksimal :max karakter.',
            'body.required' => 'Isi pengumuman wajib diisi.',
            'body.max' => 'Isi maksimal :max karakter.',
            'audience.required' => 'Pilih penerima.',
            'expires_on.date_format' => 'Tanggal tidak valid.',
        ];
    }

    public function audience(): AnnouncementAudience
    {
        return AnnouncementAudience::from($this->string('audience')->toString());
    }

    /**
     * @return list<string>
     */
    public function targetIds(): array
    {
        $ids = $this->validated('target_ids');

        return is_array($ids) ? array_values(array_filter($ids, 'is_string')) : [];
    }

    /**
     * "Tampil sampai" date → end of that office day.
     */
    public function expiresAt(): ?CarbonImmutable
    {
        $date = $this->validated('expires_on');

        return is_string($date) && $date !== ''
            ? CarbonImmutable::parse($date, config()->string('app.office_timezone'))->endOfDay()->utc()
            : null;
    }
}
