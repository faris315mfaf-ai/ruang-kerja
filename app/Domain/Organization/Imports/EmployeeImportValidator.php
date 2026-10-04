<?php

namespace App\Domain\Organization\Imports;

use App\Domain\Organization\Data\EmployeeData;
use App\Domain\Organization\Enums\Role;
use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Enums\WorkMode;
use App\Domain\Organization\Rules\CompanyEmail;
use App\Domain\Organization\Services\RoleChangeGuard;
use App\Models\Company;
use App\Models\Division;
use App\Models\EmployeeProfile;
use App\Models\Position;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use Throwable;

/**
 * Validates import rows the same way the form does, plus cross-row rules:
 * duplicate emails / employee numbers, managers that are in the file, and
 * reporting cycles across the file and the existing data.
 *
 * Empty optional cells keep the current value of an existing employee (so a
 * partial file can update a few columns) and use defaults for new employees.
 * Messages never echo NIK or phone values.
 */
final class EmployeeImportValidator
{
    public const array REQUIRED_COLUMNS = ['nama', 'email'];

    public const array COLUMNS = [
        'nama', 'email', 'nomor_karyawan', 'divisi', 'tim', 'jabatan', 'atasan_email',
        'mode_kerja', 'peran', 'tanggal_bergabung', 'telepon', 'nik',
    ];

    private Company $company;

    /** @var array<string, Division> lower(code|name) → division */
    private array $divisions = [];

    /** @var array<string, array<string, Team>> division id → lower(name|code) → team */
    private array $teams = [];

    /** @var array<string, Position> lower(name) → position */
    private array $positions = [];

    /** @var array<string, User> lower(email) → user (any company) */
    private array $users = [];

    /** @var array<string, string> user id → lower(email) */
    private array $emailsById = [];

    /** @var array<string, string> employee_number → user_id */
    private array $employeeNumbers = [];

    public function __construct(private readonly RoleChangeGuard $roleGuard) {}

    /**
     * @param  array<int, array<string, string|null>>  $rows  sheet row number → values
     */
    public function validate(User $actor, array $rows, bool $truncated = false): EmployeeImportReport
    {
        $report = new EmployeeImportReport;

        if ($rows === []) {
            $report->fileErrors[] = 'Berkas tidak berisi data karyawan.';

            return $report;
        }

        $missing = array_diff(self::REQUIRED_COLUMNS, array_keys((array) reset($rows)));

        if ($missing !== []) {
            $report->fileErrors[] = 'Kolom wajib tidak ditemukan: '.implode(', ', $missing).'. Gunakan templat impor.';

            return $report;
        }

        if ($truncated) {
            $report->fileErrors[] = 'Berkas berisi lebih dari '.EmployeeSheetReader::MAX_ROWS.' baris. Hanya '.EmployeeSheetReader::MAX_ROWS.' baris pertama yang diproses; pecah berkas menjadi beberapa bagian.';
        }

        $this->load($actor, $rows);

        $seenEmails = [];
        $seenNumbers = [];

        foreach ($rows as $number => $values) {
            $row = $this->validateRow($actor, $number, $values);

            if ($row->email !== null) {
                if (isset($seenEmails[$row->email])) {
                    $row->fail("Email sama dengan baris {$seenEmails[$row->email]}.");
                } else {
                    $seenEmails[$row->email] = $number;
                }
            }

            $employeeNumber = $row->data?->employeeNumber;

            if ($employeeNumber !== null && ($values['nomor_karyawan'] ?? null) !== null) {
                if (isset($seenNumbers[$employeeNumber])) {
                    $row->fail("Nomor karyawan sama dengan baris {$seenNumbers[$employeeNumber]}.");
                } else {
                    $seenNumbers[$employeeNumber] = $number;
                }
            }

            $report->rows[] = $row;
        }

        $this->validateManagers($actor, $report);

        return $report;
    }

    /**
     * @param  array<int, array<string, string|null>>  $rows
     */
    private function load(User $actor, array $rows): void
    {
        // Fresh query: the shared Inertia props load `company` with id & name only.
        $this->company = Company::query()->findOrFail($actor->company_id);
        $this->divisions = [];
        $this->teams = [];
        $this->positions = [];

        $divisions = Division::query()->where('company_id', $actor->company_id)->get(['id', 'name', 'code']);

        foreach ($divisions as $division) {
            $this->divisions[Str::lower($division->name)] = $division;
            $this->divisions[Str::lower($division->code)] = $division;
        }

        foreach (Team::query()->whereIn('division_id', $divisions->modelKeys())->get(['id', 'name', 'code', 'division_id']) as $team) {
            $this->teams[$team->division_id][Str::lower($team->name)] = $team;

            if ($team->code !== null) {
                $this->teams[$team->division_id][Str::lower($team->code)] = $team;
            }
        }

        foreach (Position::query()->where('company_id', $actor->company_id)->get(['id', 'name']) as $position) {
            $this->positions[Str::lower($position->name)] = $position;
        }

        $emails = [];
        $numbers = [];

        foreach ($rows as $values) {
            foreach (['email', 'atasan_email'] as $column) {
                if (($values[$column] ?? null) !== null) {
                    $emails[] = Str::lower((string) $values[$column]);
                }
            }

            if (($values['nomor_karyawan'] ?? null) !== null) {
                $numbers[] = (string) $values['nomor_karyawan'];
            }
        }

        // Every employee of the company (for the reporting graph) + any file email elsewhere.
        $this->users = User::query()
            ->where(fn ($query) => $query->where('company_id', $actor->company_id)->orWhereIn('email', array_unique($emails)))
            ->with(['roles:id,name', 'profile:user_id,employee_number,phone'])
            ->get()
            ->keyBy(fn (User $user): string => Str::lower($user->email))
            ->all();

        $this->emailsById = [];

        foreach ($this->users as $email => $user) {
            $this->emailsById[$user->id] = $email;
        }

        /** @var array<string, string> $employeeNumbers */
        $employeeNumbers = EmployeeProfile::query()
            ->whereIn('employee_number', array_unique($numbers))
            ->pluck('user_id', 'employee_number')
            ->all();
        $this->employeeNumbers = $employeeNumbers;
    }

    /**
     * @param  array<string, string|null>  $values
     */
    private function validateRow(User $actor, int $number, array $values): EmployeeImportRow
    {
        $name = $values['nama'] ?? null;
        $email = ($values['email'] ?? null) === null ? null : Str::lower((string) $values['email']);
        $row = new EmployeeImportRow($number, $name, $email);
        $existing = null;

        if ($name === null) {
            $row->fail('Nama wajib diisi.');
        } elseif (mb_strlen($name) > 150) {
            $row->fail('Nama maksimal 150 karakter.');
        }

        if ($email === null) {
            $row->fail('Email wajib diisi.');
        } elseif (filter_var($email, FILTER_VALIDATE_EMAIL) === false || mb_strlen($email) > 190) {
            $row->fail('Format email tidak valid.');
        } elseif (! $this->company->ownsEmail($email)) {
            $row->fail(CompanyEmail::message($this->company));
        } else {
            $existing = $this->users[$email] ?? null;

            if ($existing !== null && $existing->company_id !== $actor->company_id) {
                $row->fail('Email sudah dipakai akun lain.');
                $existing = null;
            } elseif ($existing !== null && Gate::forUser($actor)->denies('update', $existing)) {
                $row->fail('Hanya Super Admin yang dapat mengubah data Super Admin.');
            }
        }

        $row->existingId = $existing?->id;

        // Division & team.
        $divisionId = $existing?->division_id;
        $divisionValue = $values['divisi'] ?? null;

        if ($divisionValue !== null) {
            $division = $this->divisions[Str::lower($divisionValue)] ?? null;
            $division === null
                ? $row->fail("Divisi \"{$divisionValue}\" tidak ditemukan.")
                : $divisionId = $division->id;
        }

        $teamValue = $values['tim'] ?? null;
        $teamId = $existing !== null && $existing->division_id === $divisionId ? $existing->team_id : null;

        if ($teamValue !== null) {
            $team = $divisionId === null ? null : ($this->teams[$divisionId][Str::lower($teamValue)] ?? null);

            if ($divisionId === null) {
                $row->fail('Tim hanya bisa diisi bila divisi diisi.');
            } elseif ($team === null) {
                $row->fail("Tim \"{$teamValue}\" tidak ditemukan di divisi tersebut.");
            } else {
                $teamId = $team->id;
            }
        }

        // Position.
        $positionId = $existing?->position_id;
        $positionValue = $values['jabatan'] ?? null;

        if ($positionValue !== null) {
            $position = $this->positions[Str::lower($positionValue)] ?? null;
            $position === null
                ? $row->fail("Jabatan \"{$positionValue}\" tidak ditemukan.")
                : $positionId = $position->id;
        }

        // Manager (resolved across the file in validateManagers()).
        $managerValue = $values['atasan_email'] ?? null;

        if ($managerValue !== null) {
            $row->managerEmail = Str::lower($managerValue);

            if ($row->managerEmail === $email) {
                $row->fail('Karyawan tidak bisa menjadi atasan dirinya sendiri.');
            }
        } elseif ($existing?->manager_id !== null) {
            $row->managerEmail = $this->emailOfId($existing->manager_id);
        }

        // Work mode.
        $workMode = $existing !== null ? $existing->work_mode : WorkMode::Office;
        $modeValue = $values['mode_kerja'] ?? null;

        if ($modeValue !== null) {
            $mode = self::matchEnum(WorkMode::cases(), $modeValue);
            $mode === null
                ? $row->fail("Mode kerja \"{$modeValue}\" tidak dikenal. Pakai: Kantor, Hybrid, WFH, atau Lapangan.")
                : $workMode = $mode;
        }

        // Roles.
        $before = $existing === null ? [] : RoleChangeGuard::rolesOf($existing);
        $roles = $existing === null ? [Role::Anggota] : $before;
        $rolesValue = $values['peran'] ?? null;

        if ($rolesValue !== null) {
            $roles = [];

            foreach (preg_split('/[,;|]/', $rolesValue) ?: [] as $part) {
                $part = trim($part);

                if ($part === '') {
                    continue;
                }

                $role = self::matchEnum(Role::cases(), $part);
                $role === null
                    ? $row->fail("Peran \"{$part}\" tidak dikenal.")
                    : $roles[] = $role;
            }

            $roles = array_values(array_unique($roles, SORT_REGULAR));

            if ($roles === []) {
                $row->fail('Pilih minimal satu peran.');
            }
        }

        $target = $existing ?? new User(['company_id' => $actor->company_id]);

        if (! $this->roleGuard->allows($actor, $target, $before, $roles)) {
            $row->fail('Hanya Super Admin yang dapat memberikan atau mencabut peran Super Admin.');
        }

        // Joined date.
        $joinedAt = $existing?->joined_at === null ? null : CarbonImmutable::parse($existing->joined_at);
        $joinedValue = $values['tanggal_bergabung'] ?? null;

        if ($joinedValue !== null) {
            $date = self::parseDate($joinedValue);
            $date === null
                ? $row->fail("Tanggal bergabung \"{$joinedValue}\" tidak valid. Pakai format YYYY-MM-DD.")
                : $joinedAt = $date;
        }

        // Profile.
        $employeeNumber = $existing?->profile?->employee_number;
        $numberValue = $values['nomor_karyawan'] ?? null;

        if ($numberValue !== null) {
            $owner = $this->employeeNumbers[$numberValue] ?? null;

            if (mb_strlen($numberValue) > 30) {
                $row->fail('Nomor karyawan maksimal 30 karakter.');
            } elseif ($owner !== null && $owner !== $existing?->id) {
                $row->fail("Nomor karyawan {$numberValue} sudah dipakai karyawan lain.");
            } else {
                $employeeNumber = $numberValue;
            }
        }

        $phone = $existing?->profile?->phone;
        $phoneValue = $values['telepon'] ?? null;

        if ($phoneValue !== null) {
            preg_match('/^\+?[0-9][0-9 \-]{6,24}$/', $phoneValue) === 1
                ? $phone = $phoneValue
                : $row->fail('Nomor telepon tidak valid.');
        }

        $nik = null;
        $nikValue = $values['nik'] ?? null;

        if ($nikValue !== null) {
            $digits = preg_replace('/\D+/', '', $nikValue) ?? '';
            strlen($digits) === 16 ? $nik = $digits : $row->fail('NIK harus 16 digit angka.');
        }

        if ($row->errors === [] && $name !== null && $email !== null) {
            $row->data = new EmployeeData(
                name: $name,
                email: $email,
                divisionId: $divisionId,
                teamId: $teamId,
                positionId: $positionId,
                managerId: null, // resolved when writing (the manager may be new in this file)
                workMode: $workMode,
                joinedAt: $joinedAt,
                roles: $roles,
                employeeNumber: $employeeNumber,
                phone: $phone,
                nik: $nik,
            );
        }

        return $row;
    }

    /**
     * Managers must be an active employee or a valid row of the same file, and the
     * resulting reporting graph must stay acyclic. Repeats until stable because a
     * failing manager row invalidates its subordinates.
     */
    private function validateManagers(User $actor, EmployeeImportReport $report): void
    {
        do {
            $changed = false;

            /** @var array<string, EmployeeImportRow> $fileRows */
            $fileRows = [];

            foreach ($report->rows as $row) {
                if ($row->email !== null && ! isset($fileRows[$row->email])) {
                    $fileRows[$row->email] = $row;
                }
            }

            // Reporting graph after the import: existing lines overridden by valid rows.
            $graph = [];

            foreach ($this->users as $email => $user) {
                if ($user->company_id === $actor->company_id && $user->manager_id !== null) {
                    $graph[$email] = $this->emailOfId($user->manager_id);
                }
            }

            foreach ($report->validRows() as $row) {
                if ($row->email !== null) {
                    $graph[$row->email] = $row->managerEmail;
                }
            }

            foreach ($report->validRows() as $row) {
                $managerEmail = $row->managerEmail;

                if ($managerEmail === null || $row->email === null) {
                    continue;
                }

                $managerRow = $fileRows[$managerEmail] ?? null;
                $manager = $this->users[$managerEmail] ?? null;

                if ($managerRow !== null && ! $managerRow->valid()) {
                    $row->fail("Atasan {$managerEmail} ada di baris {$managerRow->row} yang galat.");
                } elseif ($managerRow === null && ($manager === null || $manager->company_id !== $actor->company_id)) {
                    $row->fail("Atasan {$managerEmail} tidak ditemukan.");
                } elseif ($managerRow === null && $manager->status !== UserStatus::Active) {
                    $row->fail("Atasan {$managerEmail} tidak aktif.");
                } elseif ($this->reaches($graph, $managerEmail, $row->email)) {
                    $row->fail('Atasan ini membentuk siklus atasan (bawahan tidak boleh menjadi atasan).');
                } else {
                    continue;
                }

                $changed = true;
            }
        } while ($changed);
    }

    /**
     * Whether walking up from $start reaches $target (cycle), or loops forever.
     *
     * @param  array<string, string|null>  $graph
     */
    private function reaches(array $graph, string $start, string $target): bool
    {
        $seen = [];
        $current = $start;

        while ($current !== null) {
            if ($current === $target || isset($seen[$current])) {
                return true;
            }

            $seen[$current] = true;
            $current = $graph[$current] ?? null;
        }

        return false;
    }

    private function emailOfId(string $id): ?string
    {
        if (isset($this->emailsById[$id])) {
            return $this->emailsById[$id];
        }

        $email = User::query()->whereKey($id)->value('email');

        return is_string($email) ? Str::lower($email) : null;
    }

    /**
     * Match an enum by value or Indonesian label, case-insensitively.
     *
     * @template T of WorkMode|Role
     *
     * @param  list<T>  $cases
     * @return T|null
     */
    private static function matchEnum(array $cases, string $value): WorkMode|Role|null
    {
        $needle = Str::lower(trim($value));

        foreach ($cases as $case) {
            if ($needle === $case->value || $needle === Str::lower($case->label()) || $needle === str_replace('_', ' ', $case->value)) {
                return $case;
            }
        }

        return null;
    }

    private static function parseDate(string $value): ?CarbonImmutable
    {
        // Excel stores dates as serial numbers (days since 1899-12-30).
        if (preg_match('/^\d{1,6}(\.\d+)?$/', $value) === 1) {
            $serial = (float) $value;

            if ($serial < 1 || $serial > 2958465) {
                return null;
            }

            return CarbonImmutable::instance(ExcelDate::excelToDateTimeObject($serial))->startOfDay();
        }

        foreach (['!Y-m-d', '!d/m/Y', '!j/n/Y', '!d-m-Y', '!j-n-Y', '!Y/m/d'] as $format) {
            try {
                $date = CarbonImmutable::createFromFormat($format, $value);
            } catch (Throwable) {
                continue;
            }

            if ($date !== null && $date->format(substr($format, 1)) === $value) {
                return $date;
            }
        }

        return null;
    }
}
