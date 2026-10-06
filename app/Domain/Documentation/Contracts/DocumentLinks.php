<?php

namespace App\Domain\Documentation\Contracts;

use App\Domain\Documentation\Data\DocumentEntry;

/**
 * Where a rendered document points to: the in-app URL of another allowlisted
 * document and of a repository image. Each reading context (Admin ›
 * Dokumentasi, the preview guide) has its own implementation; returning null
 * turns the link/image into plain text.
 */
interface DocumentLinks
{
    /** Distinguishes cached HTML of the same file between contexts. */
    public function key(): string;

    /** In-app URL of an allowlisted document ($fragment is '' or "#doc-…"). */
    public function document(DocumentEntry $target, string $fragment): ?string;

    /** In-app URL of a repository image (relative path, e.g. docs/fitur/img/okr/daftar-desktop.jpg). */
    public function image(string $path): ?string;
}
