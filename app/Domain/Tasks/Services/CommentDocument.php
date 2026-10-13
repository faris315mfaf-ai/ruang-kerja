<?php

namespace App\Domain\Tasks\Services;

/**
 * Plain text from the mobile composer + the people and tasks picked with the
 * "@" / "#" pickers → the same Tiptap document the web editor produces:
 * one paragraph per line, `@Nama` becomes a `mention` node and `#KEY-n` a
 * `taskReference` node. A picked person or task whose token cannot be found
 * in the text (the user edited it away) is appended at the end, so a mention
 * that was meant to notify someone is never lost silently.
 *
 * The result is only a proposal: PostComment/UpdateComment run it through
 * TaskRichText::prepare (RichText::sanitize), which keeps a mention only for
 * people who can see the workspace and a reference only for tasks the author
 * can see — everything else degrades to the typed text.
 */
final class CommentDocument
{
    /**
     * @param  array<string, string>  $people  mentioned user id => display name
     * @param  array<string, string>  $tasks  referenced task id => "KEY-n"
     * @return array<string, mixed>|null
     */
    public static function build(string $text, array $people = [], array $tasks = []): ?array
    {
        $text = trim(str_replace("\r\n", "\n", $text));

        if ($text === '' && $people === [] && $tasks === []) {
            return null;
        }

        /** @var array<string, array<string, mixed>> $nodes lower-case token => node */
        $nodes = [];
        /** @var array<string, string> $patterns lower-case token => regex fragment */
        $patterns = [];

        foreach ($people as $id => $name) {
            $token = '@'.$name;
            $nodes[mb_strtolower($token)] = ['type' => 'mention', 'attrs' => ['id' => $id, 'label' => $name]];
            $patterns[mb_strtolower($token)] = preg_quote($token, '/').'(?![\p{L}\p{N}])';
        }

        foreach ($tasks as $id => $key) {
            $token = '#'.$key;
            $nodes[mb_strtolower($token)] = ['type' => 'taskReference', 'attrs' => ['id' => $id, 'label' => $key]];
            $patterns[mb_strtolower($token)] = preg_quote($token, '/').'(?!\d)';
        }

        uksort($patterns, fn (string $a, string $b): int => mb_strlen($b) <=> mb_strlen($a));
        $regex = $patterns === [] ? null : '/('.implode('|', $patterns).')/iu';
        $used = [];
        $paragraphs = [];

        foreach ($text === '' ? [] : explode("\n", $text) as $line) {
            $parts = $regex === null || $line === ''
                ? [$line]
                : (preg_split($regex, $line, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY) ?: [$line]);
            $inline = [];

            foreach ($parts as $part) {
                $node = $nodes[mb_strtolower($part)] ?? null;

                if ($node !== null && $regex !== null && preg_match($regex, $part) === 1) {
                    $inline[] = $node;
                    $used[mb_strtolower($part)] = true;

                    continue;
                }

                if ($part !== '') {
                    $inline[] = ['type' => 'text', 'text' => $part];
                }
            }

            $paragraphs[] = $inline === [] ? ['type' => 'paragraph'] : ['type' => 'paragraph', 'content' => $inline];
        }

        $missing = array_diff_key($nodes, $used);

        if ($missing !== []) {
            if ($paragraphs === []) {
                $paragraphs[] = ['type' => 'paragraph'];
            }

            $last = count($paragraphs) - 1;
            $content = $paragraphs[$last]['content'] ?? [];

            foreach ($missing as $node) {
                if ($content !== []) {
                    $content[] = ['type' => 'text', 'text' => ' '];
                }

                $content[] = $node;
            }

            $paragraphs[$last]['content'] = $content;
        }

        return ['type' => 'doc', 'content' => $paragraphs];
    }
}
