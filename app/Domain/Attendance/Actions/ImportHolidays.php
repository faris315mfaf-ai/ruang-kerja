<?php

namespace App\Domain\Attendance\Actions;

use App\Domain\Attendance\Data\HolidayImportReport;
use App\Domain\Attendance\Enums\HolidayType;
use App\Domain\Attendance\Models\Holiday;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Imports holidays from CSV (e.g. SKB cuti bersama). Columns: tanggal, nama,
 * jenis (optional: nasional · cuti bersama · perusahaan). Comma or semicolon
 * separated, optional header row, dates as YYYY-MM-DD or DD/MM/YYYY.
 * All-or-nothing: any invalid line aborts the import and is reported by
 * line number. Existing dates are updated.
 */
final class ImportHolidays
{
    public const int MAX_ROWS = 500;

    public function handle(User $actor, UploadedFile $file): HolidayImportReport
    {
        $report = new HolidayImportReport;
        $rows = $this->parse($file, $report);

        if ($report->failed()) {
            return $report;
        }

        DB::transaction(function () use ($actor, $rows, $report): void {
            foreach ($rows as $row) {
                $holiday = Holiday::query()
                    ->where('company_id', $actor->company_id)
                    ->whereDate('date', $row['date'])
                    ->first();

                if ($holiday === null) {
                    Holiday::query()->create(['company_id' => $actor->company_id, ...$row]);
                    $report->created++;

                    continue;
                }

                $holiday->fill($row);

                if ($holiday->isDirty()) {
                    $holiday->save();
                    $report->updated++;
                }
            }
        });

        return $report;
    }

    /**
     * @return list<array{date: string, name: string, type: HolidayType}>
     */
    private function parse(UploadedFile $file, HolidayImportReport $report): array
    {
        $contents = (string) file_get_contents($file->getRealPath());
        // Strip a UTF-8 BOM written by Excel.
        $contents = preg_replace('/^\xEF\xBB\xBF/', '', $contents) ?? $contents;
        $lines = preg_split('/\r\n|\r|\n/', $contents) ?: [];

        $rows = [];
        $seen = [];

        foreach ($lines as $index => $line) {
            $number = $index + 1;

            if (trim($line) === '') {
                continue;
            }

            $delimiter = substr_count($line, ';') > substr_count($line, ',') ? ';' : ',';
            $cells = array_map(fn (?string $cell): string => trim((string) $cell), str_getcsv($line, $delimiter, '"', ''));

            if ($number === 1 && $this->isHeader($cells)) {
                continue;
            }

            if (count($rows) + count($report->errors) >= self::MAX_ROWS) {
                $report->addError($number, 'Maksimal '.self::MAX_ROWS.' baris per impor.');

                break;
            }

            $date = $this->parseDate($cells[0]);
            $name = $cells[1] ?? '';
            $type = ($cells[2] ?? '') === '' ? HolidayType::National : HolidayType::fromInput($cells[2]);

            if ($date === null) {
                $report->addError($number, 'Tanggal tidak valid. Pakai format YYYY-MM-DD atau DD/MM/YYYY.');

                continue;
            }

            if ($name === '' || mb_strlen($name) > 150) {
                $report->addError($number, 'Nama hari libur wajib diisi (maksimal 150 karakter).');

                continue;
            }

            if ($type === null) {
                $report->addError($number, 'Jenis harus nasional, cuti bersama, atau perusahaan.');

                continue;
            }

            if (isset($seen[$date])) {
                $report->addError($number, "Tanggal {$date} sudah ada di baris {$seen[$date]}.");

                continue;
            }

            $seen[$date] = $number;
            $rows[] = ['date' => $date, 'name' => $name, 'type' => $type];
        }

        if ($rows === [] && ! $report->failed()) {
            $report->addError(1, 'Berkas tidak berisi data hari libur.');
        }

        return $rows;
    }

    /**
     * @param  list<string>  $cells
     */
    private function isHeader(array $cells): bool
    {
        return in_array(mb_strtolower($cells[0] ?? ''), ['tanggal', 'date', 'tgl'], true);
    }

    private function parseDate(string $value): ?string
    {
        foreach (['!Y-m-d', '!d/m/Y', '!j/n/Y', '!d-m-Y', '!j-n-Y'] as $format) {
            try {
                $date = CarbonImmutable::createFromFormat($format, $value, CurrentCompany::timezone());
            } catch (Throwable) {
                $date = null;
            }

            if ($date instanceof CarbonImmutable && $date->format(ltrim($format, '!')) === $value) {
                return $date->toDateString();
            }
        }

        return null;
    }
}
