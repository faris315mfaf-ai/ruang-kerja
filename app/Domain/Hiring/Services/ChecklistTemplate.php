<?php

namespace App\Domain\Hiring\Services;

use App\Domain\Hiring\Enums\ReviewerRole;

/**
 * Checklist items generated for every candidate, per reviewer role
 * (hiring_settings.checklist_template). A role missing from the stored
 * template falls back to the built-in defaults; an empty list means "none".
 */
final class ChecklistTemplate
{
    public const int MAX_ITEMS = 12;

    /**
     * @return array<string, list<array{label: string, required: bool}>>
     */
    public static function defaults(): array
    {
        return [
            ReviewerRole::Hr->value => [
                ['label' => 'CV dan berkas lamaran lengkap', 'required' => true],
                ['label' => 'Data kontak sudah diverifikasi', 'required' => true],
                ['label' => 'Ekspektasi gaji sesuai anggaran', 'required' => false],
            ],
            ReviewerRole::Interviewer->value => [
                ['label' => 'Wawancara sudah dilakukan', 'required' => true],
                ['label' => 'Poin setiap pertanyaan sudah diisi', 'required' => true],
            ],
            ReviewerRole::Approver->value => [
                ['label' => 'Profil, poin, dan notulensi sudah ditinjau', 'required' => true],
            ],
        ];
    }

    /**
     * @param  array<array-key, mixed>|null  $template
     * @return array<string, list<array{label: string, required: bool}>>
     */
    public static function normalize(?array $template): array
    {
        $defaults = self::defaults();
        $normalized = [];

        foreach (ReviewerRole::cases() as $role) {
            $items = $template[$role->value] ?? null;

            if (! is_array($items)) {
                $normalized[$role->value] = $defaults[$role->value];

                continue;
            }

            $clean = [];

            foreach ($items as $item) {
                if (! is_array($item)) {
                    continue;
                }

                $label = is_string($item['label'] ?? null) ? trim($item['label']) : '';

                if ($label === '') {
                    continue;
                }

                $clean[] = [
                    'label' => mb_substr($label, 0, 200),
                    'required' => (bool) ($item['required'] ?? true),
                ];
            }

            $normalized[$role->value] = array_slice($clean, 0, self::MAX_ITEMS);
        }

        return $normalized;
    }
}
