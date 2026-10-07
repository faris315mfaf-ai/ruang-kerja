<?php

namespace App\Http\Controllers\Prototype;

use App\Domain\Documentation\Data\DocumentEntry;
use App\Domain\Documentation\Services\DocumentCatalog;
use App\Domain\Documentation\Services\DocumentRenderer;
use App\Domain\Documentation\Services\PrototypeGuideLinks;
use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Panduan pratinjau (/pratinjau/panduan): docs/fitur/PANDUAN-PRATINJAU.md and
 * the module docs of docs/fitur (config/docs.php group `features`) for every
 * employee who can open the previews (prototype flag + auth, see
 * routes/prototype.php). Same allowlist and renderer as Admin › Dokumentasi;
 * only links and screenshots differ (PrototypeGuideLinks).
 */
class PrototypeGuideController extends Controller
{
    public function index(DocumentCatalog $catalog, DocumentRenderer $renderer): Response
    {
        return $this->page(PrototypeGuideLinks::GUIDE_SLUG, $catalog, $renderer);
    }

    public function show(string $slug, DocumentCatalog $catalog, DocumentRenderer $renderer): Response
    {
        return $this->page($slug, $catalog, $renderer);
    }

    /**
     * A screenshot from docs/fitur/img (names validated, realpath inside the folder).
     */
    public function image(string $folder, string $file): BinaryFileResponse
    {
        $path = PrototypeGuideLinks::imagePath($folder, $file);
        abort_if($path === null, 404);

        return response()->file($path, [
            'Content-Type' => str_ends_with($file, '.png') ? 'image/png' : 'image/jpeg',
            'Cache-Control' => 'private, max-age=86400',
        ]);
    }

    private function page(string $slug, DocumentCatalog $catalog, DocumentRenderer $renderer): Response
    {
        $entry = $catalog->find($slug);
        abort_if($entry === null || $entry->group !== PrototypeGuideLinks::GROUP, 404);

        $rendered = $renderer->render($entry, new PrototypeGuideLinks);

        return Inertia::render('prototype/guide', [
            'guideSlug' => PrototypeGuideLinks::GUIDE_SLUG,
            'documents' => array_values($catalog->all()
                ->filter(fn (DocumentEntry $doc): bool => $doc->group === PrototypeGuideLinks::GROUP)
                ->map(fn (DocumentEntry $doc): array => $doc->toArray())
                ->all()),
            'document' => [
                ...$entry->toArray(),
                'html' => $rendered->html,
                'toc' => $rendered->toc,
            ],
        ]);
    }
}
