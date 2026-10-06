<?php

namespace App\Domain\Search\Providers;

use App\Domain\Organization\Enums\Role;
use App\Domain\Search\Contracts\SearchProvider;
use App\Domain\Search\Data\SearchResult;
use App\Models\User;
use Illuminate\Support\Str;

/**
 * "Aksi": quick actions and navigation (mirrors resources/js/lib/navigation.ts).
 * Quick actions appear on an empty query; everything matches by title/keywords.
 * Modules can append entries in config/search.php → actions.
 */
final class ActionsSearchProvider implements SearchProvider
{
    public function key(): string
    {
        return 'actions';
    }

    public function label(): string
    {
        return 'Aksi';
    }

    public function minQueryLength(): int
    {
        return 0;
    }

    public function search(User $viewer, string $query, int $limit): array
    {
        $needle = Str::lower(Str::ascii(trim($query)));
        $results = [];

        foreach ($this->entries() as $entry) {
            if (! $this->allowed($viewer, $entry['roles'] ?? [])) {
                continue;
            }

            if ($needle === '' ? ! ($entry['quick'] ?? false) : ! $this->matches($needle, $entry)) {
                continue;
            }

            $results[] = new SearchResult(
                id: 'action:'.$entry['id'],
                title: $entry['title'],
                icon: $entry['icon'],
                url: $entry['url'] ?? null,
                action: $entry['action'] ?? null,
                subtitle: $entry['subtitle'] ?? null,
                shortcut: $entry['shortcut'] ?? null,
            );

            if (count($results) >= $limit) {
                break;
            }
        }

        return $results;
    }

    /**
     * @return list<array{id: string, title: string, icon: string, url?: string, action?: string, subtitle?: string, shortcut?: string, keywords?: list<string>, roles?: list<string>, quick?: bool}>
     */
    private function entries(): array
    {
        $builtIn = [
            ['id' => 'check-in', 'title' => 'Check-in', 'icon' => 'log-in', 'url' => '/absensi', 'subtitle' => 'Buka halaman absensi', 'keywords' => ['absen', 'hadir', 'check-out', 'masuk', 'pulang'], 'quick' => true],
            ['id' => 'leave', 'title' => 'Buat pengajuan', 'icon' => 'calendar', 'url' => '/pengajuan/baru', 'keywords' => ['cuti', 'izin', 'sakit', 'lembur', 'pengajuan', 'barang', 'pembelian'], 'quick' => true],
            ['id' => 'new-task', 'title' => 'Buat tugas baru', 'icon' => 'plus', 'url' => '/tugas', 'shortcut' => 'C', 'keywords' => ['task', 'tugas'], 'quick' => true],
            ['id' => 'theme', 'title' => 'Ganti tema', 'icon' => 'sun-moon', 'action' => 'theme.toggle', 'keywords' => ['tema', 'gelap', 'terang', 'dark', 'light', 'mode'], 'quick' => true],
            ['id' => 'inbox', 'title' => 'Buka Inbox', 'icon' => 'inbox', 'url' => '/inbox', 'keywords' => ['notifikasi', 'pesan']],
            ['id' => 'my-tasks', 'title' => 'Tugas saya', 'icon' => 'circle-check', 'url' => '/tugas', 'keywords' => ['task']],
            ['id' => 'dashboard', 'title' => 'Dashboard', 'icon' => 'layout-grid', 'url' => '/dashboard', 'keywords' => ['beranda', 'ringkasan']],
            ['id' => 'attendance', 'title' => 'Absensi', 'icon' => 'map-pin', 'url' => '/absensi', 'keywords' => ['riwayat', 'kehadiran']],
            ['id' => 'requests', 'title' => 'Pengajuan saya', 'icon' => 'file-text', 'url' => '/pengajuan', 'keywords' => ['cuti', 'izin']],
            ['id' => 'approvals', 'title' => 'Persetujuan', 'icon' => 'check-check', 'url' => '/persetujuan', 'keywords' => ['approval', 'setujui']],
            // Keputusan pemilik 6 Okt 2026: laporan progres harian & pengumuman.
            ['id' => 'daily-report', 'title' => 'Tulis laporan hari ini', 'icon' => 'file-text', 'url' => '/laporan/hari-ini', 'keywords' => ['laporan', 'progres', 'harian', 'notulen', 'notulensi']],
            ['id' => 'reports', 'title' => 'Laporan harian', 'icon' => 'file-text', 'url' => '/laporan', 'keywords' => ['laporan', 'riwayat', 'tim']],
            ['id' => 'announcements', 'title' => 'Pengumuman', 'icon' => 'bell', 'url' => '/pengumuman', 'keywords' => ['info', 'kabar', 'berita']],
            ['id' => 'workspace', 'title' => 'Workspace', 'icon' => 'folder', 'url' => '/workspace', 'keywords' => ['proyek', 'tim', 'divisi']],
            ['id' => 'notification-settings', 'title' => 'Pengaturan notifikasi', 'icon' => 'bell', 'url' => '/pengaturan/notifikasi', 'keywords' => ['email', 'ringkasan', 'jam tenang']],
            ['id' => 'profile', 'title' => 'Profil saya', 'icon' => 'user', 'url' => '/settings/profile', 'keywords' => ['akun', 'nama', 'sandi']],
            ['id' => 'employees', 'title' => 'Karyawan', 'icon' => 'users', 'url' => '/admin/karyawan', 'keywords' => ['pegawai', 'admin'], 'roles' => [Role::SuperAdmin->value, Role::Hr->value]],
            ['id' => 'division-members', 'title' => 'Anggota divisi', 'icon' => 'users', 'url' => '/admin/karyawan', 'keywords' => ['tim', 'anggota'], 'roles' => [Role::KepalaDivisi->value]],
        ];

        /** @var list<array{id: string, title: string, icon: string, url?: string, action?: string, subtitle?: string, shortcut?: string, keywords?: list<string>, roles?: list<string>, quick?: bool}> $extra */
        $extra = config('search.actions', []);

        return [...$builtIn, ...$extra];
    }

    /**
     * @param  list<string>  $roles
     */
    private function allowed(User $viewer, array $roles): bool
    {
        return $roles === [] || $viewer->hasAnyRole($roles);
    }

    /**
     * @param  array{title: string, keywords?: list<string>}  $entry
     */
    private function matches(string $needle, array $entry): bool
    {
        $haystack = Str::lower(Str::ascii($entry['title'].' '.implode(' ', $entry['keywords'] ?? [])));

        foreach (preg_split('/\s+/', $needle) ?: [] as $word) {
            if ($word !== '' && ! str_contains($haystack, $word)) {
                return false;
            }
        }

        return true;
    }
}
