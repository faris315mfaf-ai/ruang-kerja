<?php

namespace Database\Seeders;

use App\Domain\Organization\Demo\DemoAccounts;
use App\Domain\Organization\Demo\DemoCompany;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Enums\WorkMode;
use App\Models\Company;
use App\Models\Division;
use App\Models\EmployeeProfile;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Demo organization (local/testing): 1 company, Direksi + 5 divisions, teams,
 * positions and 24 employees with a consistent reporting line
 * (Direksi → Kepala Divisi → anggota). The demo accounts (DemoAccounts) are placed in it.
 * Idempotent: upserts by natural keys (division code, position/team name, email).
 */
class OrganizationSeeder extends Seeder
{
    /**
     * code => [name, is_board]
     *
     * @var array<string, array{0: string, 1: bool}>
     */
    private const array DIVISIONS = [
        'DIR' => ['Direksi', true],
        'KEU' => ['Keuangan', false],
        'OPS' => ['Operasional', false],
        'PMS' => ['Pemasaran', false],
        'SDM' => ['SDM', false],
        'PRG' => ['Programming', false],
    ];

    /**
     * name => level (1 = Direksi … 5 = Staf)
     *
     * @var array<string, int>
     */
    private const array POSITIONS = [
        'Direktur Utama' => 1,
        'Direktur Keuangan' => 1,
        'Kepala Divisi Keuangan' => 2,
        'Kepala Divisi Operasional' => 2,
        'Kepala Divisi Pemasaran' => 2,
        'Kepala Divisi SDM' => 2,
        'Ketua Tim Gudang' => 3,
        'Administrator Sistem' => 4,
        'Staf Keuangan' => 5,
        'Staf Operasional' => 5,
        'Staf Gudang' => 5,
        'Staf Pemasaran' => 5,
        'Staf Rekrutmen' => 5,
        'Staf Penggajian' => 5,
        'Staf Administrasi SDM' => 5,
        'Staf Pelatihan' => 5,
        'Staf Hubungan Industrial' => 5,
        'Kepala Divisi Programming' => 2,
        'Staf Programmer' => 5,
    ];

    /**
     * name => [division code, code, lead email]
     *
     * @var array<string, array{0: string, 1: string, 2: string}>
     */
    private const array TEAMS = [
        'Tim Gudang' => ['OPS', 'GDG', 'sari.wulandari@demo.test'],
        'Tim Digital' => ['PMS', 'DGT', 'maya.lestari@demo.test'],
    ];

    /**
     * Division heads (head_user_id).
     *
     * @var array<string, string>
     */
    private const array HEADS = [
        'DIR' => 'direksi@demo.test',
        'KEU' => 'agus.setiawan@demo.test',
        'OPS' => 'kadiv@demo.test',
        'PMS' => 'putri.ramadhani@demo.test',
        'SDM' => 'hr@demo.test',
        'PRG' => 'yudi.hartono@demo.test',
    ];

    /**
     * email => [name, division, team, position, manager email, work mode, status, role, joined_at]
     * Demo accounts keep the name/role from DemoAccounts (role column is ignored for them).
     *
     * @var array<string, array{0: string, 1: string|null, 2: string|null, 3: string, 4: string|null, 5: WorkMode, 6: UserStatus, 7: Role, 8: string}>
     */
    private const array EMPLOYEES = [
        // Direksi
        'direksi@demo.test' => ['Hendra Wijaya', 'DIR', null, 'Direktur Utama', null, WorkMode::Office, UserStatus::Active, Role::Direksi, '2015-01-05'],
        'lestari.anggraini@demo.test' => ['Lestari Anggraini', 'DIR', null, 'Direktur Keuangan', 'direksi@demo.test', WorkMode::Office, UserStatus::Active, Role::Direksi, '2016-03-01'],
        'admin@demo.test' => ['Admin Sistem', null, null, 'Administrator Sistem', null, WorkMode::Office, UserStatus::Active, Role::SuperAdmin, '2020-07-01'],
        // Operasional
        'kadiv@demo.test' => ['Dimas Pratama', 'OPS', null, 'Kepala Divisi Operasional', 'direksi@demo.test', WorkMode::Office, UserStatus::Active, Role::KepalaDivisi, '2018-02-12'],
        'sari.wulandari@demo.test' => ['Sari Wulandari', 'OPS', 'Tim Gudang', 'Ketua Tim Gudang', 'kadiv@demo.test', WorkMode::Field, UserStatus::Active, Role::Anggota, '2019-05-20'],
        'bayu.saputra@demo.test' => ['Bayu Saputra', 'OPS', null, 'Staf Operasional', 'kadiv@demo.test', WorkMode::Hybrid, UserStatus::Active, Role::Anggota, '2023-02-14'],
        'anggota@demo.test' => ['Rizky Aditya', 'OPS', null, 'Staf Operasional', 'kadiv@demo.test', WorkMode::Office, UserStatus::Active, Role::Anggota, '2022-08-01'],
        'nadia.putri@demo.test' => ['Nadia Putri', 'OPS', 'Tim Gudang', 'Staf Gudang', 'sari.wulandari@demo.test', WorkMode::Field, UserStatus::Active, Role::Anggota, '2024-01-08'],
        'yoga.pratama@demo.test' => ['Yoga Pratama', 'OPS', 'Tim Gudang', 'Staf Gudang', 'sari.wulandari@demo.test', WorkMode::Office, UserStatus::Active, Role::Anggota, '2024-06-03'],
        // Keuangan
        'agus.setiawan@demo.test' => ['Agus Setiawan', 'KEU', null, 'Kepala Divisi Keuangan', 'lestari.anggraini@demo.test', WorkMode::Office, UserStatus::Active, Role::KepalaDivisi, '2017-09-18'],
        'fitri.handayani@demo.test' => ['Fitri Handayani', 'KEU', null, 'Staf Keuangan', 'agus.setiawan@demo.test', WorkMode::Hybrid, UserStatus::Active, Role::Anggota, '2021-04-12'],
        'ahmad.kurniawan@demo.test' => ['Ahmad Kurniawan', 'KEU', null, 'Staf Keuangan', 'agus.setiawan@demo.test', WorkMode::Office, UserStatus::Active, Role::Anggota, '2022-11-21'],
        // Pemasaran
        'putri.ramadhani@demo.test' => ['Putri Ramadhani', 'PMS', null, 'Kepala Divisi Pemasaran', 'direksi@demo.test', WorkMode::Office, UserStatus::Active, Role::KepalaDivisi, '2018-10-01'],
        'maya.lestari@demo.test' => ['Maya Lestari', 'PMS', 'Tim Digital', 'Staf Pemasaran', 'putri.ramadhani@demo.test', WorkMode::Wfh, UserStatus::Active, Role::Anggota, '2021-01-11'],
        'rendi.oktavian@demo.test' => ['Rendi Oktavian', 'PMS', 'Tim Digital', 'Staf Pemasaran', 'putri.ramadhani@demo.test', WorkMode::Field, UserStatus::Active, Role::Anggota, '2023-07-17'],
        'teguh.santoso@demo.test' => ['Teguh Santoso', 'PMS', null, 'Staf Pemasaran', 'putri.ramadhani@demo.test', WorkMode::Office, UserStatus::Inactive, Role::Anggota, '2020-03-02'],
        // SDM
        'hr@demo.test' => ['Hana Pratiwi', 'SDM', null, 'Kepala Divisi SDM', 'direksi@demo.test', WorkMode::Office, UserStatus::Active, Role::Hr, '2017-01-16'],
        'dewi.kartika@demo.test' => ['Dewi Kartika', 'SDM', null, 'Staf Rekrutmen', 'hr@demo.test', WorkMode::Office, UserStatus::Active, Role::Anggota, '2022-02-07'],
        'lukman.hidayat@demo.test' => ['Lukman Hidayat', 'SDM', null, 'Staf Penggajian', 'hr@demo.test', WorkMode::Office, UserStatus::Active, Role::Anggota, '2021-09-13'],
        'rahmawati@demo.test' => ['Rahmawati', 'SDM', null, 'Staf Administrasi SDM', 'hr@demo.test', WorkMode::Hybrid, UserStatus::Active, Role::Anggota, '2023-03-20'],
        'bima.prakoso@demo.test' => ['Bima Prakoso', 'SDM', null, 'Staf Pelatihan', 'hr@demo.test', WorkMode::Office, UserStatus::Active, Role::Anggota, '2024-04-15'],
        'tiara.anjani@demo.test' => ['Tiara Anjani', 'SDM', null, 'Staf Hubungan Industrial', 'hr@demo.test', WorkMode::Office, UserStatus::Resigned, Role::Anggota, '2019-08-05'],
        // Programming
        'yudi.hartono@demo.test' => ['Yudi Hartono', 'PRG', null, 'Kepala Divisi Programming', 'direksi@demo.test', WorkMode::Hybrid, UserStatus::Active, Role::KepalaDivisi, '2019-11-04'],
        'programmer@demo.test' => ['Arif Nugroho', 'PRG', null, 'Staf Programmer', 'yudi.hartono@demo.test', WorkMode::Hybrid, UserStatus::Active, Role::Anggota, '2024-02-05'],
    ];

    public function run(): void
    {
        // Roles + the demo accounts (with passwords) first.
        $this->call(DemoUserSeeder::class, silent: true);

        $company = DemoCompany::ensure();
        $divisions = $this->seedDivisions($company);
        $positions = $this->seedPositions($company);
        $users = $this->seedEmployees($company, $divisions, $positions);
        $teams = $this->seedTeams($divisions, $users);

        $this->linkEmployees($users, $teams);

        foreach (self::HEADS as $code => $email) {
            $divisions[$code]->forceFill(['head_user_id' => $users[$email]->id])->save();
        }
    }

    /**
     * @return array<string, Division>
     */
    private function seedDivisions(Company $company): array
    {
        $divisions = [];

        foreach (self::DIVISIONS as $code => [$name, $isBoard]) {
            $division = Division::withTrashed()->firstOrNew(['company_id' => $company->id, 'code' => $code]);
            $division->forceFill(['name' => $name, 'is_board' => $isBoard, 'deleted_at' => null])->save();
            $divisions[$code] = $division;
        }

        return $divisions;
    }

    /**
     * @return array<string, Position>
     */
    private function seedPositions(Company $company): array
    {
        $positions = [];

        foreach (self::POSITIONS as $name => $level) {
            $positions[$name] = Position::query()->updateOrCreate(
                ['company_id' => $company->id, 'name' => $name],
                ['level' => $level],
            );
        }

        return $positions;
    }

    /**
     * @param  array<string, Division>  $divisions
     * @param  array<string, User>  $users
     * @return array<string, Team>
     */
    private function seedTeams(array $divisions, array $users): array
    {
        $teams = [];

        foreach (self::TEAMS as $name => [$divisionCode, $code, $leadEmail]) {
            $teams[$name] = Team::query()->updateOrCreate(
                ['division_id' => $divisions[$divisionCode]->id, 'name' => $name],
                ['code' => $code, 'lead_user_id' => $users[$leadEmail]->id],
            );
        }

        return $teams;
    }

    /**
     * @param  array<string, Division>  $divisions
     * @param  array<string, Position>  $positions
     * @return array<string, User>
     */
    private function seedEmployees(Company $company, array $divisions, array $positions): array
    {
        $demoEmails = array_flip(DemoAccounts::emails());
        $users = [];
        $number = 0;

        foreach (self::EMPLOYEES as $email => [$name, $divisionCode, , $position, , $workMode, $status, $role, $joinedAt]) {
            $number++;
            $isDemo = isset($demoEmails[$email]);
            $user = User::query()->firstOrNew(['email' => $email]);

            $user->forceFill([
                'company_id' => $company->id,
                'division_id' => $divisionCode === null ? null : $divisions[$divisionCode]->id,
                'position_id' => $positions[$position]->id,
                'work_mode' => $workMode,
                'status' => $status,
                'joined_at' => $joinedAt,
                'email_verified_at' => $user->email_verified_at ?? now(),
            ]);

            if (! $isDemo) {
                // Regular employees sign in with Google only (no password).
                $user->forceFill(['name' => $name, 'password' => null]);
            }

            $user->save();

            if (! $isDemo) {
                $user->syncRoles([$role->value]);
            }

            EmployeeProfile::query()->updateOrCreate(['user_id' => $user->id], [
                'employee_number' => sprintf('RK-%04d', $number),
                'nik' => sprintf('3171%02d%010d', $number, 1_000_000 + $number),
                'phone' => sprintf('+62812%08d', 10_000_000 + $number),
                'birth_date' => sprintf('%d-%02d-%02d', 1975 + $number, ($number % 12) + 1, ($number % 27) + 1),
                'address' => "Jl. Contoh No. {$number}, Jakarta",
                'emergency_contact' => ['name' => 'Kontak Darurat', 'relation' => 'Keluarga', 'phone' => sprintf('+62813%08d', 20_000_000 + $number)],
            ]);

            $users[$email] = $user;
        }

        return $users;
    }

    /**
     * Second pass: managers and teams reference rows created above.
     *
     * @param  array<string, User>  $users
     * @param  array<string, Team>  $teams
     */
    private function linkEmployees(array $users, array $teams): void
    {
        foreach (self::EMPLOYEES as $email => [, , $team, , $managerEmail]) {
            $users[$email]->forceFill([
                'team_id' => $team === null ? null : $teams[$team]->id,
                'manager_id' => $managerEmail === null ? null : $users[$managerEmail]->id,
            ])->save();
        }
    }
}
