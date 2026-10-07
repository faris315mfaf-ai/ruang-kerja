<?php

namespace App\Domain\Meetings\Services;

/**
 * Collaborative minutes document (ProseMirror JSON of the Catatan bersama
 * editor, Tiptap StarterKit nodes) <-> structured minutes
 * (meeting_minutes.sections / decisions). Attendance and follow-ups are not
 * part of the document (follow-ups stay rows: task chips, "Jadikan tugas").
 *
 * Document layout: one heading (level 2) per section followed by its notes
 * as paragraphs, then the heading "Keputusan" with one bullet per decision.
 * Reading back: every heading starts a section; the "Keputusan" heading
 * collects decisions (list items or paragraphs); text before the first
 * heading becomes the section "Catatan". Lists inside a section become
 * "• " lines of its plain-text body. Limits match SaveMinutesRequest.
 */
final class MinutesDocument
{
    public const string DECISIONS_TITLE = 'Keputusan';

    public const string LOOSE_TITLE = 'Catatan';

    private const int MAX_SECTIONS = 40;

    private const int MAX_TITLE = 200;

    private const int MAX_BODY = 20000;

    private const int MAX_DECISIONS = 50;

    private const int MAX_DECISION = 500;

    /**
     * @param  list<array{title: string, body: string}>  $sections
     * @param  list<string>  $decisions
     * @return array<string, mixed>
     */
    public static function toDoc(array $sections, array $decisions): array
    {
        $content = [];

        foreach ($sections as $section) {
            $content[] = self::heading((string) $section['title']);

            foreach (preg_split('/\R/u', (string) $section['body']) ?: [] as $line) {
                $content[] = self::paragraph($line);
            }
        }

        $content[] = self::heading(self::DECISIONS_TITLE);
        $content[] = $decisions === []
            ? self::paragraph('')
            : ['type' => 'bulletList', 'content' => array_map(
                fn (string $decision): array => ['type' => 'listItem', 'content' => [self::paragraph($decision)]],
                $decisions,
            )];

        return ['type' => 'doc', 'content' => $content];
    }

    /**
     * @param  array<mixed>|null  $doc
     * @return array{sections: list<array{title: string, body: string}>, decisions: list<string>}
     */
    public static function fromDoc(?array $doc): array
    {
        $sections = [];
        $decisions = [];
        $current = null; // index in $sections, or 'decisions'
        $nodes = is_array($doc['content'] ?? null) ? $doc['content'] : [];

        foreach ($nodes as $node) {
            if (! is_array($node)) {
                continue;
            }

            $type = $node['type'] ?? null;

            if ($type === 'heading') {
                $title = mb_substr(trim(self::text($node)), 0, self::MAX_TITLE);

                if (mb_strtolower($title) === mb_strtolower(self::DECISIONS_TITLE)) {
                    $current = 'decisions';
                } elseif ($title !== '' && count($sections) < self::MAX_SECTIONS) {
                    $sections[] = ['title' => $title, 'body' => ''];
                    $current = count($sections) - 1;
                }

                continue;
            }

            $lines = self::lines($node);

            if ($current === 'decisions') {
                foreach ($lines as $line) {
                    $line = trim((string) preg_replace('/^•\s*/u', '', $line));

                    if ($line !== '' && count($decisions) < self::MAX_DECISIONS) {
                        $decisions[] = mb_substr($line, 0, self::MAX_DECISION);
                    }
                }

                continue;
            }

            if ($current === null) {
                if (implode('', $lines) === '' || count($sections) >= self::MAX_SECTIONS) {
                    continue;
                }

                $sections[] = ['title' => self::LOOSE_TITLE, 'body' => ''];
                $current = count($sections) - 1;
            }

            $body = $sections[$current]['body'];
            $sections[$current]['body'] = mb_substr(($body === '' ? '' : $body."\n").implode("\n", $lines), 0, self::MAX_BODY);
        }

        return [
            'sections' => array_values(array_map(fn (array $section): array => ['title' => (string) $section['title'], 'body' => rtrim((string) $section['body'])], $sections)),
            'decisions' => $decisions,
        ];
    }

    /**
     * Plain-text lines of a block: paragraphs as one line, list items as "• …".
     *
     * @param  array<mixed>  $node
     * @return list<string>
     */
    private static function lines(array $node): array
    {
        $type = $node['type'] ?? null;
        $children = is_array($node['content'] ?? null) ? $node['content'] : [];

        if (in_array($type, ['bulletList', 'orderedList', 'taskList'], true)) {
            $lines = [];

            foreach ($children as $item) {
                if (is_array($item)) {
                    $lines[] = '• '.trim(self::text($item));
                }
            }

            return $lines;
        }

        return [self::text($node)];
    }

    /**
     * @param  array<mixed>  $node
     */
    private static function text(array $node): string
    {
        if (($node['type'] ?? null) === 'text') {
            return is_string($node['text'] ?? null) ? $node['text'] : '';
        }

        if (($node['type'] ?? null) === 'hardBreak') {
            return ' ';
        }

        if (($node['type'] ?? null) === 'mention') {
            $label = $node['attrs']['label'] ?? null;

            return is_string($label) ? '@'.$label : '';
        }

        $parts = [];

        foreach (is_array($node['content'] ?? null) ? $node['content'] : [] as $child) {
            if (is_array($child)) {
                $parts[] = self::text($child);
            }
        }

        $glue = in_array($node['type'] ?? null, ['listItem', 'taskItem', 'blockquote'], true) ? ' ' : '';

        return implode($glue, $parts);
    }

    /**
     * @return array<string, mixed>
     */
    private static function heading(string $title): array
    {
        return ['type' => 'heading', 'attrs' => ['level' => 2], 'content' => [['type' => 'text', 'text' => $title]]];
    }

    /**
     * @return array<string, mixed>
     */
    private static function paragraph(string $text): array
    {
        return $text === '' ? ['type' => 'paragraph'] : ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => $text]]];
    }
}
