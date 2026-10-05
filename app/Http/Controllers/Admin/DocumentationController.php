<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Documentation\Data\DocumentEntry;
use App\Domain\Documentation\Services\DocumentCatalog;
use App\Domain\Documentation\Services\DocumentRenderer;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin › Dokumentasi (Super Admin, read-only): the curated repository docs
 * from config/docs.php rendered as safe HTML. Desktop: list + document +
 * table of contents; mobile: the same content as a simple reading view.
 */
class DocumentationController extends Controller
{
    public function index(DocumentCatalog $catalog): Response
    {
        Gate::authorize('viewDocumentation');

        return Inertia::render('admin/docs/index', [
            ...$this->listing($catalog),
            'document' => null,
        ]);
    }

    public function show(string $slug, DocumentCatalog $catalog, DocumentRenderer $renderer): Response
    {
        Gate::authorize('viewDocumentation');

        $entry = $catalog->find($slug);
        abort_if($entry === null, 404);

        $rendered = $renderer->render($entry);

        return Inertia::render('admin/docs/index', [
            ...$this->listing($catalog),
            'document' => [
                ...$entry->toArray(),
                'html' => $rendered->html,
                'toc' => $rendered->toc,
            ],
        ]);
    }

    /**
     * @return array{documents: list<array<string, mixed>>, groups: list<array{key: string, label: string}>}
     */
    private function listing(DocumentCatalog $catalog): array
    {
        $groups = [];

        foreach ($catalog->groups() as $key => $label) {
            $groups[] = ['key' => $key, 'label' => $label];
        }

        return [
            'documents' => array_values($catalog->all()->map(fn (DocumentEntry $entry): array => $entry->toArray())->all()),
            'groups' => $groups,
        ];
    }
}
