<?php

namespace App\Domain\Documentation\Services;

use App\Domain\Documentation\Contracts\DocumentLinks;
use App\Domain\Documentation\Data\DocumentEntry;
use App\Domain\Documentation\Data\RenderedDocument;
use Illuminate\Support\Facades\Cache;
use League\CommonMark\Environment\Environment;
use League\CommonMark\Event\DocumentParsedEvent;
use League\CommonMark\Extension\CommonMark\CommonMarkCoreExtension;
use League\CommonMark\Extension\CommonMark\Node\Block\Heading;
use League\CommonMark\Extension\CommonMark\Node\Inline\Image;
use League\CommonMark\Extension\CommonMark\Node\Inline\Link;
use League\CommonMark\Extension\GithubFlavoredMarkdownExtension;
use League\CommonMark\Extension\HeadingPermalink\HeadingPermalinkExtension;
use League\CommonMark\MarkdownConverter;
use League\CommonMark\Node\Node;
use League\CommonMark\Node\NodeIterator;
use League\CommonMark\Node\StringContainerHelper;
use RuntimeException;

/**
 * Markdown → safe HTML for Admin › Dokumentasi, the same approach as the
 * privacy policy (App\Domain\Privacy\Services\PrivacyPolicy): HTML comments
 * dropped, raw HTML escaped, unsafe links (javascript:, data:, …) removed.
 * On top of that:
 * - headings get stable ids ("doc-…") for the table of contents;
 * - relative links to other allowlisted docs become in-app links, other
 *   relative links (source files, docs not in the list) are unwrapped to text;
 * - external links open in a new tab with rel="noopener noreferrer";
 * - images are replaced by their alt text (no requests to arbitrary hosts),
 *   unless the reading context serves that repository image itself.
 * Where in-app links and images point is decided by a DocumentLinks context:
 * AdminDocumentLinks by default, PrototypeGuideLinks for /pratinjau/panduan.
 */
final class DocumentRenderer
{
    public const string ID_PREFIX = 'doc';

    /** Bump to invalidate cached HTML after changing the rendering. */
    private const int VERSION = 2;

    public function __construct(private readonly DocumentCatalog $catalog) {}

    public function render(DocumentEntry $entry, ?DocumentLinks $links = null): RenderedDocument
    {
        $links ??= new AdminDocumentLinks;
        $key = sprintf('docs:%d:%s:%s', self::VERSION, $links->key(), sha1($entry->absolutePath.'|'.$entry->size.'|'.$entry->modifiedAt));

        /** @var array{html: string, toc: list<array{id: string, text: string, level: int}>} $cached */
        $cached = Cache::remember($key, config()->integer('docs.cache_ttl_seconds'), function () use ($entry, $links): array {
            $document = $this->convert($entry, links: $links);

            return ['html' => $document->html, 'toc' => $document->toc];
        });

        return new RenderedDocument($cached['html'], $cached['toc']);
    }

    /**
     * Uncached rendering of Markdown text as if it lived at $entry->path.
     */
    public function convert(DocumentEntry $entry, ?string $markdown = null, ?DocumentLinks $links = null): RenderedDocument
    {
        $links ??= new AdminDocumentLinks;
        $markdown ??= $this->read($entry);
        $markdown = (string) preg_replace('/<!--.*?-->/s', '', $markdown);

        $environment = new Environment([
            'html_input' => 'escape',
            'allow_unsafe_links' => false,
            'max_nesting_level' => 50,
            'heading_permalink' => [
                'insert' => 'none',
                'apply_id_to_heading' => true,
                'id_prefix' => self::ID_PREFIX,
                'fragment_prefix' => self::ID_PREFIX,
                'min_heading_level' => 1,
                'max_heading_level' => 4,
            ],
        ]);
        $environment->addExtension(new CommonMarkCoreExtension);
        $environment->addExtension(new GithubFlavoredMarkdownExtension);
        $environment->addExtension(new HeadingPermalinkExtension);
        $environment->addEventListener(DocumentParsedEvent::class, function (DocumentParsedEvent $event) use ($entry, $links): void {
            $this->rewriteLinks($event, $entry, $links);
        });

        $result = (new MarkdownConverter($environment))->convert($markdown);

        return new RenderedDocument($result->getContent(), $this->toc($result->getDocument()));
    }

    private function read(DocumentEntry $entry): string
    {
        $markdown = file_get_contents($entry->absolutePath);

        if ($markdown === false) {
            throw new RuntimeException("Document {$entry->path} is not readable.");
        }

        return $markdown;
    }

    /**
     * Headings of level 2–3 (the document title is the page title).
     *
     * @return list<array{id: string, text: string, level: int}>
     */
    private function toc(Node $document): array
    {
        $toc = [];

        foreach ($document->iterator(NodeIterator::FLAG_BLOCKS_ONLY) as $node) {
            if (! $node instanceof Heading || $node->getLevel() < 2 || $node->getLevel() > 3) {
                continue;
            }

            $id = $node->data->get('attributes/id', '');

            if (! is_string($id) || $id === '') {
                continue;
            }

            $toc[] = [
                'id' => $id,
                'text' => trim(StringContainerHelper::getChildText($node)),
                'level' => $node->getLevel(),
            ];
        }

        return $toc;
    }

    private function rewriteLinks(DocumentParsedEvent $event, DocumentEntry $entry, DocumentLinks $context): void
    {
        $links = [];
        $images = [];

        foreach ($event->getDocument()->iterator() as $node) {
            if ($node instanceof Link) {
                $links[] = $node;
            } elseif ($node instanceof Image) {
                $images[] = $node;
            }
        }

        foreach ($images as $image) {
            $this->rewriteImage($image, $entry, $context);
        }

        foreach ($links as $link) {
            $url = trim($link->getUrl());

            if ($url === '') {
                $this->unwrap($link);
            } elseif (str_starts_with($url, '#')) {
                $link->setUrl('#'.self::ID_PREFIX.'-'.substr($url, 1));
            } elseif (preg_match('/^[a-z][a-z0-9+.-]*:/i', $url) === 1) {
                // Absolute URL (unsafe schemes were already neutralised by the renderer).
                if (preg_match('/^https?:/i', $url) === 1) {
                    $link->data->set('attributes/target', '_blank');
                    $link->data->set('attributes/rel', 'noopener noreferrer');
                }
            } else {
                $target = $this->resolveDocLink($entry, $url, $context);
                $target === null ? $this->unwrap($link) : $link->setUrl($target);
            }
        }
    }

    /**
     * A relative image the context serves keeps an in-app URL (lazy loaded);
     * any other image becomes its alt text.
     */
    private function rewriteImage(Image $image, DocumentEntry $entry, DocumentLinks $links): void
    {
        $url = trim($image->getUrl());
        $path = $url === '' || str_contains($url, '#') || preg_match('/^[a-z][a-z0-9+.-]*:/i', $url) === 1
            ? null
            : $this->resolvePath($entry, $url);
        $target = $path === null ? null : $links->image($path);

        if ($target === null) {
            $this->unwrap($image);

            return;
        }

        $image->setUrl($target);
        $image->data->set('attributes/loading', 'lazy');
        $image->data->set('attributes/decoding', 'async');
    }

    /**
     * In-app URL of a relative link to another allowlisted doc, else null.
     */
    private function resolveDocLink(DocumentEntry $entry, string $url, DocumentLinks $links): ?string
    {
        $fragment = '';

        if (str_contains($url, '#')) {
            [$url, $fragment] = explode('#', $url, 2);
            $fragment = $fragment === '' ? '' : '#'.self::ID_PREFIX.'-'.$fragment;
        }

        $path = $this->resolvePath($entry, $url);
        $target = $path === null ? null : $this->catalog->findByPath($path);

        return $target === null ? null : $links->document($target, $fragment);
    }

    /**
     * Repository-relative path of a relative URL in $entry (query dropped),
     * or null when it is empty, absolute or climbs above the repository.
     */
    private function resolvePath(DocumentEntry $entry, string $url): ?string
    {
        $url = rawurldecode((string) strtok($url, '?'));

        if ($url === '' || str_starts_with($url, '/') || str_contains($url, "\0") || str_contains($url, '\\')) {
            return null;
        }

        $segments = dirname($entry->path) === '.' ? [] : explode('/', dirname($entry->path));

        foreach (explode('/', $url) as $segment) {
            if ($segment === '..') {
                if ($segments === []) {
                    return null;
                }

                array_pop($segments);
            } elseif ($segment !== '.' && $segment !== '') {
                $segments[] = $segment;
            }
        }

        return $segments === [] ? null : implode('/', $segments);
    }

    /**
     * Replaces a link/image by its children (an image's children are its alt text).
     */
    private function unwrap(Node $node): void
    {
        foreach ($node->children() as $child) {
            $node->insertBefore($child);
        }

        $node->detach();
    }
}
