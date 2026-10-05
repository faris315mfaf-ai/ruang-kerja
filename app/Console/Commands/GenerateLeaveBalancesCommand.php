<?php

namespace App\Console\Commands;

use App\Domain\Requests\Actions\GenerateAnnualBalances;
use App\Domain\Requests\Support\OfficeTime;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('requests:generate-balances {year? : Tahun saldo (default: tahun berjalan di zona kantor)}')]
#[Description('Buat saldo cuti tahunan semua karyawan aktif, termasuk carry-over (idempoten).')]
class GenerateLeaveBalancesCommand extends Command
{
    public function handle(GenerateAnnualBalances $generate): int
    {
        $argument = $this->argument('year');
        $year = is_numeric($argument) ? (int) $argument : OfficeTime::today()->year;

        if ($year < 2000 || $year > 2100) {
            $this->error('Tahun tidak valid.');

            return self::FAILURE;
        }

        $result = $generate->handle($year);
        $this->info("Saldo {$year}: {$result['created']} dibuat, {$result['completed']} dilengkapi, {$result['skipped']} dilewati.");

        return self::SUCCESS;
    }
}
