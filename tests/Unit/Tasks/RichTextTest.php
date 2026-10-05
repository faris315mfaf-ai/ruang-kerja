<?php

use App\Domain\Tasks\Services\MentionParser;
use App\Domain\Tasks\Services\RichText;

const RT_USER = '01k6x0000000000000000000aa';
const RT_OTHER = '01k6x0000000000000000000bb';
const RT_TASK = '01k6x0000000000000000000cc';

function rtDoc(array ...$blocks): array
{
    return ['type' => 'doc', 'content' => $blocks];
}

function rtParagraph(array ...$inline): array
{
    return ['type' => 'paragraph', 'content' => $inline];
}

function rtText(string $text, array $marks = []): array
{
    return $marks === [] ? ['type' => 'text', 'text' => $text] : ['type' => 'text', 'text' => $text, 'marks' => $marks];
}

it('keeps whitelisted nodes and marks and strips everything else', function () {
    $dirty = rtDoc(
        ['type' => 'heading', 'attrs' => ['level' => 9, 'onclick' => 'x'], 'content' => [rtText('Ruang lingkup')]],
        rtParagraph(
            rtText('tebal', [['type' => 'bold'], ['type' => 'bold'], ['type' => 'textStyle', 'attrs' => ['color' => 'red']]]),
            rtText(' tautan', [['type' => 'link', 'attrs' => ['href' => 'https://contoh.id', 'target' => '_blank', 'class' => 'x']]]),
            rtText(' jahat', [['type' => 'link', 'attrs' => ['href' => 'javascript:alert(1)']]]),
        ),
        ['type' => 'iframe', 'attrs' => ['src' => 'https://evil.test']],
        ['type' => 'taskList', 'content' => [['type' => 'taskItem', 'attrs' => ['checked' => 'yes'], 'content' => [rtParagraph(rtText('Hero'))]]]],
        ['type' => 'codeBlock', 'attrs' => ['language' => 'PHP<script>'], 'content' => [rtText('echo 1;', [['type' => 'bold']]), ['type' => 'mention', 'attrs' => ['id' => RT_USER]]]],
        ['type' => 'bulletList', 'content' => []],
    );

    $clean = RichText::sanitize($dirty);

    expect($clean['content'][0])->toBe(['type' => 'heading', 'attrs' => ['level' => 3], 'content' => [rtText('Ruang lingkup')]])
        ->and($clean['content'][1]['content'])->toBe([
            rtText('tebal', [['type' => 'bold']]),
            rtText(' tautan', [['type' => 'link', 'attrs' => ['href' => 'https://contoh.id']]]),
            rtText(' jahat'),
        ])
        ->and($clean['content'][2])->toBe(['type' => 'taskList', 'content' => [['type' => 'taskItem', 'attrs' => ['checked' => false], 'content' => [rtParagraph(rtText('Hero'))]]]])
        ->and($clean['content'][3])->toBe(['type' => 'codeBlock', 'content' => [rtText('echo 1;')]])
        ->and($clean['content'])->toHaveCount(4);
});

it('resolves mentions and task references to known people and visible tasks only', function () {
    $doc = rtDoc(rtParagraph(
        ['type' => 'mention', 'attrs' => ['id' => strtoupper(RT_USER), 'label' => 'Nama palsu']],
        rtText(' dan '),
        ['type' => 'mention', 'attrs' => ['id' => RT_OTHER, 'label' => 'Orang luar']],
        rtText(' lihat '),
        ['type' => 'taskReference', 'attrs' => ['id' => RT_TASK, 'label' => 'PLQ-1']],
        ['type' => 'taskReference', 'attrs' => ['id' => RT_OTHER, 'label' => 'SEC-9']],
    ));

    $clean = RichText::sanitize($doc, [RT_USER => 'Maya Lestari'], [RT_TASK => 'PLQ-27']);

    expect($clean['content'][0]['content'])->toBe([
        ['type' => 'mention', 'attrs' => ['id' => RT_USER, 'label' => 'Maya Lestari']],
        rtText(' dan '),
        rtText('@Orang luar'),
        rtText(' lihat '),
        ['type' => 'taskReference', 'attrs' => ['id' => RT_TASK, 'label' => 'PLQ-27']],
        rtText('#SEC-9'),
    ])->and(RichText::toText($clean))->toBe('@Maya Lestari dan @Orang luar lihat PLQ-27#SEC-9');
});

it('produces plain text with checklist markers and treats blank documents as empty', function () {
    $doc = rtDoc(
        rtParagraph(rtText('Baris satu'), ['type' => 'hardBreak'], rtText('baris dua')),
        ['type' => 'taskList', 'content' => [
            ['type' => 'taskItem', 'attrs' => ['checked' => true], 'content' => [rtParagraph(rtText('Selesai'))]],
            ['type' => 'taskItem', 'attrs' => ['checked' => false], 'content' => [rtParagraph(rtText('Belum'))]],
        ]],
    );

    expect(RichText::toText($doc))->toBe("Baris satu\nbaris dua\n[x] Selesai\n[ ] Belum")
        ->and(RichText::sanitize(rtDoc(rtParagraph(), rtParagraph(rtText('   ')))))->toBeNull()
        ->and(RichText::excerpt(rtDoc(rtParagraph(rtText(str_repeat('a', 300)))), 10))->toBe('aaaaaaaaa…');
});

it('rejects documents that are not a doc, too deep or too long', function () {
    $deep = ['type' => 'paragraph'];
    for ($i = 0; $i < 20; $i++) {
        $deep = ['type' => 'blockquote', 'content' => [$deep]];
    }

    expect(RichText::violation('teks'))->toBe('Format teks tidak valid.')
        ->and(RichText::violation(['type' => 'paragraph']))->toBe('Format teks tidak valid.')
        ->and(RichText::violation(rtDoc($deep)))->not->toBeNull()
        ->and(RichText::violation(rtDoc(rtParagraph(rtText(str_repeat('x', RichText::MAX_TEXT_LENGTH + 1))))))->not->toBeNull()
        ->and(RichText::violation(rtDoc(rtParagraph(rtText('ok')))))->toBeNull();
});

it('allows only http, https and mailto links', function (string $href, bool $safe) {
    expect(RichText::safeHref($href))->toBe($safe);
})->with([
    ['https://drive.google.com/x', true],
    ['http://contoh.id', true],
    ['mailto:hr@demo.test', true],
    ['javascript:alert(1)', false],
    ['JaVaScRiPt:alert(1)', false],
    ['data:text/html,x', false],
    ['/relatif', false],
    ["https://a.id/\x00", false],
]);

it('parses mention and reference ids in order without duplicates', function () {
    $doc = rtDoc(
        rtParagraph(['type' => 'mention', 'attrs' => ['id' => RT_OTHER]], ['type' => 'mention', 'attrs' => ['id' => RT_USER]]),
        ['type' => 'bulletList', 'content' => [['type' => 'listItem', 'content' => [rtParagraph(
            ['type' => 'mention', 'attrs' => ['id' => strtoupper(RT_OTHER)]],
            ['type' => 'mention', 'attrs' => ['id' => 'bukan-ulid']],
            ['type' => 'taskReference', 'attrs' => ['id' => RT_TASK]],
        )]]]],
    );
    $parser = new MentionParser;

    expect($parser->userIds($doc))->toBe([RT_OTHER, RT_USER])
        ->and($parser->taskIds($doc))->toBe([RT_TASK])
        ->and($parser->userIds(null))->toBe([]);
});
