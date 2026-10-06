<?php

namespace App\Domain\Documentation\Services;

use App\Domain\Documentation\Contracts\DocumentLinks;
use App\Domain\Documentation\Data\DocumentEntry;

/**
 * Admin › Dokumentasi: links between docs stay in /admin/dokumentasi, images
 * become their alt text (repository images are not served there).
 */
final class AdminDocumentLinks implements DocumentLinks
{
    public function key(): string
    {
        return 'admin';
    }

    public function document(DocumentEntry $target, string $fragment): string
    {
        return route('admin.docs.show', ['slug' => $target->slug], absolute: false).$fragment;
    }

    public function image(string $path): ?string
    {
        return null;
    }
}
