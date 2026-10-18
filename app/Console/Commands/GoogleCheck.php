<?php

namespace App\Console\Commands;

use App\Domain\Google\Auth\ServiceAccountCredentials;
use App\Domain\Google\Exceptions\DriveRequestFailed;
use App\Domain\Google\Exceptions\GoogleNotConfigured;
use App\Domain\Google\GoogleFeatures;
use App\Domain\Google\Services\GoogleClientFactory;
use App\Domain\Tenancy\CompanyContext;
use App\Domain\Tenancy\Support\CompanyLookup;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Diagnoses the Google setup step by step with Indonesian hints. Never
 * prints secrets (only whether keys are filled).
 */
#[Signature('ruangkerja:google-check
    {--write : Juga uji membuat & menghapus folder uji di Shared Drive}
    {--company= : ID, domain, atau nama perusahaan: periksa Shared Drive perusahaan itu (companies.settings)}')]
#[Description('Uji konfigurasi Google Workspace (service account, Shared Drive, OAuth, Picker)')]
class GoogleCheck extends Command
{
    private bool $ok = true;

    public function handle(GoogleClientFactory $google): int
    {
        $reference = $this->option('company');

        if (is_string($reference) && $reference !== '') {
            $company = CompanyLookup::find($reference);

            if ($company === null) {
                $this->components->error('Perusahaan tidak ditemukan (lihat php artisan company:list).');

                return self::FAILURE;
            }

            // Every Drive check below then resolves that company's Shared Drive.
            return app(CompanyContext::class)->run($company, fn (): int => $this->check($google, $company->name));
        }

        return $this->check($google);
    }

    private function check(GoogleClientFactory $google, ?string $companyName = null): int
    {
        $this->components->info('Pemeriksaan integrasi Google RuangKerja'.($companyName === null ? '' : ' · '.$companyName));

        if (GoogleFeatures::fake()) {
            $this->components->warn('GOOGLE_FAKE=true: aplikasi memakai Drive palsu, Google sungguhan tidak dipanggil.');
        }

        $this->checkDriveSettings();

        if ($this->ok) {
            $this->checkServiceAccount($google);
        }

        $this->checkOAuthSettings();

        if ($this->ok) {
            $this->components->info('Semua pemeriksaan lolos.');

            return self::SUCCESS;
        }

        $this->components->error('Ada pemeriksaan yang gagal. Lihat petunjuk di atas dan docs/sprints/sprint-7/GOOGLE-API.md.');

        return self::FAILURE;
    }

    private function checkDriveSettings(): void
    {
        $this->line('');
        $this->line('<options=bold>1. Konfigurasi Drive (service account)</>');

        foreach (['GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_IMPERSONATE_USER', 'GOOGLE_SHARED_DRIVE_ID'] as $key) {
            $missing = in_array($key, GoogleFeatures::missingDriveSettings(), true);
            $this->result(! $missing, $key, $missing ? 'kosong atau berkas tidak terbaca' : 'terisi');
        }

        if (in_array(GoogleFeatures::COMPANY_SHARED_DRIVE_SETTING, GoogleFeatures::missingDriveSettings(), true)) {
            $this->result(false, 'Shared Drive perusahaan', 'belum diatur');
            $this->hint('Atur dengan php artisan company:configure <perusahaan> --shared-drive=<ID>.');
        }

        if (GoogleFeatures::missingDriveSettings() !== []) {
            $this->hint('Isi kunci di atas pada .env, simpan kunci JSON di secrets/google-sa.json (lihat SETUP-LOKAL §6).');
        }
    }

    private function checkServiceAccount(GoogleClientFactory $google): void
    {
        if (GoogleFeatures::fake()) {
            return;
        }

        $this->line('');
        $this->line('<options=bold>2. Service account & Shared Drive</>');

        try {
            $credentials = ServiceAccountCredentials::fromConfig();
            $this->result(true, 'Kunci service account', $credentials->clientEmail);
        } catch (GoogleNotConfigured) {
            $this->result(false, 'Kunci service account', 'JSON tidak valid (butuh client_email & private_key)');

            return;
        }

        try {
            $drive = $google->serviceAccount();
            $sharedDrive = $drive->getSharedDrive($google->sharedDriveId());
            $this->result(true, 'Token impersonasi', 'sebagai '.config('google.service_account.impersonate'));
            $this->result(true, 'Shared Drive', $sharedDrive->name);
        } catch (DriveRequestFailed $exception) {
            $this->result(false, 'Akses Drive', $exception->operation.' → '.$exception->status.' '.($exception->reason ?? ''));
            $this->hint(match (true) {
                in_array($exception->reason, ['unauthorized_client', 'access_denied'], true) => 'Tambahkan Client ID service account di Admin Console › Keamanan › Kontrol API › Delegasi tingkat domain dengan scope https://www.googleapis.com/auth/drive.',
                $exception->reason === 'invalid_grant' => 'Periksa GOOGLE_IMPERSONATE_USER (harus akun aktif di domain) dan jam server.',
                $exception->isNotFound() => 'Akun impersonasi belum menjadi anggota Shared Drive (peran Pengelola) atau GOOGLE_SHARED_DRIVE_ID salah.',
                $exception->status === 403 => 'Aktifkan Google Drive API di Google Cloud Console untuk proyek service account.',
                default => 'Periksa koneksi internet server dan status Google Workspace.',
            });

            return;
        }

        if (! $this->option('write')) {
            $this->hint('Jalankan dengan --write untuk menguji izin membuat folder.');

            return;
        }

        try {
            $folder = $drive->createFolder('RuangKerja google-check '.now()->format('YmdHis'), $google->sharedDriveId());
            $drive->deleteFile($folder->id);
            $this->result(true, 'Izin tulis', 'folder uji dibuat lalu dihapus');
        } catch (DriveRequestFailed $exception) {
            $this->result(false, 'Izin tulis', $exception->status.' '.($exception->reason ?? ''));
            $this->hint('Beri akun impersonasi peran Pengelola (Manager) pada Shared Drive.');
        }
    }

    private function checkOAuthSettings(): void
    {
        $this->line('');
        $this->line('<options=bold>3. OAuth pengguna & Google Picker</>');

        $missing = GoogleFeatures::missingOAuthSettings();

        foreach (['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as $key) {
            $this->result(! in_array($key, $missing, true), $key, in_array($key, $missing, true) ? 'kosong' : 'terisi');
        }

        $apiKey = config('google.picker.api_key');
        $this->result(is_string($apiKey) && $apiKey !== '', 'GOOGLE_PICKER_API_KEY', is_string($apiKey) && $apiKey !== '' ? 'terisi' : 'kosong');
        $this->result(GoogleFeatures::pickerAppId() !== null, 'Nomor proyek (app id Picker)', GoogleFeatures::pickerAppId() ?? 'tidak bisa diturunkan dari GOOGLE_CLIENT_ID; isi GOOGLE_PICKER_APP_ID');

        $this->hint('Daftarkan redirect URI OAuth: '.config('google.oauth.redirect').' (sambungkan Drive) dan '.url('/auth/google/callback').' (login).');
    }

    private function result(bool $passed, string $label, string $detail): void
    {
        $this->ok = $this->ok && $passed;
        $this->components->twoColumnDetail(($passed ? '<fg=green>✓</>' : '<fg=red>✗</>').' '.$label, $detail);
    }

    private function hint(string $message): void
    {
        $this->line('  <fg=yellow>→</> '.$message);
    }
}
