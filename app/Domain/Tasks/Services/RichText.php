<?php

namespace App\Domain\Tasks\Services;

/**
 * Server-side guard for Tiptap/ProseMirror JSON (task descriptions and
 * comments). The client editor is never trusted:
 *
 * - only whitelisted nodes, marks and attributes survive (unknown nodes are
 *   dropped, unknown attributes stripped);
 * - links must be http(s) or mailto;
 * - `mention` labels are replaced with the real name of the person (or the
 *   node becomes plain text when the person may not be mentioned);
 * - `taskReference` (#KEY-n) keeps only references the author may see;
 * - size, depth and text length are bounded (see violation()).
 *
 * The frontend renders the same node set (features/tasks/editor/rich-text-view.tsx).
 */
final class RichText
{
    public const int MAX_TEXT_LENGTH = 20000;

    public const int MAX_DEPTH = 12;

    public const int MAX_NODES = 4000;

    public const int MAX_JSON_BYTES = 200_000;

    /** Block containers whose content is kept recursively. */
    private const array CONTAINERS = ['doc', 'paragraph', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'taskList', 'taskItem', 'heading', 'codeBlock'];

    private const array MARKS = ['bold', 'italic', 'strike', 'code', 'underline', 'link'];

    /** Nodes followed by a line break in the plain-text version. */
    private const array BLOCKS = ['paragraph', 'heading', 'codeBlock', 'horizontalRule', 'taskItem', 'listItem'];

    /**
     * Validation message when the document is not acceptable, null when it is.
     */
    public static function violation(mixed $document): ?string
    {
        if (! is_array($document) || ($document['type'] ?? null) !== 'doc') {
            return 'Format teks tidak valid.';
        }

        $json = json_encode($document);

        if ($json === false || strlen($json) > self::MAX_JSON_BYTES) {
            return 'Teks terlalu panjang.';
        }

        $nodes = 0;

        if (! self::withinLimits($document, 0, $nodes)) {
            return 'Teks terlalu kompleks atau terlalu panjang.';
        }

        if (mb_strlen(self::toText($document) ?? '') > self::MAX_TEXT_LENGTH) {
            return 'Teks maksimal '.number_format(self::MAX_TEXT_LENGTH, 0, ',', '.').' karakter.';
        }

        return null;
    }

    /**
     * Whitelisted copy of the document; null when it has no visible content.
     *
     * @param  array<mixed>  $document
     * @param  array<string, string>  $people  mentionable user id => display name
     * @param  array<string, string>  $tasks  referenceable task id => "KEY-n"
     * @return array<string, mixed>|null
     */
    public static function sanitize(array $document, array $people = [], array $tasks = []): ?array
    {
        $clean = self::node($document, $people, $tasks, 0);

        if ($clean === null || ($clean['type'] ?? null) !== 'doc') {
            return null;
        }

        return self::isEmpty($clean) ? null : $clean;
    }

    /**
     * Plain-text version for search, notifications and previews.
     *
     * @param  array<string, mixed>|null  $document
     */
    public static function toText(?array $document): ?string
    {
        if ($document === null) {
            return null;
        }

        $text = trim((string) preg_replace("/\n{3,}/", "\n\n", self::text($document)));

        return $text === '' ? null : $text;
    }

    /**
     * Short one-line excerpt ("…" when cut).
     *
     * @param  array<string, mixed>|null  $document
     */
    public static function excerpt(?array $document, int $length = 140): string
    {
        $text = (string) preg_replace('/\s+/u', ' ', self::toText($document) ?? '');

        return mb_strlen($text) > $length ? rtrim(mb_substr($text, 0, $length - 1)).'…' : $text;
    }

    /**
     * @param  array<string, mixed>  $document
     */
    public static function isEmpty(array $document): bool
    {
        return self::toText($document) === null && ! self::containsNode($document, ['horizontalRule', 'mention', 'taskReference']);
    }

    /**
     * Minimal document from plain text (one paragraph per line).
     *
     * @return array<string, mixed>|null
     */
    public static function fromText(?string $text): ?array
    {
        return TaskDescription::documentFromText($text);
    }

    /**
     * @param  array<mixed>  $node
     */
    private static function withinLimits(array $node, int $depth, int &$count): bool
    {
        if ($depth > self::MAX_DEPTH || ++$count > self::MAX_NODES) {
            return false;
        }

        $content = $node['content'] ?? [];

        if (! is_array($content)) {
            return false;
        }

        foreach ($content as $child) {
            if (! is_array($child) || ! self::withinLimits($child, $depth + 1, $count)) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<mixed>  $node
     * @param  array<string, string>  $people
     * @param  array<string, string>  $tasks
     * @return array<string, mixed>|null
     */
    private static function node(array $node, array $people, array $tasks, int $depth): ?array
    {
        $type = $node['type'] ?? null;

        if (! is_string($type) || $depth > self::MAX_DEPTH) {
            return null;
        }

        if ($type === 'text') {
            $text = $node['text'] ?? null;

            if (! is_string($text) || $text === '') {
                return null;
            }

            $clean = ['type' => 'text', 'text' => $text];
            $marks = self::marks($node['marks'] ?? null);

            return $marks === [] ? $clean : [...$clean, 'marks' => $marks];
        }

        if ($type === 'mention') {
            $id = self::idAttr($node);

            if ($id !== null && isset($people[$id])) {
                return ['type' => 'mention', 'attrs' => ['id' => $id, 'label' => $people[$id]]];
            }

            // Not mentionable (unknown or without access): keep the typed text only.
            $label = self::stringAttr($node, 'label');

            return $label !== null ? ['type' => 'text', 'text' => '@'.$label] : null;
        }

        if ($type === 'taskReference') {
            $id = self::idAttr($node);

            if ($id !== null && isset($tasks[$id])) {
                return ['type' => 'taskReference', 'attrs' => ['id' => $id, 'label' => $tasks[$id]]];
            }

            $label = self::stringAttr($node, 'label');

            return $label !== null ? ['type' => 'text', 'text' => '#'.$label] : null;
        }

        if ($type === 'hardBreak' || $type === 'horizontalRule') {
            return ['type' => $type];
        }

        if (! in_array($type, self::CONTAINERS, true)) {
            return null;
        }

        $clean = ['type' => $type];
        $attrs = self::attrs($type, $node['attrs'] ?? null);

        if ($attrs !== []) {
            $clean['attrs'] = $attrs;
        }

        $children = [];

        foreach (is_array($node['content'] ?? null) ? $node['content'] : [] as $child) {
            if (! is_array($child)) {
                continue;
            }

            // Code blocks hold plain text only.
            if ($type === 'codeBlock' && ($child['type'] ?? null) !== 'text') {
                continue;
            }

            $sanitized = self::node($child, $people, $tasks, $depth + 1);

            if ($sanitized !== null) {
                if ($type === 'codeBlock') {
                    unset($sanitized['marks']);
                }

                $children[] = $sanitized;
            }
        }

        // Lists without items are dropped; empty paragraphs are kept (blank lines).
        if (in_array($type, ['bulletList', 'orderedList', 'taskList'], true) && $children === []) {
            return null;
        }

        if ($children !== []) {
            $clean['content'] = $children;
        }

        return $clean;
    }

    /**
     * @return array<string, mixed>
     */
    private static function attrs(string $type, mixed $attrs): array
    {
        $attrs = is_array($attrs) ? $attrs : [];

        return match ($type) {
            'heading' => ['level' => max(1, min(3, is_int($attrs['level'] ?? null) ? $attrs['level'] : 2))],
            'orderedList' => is_int($attrs['start'] ?? null) && $attrs['start'] > 1 ? ['start' => min($attrs['start'], 100000)] : [],
            'taskItem' => ['checked' => ($attrs['checked'] ?? false) === true],
            'codeBlock' => is_string($attrs['language'] ?? null) && preg_match('/^[a-z0-9+#-]{1,20}$/i', $attrs['language']) === 1
                ? ['language' => strtolower($attrs['language'])]
                : [],
            default => [],
        };
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function marks(mixed $marks): array
    {
        if (! is_array($marks)) {
            return [];
        }

        $clean = [];
        $seen = [];

        foreach ($marks as $mark) {
            $type = is_array($mark) ? ($mark['type'] ?? null) : null;

            if (! is_string($type) || ! in_array($type, self::MARKS, true) || isset($seen[$type])) {
                continue;
            }

            if ($type === 'link') {
                $href = is_array($mark['attrs'] ?? null) ? ($mark['attrs']['href'] ?? null) : null;

                if (! is_string($href) || ! self::safeHref($href)) {
                    continue;
                }

                $clean[] = ['type' => 'link', 'attrs' => ['href' => $href]];
            } else {
                $clean[] = ['type' => $type];
            }

            $seen[$type] = true;
        }

        return $clean;
    }

    public static function safeHref(string $href): bool
    {
        if (strlen($href) > 2000 || preg_match('/[\x00-\x20]/', $href) === 1) {
            return false;
        }

        $scheme = strtolower((string) parse_url($href, PHP_URL_SCHEME));

        return in_array($scheme, ['http', 'https', 'mailto'], true);
    }

    /**
     * @param  array<mixed>  $node
     */
    private static function idAttr(array $node): ?string
    {
        $id = self::stringAttr($node, 'id');

        return $id === null ? null : strtolower($id);
    }

    /**
     * @param  array<mixed>  $node
     */
    private static function stringAttr(array $node, string $key): ?string
    {
        $attrs = $node['attrs'] ?? null;
        $value = is_array($attrs) ? ($attrs[$key] ?? null) : null;

        return is_string($value) && $value !== '' && mb_strlen($value) <= 200 ? $value : null;
    }

    /**
     * @param  array<mixed>  $node
     */
    private static function text(array $node): string
    {
        $type = $node['type'] ?? null;

        $own = match ($type) {
            'text' => is_string($node['text'] ?? null) ? $node['text'] : '',
            'hardBreak' => "\n",
            'mention' => '@'.(self::stringAttr($node, 'label') ?? ''),
            'taskReference' => self::stringAttr($node, 'label') ?? '',
            default => '',
        };

        if ($type === 'taskItem') {
            $own = (is_array($node['attrs'] ?? null) && ($node['attrs']['checked'] ?? false) === true ? '[x] ' : '[ ] ');
        }

        $children = '';

        foreach (is_array($node['content'] ?? null) ? $node['content'] : [] as $child) {
            if (is_array($child)) {
                $children .= self::text($child);
            }
        }

        // A list item holds paragraphs; avoid a double break.
        if (in_array($type, ['listItem', 'taskItem'], true)) {
            return $own.rtrim($children, "\n")."\n";
        }

        return $own.$children.(in_array($type, self::BLOCKS, true) ? "\n" : '');
    }

    /**
     * @param  array<mixed>  $node
     * @param  list<string>  $types
     */
    private static function containsNode(array $node, array $types): bool
    {
        if (in_array($node['type'] ?? null, $types, true)) {
            return true;
        }

        foreach (is_array($node['content'] ?? null) ? $node['content'] : [] as $child) {
            if (is_array($child) && self::containsNode($child, $types)) {
                return true;
            }
        }

        return false;
    }
}
