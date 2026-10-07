<?php

namespace App\Domain\Hiring\Services;

use App\Domain\Hiring\Enums\CandidateField;
use App\Models\HiringPosition;

/**
 * Turns a Google Form response (answers + uploaded files, as sent by the
 * Apps Script in docs/fitur/hiring.md) into candidate fields. The position's
 * `field_map` names the Form question of each field; without one the built-in
 * aliases are tried ("Nama lengkap", "Email", "No. HP", "CV").
 */
final class FormSubmissionMapper
{
    public const int MAX_ANSWERS = 100;

    public const int MAX_ANSWER_LENGTH = 10000;

    /**
     * @param  list<array{question: string, answer: string}>  $answers
     * @param  list<array{label: string, url: string}>  $files
     * @return array{full_name: string|null, email: string|null, phone: string|null, cv_url: string|null}
     */
    public function map(HiringPosition $position, array $answers, array $files): array
    {
        $result = ['full_name' => null, 'email' => null, 'phone' => null, 'cv_url' => null];

        foreach (CandidateField::cases() as $field) {
            $titles = $this->titlesFor($position, $field);
            $value = $this->find($answers, 'question', 'answer', $titles);

            if ($field === CandidateField::CvUrl) {
                $value = self::safeUrl($value) ?? self::safeUrl($this->find($files, 'label', 'url', $titles));
            }

            $result[$field->value] = $this->clean($field, $value);
        }

        // A Form with a single upload question: that file is the CV.
        if ($result['cv_url'] === null && count($files) === 1) {
            $result['cv_url'] = self::safeUrl($files[0]['url']);
        }

        return $result;
    }

    /**
     * Normalises the raw `answers` array: strings only, arrays (checkbox
     * questions) joined with ", ", empty questions dropped, lengths capped.
     *
     * @param  array<array-key, mixed>  $raw
     * @return list<array{question: string, answer: string}>
     */
    public static function answers(array $raw): array
    {
        $answers = [];

        foreach (array_slice($raw, 0, self::MAX_ANSWERS) as $item) {
            if (! is_array($item) || ! is_string($item['question'] ?? null)) {
                continue;
            }

            $question = trim($item['question']);
            $answer = $item['answer'] ?? '';

            if (is_array($answer)) {
                $answer = implode(', ', array_map(fn (mixed $part): string => is_scalar($part) ? (string) $part : '', array_values($answer)));
            }

            if ($question === '') {
                continue;
            }

            $answers[] = [
                'question' => mb_substr($question, 0, 500),
                'answer' => mb_substr(trim(is_scalar($answer) ? (string) $answer : ''), 0, self::MAX_ANSWER_LENGTH),
            ];
        }

        return $answers;
    }

    /**
     * Normalises the raw `files` array: http(s) links only.
     *
     * @param  array<array-key, mixed>  $raw
     * @return list<array{label: string, url: string}>
     */
    public static function files(array $raw): array
    {
        $files = [];

        foreach (array_slice($raw, 0, 20) as $item) {
            if (! is_array($item)) {
                continue;
            }

            $url = self::safeUrl(is_string($item['url'] ?? null) ? $item['url'] : null);
            $label = is_string($item['label'] ?? null) ? trim($item['label']) : '';

            if ($url !== null) {
                $files[] = ['label' => mb_substr($label !== '' ? $label : 'Berkas', 0, 200), 'url' => $url];
            }
        }

        return $files;
    }

    /**
     * Only absolute http(s) links (rendered as <a href> on the profile).
     */
    public static function safeUrl(?string $value): ?string
    {
        $value = trim((string) $value);

        if ($value === '' || mb_strlen($value) > 2000 || filter_var($value, FILTER_VALIDATE_URL) === false) {
            return null;
        }

        $scheme = strtolower((string) parse_url($value, PHP_URL_SCHEME));

        return in_array($scheme, ['http', 'https'], true) ? $value : null;
    }

    public static function normalizeTitle(string $title): string
    {
        $title = mb_strtolower(trim($title));
        $title = (string) preg_replace('/\s+/u', ' ', $title);

        // "Nama lengkap *" (required marker copied from the Form)
        return trim(rtrim($title, '*: '));
    }

    /**
     * @return list<string>
     */
    private function titlesFor(HiringPosition $position, CandidateField $field): array
    {
        $mapped = $position->field_map[$field->value] ?? null;

        if (is_string($mapped) && trim($mapped) !== '') {
            return [self::normalizeTitle($mapped)];
        }

        return $field->aliases();
    }

    /**
     * @param  list<array<string, string>>  $rows
     * @param  list<string>  $titles
     */
    private function find(array $rows, string $key, string $valueKey, array $titles): ?string
    {
        foreach ($titles as $title) {
            foreach ($rows as $row) {
                if (self::normalizeTitle($row[$key]) === $title && trim($row[$valueKey]) !== '') {
                    return trim($row[$valueKey]);
                }
            }
        }

        return null;
    }

    private function clean(CandidateField $field, ?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return match ($field) {
            CandidateField::FullName => mb_substr($value, 0, 150),
            CandidateField::Email => filter_var($value, FILTER_VALIDATE_EMAIL) !== false ? mb_strtolower(mb_substr($value, 0, 190)) : null,
            CandidateField::Phone => mb_substr($value, 0, 40),
            CandidateField::CvUrl => $value,
        };
    }
}
