<?php

namespace App\Domain\Meetings\Transcripts\Services;

/**
 * Turns whatever JSON the language model returned into the draft shape of
 * docs/fitur/notulen-otomatis-kontrak.md §2.1, defensively:
 *
 * - unknown keys dropped, strings trimmed and capped, lists capped;
 * - `sumber` = valid transcript line indexes only → [{i, start_ms}];
 * - `penanggung_jawab` only ever a meeting participant (never invented): an
 *   unmatched name becomes null, kept as `penanggung_jawab_teks`, and is
 *   listed under `perlu_dicek`;
 * - `tenggat` a real YYYY-MM-DD date or null (anything else → perlu_dicek).
 */
final class DraftNormalizer
{
    private const array HONORIFICS = ['bapak', 'pak', 'ibu', 'bu', 'mas', 'mbak', 'mba', 'kak', 'bang', 'saudara', 'sdr', 'sdri', 'dr', 'ir'];

    /**
     * @param  list<array{user_id: string, name: string}>  $participants
     * @param  list<int>  $lineStarts  start_ms per transcript line index
     */
    public function __construct(
        private readonly array $participants,
        private readonly array $lineStarts,
    ) {}

    /**
     * Strict JSON object from a model reply: strips code fences and text
     * around the object, removes trailing commas. Null when still invalid.
     *
     * @return array<string, mixed>|null
     */
    public static function decode(string $reply): ?array
    {
        $text = trim($reply);
        $text = (string) preg_replace('/^```(?:json)?\s*|\s*```$/i', '', $text);
        $start = strpos($text, '{');
        $end = strrpos($text, '}');

        if ($start === false || $end === false || $end < $start) {
            return null;
        }

        $json = substr($text, $start, $end - $start + 1);

        foreach ([$json, (string) preg_replace('/,\s*([}\]])/', '$1', $json)] as $candidate) {
            $decoded = json_decode($candidate, true);

            if (is_array($decoded) && ! array_is_list($decoded)) {
                return $decoded;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $raw
     * @return array{ringkasan: string, agenda: list<array<string, mixed>>, keputusan: list<array<string, mixed>>, tindak_lanjut: list<array<string, mixed>>, perlu_dicek: list<string>}
     */
    public function normalize(array $raw): array
    {
        $check = array_values(array_filter(array_map(
            fn (mixed $item): string => self::text($item, 300),
            self::list($raw['perlu_dicek'] ?? []),
        )));
        $agenda = [];
        $decisions = [];
        $actions = [];

        foreach (array_slice(self::list($raw['agenda'] ?? []), 0, 30) as $section) {
            if (! is_array($section)) {
                continue;
            }

            $title = self::text($section['judul'] ?? '', 200);
            $points = [];

            foreach (array_slice(self::list($section['poin'] ?? []), 0, 30) as $point) {
                $entry = $this->statement($point);

                if ($entry !== null) {
                    $points[] = $entry;
                }
            }

            if ($title !== '' || $points !== []) {
                $agenda[] = ['judul' => $title !== '' ? $title : 'Pembahasan', 'poin' => $points];
            }

            foreach (self::list($section['keputusan'] ?? []) as $decision) {
                $entry = $this->statement($decision);

                if ($entry !== null) {
                    $decisions[] = [...$entry, 'agenda' => $title !== '' ? $title : null];
                }
            }

            foreach (self::list($section['tindak_lanjut'] ?? []) as $action) {
                $entry = $this->action($action, $title !== '' ? $title : null, $check);

                if ($entry !== null) {
                    $actions[] = $entry;
                }
            }
        }

        // Top-level lists are accepted too (some models flatten the structure).
        foreach (self::list($raw['keputusan'] ?? []) as $decision) {
            $entry = $this->statement($decision);

            if ($entry !== null) {
                $decisions[] = [...$entry, 'agenda' => self::text(is_array($decision) ? ($decision['agenda'] ?? '') : '', 200) ?: null];
            }
        }

        foreach (self::list($raw['tindak_lanjut'] ?? []) as $action) {
            $agendaTitle = is_array($action) ? self::text($action['agenda'] ?? '', 200) : '';
            $entry = $this->action($action, $agendaTitle !== '' ? $agendaTitle : null, $check);

            if ($entry !== null) {
                $actions[] = $entry;
            }
        }

        $actions = array_slice($actions, 0, 50);

        foreach ($actions as $index => $action) {
            $actions[$index] = ['id' => 'tl-'.($index + 1), ...$action];
        }

        return [
            'ringkasan' => self::text($raw['ringkasan'] ?? '', 2000),
            'agenda' => $agenda,
            'keputusan' => array_slice($decisions, 0, 50),
            'tindak_lanjut' => $actions,
            'perlu_dicek' => array_slice(array_values(array_unique($check)), 0, 30),
        ];
    }

    /**
     * Person in the participant list for a name the model wrote, or null.
     *
     * @return array{user_id: string, nama: string}|null
     */
    public function matchParticipant(string $name): ?array
    {
        $wanted = self::nameKey($name);

        if ($wanted === '') {
            return null;
        }

        $byFull = array_values(array_filter($this->participants, fn (array $p): bool => self::nameKey($p['name']) === $wanted));

        if (count($byFull) === 1) {
            return ['user_id' => $byFull[0]['user_id'], 'nama' => $byFull[0]['name']];
        }

        // "Budi" → "Budi Santoso" when exactly one participant has that word in their name.
        $words = explode(' ', $wanted);
        $partial = array_values(array_filter($this->participants, function (array $p) use ($words): bool {
            $own = explode(' ', self::nameKey($p['name']));

            return array_diff($words, $own) === [];
        }));

        return count($partial) === 1 ? ['user_id' => $partial[0]['user_id'], 'nama' => $partial[0]['name']] : null;
    }

    /**
     * @return array{teks: string, sumber: list<array{i: int, start_ms: int}>}|null
     */
    private function statement(mixed $item): ?array
    {
        $text = self::text(is_array($item) ? ($item['teks'] ?? $item['judul'] ?? '') : $item, 500);

        return $text === '' ? null : ['teks' => $text, 'sumber' => $this->sources(is_array($item) ? ($item['sumber'] ?? []) : [])];
    }

    /**
     * @param  list<string>  $check
     * @return array<string, mixed>|null
     */
    private function action(mixed $item, ?string $agenda, array &$check): ?array
    {
        $title = self::text(is_array($item) ? ($item['judul'] ?? $item['teks'] ?? '') : $item, 300);

        if ($title === '') {
            return null;
        }

        $who = is_array($item) ? self::text($item['penanggung_jawab'] ?? '', 120) : '';
        $who = in_array(mb_strtolower($who), ['null', 'tidak ada', '-', 'belum ditentukan'], true) ? '' : $who;
        $person = $who !== '' ? $this->matchParticipant($who) : null;

        if ($who !== '' && $person === null) {
            $check[] = "Penanggung jawab \"{$who}\" untuk \"{$title}\" tidak ada di daftar peserta rapat.";
        }

        $dueText = is_array($item) ? self::text($item['tenggat'] ?? '', 40) : '';
        $due = self::date($dueText);

        if ($dueText !== '' && $due === null && ! in_array(mb_strtolower($dueText), ['null', '-', 'tidak ada'], true)) {
            $check[] = "Tenggat \"{$dueText}\" untuk \"{$title}\" perlu dipastikan.";
        }

        return [
            'judul' => $title,
            'agenda' => $agenda,
            'penanggung_jawab' => $person,
            'penanggung_jawab_teks' => $who !== '' ? $who : null,
            'tenggat' => $due,
            'sumber' => $this->sources(is_array($item) ? ($item['sumber'] ?? []) : []),
            'action_item_id' => null,
            'task' => null,
        ];
    }

    /**
     * @return list<array{i: int, start_ms: int}>
     */
    private function sources(mixed $value): array
    {
        $result = [];

        foreach (array_slice(self::list($value), 0, 10) as $index) {
            if (is_numeric($index) && (int) $index >= 0 && array_key_exists((int) $index, $this->lineStarts)) {
                $result[(int) $index] = ['i' => (int) $index, 'start_ms' => $this->lineStarts[(int) $index]];
            }
        }

        ksort($result);

        return array_values($result);
    }

    private static function date(string $value): ?string
    {
        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $value, $m) !== 1 || ! checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
            return null;
        }

        return "{$m[1]}-{$m[2]}-{$m[3]}";
    }

    private static function nameKey(string $name): string
    {
        $words = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($name), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        return implode(' ', array_values(array_filter($words, fn (string $word): bool => ! in_array($word, self::HONORIFICS, true))));
    }

    private static function text(mixed $value, int $max): string
    {
        if (! is_string($value) && ! is_numeric($value)) {
            return '';
        }

        $text = trim((string) preg_replace('/\s+/u', ' ', (string) $value));

        return mb_substr($text, 0, $max);
    }

    /**
     * @return list<mixed>
     */
    private static function list(mixed $value): array
    {
        return is_array($value) ? array_values($value) : [];
    }
}
