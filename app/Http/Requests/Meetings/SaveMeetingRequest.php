<?php

namespace App\Http\Requests\Meetings;

use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Services\VideoRooms;
use App\Domain\Meetings\Transcripts\Services\NotulenConfig;
use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\UserStatus;
use App\Models\Meeting;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\WorkspacePolicy;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Schedule (POST /rapat) or change (PATCH /rapat/{meeting}) a meeting. Times
 * arrive as an office date + "HH:MM" + duration; the organizer is always a
 * participant. Only holders of dashboard.view_company may mark a meeting as
 * a leadership meeting.
 */
class SaveMeetingRequest extends MeetingRequest
{
    public const array DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

    public const array REMINDERS = [5, 10, 15, 30, 60];

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $user = $this->user();
        $companyId = $user instanceof User ? $user->company_id : null;
        $activeEmployee = Rule::exists('users', 'id')->where('company_id', $companyId)->where('status', UserStatus::Active->value);
        $isNew = ! $this->route('meeting') instanceof Meeting;

        return [
            'title' => ['required', 'string', 'min:3', 'max:160'],
            'description' => ['nullable', 'string', 'max:2000'],
            'date' => ['required', 'date_format:Y-m-d', ...($isNew ? ['after_or_equal:today'] : [])],
            'start' => ['required', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'duration' => ['required', 'integer', Rule::in(self::DURATIONS)],
            'platform' => ['required', Rule::enum(MeetingPlatform::class)],
            'join_url' => ['nullable', 'string', 'max:500', 'url:https', Rule::requiredIf(fn (): bool => $this->input('platform') === MeetingPlatform::Zoom->value)],
            'location' => ['nullable', 'string', 'max:200', Rule::requiredIf(fn (): bool => in_array($this->input('platform'), [MeetingPlatform::Room->value, MeetingPlatform::Client->value], true))],
            'participant_ids' => ['present', 'array', 'max:100'],
            'participant_ids.*' => ['string', 'ulid', $activeEmployee],
            'guest_emails' => ['sometimes', 'array', 'max:30'],
            'guest_emails.*' => ['string', 'email', 'max:190'],
            // Optional display name per guest e-mail ({"tamu@x.com": "Budi"}), pre-filled on the guest page.
            'guest_names' => ['sometimes', 'nullable', 'array', 'max:30'],
            'guest_names.*' => ['nullable', 'string', 'max:60'],
            'agenda' => ['required', 'array', 'min:1', 'max:20'],
            'agenda.*' => ['nullable', 'string', 'max:200'],
            'recurrence' => ['required', Rule::enum(Recurrence::class)],
            'recurrence_until' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date'],
            'reminders' => ['present', 'array', 'max:5'],
            'reminders.*' => ['integer', Rule::in(self::REMINDERS)],
            'minute_taker_id' => ['nullable', 'string', 'ulid', $activeEmployee],
            'workspace_id' => ['nullable', 'string', 'ulid'],
            'leadership' => ['sometimes', 'boolean'],
            'auto_minutes' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'title' => 'judul',
            'date' => 'tanggal',
            'start' => 'jam mulai',
            'duration' => 'durasi',
            'platform' => 'platform',
            'join_url' => 'tautan rapat',
            'location' => 'lokasi',
            'participant_ids' => 'peserta',
            'participant_ids.*' => 'peserta',
            'guest_emails.*' => 'email tamu',
            'agenda' => 'agenda',
            'agenda.*' => 'butir agenda',
            'recurrence' => 'pengulangan',
            'recurrence_until' => 'tanggal akhir pengulangan',
            'minute_taker_id' => 'notulis',
            'workspace_id' => 'workspace',
            'auto_minutes' => 'notulen otomatis',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'date.after_or_equal' => 'Tanggal sudah lewat. Pilih hari ini atau sesudahnya.',
            'start.regex' => 'Isi jam mulai, misalnya 13:30.',
            'join_url.url' => 'Tempel tautan rapat lengkap yang diawali https://.',
            'join_url.required' => 'Tempel tautan Zoom lengkap, misalnya https://zoom.us/j/81234567890.',
            'location.required' => 'Isi ruangan atau alamat rapat.',
            'agenda.required' => 'Tambahkan minimal satu butir agenda.',
            'agenda.min' => 'Tambahkan minimal satu butir agenda.',
            'participant_ids.*.exists' => 'Peserta harus karyawan aktif.',
            'minute_taker_id.exists' => 'Notulis harus karyawan aktif.',
            'recurrence_until.after_or_equal' => 'Tanggal akhir pengulangan harus sesudah tanggal rapat.',
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $user = $this->user();

                if (! $user instanceof User) {
                    return;
                }

                $others = array_diff($this->stringList('participant_ids'), [$user->id]);

                if ($others === [] && $this->stringList('guest_emails') === []) {
                    $validator->errors()->add('participant_ids', 'Undang minimal satu peserta selain Anda.');
                }

                if (array_filter($this->stringList('agenda'), fn (string $item): bool => trim($item) !== '') === []) {
                    $validator->errors()->add('agenda', 'Tambahkan minimal satu butir agenda.');
                }

                $workspaceId = $this->input('workspace_id');

                if (is_string($workspaceId) && $workspaceId !== '') {
                    $workspace = Workspace::query()->find($workspaceId);

                    if ($workspace === null || ! app(WorkspacePolicy::class)->canEditTasks($user, $workspace)) {
                        $validator->errors()->add('workspace_id', 'Pilih workspace tempat Anda dapat membuat tugas.');
                    }
                }

                // Video RuangKerja needs a configured LiveKit server (an existing
                // video meeting may keep its platform while the server is down).
                $existing = $this->route('meeting');
                $keepsVideo = $existing instanceof Meeting && $existing->platform === MeetingPlatform::Video;

                if ($this->input('platform') === MeetingPlatform::Video->value && ! $keepsVideo && ! app(VideoRooms::class)->configured()) {
                    $validator->errors()->add('platform', 'Video RuangKerja belum disiapkan di server ini. Pilih Google Meet atau Zoom.');
                }

                // "Notulen otomatis" (docs/fitur/notulen-otomatis-kontrak.md §6): video only, and
                // switching it on needs the transcription server (an existing setting may stay).
                if ($this->boolean('auto_minutes')) {
                    if ($this->input('platform') !== MeetingPlatform::Video->value) {
                        $validator->errors()->add('auto_minutes', 'Notulen otomatis hanya untuk rapat Video RuangKerja.');
                    } elseif (! ($existing instanceof Meeting && $existing->auto_minutes) && ! app(NotulenConfig::class)->configured()) {
                        $validator->errors()->add('auto_minutes', 'Notulen otomatis belum disiapkan admin di server ini.');
                    }
                }

                $timeErrors = $validator->errors()->hasAny(['date', 'start', 'duration']);

                if (! $timeErrors && $this->route('meeting') === null && $this->times()[0]->isPast()) {
                    $validator->errors()->add('start', 'Jam mulai sudah lewat. Pilih jam yang akan datang.');
                }
            },
        ];
    }

    /**
     * Input for ScheduleMeeting / UpdateMeeting.
     *
     * @return array{
     *     title: string, description: string|null, starts_at: CarbonImmutable, ends_at: CarbonImmutable,
     *     platform: MeetingPlatform, location: string|null, join_url: string|null,
     *     minute_taker_id: string|null, workspace_id: string|null, agenda: list<string>,
     *     recurrence: Recurrence, recurrence_until: string|null, reminders: list<int>, leadership: bool,
     *     auto_minutes: bool, participant_ids: list<string>, guest_emails: list<string>, guest_names: array<string, string|null>
     * }
     */
    public function toInput(): array
    {
        $user = $this->user();
        [$startsAt, $endsAt] = $this->times();
        $existing = $this->route('meeting');
        $canLead = $user instanceof User && $user->hasPermission(Permission::DashboardViewCompany);

        return [
            'title' => $this->string('title')->trim()->toString(),
            'description' => $this->filled('description') ? $this->string('description')->toString() : null,
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'platform' => MeetingPlatform::from($this->string('platform')->toString()),
            'location' => $this->filled('location') ? $this->string('location')->toString() : null,
            'join_url' => $this->filled('join_url') ? $this->string('join_url')->toString() : null,
            'minute_taker_id' => $this->filled('minute_taker_id') ? $this->string('minute_taker_id')->toString() : null,
            'workspace_id' => $this->filled('workspace_id') ? $this->string('workspace_id')->toString() : null,
            'agenda' => $this->stringList('agenda'),
            'recurrence' => Recurrence::from($this->string('recurrence')->toString()),
            'recurrence_until' => $this->filled('recurrence_until') ? $this->string('recurrence_until')->toString() : null,
            'reminders' => array_values(array_map(intval(...), (array) $this->input('reminders', []))),
            // Kept as it was when someone without the permission edits a leadership meeting.
            'leadership' => $canLead ? $this->boolean('leadership') : ($existing instanceof Meeting && $existing->leadership),
            // Missing from the request (older form) = keep the current setting.
            'auto_minutes' => $this->has('auto_minutes') ? $this->boolean('auto_minutes') : ($existing instanceof Meeting && $existing->auto_minutes),
            'participant_ids' => $this->stringList('participant_ids'),
            'guest_emails' => $this->stringList('guest_emails'),
            'guest_names' => $this->guestNames(),
        ];
    }

    /**
     * @return array<string, string|null>
     */
    private function guestNames(): array
    {
        $names = [];

        foreach ((array) $this->input('guest_names', []) as $email => $name) {
            if (is_string($email) && (is_string($name) || $name === null)) {
                $names[mb_strtolower(trim($email))] = $name;
            }
        }

        return $names;
    }

    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    private function times(): array
    {
        $timezone = config()->string('app.office_timezone');
        $start = CarbonImmutable::createFromFormat('Y-m-d H:i', $this->string('date')->toString().' '.$this->string('start')->toString(), $timezone);
        $start = $start instanceof CarbonImmutable ? $start : CarbonImmutable::now($timezone);

        return [$start->utc(), $start->addMinutes($this->integer('duration'))->utc()];
    }

    /**
     * @return list<string>
     */
    private function stringList(string $key): array
    {
        $value = $this->input($key, []);

        return is_array($value) ? array_values(array_map(fn (mixed $item): string => is_scalar($item) ? (string) $item : '', $value)) : [];
    }
}
