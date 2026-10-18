<?php

namespace App\Domain\Tenancy\Support;

/**
 * Private files of a company live under `company/{id}/…` on their disk
 * (selfies, request attachments, employee imports; Fase 1 multi-perusahaan),
 * so one company's files can be listed, backed up or removed on their own.
 *
 * Files stored before this keep their old path: the path is saved in the
 * database row (or the import session) and read from there, never rebuilt.
 */
final class CompanyFiles
{
    public const string ROOT = 'company';

    public static function directory(string $companyId, string ...$segments): string
    {
        $segments = array_filter(array_map(fn (string $segment): string => trim($segment, '/'), $segments), fn (string $segment): bool => $segment !== '');

        return implode('/', [self::ROOT, $companyId, ...$segments]);
    }
}
