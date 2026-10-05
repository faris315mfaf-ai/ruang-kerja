<?php

namespace App\Console\Commands;

use App\Domain\Organization\Services\EmployeeImportStore;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('employee-imports:prune')]
#[Description('Hapus berkas impor karyawan (berisi NIK) yang sesinya sudah kedaluwarsa')]
class PruneEmployeeImportsCommand extends Command
{
    public function handle(EmployeeImportStore $store): int
    {
        $deleted = $store->pruneExpired();

        $this->info("{$deleted} berkas impor kedaluwarsa dihapus.");

        return self::SUCCESS;
    }
}
