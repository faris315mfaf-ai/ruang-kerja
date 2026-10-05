<?php

namespace App\Domain\Documentation\Services;

use App\Domain\Documentation\Data\DocumentEntry;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * The curated allowlist of repository docs (config/docs.php). Lookups are by
 * slug only; a slug maps to a path from the config, never from user input.
 * Every path must be relative, end in .md and resolve (symlinks followed) to
 * a regular file inside the repository root — anything else is skipped, so a
 * mistaken config entry cannot expose .env or files outside the project.
 */
final class DocumentCatalog
{
    private const string SLUG_PATTERN = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/';

    /** @var Collection<string, DocumentEntry>|null */
    private ?Collection $entries = null;

    public function __construct(private readonly ?string $root = null) {}

    /**
     * All available documents keyed by slug, in display order: fixed entries
     * in config order, then pattern matches in natural path order.
     *
     * @return Collection<string, DocumentEntry>
     */
    public function all(): Collection
    {
        return $this->entries ??= $this->load();
    }

    public function find(string $slug): ?DocumentEntry
    {
        return preg_match(self::SLUG_PATTERN, $slug) === 1 ? $this->all()->get($slug) : null;
    }

    /**
     * The document a repository-relative path points to, if allowlisted
     * (used to turn links between docs into in-app links).
     */
    public function findByPath(string $path): ?DocumentEntry
    {
        return $this->all()->first(fn (DocumentEntry $entry): bool => $entry->path === $path);
    }

    /**
     * Display names of the groups (config order).
     *
     * @return array<string, string>
     */
    public function groups(): array
    {
        /** @var array<string, string> $groups */
        $groups = config()->array('docs.groups');

        return $groups;
    }

    /**
     * @return Collection<string, DocumentEntry>
     */
    private function load(): Collection
    {
        $root = realpath($this->root ?? base_path());

        if ($root === false) {
            return collect();
        }

        $entries = collect();

        /** @var array<string, array{path: string, title: string, group: string}> $documents */
        $documents = config()->array('docs.documents');

        foreach ($documents as $slug => $document) {
            $entry = $this->entry($root, (string) $slug, $document['path'], $document['title'], $document['group']);

            if ($entry !== null && ! $entries->has($entry->slug)) {
                $entries->put($entry->slug, $entry);
            }
        }

        /** @var list<array{glob: string, group: string}> $patterns */
        $patterns = config()->array('docs.patterns');

        foreach ($patterns as $pattern) {
            foreach ($this->glob($root, $pattern['glob']) as $path) {
                $slug = Str::slug(str_replace(['/', '_', '.'], '-', Str::beforeLast(Str::after($path, 'docs/'), '.md')));
                $entry = $this->entry($root, $slug, $path, null, $pattern['group']);

                if ($entry !== null && ! $entries->has($entry->slug) && $this->findIn($entries, $entry->path) === null) {
                    $entries->put($entry->slug, $entry);
                }
            }
        }

        return $entries;
    }

    /**
     * Repository-relative paths matching a glob, natural order (sprint-2 before sprint-10).
     *
     * @return list<string>
     */
    private function glob(string $root, string $pattern): array
    {
        if (! $this->isSafeRelativePath($pattern)) {
            return [];
        }

        $matches = glob($root.DIRECTORY_SEPARATOR.$pattern) ?: [];
        $paths = array_map(fn (string $match): string => substr($match, strlen($root) + 1), $matches);
        usort($paths, strnatcasecmp(...));

        return $paths;
    }

    private function entry(string $root, string $slug, string $path, ?string $title, string $group): ?DocumentEntry
    {
        if (preg_match(self::SLUG_PATTERN, $slug) !== 1 || ! $this->isSafeRelativePath($path) || ! str_ends_with(strtolower($path), '.md')) {
            return null;
        }

        $absolute = realpath($root.DIRECTORY_SEPARATOR.$path);

        if ($absolute === false || ! str_starts_with($absolute, $root.DIRECTORY_SEPARATOR) || ! is_file($absolute) || ! is_readable($absolute)) {
            return null;
        }

        return new DocumentEntry(
            slug: $slug,
            title: $title ?? $this->headingOf($absolute) ?? basename($path, '.md'),
            group: $group,
            path: str_replace(DIRECTORY_SEPARATOR, '/', $path),
            absolutePath: $absolute,
            size: (int) filesize($absolute),
            modifiedAt: (int) filemtime($absolute),
        );
    }

    /**
     * Relative, no "..", no NUL bytes, no backslashes, no scheme (phar://, …).
     */
    private function isSafeRelativePath(string $path): bool
    {
        return $path !== ''
            && ! str_starts_with($path, '/')
            && ! str_contains($path, "\0")
            && ! str_contains($path, '\\')
            && ! str_contains($path, ':')
            && ! in_array('..', explode('/', $path), true);
    }

    /**
     * First "# " heading of the file (read from the first 4 KB).
     */
    private function headingOf(string $absolute): ?string
    {
        $handle = fopen($absolute, 'r');

        if ($handle === false) {
            return null;
        }

        $head = (string) fread($handle, 4096);
        fclose($handle);

        return preg_match('/^#\s+(.+?)\s*#*\s*$/m', $head, $match) === 1 ? $match[1] : null;
    }

    /**
     * @param  Collection<string, DocumentEntry>  $entries
     */
    private function findIn(Collection $entries, string $path): ?DocumentEntry
    {
        return $entries->first(fn (DocumentEntry $entry): bool => $entry->path === $path);
    }
}
