<?php

namespace App\Domain\Notes\Services;

use App\Domain\Tasks\Services\RichText;

/**
 * Note document (Tiptap JSON, the storage format of notes.content) ↔ HTML
 * string, for the mobile app (API v1): GET renders the sanitized snapshot as
 * simple HTML, PATCH accepts that HTML back. Only the node and mark set that
 * survives RichText::sanitize is converted — anything else becomes plain
 * text or is dropped, so a note saved from the app can never smuggle in a
 * node the web editor does not know. Mentions and #KEY-n task references
 * ride on data-* attributes and are re-validated by the sanitizer (a mention
 * survives only for people who may open the note).
 */
final class NoteHtml
{
    /**
     * The stored document as an HTML string ('' when empty).
     *
     * @param  array<string, mixed>|null  $document
     */
    public static function toHtml(?array $document): string
    {
        $html = '';

        foreach (is_array($document) ? ($document['content'] ?? []) : [] as $block) {
            $html .= is_array($block) ? self::renderBlock($block) : '';
        }

        return $html;
    }

    /**
     * An HTML string from the app as a Tiptap document (null when it has no
     * content). Everything unknown degrades to text; the result still runs
     * through NoteContent::prepare → RichText::sanitize before it is stored.
     *
     * @return array<string, mixed>|null
     */
    public static function documentFromHtml(?string $html): ?array
    {
        $html = trim((string) $html);

        if ($html === '') {
            return null;
        }

        $errors = libxml_use_internal_errors(true);
        $dom = new \DOMDocument;
        $loaded = $dom->loadHTML('<?xml encoding="UTF-8"><body>'.$html.'</body>', LIBXML_NOWARNING | LIBXML_NOERROR);
        libxml_use_internal_errors($errors);
        libxml_clear_errors();

        if (! $loaded) {
            return null;
        }

        $blocks = self::parseBlocks($dom->getElementsByTagName('body')->item(0)?->childNodes);

        return $blocks === [] ? null : ['type' => 'doc', 'content' => $blocks];
    }

    /**
     * Whether the mobile app may replace the document from plain text
     * without losing anything: empty, or only paragraphs of unmarked text
     * and hard breaks. Headings, lists, marks, mentions, task references or
     * any other node make the note "rich" — the app edits it read-only and
     * the API refuses a body save (409 `rich_note`).
     *
     * @param  array<string, mixed>|null  $document
     */
    public static function isMobileEditable(?array $document): bool
    {
        foreach (is_array($document) ? ($document['content'] ?? []) : [] as $block) {
            if (! is_array($block) || ($block['type'] ?? null) !== 'paragraph') {
                return false;
            }

            foreach (is_array($block['content'] ?? null) ? $block['content'] : [] as $inline) {
                if (! is_array($inline)) {
                    return false;
                }

                $type = $inline['type'] ?? null;

                if ($type === 'hardBreak') {
                    continue;
                }

                if ($type !== 'text' || ! empty($inline['marks'])) {
                    return false;
                }
            }
        }

        return true;
    }

    /*
     * Rendering: Tiptap JSON → HTML.
     */

    /**
     * @param  array<string, mixed>  $node
     */
    private static function renderBlock(array $node): string
    {
        $type = (string) ($node['type'] ?? '');
        $content = is_array($node['content'] ?? null) ? $node['content'] : [];

        return match ($type) {
            'heading' => sprintf('<h%1$d>%2$s</h%1$d>', self::level($node), self::renderInline($content)),
            'blockquote' => '<blockquote>'.self::renderBlocks($content).'</blockquote>',
            'bulletList' => '<ul>'.self::renderBlocks($content).'</ul>',
            'orderedList' => sprintf(
                '<ol%1$s>%2$s</ol>',
                is_int($node['attrs']['start'] ?? null) && $node['attrs']['start'] > 1 ? ' start="'.$node['attrs']['start'].'"' : '',
                self::renderBlocks($content),
            ),
            'taskList' => '<ul data-type="taskList">'.self::renderBlocks($content).'</ul>',
            'taskItem' => sprintf(
                '<li data-type="taskItem" data-checked="%s">%s</li>',
                ($node['attrs']['checked'] ?? false) === true ? 'true' : 'false',
                self::renderItemContent($content),
            ),
            'listItem' => '<li>'.self::renderItemContent($content).'</li>',
            'codeBlock' => sprintf(
                '<pre%1$s><code>%2$s</code></pre>',
                is_string($node['attrs']['language'] ?? null) ? ' data-language="'.self::escape($node['attrs']['language']).'"' : '',
                self::escape(self::codeText($content)),
            ),
            'horizontalRule' => '<hr>',
            default => '<p>'.self::renderInline($content).'</p>', // paragraph & unknown blocks
        };
    }

    /**
     * @param  array<int, mixed>  $nodes
     */
    private static function renderBlocks(array $nodes): string
    {
        $html = '';

        foreach ($nodes as $node) {
            $html .= is_array($node) ? self::renderBlock($node) : '';
        }

        return $html;
    }

    /**
     * Content of a list/task item: paragraphs and nested lists (Tiptap
     * `paragraph block*`), rendered as blocks so marks and nested lists
     * survive. Older documents stored inline nodes straight in the item;
     * such runs are wrapped into a paragraph instead of being dropped.
     *
     * @param  array<int, mixed>  $nodes
     */
    private static function renderItemContent(array $nodes): string
    {
        $html = '';
        $inline = [];

        foreach ($nodes as $node) {
            if (! is_array($node)) {
                continue;
            }

            if (self::isInlineNode($node)) {
                $inline[] = $node;

                continue;
            }

            if ($inline !== []) {
                $html .= '<p>'.self::renderInline($inline).'</p>';
                $inline = [];
            }

            $html .= self::renderBlock($node);
        }

        if ($inline !== []) {
            $html .= '<p>'.self::renderInline($inline).'</p>';
        }

        return $html;
    }

    /**
     * @param  array<string, mixed>  $node
     */
    private static function isInlineNode(array $node): bool
    {
        return in_array($node['type'] ?? null, ['text', 'hardBreak', 'mention', 'taskReference'], true);
    }

    /**
     * @param  array<int, mixed>  $nodes
     */
    private static function renderInline(array $nodes): string
    {
        $html = '';

        foreach ($nodes as $node) {
            $html .= is_array($node) ? self::renderInlineNode($node) : '';
        }

        return $html;
    }

    /**
     * @param  array<string, mixed>  $node
     */
    private static function renderInlineNode(array $node): string
    {
        $type = (string) ($node['type'] ?? '');

        if ($type === 'hardBreak') {
            return '<br>';
        }

        if ($type === 'mention') {
            return sprintf(
                '<span data-type="mention" data-id="%s">%s</span>',
                self::escape((string) ($node['attrs']['id'] ?? '')),
                self::escape('@'.($node['attrs']['label'] ?? '')),
            );
        }

        if ($type === 'taskReference') {
            return sprintf(
                '<span data-type="taskReference" data-id="%s">%s</span>',
                self::escape((string) ($node['attrs']['id'] ?? '')),
                self::escape('#'.($node['attrs']['label'] ?? '')),
            );
        }

        if ($type !== 'text') {
            return self::escape((string) RichText::toText(['type' => 'doc', 'content' => [$node]]));
        }

        $text = self::escape((string) ($node['text'] ?? ''));

        foreach (array_reverse(is_array($node['marks'] ?? null) ? $node['marks'] : []) as $mark) {
            $text = self::wrapMark($text, is_array($mark) ? $mark : []);
        }

        return $text;
    }

    /**
     * @param  array<string, mixed>  $mark
     */
    private static function wrapMark(string $text, array $mark): string
    {
        return match ((string) ($mark['type'] ?? '')) {
            'bold' => '<strong>'.$text.'</strong>',
            'italic' => '<em>'.$text.'</em>',
            'strike' => '<s>'.$text.'</s>',
            'code' => '<code>'.$text.'</code>',
            'underline' => '<u>'.$text.'</u>',
            'link' => sprintf('<a href="%s">%s</a>', self::escape((string) ($mark['attrs']['href'] ?? '')), $text),
            'textColor' => sprintf('<span data-color="%s">%s</span>', self::escape((string) ($mark['attrs']['color'] ?? '')), $text),
            'highlight' => sprintf('<span data-highlight="%s">%s</span>', self::escape((string) ($mark['attrs']['color'] ?? '')), $text),
            default => $text,
        };
    }

    /*
     * Parsing: HTML → Tiptap JSON.
     */

    /**
     * Block-level children → block nodes; loose inline children are wrapped
     * into a paragraph (the app composer sends well-formed blocks, this keeps
     * stray text from disappearing).
     *
     * @param  \DOMNodeList<\DOMNode>|null  $children
     * @return list<array<string, mixed>>
     */
    private static function parseBlocks(?\DOMNodeList $children): array
    {
        $blocks = [];
        $loose = [];

        $flush = function () use (&$loose, &$blocks): void {
            $inline = self::parseInline(self::withoutTrailingSpace($loose));

            if ($inline !== []) {
                $blocks[] = ['type' => 'paragraph', 'content' => $inline];
            }

            $loose = [];
        };

        foreach ($children ?? [] as $child) {
            if (! $child instanceof \DOMElement) {
                if ($child instanceof \DOMText && trim($child->wholeText ?? $child->textContent) !== '') {
                    $loose[] = $child;
                } elseif ($child instanceof \DOMText && $loose !== []) {
                    // A space between two inline elements ("<b>a</b> <i>b</i>")
                    // is content; source-formatting newlines are not breaks.
                    $loose[] = new \DOMText(' ');
                }

                continue;
            }

            if (in_array(strtolower($child->nodeName), ['script', 'style'], true)) {
                continue;
            }

            if (self::isBlock($child)) {
                $flush();
                $blocks = [...$blocks, ...self::parseBlock($child)];

                continue;
            }

            $loose[] = $child;
        }

        $flush();

        return $blocks;
    }

    /**
     * Whitespace kept between inline elements is not content at the end of
     * a run.
     *
     * @param  list<\DOMNode>  $nodes
     * @return list<\DOMNode>
     */
    private static function withoutTrailingSpace(array $nodes): array
    {
        while ($nodes !== [] && $nodes[count($nodes) - 1] instanceof \DOMText && trim($nodes[count($nodes) - 1]->textContent) === '') {
            array_pop($nodes);
        }

        return $nodes;
    }

    /**
     * One block element → one or more block nodes.
     *
     * @return list<array<string, mixed>>
     */
    private static function parseBlock(\DOMElement $element): array
    {
        $name = strtolower($element->nodeName);

        if ($name === 'br') {
            return [];
        }

        if ($name === 'hr') {
            return [['type' => 'horizontalRule']];
        }

        if (in_array($name, ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'], true)) {
            return [['type' => 'heading', 'attrs' => ['level' => (int) $name[1]], 'content' => self::parseInline(self::children($element))]];
        }

        if ($name === 'pre') {
            $language = $element->getAttribute('data-language');
            $codeElement = $element->getElementsByTagName('code')->item(0);
            $code = $codeElement !== null ? $codeElement->textContent : $element->textContent;

            return [[
                ...['type' => 'codeBlock'],
                ...(preg_match('/^[a-z0-9+#-]{1,20}$/i', $language) === 1 ? ['attrs' => ['language' => strtolower($language)]] : []),
                'content' => [['type' => 'text', 'text' => (string) $code]],
            ]];
        }

        if ($name === 'blockquote') {
            return [['type' => 'blockquote', 'content' => self::parseBlocks($element->childNodes)]];
        }

        if ($name === 'ul' && $element->getAttribute('data-type') === 'taskList') {
            $items = [];

            foreach ($element->childNodes as $child) {
                if ($child instanceof \DOMElement && strtolower($child->nodeName) === 'li') {
                    $items[] = ['type' => 'taskItem', 'attrs' => ['checked' => $child->getAttribute('data-checked') === 'true'], 'content' => self::parseItemContent($child)];
                }
            }

            return $items === [] ? [] : [['type' => 'taskList', 'content' => $items]];
        }

        if ($name === 'ul' || $name === 'ol') {
            $items = [];

            foreach ($element->childNodes as $child) {
                if ($child instanceof \DOMElement && strtolower($child->nodeName) === 'li') {
                    $items[] = ['type' => 'listItem', 'content' => self::parseItemContent($child)];
                }
            }

            if ($items === []) {
                return [];
            }

            $start = (int) $element->getAttribute('start');

            return [[
                ...['type' => $name === 'ol' ? 'orderedList' : 'bulletList'],
                ...($name === 'ol' && $start > 1 ? ['attrs' => ['start' => $start]] : []),
                'content' => $items,
            ]];
        }

        // p, div and anything unknown: transparent — children join the level
        // above (a div around paragraphs must not eat them).
        return self::parseBlocks($element->childNodes);
    }

    /**
     * An <li> as Tiptap item content (`paragraph block*`): loose inline runs
     * become paragraphs, nested <ul>/<ol> stay lists, and an item that does
     * not start with a paragraph (empty, or only a nested list) gets an
     * empty one first so the editor schema accepts it.
     *
     * @return list<array<string, mixed>>
     */
    private static function parseItemContent(\DOMElement $item): array
    {
        $blocks = self::parseBlocks($item->childNodes);

        if ($blocks === [] || ($blocks[0]['type'] ?? null) !== 'paragraph') {
            array_unshift($blocks, ['type' => 'paragraph']);
        }

        return $blocks;
    }

    /**
     * @param  list<\DOMNode>  $nodes
     * @return list<array<string, mixed>>
     */
    private static function parseInline(array $nodes): array
    {
        $inline = [];

        foreach ($nodes as $node) {
            if ($node instanceof \DOMText) {
                $inline = [...$inline, ...self::textNodes((string) $node->wholeText)];

                continue;
            }

            if (! $node instanceof \DOMElement) {
                continue;
            }

            $name = strtolower($node->nodeName);

            if ($name === 'br') {
                $inline[] = ['type' => 'hardBreak'];

                continue;
            }

            if (in_array($name, ['script', 'style'], true)) {
                continue;
            }

            $type = $node->getAttribute('data-type');
            $id = $node->getAttribute('data-id');

            if ($type === 'mention' && $id !== '') {
                $inline[] = ['type' => 'mention', 'attrs' => ['id' => $id, 'label' => ltrim(trim($node->textContent), '@')]];

                continue;
            }

            if ($type === 'taskReference' && $id !== '') {
                $inline[] = ['type' => 'taskReference', 'attrs' => ['id' => $id, 'label' => ltrim(trim($node->textContent), '#')]];

                continue;
            }

            if (self::isBlock($node)) {
                // A block nested inside inline context (a list inside a p):
                // keep its text, the document shape stays flat.
                $inline = [...$inline, ...self::textNodes((string) preg_replace('/\s+/u', ' ', self::innerText($node)))];

                continue;
            }

            $mark = self::markOf($node);

            foreach (self::parseInline(self::children($node)) as $child) {
                $inline[] = $mark === null || ($child['type'] ?? null) !== 'text'
                    ? $child
                    : self::withMark($child, $mark);
            }
        }

        return $inline;
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function markOf(\DOMElement $element): ?array
    {
        return match (strtolower($element->nodeName)) {
            'strong', 'b' => ['type' => 'bold'],
            'em', 'i' => ['type' => 'italic'],
            's', 'strike', 'del' => ['type' => 'strike'],
            'code' => ['type' => 'code'],
            'u' => ['type' => 'underline'],
            'a' => ['type' => 'link', 'attrs' => ['href' => $element->getAttribute('href')]],
            'span' => $element->getAttribute('data-color') !== ''
                ? ['type' => 'textColor', 'attrs' => ['color' => $element->getAttribute('data-color')]]
                : ($element->getAttribute('data-highlight') !== ''
                    ? ['type' => 'highlight', 'attrs' => ['color' => $element->getAttribute('data-highlight')]]
                    : null),
            default => null,
        };
    }

    /**
     * Plain text → text nodes with hardBreaks between the lines.
     *
     * @return list<array<string, mixed>>
     */
    private static function textNodes(string $text): array
    {
        $nodes = [];

        foreach (preg_split("/\n/", str_replace("\r\n", "\n", $text)) ?: [] as $i => $line) {
            if ($i > 0) {
                $nodes[] = ['type' => 'hardBreak'];
            }

            if ($line !== '') {
                $nodes[] = ['type' => 'text', 'text' => $line];
            }
        }

        return $nodes;
    }

    /**
     * @param  array<string, mixed>  $text
     * @param  array<string, mixed>  $mark
     * @return array<string, mixed>
     */
    private static function withMark(array $text, array $mark): array
    {
        $marks = is_array($text['marks'] ?? null) ? $text['marks'] : [];

        return [...$text, 'marks' => [...$marks, $mark]];
    }

    /**
     * @return list<\DOMNode>
     */
    private static function children(\DOMElement $element): array
    {
        return iterator_to_array($element->childNodes, false);
    }

    private static function isBlock(\DOMElement $element): bool
    {
        return in_array(strtolower($element->nodeName), [
            'p', 'div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav', 'figure', 'figcaption',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'hr', 'table', 'thead',
            'tbody', 'tr', 'td', 'th', 'dl', 'dt', 'dd', 'address',
        ], true);
    }

    private static function innerText(\DOMElement $element): string
    {
        return html_entity_decode(strip_tags((string) $element->ownerDocument?->saveHTML($element)), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * @param  array<string, mixed>  $node
     */
    private static function level(array $node): int
    {
        return max(1, min(3, (int) ($node['attrs']['level'] ?? 2)));
    }

    /**
     * @param  array<int, mixed>  $nodes
     */
    private static function codeText(array $nodes): string
    {
        $text = '';

        foreach ($nodes as $node) {
            if (is_array($node) && ($node['type'] ?? null) === 'text' && is_string($node['text'] ?? null)) {
                $text .= $node['text'];
            }
        }

        return $text;
    }

    private static function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_HTML5 | ENT_SUBSTITUTE, 'UTF-8');
    }
}
