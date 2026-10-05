<?php

namespace App\Domain\Requests\Imports;

use App\Domain\Organization\Enums\UserStatus;
use App\Domain\Organization\Imports\EmployeeSheetReader;
use App\Domain\Requests\Actions\AdjustLeaveBalance;
use App\Domain\Requests\Actions\UpdateLeaveBalance;
use App\Domain\Requests\Services\BalanceLedger;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Maatwebsite\Excel\Facades\Excel;

/**
 * Admin › Saldo cuti › Impor (CSV/XLSX): opening balance, entitlement,
 * carry-over and adjustments per employee, type and year. The same file is
 * first validated as a preview (nothing written, per-row errors) and then
 * committed: valid rows are applied through UpdateLeaveBalance /
 * AdjustLeaveBalance (audited), invalid rows are skipped and reported.
 *
 * Rows are read with the employee import's reader (headings slugged, values
 * trimmed); the file is never stored.
 */
final class LeaveBalanceImport
{
    /** Template / accepted columns (email, jenis, tahun required; at least one value). */
    public const array COLUMNS = ['email', 'jenis', 'tahun', 'saldo_awal', 'jatah', 'bawaan', 'penyesuaian', 'alasan'];

    public const array REQUIRED_COLUMNS = ['email', 'jenis', 'tahun'];

    private const float MAX_DAYS = 365;

    public function __construct(
        private readonly BalanceLedger $ledger,
        private readonly UpdateLeaveBalance $update,
        private readonly AdjustLeaveBalance $adjust,
    ) {}

    /**
     * @return array{mode: 'preview'|'commit', file: string, truncated: bool, missing_columns: list<string>, rows: list<array<string, mixed>>, summary: array{total: int, ok: int, error: int, applied: int}}
     */
    public function handle(User $actor, UploadedFile $file, bool $commit): array
    {
        $reader = new EmployeeSheetReader;
        Excel::import($reader, $file);

        $sheet = $reader->rows();
        $missing = $this->missingColumns($sheet);
        $rows = $missing === [] ? $this->validate($actor, $sheet) : [];

        if ($commit && $missing === []) {
            $rows = $this->apply($actor, $rows);
        }

        $public = array_map(fn (array $row): array => array_diff_key($row, array_flip(['user', 'type'])), $rows);
        $errors = count(array_filter($rows, fn (array $row): bool => $row['errors'] !== []));

        return [
            'mode' => $commit ? 'commit' : 'preview',
            'file' => mb_strimwidth($file->getClientOriginalName(), 0, 120, '…'),
            'truncated' => $reader->truncated(),
            'missing_columns' => $missing,
            'rows' => $public,
            'summary' => [
                'total' => count($rows),
                'ok' => count($rows) - $errors,
                'error' => $errors,
                'applied' => count(array_filter($rows, fn (array $row): bool => $row['applied'])),
            ],
        ];
    }

    /**
     * @param  array<int, array<string, string|null>>  $sheet
     * @return list<string>
     */
    private function missingColumns(array $sheet): array
    {
        $first = $sheet === [] ? null : reset($sheet);

        if ($first === null) {
            return [];
        }

        return array_values(array_diff(self::REQUIRED_COLUMNS, array_keys($first)));
    }

    /**
     * @param  array<int, array<string, string|null>>  $sheet
     * @return list<array<string, mixed>>
     */
    private function validate(User $actor, array $sheet): array
    {
        $emails = array_values(array_unique(array_filter(array_map(fn (array $row): string => mb_strtolower((string) ($row['email'] ?? '')), $sheet))));
        $users = User::query()
            ->where('company_id', $actor->company_id)
            ->where('status', UserStatus::Active->value)
            ->whereIn(DB::raw('lower(email)'), $emails === [] ? [''] : $emails)
            ->get()
            ->keyBy(fn (User $user): string => mb_strtolower($user->email));
        $types = LeaveType::query()
            ->where('company_id', $actor->company_id)
            ->whereNotNull('annual_quota_days')
            ->get()
            ->keyBy('code');

        $seen = [];
        $rows = [];

        foreach ($sheet as $number => $values) {
            $errors = [];
            $email = mb_strtolower((string) ($values['email'] ?? ''));
            $code = mb_strtoupper((string) ($values['jenis'] ?? ''));
            $user = $users->get($email);
            $type = $types->get($code);
            $year = $this->year($values['tahun'] ?? null, $errors);

            if ($email === '') {
                $errors[] = 'Email wajib diisi.';
            } elseif ($user === null) {
                $errors[] = 'Karyawan aktif dengan email ini tidak ditemukan.';
            }

            if ($code === '') {
                $errors[] = 'Jenis wajib diisi (kode, mis. CUT).';
            } elseif ($type === null) {
                $errors[] = "Jenis {$code} tidak dikenal atau tidak memakai saldo tahunan.";
            }

            $beforeNumbers = count($errors);
            $opening = $this->days($values['saldo_awal'] ?? null, 'Saldo awal', $errors);
            $entitled = $this->days($values['jatah'] ?? null, 'Jatah', $errors);
            $carried = $this->days($values['bawaan'] ?? null, 'Bawaan', $errors);
            $delta = $this->days($values['penyesuaian'] ?? null, 'Penyesuaian', $errors, signed: true);
            $numberError = count($errors) > $beforeNumbers;
            $reason = trim((string) ($values['alasan'] ?? ''));

            if ($delta !== null && $reason === '') {
                $errors[] = 'Alasan wajib diisi untuk penyesuaian.';
            }

            if (mb_strlen($reason) > 255) {
                $errors[] = 'Alasan maksimal 255 karakter.';
            }

            if ($opening === null && $entitled === null && $carried === null && $delta === null && ! $numberError) {
                $errors[] = 'Isi minimal satu dari saldo_awal, jatah, bawaan, atau penyesuaian.';
            }

            $key = "{$email}|{$code}|{$year}";

            if (isset($seen[$key])) {
                $errors[] = "Baris ganda: karyawan, jenis, dan tahun yang sama sudah ada di baris {$seen[$key]}.";
            } else {
                $seen[$key] = $number;
            }

            $before = null;
            $after = null;

            if ($user !== null && $type !== null && $year !== null) {
                $balance = $this->ledger->peek($user, $type, $year) ?? new LeaveBalance;
                $before = $balance->available();
                $after = round(
                    ($entitled ?? $balance->entitled_days) + ($carried ?? $balance->carried_over_days) + ($opening ?? $balance->opening_days)
                    + $balance->adjustment_days + ($delta ?? 0) - $balance->used_days - $balance->pending_days,
                    1,
                );

                if ($after < 0) {
                    $errors[] = 'Saldo menjadi minus ('.BalanceLedger::format($after).' hari): sudah terpakai/diajukan '.BalanceLedger::format($balance->used_days + $balance->pending_days).' hari.';
                }
            }

            $rows[] = [
                'row' => $number,
                'email' => $values['email'] ?? null,
                'name' => $user?->name,
                'type' => $type,
                'user' => $user,
                'type_code' => $code === '' ? null : $code,
                'year' => $year,
                'opening' => $opening,
                'entitled' => $entitled,
                'carried_over' => $carried,
                'adjustment' => $delta,
                'reason' => $reason === '' ? null : $reason,
                'available_before' => $before,
                'available_after' => $after,
                'errors' => $errors,
                'applied' => false,
            ];
        }

        return $rows;
    }

    /**
     * Applies the valid rows (one transaction; a row failing on the locked
     * balance is reported and skipped).
     *
     * @param  list<array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    private function apply(User $actor, array $rows): array
    {
        return DB::transaction(function () use ($actor, $rows): array {
            foreach ($rows as $index => $row) {
                if ($row['errors'] !== [] || ! $row['user'] instanceof User || ! $row['type'] instanceof LeaveType || ! is_int($row['year'])) {
                    continue;
                }

                try {
                    DB::transaction(function () use ($actor, $row): void {
                        $balance = $this->ledger->balanceFor($row['user'], $row['type'], $row['year'], lock: true)
                            ?? throw new \LogicException('Leave type without quota.');

                        if ($row['opening'] !== null || $row['entitled'] !== null || $row['carried_over'] !== null) {
                            $balance = $this->update->handle(
                                $actor,
                                $balance,
                                self::float($row['entitled']) ?? $balance->entitled_days,
                                self::float($row['carried_over']) ?? $balance->carried_over_days,
                                self::float($row['opening']) ?? $balance->opening_days,
                            );
                        }

                        $delta = self::float($row['adjustment']);

                        if ($delta !== null) {
                            $this->adjust->handle($actor, $balance, $delta, (string) $row['reason']);
                        }
                    });

                    $rows[$index]['applied'] = true;
                    $after = $this->ledger->peek($row['user'], $row['type'], $row['year']);
                    $rows[$index]['available_after'] = $after?->available();
                } catch (ValidationException $exception) {
                    $rows[$index]['errors'] = array_values(array_map(strval(...), array_merge(...array_values($exception->errors()))));
                }
            }

            return $rows;
        });
    }

    /**
     * @param  list<string>  $errors
     */
    private function year(?string $value, array &$errors): ?int
    {
        if ($value === null || preg_match('/^\d{4}$/', $value) !== 1 || (int) $value < 2000 || (int) $value > 2100) {
            $errors[] = 'Tahun wajib diisi (4 angka, mis. 2026).';

            return null;
        }

        return (int) $value;
    }

    /**
     * "1,5" / "1.5" → 1.5; empty → null. Multiples of 0.5; ≥ 0 unless $signed (then ≠ 0).
     *
     * @param  list<string>  $errors
     */
    private function days(?string $value, string $label, array &$errors, bool $signed = false): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        $normalized = str_replace(',', '.', str_replace(' ', '', $value));

        if (! is_numeric($normalized)) {
            $errors[] = "{$label} harus berupa angka.";

            return null;
        }

        $days = round((float) $normalized, 1);

        if (fmod(abs($days) * 2, 1.0) !== 0.0) {
            $errors[] = "{$label} harus kelipatan 0,5 hari.";

            return null;
        }

        if (abs($days) > self::MAX_DAYS || (! $signed && $days < 0)) {
            $errors[] = $signed ? "{$label} maksimal ±365 hari." : "{$label} harus 0–365 hari.";

            return null;
        }

        if ($signed && $days === 0.0) {
            return null;
        }

        return $days;
    }

    private static function float(mixed $value): ?float
    {
        return is_float($value) || is_int($value) ? (float) $value : null;
    }
}
