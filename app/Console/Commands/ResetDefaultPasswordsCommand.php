<?php

namespace App\Console\Commands;

use App\Domain\Auth\Actions\ResetPasswordsToDefault;
use App\Domain\Auth\Services\DefaultPassword;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Mass reset to the company default password (owner decision 7 Oct 2026),
 * e.g. right after go-live so every employee can sign in. See
 * ResetPasswordsToDefault for who is included. Never prints the value.
 */
#[Signature('ruangkerja:reset-default-passwords
    {--dry-run : Hanya tampilkan jumlah dan daftar email, tanpa mengubah apa pun}
    {--force : Jalankan tanpa konfirmasi (wajib di produksi)}
    {--only-without-password : Hanya akun yang belum punya kata sandi}
    {--notify : Kirim notifikasi in-app + email ke tiap karyawan (bawaan: tidak)}')]
#[Description('Mengembalikan kata sandi semua karyawan (bukan Super Admin, bukan yang mengundurkan diri) ke sandi bawaan, wajib ganti saat login')]
class ResetDefaultPasswordsCommand extends Command
{
    public function handle(DefaultPassword $defaultPassword, ResetPasswordsToDefault $reset): int
    {
        if (! $defaultPassword->enabled()) {
            $this->components->error('EMPLOYEE_DEFAULT_PASSWORD kosong. Isi di .env (lalu php artisan config:clear / recreate kontainer) sebelum menjalankan perintah ini.');

            return self::FAILURE;
        }

        $onlyWithoutPassword = (bool) $this->option('only-without-password');
        $count = $reset->eligible($onlyWithoutPassword)->count();
        $scope = $onlyWithoutPassword ? 'akun karyawan tanpa kata sandi' : 'akun karyawan';

        if ($count === 0) {
            $this->components->info("Tidak ada {$scope} yang perlu direset.");

            return self::SUCCESS;
        }

        if ((bool) $this->option('dry-run')) {
            $this->components->info("Simulasi: {$count} {$scope} akan direset ke sandi bawaan (wajib ganti saat login).");
            $this->table(['Email', 'Nama', 'Status', 'Punya sandi'], $reset->eligible($onlyWithoutPassword)
                ->orderBy('email')
                ->get(['id', 'email', 'name', 'status', 'password'])
                ->map(fn (User $user): array => [$user->email, $user->name, $user->status->label(), $user->password === null ? 'Belum' : 'Ya'])
                ->all());

            return self::SUCCESS;
        }

        if (! (bool) $this->option('force')) {
            if ($this->laravel->isProduction()) {
                $this->components->error('Di produksi wajib memakai --force (cek dulu dengan --dry-run).');

                return self::FAILURE;
            }

            if (! $this->confirm("Reset {$count} {$scope} ke sandi bawaan? Semua sesi mereka akan dikeluarkan.")) {
                $this->components->warn('Dibatalkan.');

                return self::FAILURE;
            }
        }

        $notify = (bool) $this->option('notify');
        $bar = $this->output->createProgressBar($count);
        $done = $reset->handle($onlyWithoutPassword, $notify, fn (int $chunk) => $bar->advance($chunk));
        $bar->finish();
        $this->newLine(2);

        $this->components->info("{$done} {$scope} direset ke sandi bawaan. Mereka wajib menggantinya saat login berikutnya.");

        if (! $notify) {
            $this->components->warn('Tanpa notifikasi (pakai --notify untuk mengirim in-app + email). Sampaikan sandi bawaan langsung ke karyawan.');
        }

        return self::SUCCESS;
    }
}
