<?php

namespace App\Http\Requests\Meetings;

use Illuminate\Contracts\Validation\ValidationRule;

/** Autosave of draft minutes (PUT /rapat/{meeting}/notulen). */
class SaveMinutesRequest extends MeetingRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'tanggal' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'attendance' => ['present', 'array', 'max:200'],
            'attendance.*.user_id' => ['required', 'string', 'ulid'],
            'attendance.*.present' => ['required', 'boolean'],
            'attendance.*.reason' => ['nullable', 'string', 'max:60'],
            'sections' => ['present', 'array', 'max:40'],
            'sections.*.title' => ['required', 'string', 'max:200'],
            'sections.*.body' => ['present', 'nullable', 'string', 'max:20000'],
            'decisions' => ['present', 'array', 'max:50'],
            'decisions.*' => ['nullable', 'string', 'max:500'],
        ];
    }

    /**
     * @return array{attendance: list<array{user_id: string, present: bool, reason?: string|null}>, sections: list<array{title: string, body: string}>, decisions: list<string>}
     */
    public function content(): array
    {
        /** @var list<array{user_id: string, present: bool|string|int, reason?: string|null}> $attendance */
        $attendance = array_values((array) $this->input('attendance', []));
        /** @var list<array{title: string, body: string|null}> $sections */
        $sections = array_values((array) $this->input('sections', []));
        /** @var list<string|null> $decisions */
        $decisions = array_values((array) $this->input('decisions', []));

        return [
            'attendance' => array_map(fn (array $mark): array => [
                'user_id' => (string) $mark['user_id'],
                'present' => filter_var($mark['present'], FILTER_VALIDATE_BOOL),
                'reason' => $mark['reason'] ?? null,
            ], $attendance),
            'sections' => array_map(fn (array $section): array => [
                'title' => (string) $section['title'],
                'body' => (string) ($section['body'] ?? ''),
            ], $sections),
            'decisions' => array_map(fn (?string $decision): string => (string) $decision, $decisions),
        ];
    }
}
