<?php

namespace Database\Seeders;

use App\Domain\Analytics\Data\Period;
use App\Domain\Tasks\Services\Lexorank;
use App\Models\ManagementNote;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Demo "catatan tindakan" (local/testing only, idempotent; keputusan pemilik
 * 6 Okt 2026): a few private action notes for the Direksi and HR demo
 * accounts so the Direksi dashboard and /manajemen are not empty. Skipped
 * for a user who already has notes. Daily reports come from the Laporan
 * module's own seeder.
 */
class MonitoringDemoSeeder extends Seeder
{
    /** @var array<string, list<array{0: string, 1: int|null, 2: bool}>> body, due in days (null = none), done */
    private const array NOTES = [
        'direksi@demo.test' => [
            ['Putuskan vendor katering acara peluncuran', 2, false],
            ['Minta update proyek yang berisiko dari PIC', 0, false],
            ['Tinjau anggaran Q4 bersama Keuangan', 7, false],
            ['Cek laporan harian tim yang belum lapor 3 hari', null, false],
            ['Tanda tangani kontrak sewa gudang', -2, true],
        ],
        'hr@demo.test' => [
            ['Siapkan jadwal wawancara kandidat staf gudang', 3, false],
            ['Ingatkan kepala divisi soal lupa check-out berulang', 1, false],
        ],
    ];

    public function run(): void
    {
        $today = Period::officeDate(CarbonImmutable::now());

        foreach (self::NOTES as $email => $notes) {
            $user = User::query()->where('email', $email)->first();

            if ($user === null || ManagementNote::query()->ownedBy($user)->exists()) {
                continue;
            }

            $positions = Lexorank::sequence(count($notes));

            foreach ($notes as $index => [$body, $due, $done]) {
                ManagementNote::query()->create([
                    'company_id' => $user->company_id,
                    'user_id' => $user->id,
                    'body' => $body,
                    'due_on' => $due === null ? null : $today->addDays($due)->toDateString(),
                    'done_at' => $done ? CarbonImmutable::now()->subDay() : null,
                    'position' => $positions[$index],
                ]);
            }
        }
    }
}
