<?php

namespace App\Domain\Documentation\Services;

use App\Domain\Documentation\Contracts\DocumentLinks;
use App\Domain\Documentation\Data\DocumentEntry;

/**
 * The preview guide (/pratinjau/panduan): links stay inside the guide when the
 * target is one of its documents (config/docs.php group `features`); other
 * docs become text (Admin › Dokumentasi is Super Admin only). Screenshots in
 * docs/fitur/img/<folder>/<file>.(jpg|png) are served by
 * prototype.guide.image; any other image becomes its alt text.
 */
final class PrototypeGuideLinks implements DocumentLinks
{
    public const string GROUP = 'features';

    public const string GUIDE_SLUG = 'panduan-pratinjau';

    public const string IMAGE_DIRECTORY = 'docs/fitur/img';

    /** One folder level and a plain file name, so no traversal is possible. */
    public const string FOLDER_PATTERN = '[a-z0-9]+(?:-[a-z0-9]+)*';

    public const string FILE_PATTERN = '[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpg|png)';

    public function key(): string
    {
        return 'prototype-guide';
    }

    public function document(DocumentEntry $target, string $fragment): ?string
    {
        if ($target->group !== self::GROUP) {
            return null;
        }

        $url = $target->slug === self::GUIDE_SLUG
            ? route('prototype.guide', absolute: false)
            : route('prototype.guide.show', ['slug' => $target->slug], absolute: false);

        return $url.$fragment;
    }

    public function image(string $path): ?string
    {
        $pattern = '#^'.preg_quote(self::IMAGE_DIRECTORY, '#').'/('.self::FOLDER_PATTERN.')/('.self::FILE_PATTERN.')$#';

        if (preg_match($pattern, $path, $match) !== 1 || self::imagePath($match[1], $match[2]) === null) {
            return null;
        }

        return route('prototype.guide.image', ['folder' => $match[1], 'file' => $match[2]], absolute: false);
    }

    /**
     * Absolute path of a guide image, or null when the name is not allowed or
     * does not resolve (symlinks followed) to a regular file inside
     * docs/fitur/img.
     */
    public static function imagePath(string $folder, string $file): ?string
    {
        if (preg_match('#^'.self::FOLDER_PATTERN.'$#', $folder) !== 1 || preg_match('#^'.self::FILE_PATTERN.'$#', $file) !== 1) {
            return null;
        }

        $root = realpath(base_path(self::IMAGE_DIRECTORY));
        $absolute = realpath(base_path(self::IMAGE_DIRECTORY.'/'.$folder.'/'.$file));

        if ($root === false || $absolute === false || ! str_starts_with($absolute, $root.DIRECTORY_SEPARATOR) || ! is_file($absolute)) {
            return null;
        }

        return $absolute;
    }
}
