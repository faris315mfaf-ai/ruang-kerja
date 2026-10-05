<?php

/*
|--------------------------------------------------------------------------
| Payroll export of the monthly attendance recap (Excel & PDF)
|--------------------------------------------------------------------------
|
| Column order and headers of "Ekspor Excel" / "Ekspor PDF" on
| Absensi › Rekap bulanan (docs/PRD.md M2). Reorder, rename or remove
| entries to match the payroll system. Keys must be one of
| App\Domain\Attendance\Enums\PayrollColumn:
|
|   employee_number, name, email, division, position, shift,
|   work_days, present_days, late_count, late_minutes, early_leave_count,
|   absent_days, leave_days, permit_days, sick_days, business_trip_days,
|   wfh_days, needs_correction_days, overtime_hours, work_hours,
|   attendance_rate, average_check_in
|
*/

return [

    'columns' => [
        'employee_number' => 'No. karyawan',
        'name' => 'Nama',
        'division' => 'Divisi',
        'position' => 'Jabatan',
        'work_days' => 'Hari kerja',
        'present_days' => 'Hadir',
        'late_count' => 'Terlambat (kali)',
        'late_minutes' => 'Terlambat (menit)',
        'absent_days' => 'Alpha',
        'leave_days' => 'Cuti',
        'permit_days' => 'Izin',
        'sick_days' => 'Sakit',
        'business_trip_days' => 'Dinas',
        'overtime_hours' => 'Lembur (jam)',
    ],

    // {month} = 2026-09
    'filename' => env('PAYROLL_EXPORT_FILENAME', 'rekap-absensi-{month}'),

    // {month} = September 2026 (Excel sheet names are cut at 31 characters)
    'sheet_title' => 'Rekap {month}',

    'pdf' => [
        'paper' => 'a4',
        'orientation' => 'landscape',
    ],

];
