<?php

namespace App\Console\Commands;

use App\Domain\Requests\Actions\GenerateAnnualBalances;
use App\Domain\Requests\Support\OfficeTime;
use App\Domain\Tenancy\Scheduling\ForEachCompany;
use App\Models\Company;
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

        if (is_numeric($argument) && ((int) $argument < 2000 || (int) $argument > 2100)) {
            $this->error('Tahun tidak valid.');

            return self::FAILURE;
        }

        // Per company; without a year, the current year of the company's office calendar.
        ForEachCompany::run(function (Company $company) use ($generate, $argument): void {
            $year = is_numeric($argument) ? (int) $argument : OfficeTime::today()->year;
            $result = $generate->handle($year, $company);
            $this->info("Saldo {$year}: {$result['created']} dibuat, {$result['completed']} dilengkapi, {$result['skipped']} dilewati.");
        });

        return self::SUCCESS;
    }
}
