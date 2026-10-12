<?php

use App\Domain\Notes\Services\NoteHtml;

/*
 * NoteHtml (API v1 catatan): Tiptap JSON ↔ HTML. List and task items hold
 * blocks (`paragraph block*`), so marks and nested lists survive a round
 * trip; parsed items always start with a paragraph (editor schema).
 */

function paragraphOf(array ...$inline): array
{
    return ['type' => 'paragraph', 'content' => $inline];
}

function textOf(string $text, array $marks = []): array
{
    return $marks === [] ? ['type' => 'text', 'text' => $text] : ['type' => 'text', 'text' => $text, 'marks' => $marks];
}

it('renders list items as blocks and parses them back, keeping marks and nested lists', function () {
    $document = ['type' => 'doc', 'content' => [
        ['type' => 'bulletList', 'content' => [
            ['type' => 'listItem', 'content' => [
                paragraphOf(
                    textOf('Satu '),
                    textOf('tebal', [['type' => 'bold']]),
                    textOf(' dan '),
                    textOf('tautan', [['type' => 'link', 'attrs' => ['href' => 'https://contoh.id']]]),
                ),
                ['type' => 'orderedList', 'content' => [
                    ['type' => 'listItem', 'content' => [paragraphOf(textOf('Anak', [['type' => 'italic']]))]],
                ]],
            ]],
            ['type' => 'listItem', 'content' => [paragraphOf(textOf('Dua'))]],
        ]],
    ]];

    $html = NoteHtml::toHtml($document);

    expect($html)->toBe(
        '<ul><li><p>Satu <strong>tebal</strong> dan <a href="https://contoh.id">tautan</a></p>'
        .'<ol><li><p><em>Anak</em></p></li></ol></li><li><p>Dua</p></li></ul>',
    )
        ->and(NoteHtml::documentFromHtml($html))->toEqual($document);
});

it('round-trips task items with their checked state', function () {
    $document = ['type' => 'doc', 'content' => [
        ['type' => 'taskList', 'content' => [
            ['type' => 'taskItem', 'attrs' => ['checked' => true], 'content' => [paragraphOf(textOf('Selesai', [['type' => 'bold']]))]],
            ['type' => 'taskItem', 'attrs' => ['checked' => false], 'content' => [paragraphOf(textOf('Belum'))]],
        ]],
    ]];

    $html = NoteHtml::toHtml($document);

    expect($html)->toBe('<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p><strong>Selesai</strong></p></li>'
        .'<li data-type="taskItem" data-checked="false"><p>Belum</p></li></ul>')
        ->and(NoteHtml::documentFromHtml($html))->toEqual($document);
});

it('wraps loose inline content of an <li> into a paragraph and keeps spaces between marks', function () {
    expect(NoteHtml::documentFromHtml('<ul><li><b>a</b> <i>b</i></li><li><ul><li>Anak</li></ul></li></ul>'))->toEqual(['type' => 'doc', 'content' => [
        ['type' => 'bulletList', 'content' => [
            ['type' => 'listItem', 'content' => [paragraphOf(textOf('a', [['type' => 'bold']]), textOf(' '), textOf('b', [['type' => 'italic']]))]],
            // Only a nested list: an empty paragraph first (schema).
            ['type' => 'listItem', 'content' => [
                ['type' => 'paragraph'],
                ['type' => 'bulletList', 'content' => [['type' => 'listItem', 'content' => [paragraphOf(textOf('Anak'))]]]],
            ]],
        ]],
    ]]);
});

it('still renders legacy list items that hold inline nodes directly', function () {
    $legacy = ['type' => 'doc', 'content' => [
        ['type' => 'bulletList', 'content' => [['type' => 'listItem', 'content' => [textOf('Lama', [['type' => 'bold']])]]]],
    ]];

    expect(NoteHtml::toHtml($legacy))->toBe('<ul><li><p><strong>Lama</strong></p></li></ul>');
});

it('tells which documents the app may edit as plain text', function (?array $document, bool $editable) {
    expect(NoteHtml::isMobileEditable($document))->toBe($editable);
})->with([
    'kosong' => [null, true],
    'doc kosong' => [['type' => 'doc', 'content' => []], true],
    'paragraf polos' => [['type' => 'doc', 'content' => [paragraphOf(textOf('a'), ['type' => 'hardBreak'], textOf('b')), ['type' => 'paragraph']]], true],
    'bertanda' => [['type' => 'doc', 'content' => [paragraphOf(textOf('a', [['type' => 'bold']]))]], false],
    'judul' => [['type' => 'doc', 'content' => [['type' => 'heading', 'attrs' => ['level' => 2], 'content' => [textOf('a')]]]], false],
    'daftar' => [['type' => 'doc', 'content' => [['type' => 'bulletList', 'content' => [['type' => 'listItem', 'content' => [paragraphOf(textOf('a'))]]]]]], false],
    'mention' => [['type' => 'doc', 'content' => [paragraphOf(['type' => 'mention', 'attrs' => ['id' => 'x', 'label' => 'A']])]], false],
]);
