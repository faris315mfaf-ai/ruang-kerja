<?php

namespace App\Domain\Documentation\Data;

/**
 * Safe HTML of a document plus its table of contents.
 */
final readonly class RenderedDocument
{
    /**
     * @param  list<array{id: string, text: string, level: int}>  $toc
     */
    public function __construct(
        public string $html,
        public array $toc,
    ) {}
}
