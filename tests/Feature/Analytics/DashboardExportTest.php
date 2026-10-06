<?php

use App\Domain\Analytics\Exports\DashboardExport;
use App\Domain\Tasks\Enums\TaskStatusCategory as Cat;
use App\Models\AuditLog;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Maatwebsite\Excel\Facades\Excel;
use Tests\Support\AnalyticsFixtures as F;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
    $this->org = F::org();
    F::task(Workspace::factory()->internal()->create(), Cat::Todo, [$this->org['rizky']], ['due_date' => '2026-10-01', 'title' => 'Rekap stok']);
});

it('exports the division dashboard as the screen shows it', function () {
    Excel::fake();

    $this->actingAs($this->org['kadiv'])->get('/dashboard/divisi/ekspor?periode=bulan')->assertOk();

    Excel::assertDownloaded('dashboard-divisi-2026-10-07.xlsx', function (DashboardExport $export): bool {
        $sheets = collect($export->sheets())->mapWithKeys(fn ($sheet) => [$sheet->title() => $sheet->array()]);
        $summary = $sheets['Ringkasan'];
        $overdue = $sheets['Tugas terlambat'];

        return $sheets->keys()->all() === ['Ringkasan', 'Tren 8 minggu', 'Beban kerja', 'Tugas terlambat', 'Kehadiran hari ini', 'Proyek berisiko']
            && $summary[1] === ['Cakupan', 'Operasional (3 orang)']
            && in_array(['Tugas terlambat', 1, null, null, 'tugas', 'Tugas yang belum selesai (bukan Selesai atau Dibatalkan) dengan tenggat sebelum hari ini.'], $summary, true)
            && $overdue[0][1] === 'Rekap stok' && $overdue[0][4] === 6
            && count($sheets['Tren 8 minggu']) === 8;
    });

    expect(AuditLog::query()->where('action', 'dashboard.exported')->where('user_id', $this->org['kadiv']->id)->exists())->toBeTrue();
});

it('exports the personal and HR dashboards', function () {
    Excel::fake();

    $this->actingAs($this->org['rizky'])->get('/dashboard/saya/ekspor')->assertOk();
    Excel::assertDownloaded('dashboard-saya-2026-10-07.xlsx', fn (DashboardExport $export): bool => collect($export->sheets())->map->title()->all() === ['Ringkasan', 'Ruang saya', 'Kehadiran', 'Pengajuan']);

    $this->actingAs($this->org['hr'])->get('/dashboard/hr/ekspor')->assertOk();
    // Keputusan pemilik 6 Okt 2026: attendance lists and the recap are exported from Absensi.
    Excel::assertDownloaded('dashboard-hr-2026-10-07.xlsx', fn (DashboardExport $export): bool => collect($export->sheets())->map->title()->all() === ['Ringkasan', 'Menunggu HR']);

    $this->actingAs($this->org['direksi'])->get('/dashboard/direksi/ekspor')->assertOk();
    Excel::assertDownloaded('dashboard-direksi-2026-10-07.xlsx', fn (DashboardExport $export): bool => collect($export->sheets())->map->title()->all() === ['Ringkasan', 'Harian per divisi', 'Laporan hari ini', 'Mingguan', 'Proyek']);
});

it('produces a real xlsx file', function () {
    $response = $this->actingAs($this->org['kadiv'])->get('/dashboard/divisi/ekspor');

    $response->assertOk()->assertDownload('dashboard-divisi-2026-10-07.xlsx');
});
