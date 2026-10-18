<?php

namespace App\Console\Commands;

use App\Domain\Organization\Actions\CreateSuperAdmin;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use InvalidArgumentException;

#[Signature('ruangkerja:create-super-admin
    {email : E-mail Super Admin (domain menjadi domain Google perusahaan baru)}
    {--name=Super Admin : Nama tampilan}
    {--company= : Perusahaan yang ada (id, domain Google, atau nama); wajib bila ada beberapa perusahaan. Instalasi baru: nama perusahaan yang dibuat}
    {--new-company= : Buat perusahaan baru dengan nama ini}
    {--domain= : Domain Google perusahaan baru (bawaan: domain e-mail; harus belum dipakai perusahaan lain)}
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

        $company = $this->filled('company');
        $newCompany = $this->filled('new-company');

        try {
            $user = $createSuperAdmin->handle(
                $email,
                (string) $this->option('name'),
                $password,
                companyName: $newCompany,
                company: $company,
                newCompany: $newCompany !== null,
                domain: $this->filled('domain'),
            );
        } catch (InvalidArgumentException $e) {
            $this->components->error($e->getMessage());

            return self::FAILURE;
        }

        $this->components->info("Super Admin siap: {$user->email}");

        if ($generate) {
            $this->components->warn('Sandi sementara (hanya ditampilkan sekali, segera ganti dan aktifkan 2FA):');
            $this->line($password);
        }

        return self::SUCCESS;
    }

    private function filled(string $option): ?string
    {
        $value = $this->option($option);

        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }
}
