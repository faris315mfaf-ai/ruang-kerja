<?php

namespace App\Console\Commands;

use App\Domain\Organization\Actions\CreateSuperAdmin;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

#[Signature('ruangkerja:create-super-admin
    {email : E-mail Super Admin (domain menjadi domain Google perusahaan bila perusahaan belum ada)}
    {--name=Super Admin : Nama tampilan}
    {--company= : Nama perusahaan bila belum ada (bawaan: BRANDING_COMPANY_NAME)}
    {--generate-password : Buat sandi acak dan tampilkan sekali (untuk docker exec -T)}')]
#[Description('Membuat atau menaikkan akun menjadi Super Admin (instalasi baru)')]
class CreateSuperAdminCommand extends Command
{
    public function handle(CreateSuperAdmin $createSuperAdmin): int
    {
        $email = (string) $this->argument('email');
        $generate = (bool) $this->option('generate-password');
        $password = $generate ? Str::password(24) : (string) $this->secret('Sandi (min. 12 karakter di produksi)');

        $validator = Validator::make(
            ['email' => $email, 'password' => $password],
            ['email' => ['required', 'email'], 'password' => ['required', Password::defaults()]],
        );

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->components->error($error);
            }

            return self::FAILURE;
        }

        $companyOption = $this->option('company');

        $user = $createSuperAdmin->handle(
            $email,
            (string) $this->option('name'),
            $password,
            is_string($companyOption) && $companyOption !== '' ? $companyOption : null,
        );

        $this->components->info("Super Admin siap: {$user->email}");

        if ($generate) {
            $this->components->warn('Sandi sementara (hanya ditampilkan sekali, segera ganti dan aktifkan 2FA):');
            $this->line($password);
        }

        return self::SUCCESS;
    }
}
