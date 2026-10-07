<?php

namespace Database\Seeders;

use App\Domain\Notes\Enums\NoteAccess;
use App\Domain\Notes\Enums\NoteKind;
use App\Domain\Notes\Enums\NoteShareRole;
use App\Domain\Tasks\Services\Lexorank;
use App\Domain\Tasks\Services\RichText;
use App\Models\Note;
use App\Models\NoteShare;
use App\Models\NoteVersion;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Demo Catatan bersama (local/testing, idempotent; F2-2): SOPs, wiki pages
 * and light minutes in the demo workspaces (SDM, OPS, GDG, PLQ, PRG), a
 * folder with a draft in Dimas' personal workspace, a
 * version history on the onboarding SOP and one "restricted" note in OPS
 * shared with HR only. Content adapted from the front-end prototype. Rows
 * are written directly (no Yjs state: the collab server builds the document
 * from `content` on first open), no notifications.
 */
class NoteDemoSeeder extends Seeder
{
    /** Persona → demo account. */
    private const array PEOPLE = [
        'dimas' => 'kadiv@demo.test',
        'hana' => 'hr@demo.test',
        'dewi' => 'dewi.kartika@demo.test',
        'sari' => 'sari.wulandari@demo.test',
        'rizky' => 'anggota@demo.test',
        'maya' => 'maya.lestari@demo.test',
        'arif' => 'programmer@demo.test',
        'hendra' => 'direksi@demo.test',
    ];

    /** @var array<string, User> */
    private array $people = [];

    public function run(): void
    {
        $this->people = User::query()->whereIn('email', array_values(self::PEOPLE))->get()->keyBy('email')
            ->mapWithKeys(fn (User $user): array => [(string) array_search($user->email, self::PEOPLE, true) => $user])
            ->all();

        if (! isset($this->people['dimas'], $this->people['hana'])) {
            return;
        }

        $sdm = $this->workspace('SDM');
        $ops = $this->workspace('OPS');
        $gdg = $this->workspace('GDG');
        $plq = $this->workspace('PLQ');
        $prg = $this->workspace('PRG');

        if ($sdm !== null) {
            $onboarding = $this->note($sdm, null, 'SOP Onboarding Karyawan Baru', self::onboarding(3), 'hana', 0, '10:12');
            $this->versions($onboarding, [
                [-14, '10:00', 'SOP Onboarding', self::onboarding(1), 'hana'],
                [-3, '14:25', 'SOP Onboarding Karyawan Baru', self::onboarding(2), 'dewi'],
            ]);
            $this->share($onboarding, ['hendra' => NoteShareRole::View]);

            $this->note($sdm, $onboarding, 'Checklist hari pertama', self::doc(self::tasks([true, 'Kartu akses aktif'], [true, 'Laptop terpasang'], [false, 'Foto profil di RuangKerja'])), 'dewi', -1, '15:30');
            $this->note($sdm, $onboarding, 'Pembuatan akun & akses sistem', self::doc(
                self::p('Urutan pembuatan akun untuk karyawan baru.'),
                self::ol('Google Workspace (oleh Super Admin)', 'RuangKerja: HR menambah karyawan', 'Workspace divisi tersinkron otomatis'),
            ), 'hana', -3, '11:00');
            $this->note($sdm, null, 'Kebijakan WFH & hybrid', self::doc(
                self::p('Karyawan hybrid boleh WFH maksimal 2 hari per minggu sesuai jadwal shift.'),
                self::ul('Check-in WFH tetap memakai selfie', 'Wajib catatan aktivitas harian'),
            ), 'hana', -7, '09:30');
        }

        if ($ops !== null) {
            $receiving = $this->note($ops, null, 'SOP Penerimaan Barang', self::doc(
                self::p('Langkah penerimaan barang di gudang Cikarang. Revisi dibahas di rapat mingguan.'),
                self::ol('Cocokkan surat jalan dengan PO', 'Periksa kondisi fisik barang', 'Input ke sistem stok sebelum pukul 16.00'),
            ), 'dimas', -1, '16:40');
            $this->note($ops, $receiving, 'Format surat jalan', self::doc(
                self::p('Nomor surat jalan: SJ/OPS/2026/10/0001. Wajib cap vendor dan tanda tangan sopir.'),
            ), 'rizky', -4, '14:20');
            $this->note($ops, null, 'Notulen rapat mingguan 28 Sep', self::doc(
                self::h(2, 'Keputusan'),
                self::ul('Stok opname dipercepat ke 2 Oktober', 'Armada peluncuran: 4 truk'),
                self::h(2, 'Tindak lanjut'),
                self::tasks([true, 'Sari: jadwal stok opname'], [false, 'Rizky: konfirmasi vendor panggung']),
            ), 'dimas', -7, '11:30');

            // Only Dimas and the invited HR lead see this one (not the division, not Direksi).
            $review = $this->note($ops, null, 'Catatan evaluasi tim (terbatas)', self::doc(
                self::p('Bahan diskusi penilaian kinerja kuartal III bersama HR. Jangan dibagikan ke tim.'),
                self::ul('Rencana pengembangan untuk dua staf baru', 'Usulan rotasi shift gudang'),
            ), 'dimas', -2, '17:05', NoteAccess::Restricted);
            $this->share($review, ['hana' => NoteShareRole::View]);
        }

        if ($gdg !== null) {
            $this->note($gdg, null, 'Panduan shift gudang', self::doc(
                self::p('Shift pagi 06.00–14.00, shift malam 22.00–06.00. Tukar shift diajukan lewat Pengajuan.'),
            ), 'sari', -2, '08:00');
        }

        if ($plq !== null) {
            $brief = $this->note($plq, null, 'Brief peluncuran Q4', self::doc(
                self::p('Peluncuran produk baru pada 27 Oktober 2026 di Jakarta Convention Center.'),
                self::h(2, 'Target'),
                self::ul('200 tamu undangan', 'Liputan 15 media', '1.000 pendaftar demo dalam seminggu'),
            ), 'maya', 0, '09:05');
            $this->note($plq, $brief, 'Notulen kickoff 7 Sep', self::doc(
                self::p('Hadir: Hendra, Putri, Dimas, Maya, Rizky.'),
                self::ul('Anggaran disetujui dengan catatan', 'PIC logistik: Dimas'),
            ), 'maya', -28, '15:00');
        }

        // Personal workspace of Dimas: a folder with a private draft.
        $personal = Workspace::query()->where('type', 'personal')->where('owner_id', $this->people['dimas']->id)->first();

        if ($personal !== null) {
            $folder = $this->folder($personal, 'Ide & draf', 'dimas');
            $this->note($personal, $folder, 'Draf sambutan peluncuran', self::doc(
                self::p('Poin sambutan untuk pembukaan acara peluncuran Q4.'),
                self::ul('Terima kasih kepada tim lintas divisi', 'Target 200 tamu dan 15 media', 'Ajakan mencoba demo produk'),
            ), 'dimas', -1, '20:15');
        }

        if ($prg !== null && isset($this->people['arif'])) {
            $this->note($prg, null, 'Panduan rilis aplikasi', self::doc(
                self::p('Rilis dilakukan Selasa dan Kamis setelah CI hijau.'),
                self::ol('Gabungkan PR ke main', 'Tunggu deploy otomatis', 'Cek /health dan log galat 15 menit'),
            ), 'arif', -5, '13:10');
        }
    }

    private function workspace(string $key): ?Workspace
    {
        return Workspace::query()->where('key', $key)->first();
    }

    /**
     * @param  array<string, mixed>  $content
     */
    private function note(Workspace $workspace, ?Note $parent, string $title, array $content, string $by, int $days, string $time, NoteAccess $access = NoteAccess::Workspace): Note
    {
        $author = $this->people[$by] ?? $this->people['dimas'];
        $at = self::at($days, $time);
        $note = Note::query()->firstOrNew(['workspace_id' => $workspace->id, 'title' => $title]);

        if (! $note->exists) {
            $last = Note::query()->where('workspace_id', $workspace->id)->where('parent_id', $parent?->id)->orderByDesc('position')->value('position');
            $note->forceFill([
                'company_id' => $workspace->company_id,
                'parent_id' => $parent?->id,
                'access' => $access,
                'content' => $content,
                'content_text' => (string) RichText::toText($content),
                'created_by' => $author->id,
                'updated_by' => $author->id,
                'position' => Lexorank::between(is_string($last) ? $last : null, null),
                'created_at' => $at->subDays(30),
                'updated_at' => $at,
            ]);
            $note->timestamps = false;
            $note->save();
            $note->timestamps = true;
        }

        return $note;
    }

    private function folder(Workspace $workspace, string $title, string $by): Note
    {
        $author = $this->people[$by] ?? $this->people['dimas'];
        $folder = Note::query()->firstOrNew(['workspace_id' => $workspace->id, 'title' => $title]);

        if (! $folder->exists) {
            $folder->forceFill([
                'company_id' => $workspace->company_id,
                'kind' => NoteKind::Folder,
                'access' => NoteAccess::Workspace,
                'content_text' => '',
                'created_by' => $author->id,
                'updated_by' => $author->id,
                'position' => Lexorank::between(null, null),
            ])->save();
        }

        return $folder;
    }

    /**
     * @param  list<array{0: int, 1: string, 2: string, 3: array<string, mixed>, 4: string}>  $versions
     */
    private function versions(Note $note, array $versions): void
    {
        if (NoteVersion::query()->where('note_id', $note->id)->exists()) {
            return;
        }

        foreach ($versions as [$days, $time, $title, $content, $by]) {
            NoteVersion::query()->create([
                'note_id' => $note->id,
                'title' => $title,
                'content' => $content,
                'created_by' => ($this->people[$by] ?? $this->people['dimas'])->id,
                'created_at' => self::at($days, $time),
            ]);
        }
    }

    /**
     * @param  array<string, NoteShareRole>  $people
     */
    private function share(Note $note, array $people): void
    {
        foreach ($people as $persona => $role) {
            if (isset($this->people[$persona])) {
                NoteShare::query()->firstOrCreate(
                    ['note_id' => $note->id, 'user_id' => $this->people[$persona]->id],
                    ['role' => $role],
                );
            }
        }
    }

    private static function at(int $days, string $time): CarbonImmutable
    {
        $zone = config()->string('app.office_timezone');

        return CarbonImmutable::parse(CarbonImmutable::now($zone)->addDays($days)->toDateString().' '.$time, $zone)->utc();
    }

    /**
     * @return array<string, mixed>
     */
    private static function onboarding(int $stage): array
    {
        if ($stage === 1) {
            return self::doc(
                self::p('Panduan untuk HR dan atasan saat menyambut karyawan baru.'),
                self::h(2, 'Sebelum hari pertama'),
                self::ul('Kirim surat penawaran yang sudah ditandatangani', 'Siapkan meja dan perangkat'),
            );
        }

        if ($stage === 2) {
            return self::doc(
                self::p('Panduan untuk HR dan atasan saat menyambut karyawan baru. Berlaku sejak Oktober 2026.'),
                self::h(2, 'Sebelum hari pertama'),
                self::ul('Kirim surat penawaran yang sudah ditandatangani', 'Siapkan meja, laptop, dan kartu akses', 'Daftarkan email di Google Workspace'),
                self::h(2, 'Hari pertama'),
                self::ol('Sambutan oleh atasan langsung', 'Tur kantor dan perkenalan tim'),
            );
        }

        return self::doc(
            self::p('Panduan untuk HR dan atasan langsung saat menyambut karyawan baru. Berlaku sejak ', ['type' => 'text', 'text' => '1 Oktober 2026', 'marks' => [['type' => 'bold']]], '.'),
            self::h(2, 'Sebelum hari pertama'),
            self::ul('Kirim surat penawaran yang sudah ditandatangani dan jadwal hari pertama', 'Siapkan meja, laptop, dan kartu akses lantai', 'Daftarkan email kantor di Google Workspace dan tambahkan ke RuangKerja'),
            self::h(2, 'Hari pertama'),
            self::ol('Sambutan oleh atasan langsung pukul 09.00', 'Tur kantor dan perkenalan dengan tim', 'Persetujuan data lokasi & selfie untuk absensi', 'Makan siang bersama buddy'),
            self::h(2, 'Minggu pertama'),
            self::tasks([true, 'Pelatihan K3 dasar'], [true, 'Akses workspace divisi dan tugas pertama'], [false, 'Evaluasi singkat bersama atasan di hari Jumat']),
            ['type' => 'blockquote', 'content' => [self::p('Tip: tunjuk satu buddy dari tim yang sama untuk dua minggu pertama.')]],
        );
    }

    /**
     * @param  array<string, mixed>  ...$content
     * @return array<string, mixed>
     */
    private static function doc(array ...$content): array
    {
        return ['type' => 'doc', 'content' => array_values($content)];
    }

    /**
     * @param  string|array<string, mixed>  ...$parts
     * @return array<string, mixed>
     */
    private static function p(string|array ...$parts): array
    {
        return ['type' => 'paragraph', 'content' => array_map(
            fn (string|array $part): array => is_string($part) ? ['type' => 'text', 'text' => $part] : $part,
            array_values($parts),
        )];
    }

    /**
     * @return array<string, mixed>
     */
    private static function h(int $level, string $text): array
    {
        return ['type' => 'heading', 'attrs' => ['level' => $level], 'content' => [['type' => 'text', 'text' => $text]]];
    }

    /**
     * @return array<string, mixed>
     */
    private static function ul(string ...$items): array
    {
        return ['type' => 'bulletList', 'content' => array_map(fn (string $item): array => ['type' => 'listItem', 'content' => [self::p($item)]], array_values($items))];
    }

    /**
     * @return array<string, mixed>
     */
    private static function ol(string ...$items): array
    {
        return ['type' => 'orderedList', 'content' => array_map(fn (string $item): array => ['type' => 'listItem', 'content' => [self::p($item)]], array_values($items))];
    }

    /**
     * @param  array{0: bool, 1: string}  ...$items
     * @return array<string, mixed>
     */
    private static function tasks(array ...$items): array
    {
        return ['type' => 'taskList', 'content' => array_map(
            fn (array $item): array => ['type' => 'taskItem', 'attrs' => ['checked' => $item[0]], 'content' => [self::p($item[1])]],
            array_values($items),
        )];
    }
}
