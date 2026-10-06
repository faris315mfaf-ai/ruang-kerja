<?php

namespace Database\Seeders;

use App\Domain\Analytics\Okr\Quarter;
use App\Domain\Okr\Enums\KeyResultUnit;
use App\Domain\Okr\Enums\ObjectiveStatus;
use App\Domain\Requests\Support\OfficeTime;
use App\Domain\Workspaces\Enums\WorkspaceType;
use App\Models\Division;
use App\Models\KeyResult;
use App\Models\KeyResultCheckin;
use App\Models\Objective;
use App\Models\Task;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Demo OKR divisi (local/testing, idempotent; F3-3): objectives of the current
 * quarter for Operasional, Programming, Pemasaran, SDM and Keuangan (a mix of
 * on track / at risk / behind, one key result moving away from its start) and
 * closed objectives of the previous quarter with weekly check-ins. Content
 * adapted from the front-end prototype (features/okr). Rows are written
 * directly: no notifications. Upserts by (division, quarter, title) and
 * (objective, title); check-ins are only written for key results without any.
 */
class OkrDemoSeeder extends Seeder
{
    /**
     * [division code, owner email, title, description, key results]
     * key result: [title, unit, label, start, target, current, weight, owner email, link tasks]
     *
     * @var list<array{0: string, 1: string, 2: string, 3: string|null, 4: list<array{0: string, 1: KeyResultUnit, 2: string, 3: float, 4: float, 5: float, 6: int, 7: string, 8?: int}>}>
     */
    private const array CURRENT = [
        ['OPS', 'kadiv@demo.test', 'Migrasi sistem gudang selesai tanpa insiden kritis', 'Fokus kuartal: UAT tuntas, bug kritis nol, dan semua staf gudang terlatih sebelum sistem lama dimatikan.', [
            ['Skenario UAT lulus sebelum go-live', KeyResultUnit::Number, 'skenario', 140, 190, 148, 40, 'sari.wulandari@demo.test', 3],
            ['Bug kritis terbuka di produksi', KeyResultUnit::Number, 'bug', 2, 0, 3, 30, 'anggota@demo.test', 2],
            ['Staf gudang selesai pelatihan', KeyResultUnit::Number, 'orang', 3, 8, 3, 30, 'nadia.putri@demo.test', 1],
        ]],
        ['OPS', 'kadiv@demo.test', 'Proses kerja internal lebih cepat dan tercatat', 'Semua pekerjaan tim tercatat di RuangKerja agar lead time bisa diukur.', [
            ['Median lead time tugas', KeyResultUnit::Days, '', 6.5, 4, 6.2, 50, 'kadiv@demo.test'],
            ['Tugas tim tercatat di RuangKerja', KeyResultUnit::Percent, '', 70, 95, 74, 50, 'anggota@demo.test'],
        ]],
        ['PRG', 'yudi.hartono@demo.test', 'Kualitas rilis aplikasi klien naik', null, [
            ['Cakupan test Aplikasi Koperasi', KeyResultUnit::Percent, '', 48, 70, 50, 40, 'programmer@demo.test', 2],
            ['Bug terbuka lintas proyek', KeyResultUnit::Number, 'bug', 14, 4, 19, 30, 'yudi.hartono@demo.test'],
            ['PR direview kurang dari 1 hari', KeyResultUnit::Percent, '', 60, 90, 58, 30, 'programmer@demo.test'],
        ]],
        ['PMS', 'putri.ramadhani@demo.test', 'Pipeline prospek baru untuk 2027', null, [
            ['Prospek baru masuk', KeyResultUnit::Number, 'prospek', 0, 30, 7, 50, 'putri.ramadhani@demo.test'],
            ['Konten terbit', KeyResultUnit::Number, 'konten', 0, 48, 3, 30, 'maya.lestari@demo.test'],
            ['Tender dimenangkan', KeyResultUnit::Number, 'tender', 0, 2, 0, 20, 'rendi.oktavian@demo.test'],
        ]],
        ['SDM', 'hr@demo.test', 'Administrasi SDM tepat waktu', null, [
            ['Waktu rekap payroll bulanan', KeyResultUnit::Number, 'menit', 90, 30, 85, 50, 'lukman.hidayat@demo.test'],
            ['Karyawan absen lewat RuangKerja', KeyResultUnit::Percent, '', 80, 95, 92, 50, 'hr@demo.test'],
        ]],
        ['KEU', 'agus.setiawan@demo.test', 'Anggaran 2027 disahkan tepat waktu', null, [
            ['Divisi yang menyerahkan RAB', KeyResultUnit::Number, 'divisi', 0, 6, 1, 60, 'fitri.handayani@demo.test'],
            ['Selisih realisasi anggaran', KeyResultUnit::Percent, '', 12, 5, 11, 40, 'agus.setiawan@demo.test'],
        ]],
    ];

    /**
     * @var list<array{0: string, 1: string, 2: string, 3: string|null, 4: list<array{0: string, 1: KeyResultUnit, 2: string, 3: float, 4: float, 5: float, 6: int, 7: string}>}>
     */
    private const array PREVIOUS = [
        ['OPS', 'kadiv@demo.test', 'RuangKerja dipakai seluruh kantor', 'Fase 1 RuangKerja dirilis bertahap ke semua divisi.', [
            ['Karyawan aktif mingguan', KeyResultUnit::Percent, '', 0, 95, 92, 60, 'kadiv@demo.test'],
            ['Modul Fase 1 dirilis', KeyResultUnit::Number, 'modul', 0, 8, 7, 40, 'anggota@demo.test'],
        ]],
        ['PRG', 'yudi.hartono@demo.test', 'Sprint Aplikasi Koperasi sesuai rencana', null, [
            ['Poin sprint selesai', KeyResultUnit::Number, 'poin', 0, 240, 168, 70, 'yudi.hartono@demo.test'],
            ['Demo sprint diterima klien', KeyResultUnit::Number, 'demo', 0, 6, 4, 30, 'programmer@demo.test'],
        ]],
        ['PMS', 'putri.ramadhani@demo.test', 'Rebranding SPKD', null, [
            ['Alternatif logo siap dipilih', KeyResultUnit::Number, 'konsep', 0, 3, 3, 40, 'putri.ramadhani@demo.test'],
            ['Halaman website baru selesai', KeyResultUnit::Number, 'halaman', 0, 12, 8, 60, 'maya.lestari@demo.test'],
        ]],
    ];

    private const array NOTES = [
        'Sesuai rencana minggu ini.',
        'Sedikit tertahan menunggu data dari divisi lain.',
        'Ada percepatan setelah tim ditambah.',
        null,
        'Perlu perhatian di minggu depan.',
    ];

    public function run(): void
    {
        $today = OfficeTime::today();
        $current = Quarter::of($today);

        /** @var array<string, Division> $divisions */
        $divisions = Division::query()->get()->keyBy('code')->all();
        /** @var array<string, User> $users */
        $users = User::query()->where('email', 'like', '%@demo.test')->get()->keyBy('email')->all();

        foreach (self::CURRENT as $definition) {
            $this->objective($definition, $current, ObjectiveStatus::Active, $today, $divisions, $users);
        }

        foreach (self::PREVIOUS as $definition) {
            $this->objective($definition, $current->previous(), ObjectiveStatus::Closed, $today, $divisions, $users);
        }
    }

    /**
     * @param  array{0: string, 1: string, 2: string, 3: string|null, 4: list<array{0: string, 1: KeyResultUnit, 2: string, 3: float, 4: float, 5: float, 6: int, 7: string, 8?: int}>}  $definition
     * @param  array<string, Division>  $divisions
     * @param  array<string, User>  $users
     */
    private function objective(array $definition, Quarter $quarter, ObjectiveStatus $status, CarbonImmutable $today, array $divisions, array $users): void
    {
        [$code, $ownerEmail, $title, $description, $keyResults] = $definition;
        $division = $divisions[$code] ?? null;
        $owner = $users[$ownerEmail] ?? null;

        if ($division === null || $owner === null) {
            return;
        }

        $objective = Objective::withTrashed()->firstOrNew([
            'division_id' => $division->id,
            'quarter' => $quarter->key(),
            'title' => $title,
        ]);
        $objective->forceFill([
            'company_id' => $division->company_id,
            'description' => $description,
            'owner_id' => $owner->id,
            'status' => $status,
            'closed_at' => $status === ObjectiveStatus::Closed ? ($objective->closed_at ?? $quarter->end()->setTime(17, 0)) : null,
            'deleted_at' => null,
        ])->save();

        $tasks = $this->divisionTasks($division);

        foreach ($keyResults as $position => $row) {
            [$krTitle, $unit, $label, $start, $target, $value, $weight, $krOwnerEmail] = $row;
            $krOwner = $users[$krOwnerEmail] ?? $owner;

            $keyResult = KeyResult::query()->firstOrNew(['objective_id' => $objective->id, 'title' => $krTitle]);
            $keyResult->forceFill([
                'unit' => $unit,
                'unit_label' => $label,
                'start_value' => $start,
                'target_value' => $target,
                'current_value' => $value,
                'weight' => $weight,
                'owner_id' => $krOwner->id,
                'position' => $position + 1,
            ])->save();

            if (! $keyResult->checkins()->exists()) {
                $this->checkins($keyResult, $quarter, $today, $start, $value, $krOwner, $status === ObjectiveStatus::Closed);
            }

            $links = $row[8] ?? 0;

            if ($links > 0 && $tasks !== []) {
                $offset = ($position * 2) % count($tasks);
                $ids = array_slice([...array_slice($tasks, $offset), ...array_slice($tasks, 0, $offset)], 0, $links);
                $keyResult->tasks()->syncWithoutDetaching(array_fill_keys($ids, ['linked_by' => $owner->id, 'created_at' => now()]));
            }
        }
    }

    /**
     * Weekly Friday check-ins easing from the start value to the current one
     * (the last equals the current value). Running quarter: the Fridays that
     * have passed (at least one, on the first day of the quarter).
     */
    private function checkins(KeyResult $keyResult, Quarter $quarter, CarbonImmutable $today, float $start, float $end, User $author, bool $closed): void
    {
        $dates = [];
        $friday = CarbonImmutable::parse($quarter->start()->toDateString())->next(CarbonImmutable::FRIDAY);
        $last = $closed ? CarbonImmutable::parse($quarter->end()->toDateString()) : $today->subDay();

        while ($friday->lessThanOrEqualTo($last)) {
            $dates[] = $friday->toDateString();
            $friday = $friday->addWeek();
        }

        if ($dates === []) {
            $dates[] = $quarter->start()->toDateString();
        }

        $count = count($dates);
        $decimals = fmod($end, 1.0) !== 0.0 || fmod($start, 1.0) !== 0.0 ? 1 : 0;

        foreach ($dates as $index => $date) {
            $t = ($index + 1) / $count;
            $eased = 1 - (1 - $t) ** 1.6;
            $wiggle = $index === $count - 1 ? 0 : sin($index * 1.7) * 0.04;
            $value = $index === $count - 1 ? $end : round($start + ($end - $start) * ($eased + $wiggle), $decimals);

            (new KeyResultCheckin)->forceFill([
                'key_result_id' => $keyResult->id,
                'value' => $value,
                'confidence' => 6 + (($index * 3) % 4),
                'note' => $count === 1 ? 'Check-in pertama kuartal.' : self::NOTES[$index % count(self::NOTES)],
                'author_id' => $author->id,
                'checked_on' => $date,
                'created_at' => CarbonImmutable::parse($date.' 16:00', OfficeTime::zone())->utc(),
            ])->save();
        }
    }

    /**
     * Open tasks of the division's workspaces (division, teams, primary projects), oldest first.
     *
     * @return list<string>
     */
    private function divisionTasks(Division $division): array
    {
        $workspaces = Workspace::query()
            ->where('type', '!=', WorkspaceType::Personal->value)
            ->where(fn ($query) => $query->where('division_id', $division->id)
                ->orWhereIn('team_id', Team::query()->where('division_id', $division->id)->select('id')))
            ->select('id');

        return array_values(Task::query()
            ->whereIn('workspace_id', $workspaces)
            ->whereNull('parent_id')
            ->orderBy('workspace_id')
            ->orderBy('number')
            ->limit(12)
            ->pluck('id')
            ->map(fn (mixed $id): string => (string) $id)
            ->all());
    }
}
