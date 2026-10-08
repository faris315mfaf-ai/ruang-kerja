<?php

namespace App\Domain\Meetings\Transcripts\Services;

/**
 * "Masukkan ke notulen": adds the AI draft to the minutes content without
 * touching what the notulis wrote. Each agenda section gets an appended
 * block marked "Draf otomatis — periksa sebelum final" (a draft agenda item
 * without a matching section becomes a new section), the summary becomes a
 * final section, and new decisions are appended with a marker. Follow-ups
 * are added separately as action items (AddActionItem).
 */
final class DraftMerger
{
    public const string MARKER = 'Draf otomatis — periksa sebelum final';

    /**
     * @param  array{attendance: list<array{user_id: string, present: bool, reason?: string|null}>, sections: list<array{title: string, body: string}>, decisions: list<string>}  $content
     * @param  array<string, mixed>  $draft  normalized draft (DraftNormalizer)
     * @return array{attendance: list<array{user_id: string, present: bool, reason?: string|null}>, sections: list<array{title: string, body: string}>, decisions: list<string>}
     */
    public static function merge(array $content, array $draft): array
    {
        $sections = $content['sections'];

        foreach (is_array($draft['agenda'] ?? null) ? $draft['agenda'] : [] as $item) {
            $lines = array_values(array_filter(array_map(
                fn (mixed $point): string => is_array($point) ? trim((string) ($point['teks'] ?? '')) : '',
                is_array($item['poin'] ?? null) ? $item['poin'] : [],
            )));

            if ($lines === []) {
                continue;
            }

            $block = '['.self::MARKER."]\n".implode("\n", array_map(fn (string $line): string => '• '.$line, $lines));
            $title = trim((string) ($item['judul'] ?? ''));
            $index = self::findSection($sections, $title);

            if ($index === null) {
                $sections[] = ['title' => mb_substr($title !== '' ? $title : 'Pembahasan', 0, 200), 'body' => $block];

                continue;
            }

            $body = rtrim($sections[$index]['body']);
            $sections[$index] = ['title' => $sections[$index]['title'], 'body' => $body === '' ? $block : $body."\n\n".$block];
        }

        $summary = trim((string) ($draft['ringkasan'] ?? ''));

        if ($summary !== '') {
            $sections[] = ['title' => 'Ringkasan (draf otomatis)', 'body' => '['.self::MARKER."]\n".$summary];
        }

        $decisions = $content['decisions'];
        $known = array_map(fn (string $d): string => self::key($d), $decisions);

        foreach (is_array($draft['keputusan'] ?? null) ? $draft['keputusan'] : [] as $decision) {
            $text = is_array($decision) ? trim((string) ($decision['teks'] ?? '')) : '';

            if ($text === '' || in_array(self::key($text), $known, true)) {
                continue;
            }

            $decisions[] = $text.' (draf otomatis)';
            $known[] = self::key($text);
        }

        return ['attendance' => $content['attendance'], 'sections' => $sections, 'decisions' => $decisions];
    }

    /**
     * @param  list<array{title: string, body: string}>  $sections
     */
    private static function findSection(array $sections, string $title): ?int
    {
        $wanted = self::key($title);

        foreach ($sections as $index => $section) {
            if ($wanted !== '' && self::key($section['title']) === $wanted) {
                return $index;
            }
        }

        return null;
    }

    private static function key(string $text): string
    {
        return trim((string) preg_replace('/[^\p{L}\p{N}]+/u', ' ', mb_strtolower(str_replace(' (draf otomatis)', '', $text))));
    }
}
