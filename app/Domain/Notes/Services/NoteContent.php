<?php

namespace App\Domain\Notes\Services;

use App\Domain\Tasks\Services\MentionParser;
use App\Domain\Tasks\Services\RichText;
use App\Models\Note;
use App\Models\User;

/**
 * Note document (Tiptap JSON from the collab server or the fallback save) →
 * sanitized snapshot. Same whitelist as task descriptions and comments
 * (RichText::sanitize); `@mentions` survive only for people who can open the
 * note (NoteAudience), everything else becomes plain text. Notes are longer
 * than comments, so the size limits are wider than RichText::violation().
 * Unlike tasks and comments, notes keep text colour and highlight marks
 * (palette names only).
 */
final class NoteContent
{
    public const int MAX_JSON_BYTES = 1_000_000;

    public const int MAX_TEXT_LENGTH = 200_000;

    public function __construct(
        private readonly MentionParser $parser,
        private readonly NoteAudience $audience,
    ) {}

    /**
     * Validation message when the document is not acceptable, null when it is.
     */
    public static function violation(mixed $document): ?string
    {
        if ($document === null) {
            return null;
        }

        if (! is_array($document) || ($document['type'] ?? null) !== 'doc') {
            return 'Format catatan tidak valid.';
        }

        $json = json_encode($document);

        if ($json === false || strlen($json) > self::MAX_JSON_BYTES) {
            return 'Catatan terlalu panjang.';
        }

        if (mb_strlen(RichText::toText($document) ?? '') > self::MAX_TEXT_LENGTH) {
            return 'Catatan maksimal '.number_format(self::MAX_TEXT_LENGTH, 0, ',', '.').' karakter.';
        }

        return null;
    }

    /**
     * Same document? jsonb does not keep key order, so keys are compared
     * order-insensitively (list order still matters).
     *
     * @param  array<mixed>|null  $a
     * @param  array<mixed>|null  $b
     */
    public static function same(?array $a, ?array $b): bool
    {
        if ($a === null || $b === null) {
            return $a === $b;
        }

        return self::canonical($a) === self::canonical($b);
    }

    /**
     * @param  array<mixed>  $value
     * @return array<mixed>
     */
    private static function canonical(array $value): array
    {
        if (! array_is_list($value)) {
            ksort($value);
        }

        foreach ($value as $key => $item) {
            if (is_array($item)) {
                $value[$key] = self::canonical($item);
            }
        }

        return $value;
    }

    /**
     * @param  array<mixed>|null  $document
     * @return array{document: array<string, mixed>|null, text: string, mentioned_ids: list<string>}
     */
    public function prepare(Note $note, ?array $document): array
    {
        if ($document === null) {
            return ['document' => null, 'text' => '', 'mentioned_ids' => []];
        }

        $people = $this->audience->withAccess($note, $this->parser->userIds($document))
            ->mapWithKeys(fn (User $user): array => [$user->id => $user->name])
            ->all();

        // Notes keep palette text colours and highlights (Notulensi, 6 Okt 2026).
        $clean = RichText::sanitize($document, $people, colors: true);

        return [
            'document' => $clean,
            'text' => RichText::toText($clean) ?? '',
            'mentioned_ids' => $this->parser->userIds($clean),
        ];
    }
}
