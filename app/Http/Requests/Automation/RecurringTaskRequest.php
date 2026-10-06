<?php

namespace App\Http\Requests\Automation;

use App\Domain\Automation\Enums\RecurrenceKind;
use App\Domain\Automation\Services\RecurrenceSchedule;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * "Tugas berulang baru" / "Ubah": mirrors validateRecurring() of
 * features/automation/recurrence.ts (same messages), plus the priority the
 * preview form lacked and a member check on the assignee.
 */
class RecurringTaskRequest extends FormRequest
{
    private ?Workspace $workspace = null;

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
            'workspace_id' => ['required', 'string', 'ulid'],
            'title' => ['required', 'string', 'max:255'],
            'assignee_id' => ['nullable', 'string', 'ulid'],
            'priority' => ['required', 'integer', 'between:0,4'],
            'pattern' => ['required', 'array'],
            'pattern.kind' => ['required', Rule::in(RecurrenceKind::values())],
            'pattern.weekdays_only' => ['sometimes', 'boolean'],
            'pattern.weekdays' => ['nullable', 'array', 'max:7'],
            'pattern.weekdays.*' => ['integer', 'between:1,7'],
            'pattern.day_of_month' => ['nullable', 'integer'],
            'pattern.interval' => ['nullable', 'integer'],
            'starts_on' => ['required', 'date_format:Y-m-d'],
            'ends_on' => ['nullable', 'date_format:Y-m-d'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'workspace_id.required' => 'Pilih workspace.',
            'title.required' => 'Isi judul tugas.',
            'title.max' => 'Judul maksimal 255 karakter.',
            'priority.*' => 'Pilih prioritas.',
            'starts_on.*' => 'Isi tanggal mulai.',
            'ends_on.date_format' => 'Tanggal berakhir tidak valid.',
        ];
    }

    /**
     * @return list<callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $workspace = $this->workspace();

            if ($workspace === null) {
                $validator->errors()->add('workspace_id', 'Pilih workspace.');

                return;
            }

            $pattern = $this->pattern();
            $kind = $pattern['kind'];

            if (in_array($kind, ['weekly', 'every_n_weeks'], true) && $pattern['weekdays'] === []) {
                $validator->errors()->add('pattern', 'Pilih minimal satu hari.');
            } elseif ($kind === 'monthly' && ($pattern['day_of_month'] < 1 || $pattern['day_of_month'] > 31)) {
                $validator->errors()->add('pattern', 'Tanggal harus 1–31.');
            } elseif ($kind === 'every_n_weeks' && ($pattern['interval'] < 1 || $pattern['interval'] > 12)) {
                $validator->errors()->add('pattern', 'Jarak minggu harus 1–12.');
            }

            $startsOn = $this->string('starts_on')->toString();
            $endsOn = $this->endsOn();

            if ($endsOn !== null && $endsOn < $startsOn) {
                $validator->errors()->add('ends_on', 'Tanggal berakhir harus setelah tanggal mulai.');
            }

            $assignee = $this->input('assignee_id');

            if (is_string($assignee) && $assignee !== '' && ! $this->isMember($workspace, $assignee)) {
                $validator->errors()->add('assignee_id', 'Pilih anggota workspace ini.');
            }

            if ($validator->errors()->isEmpty() && RecurrenceSchedule::nextOccurrences($pattern, $startsOn, $endsOn, $startsOn, 1) === []) {
                $validator->errors()->add('ends_on', 'Tidak ada jadwal di antara tanggal mulai dan berakhir.');
            }
        }];
    }

    public function workspace(): ?Workspace
    {
        /** @var User $user */
        $user = $this->user();

        return $this->workspace ??= Workspace::query()
            ->where('company_id', $user->company_id)
            ->find($this->string('workspace_id')->toString());
    }

    /**
     * @return array{title: string, assignee_id: string|null, priority: int, pattern: array<string, mixed>, starts_on: string, ends_on: string|null}
     */
    public function payload(): array
    {
        $assignee = $this->input('assignee_id');

        return [
            'title' => $this->string('title')->trim()->toString(),
            'assignee_id' => is_string($assignee) && $assignee !== '' ? $assignee : null,
            'priority' => $this->integer('priority'),
            'pattern' => $this->pattern(),
            'starts_on' => $this->string('starts_on')->toString(),
            'ends_on' => $this->endsOn(),
        ];
    }

    /**
     * Normalized pattern with only the keys of its kind.
     *
     * @return array<string, mixed>
     */
    private function pattern(): array
    {
        $kind = (string) $this->input('pattern.kind');
        $weekdays = collect((array) $this->input('pattern.weekdays', []))
            ->map(fn (mixed $day): int => (int) $day)
            ->filter(fn (int $day): bool => $day >= 1 && $day <= 7)
            ->unique()
            ->sort()
            ->values()
            ->all();

        return match ($kind) {
            'daily' => ['kind' => 'daily', 'weekdays_only' => $this->boolean('pattern.weekdays_only')],
            'weekly' => ['kind' => 'weekly', 'weekdays' => $weekdays],
            'monthly' => ['kind' => 'monthly', 'day_of_month' => $this->integer('pattern.day_of_month')],
            default => ['kind' => 'every_n_weeks', 'interval' => $this->integer('pattern.interval'), 'weekdays' => $weekdays],
        };
    }

    private function endsOn(): ?string
    {
        $value = $this->input('ends_on');

        return is_string($value) && $value !== '' ? $value : null;
    }

    private function isMember(Workspace $workspace, string $userId): bool
    {
        if ($workspace->isPersonal()) {
            return $workspace->owner_id === $userId;
        }

        return WorkspaceMember::query()->where('workspace_id', $workspace->id)->where('user_id', $userId)->exists();
    }
}
