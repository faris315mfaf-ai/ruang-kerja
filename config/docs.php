<?php

/*
|--------------------------------------------------------------------------
| In-app documentation (Admin › Dokumentasi, Super Admin only)
|--------------------------------------------------------------------------
|
| The curated allowlist of repository Markdown files shown at
| /admin/dokumentasi. Requests only ever name a slug; the file path comes
| from this list, never from the URL. Paths are relative to base_path(), must
| end in .md and must resolve (realpath, symlinks followed) to a file inside
| the repository, otherwise the entry is skipped. Missing files are skipped
| too (e.g. docs/ is not deployed).
|
| `documents`: fixed entries (slug => path, title, group). `patterns`:
| glob() patterns (no **) for sprint summaries; their slug is derived from
| the path (docs/sprints/sprint-3/SUMMARY.md → sprints-sprint-3-summary) and
| the title from the first "# " heading.
|
| The `features` group is also readable by every employee at
| /pratinjau/panduan (prototype flag on; PrototypeGuideController), with its
| screenshots from docs/fitur/img.
|
*/

return [
    'groups' => [
        'start' => 'Mulai di sini',
        'product' => 'Produk & desain',
        'features' => 'Fitur & pratinjau',
        'technical' => 'Teknis',
        'security' => 'Keamanan',
        'sprints' => 'Riwayat sprint',
    ],

    'documents' => [
        'readme' => ['path' => 'README.md', 'title' => 'README', 'group' => 'start'],
        'handoff' => ['path' => 'docs/HANDOFF.md', 'title' => 'Serah terima', 'group' => 'start'],
        'critical' => ['path' => 'docs/CRITICAL.md', 'title' => 'Hal kritis & go-live', 'group' => 'start'],
        'changelog' => ['path' => 'docs/CHANGELOG.md', 'title' => 'Changelog', 'group' => 'start'],
        'setup-lokal' => ['path' => 'docs/SETUP-LOKAL.md', 'title' => 'Setup lokal', 'group' => 'start'],
        'prd' => ['path' => 'docs/PRD.md', 'title' => 'PRD', 'group' => 'product'],
        'design' => ['path' => 'docs/DESIGN.md', 'title' => 'Design system', 'group' => 'product'],
        'platform' => ['path' => 'docs/PLATFORM.md', 'title' => 'Desktop & mobile', 'group' => 'product'],
        'panduan-pratinjau' => ['path' => 'docs/fitur/PANDUAN-PRATINJAU.md', 'title' => 'Panduan pratinjau', 'group' => 'features'],
        'fitur' => ['path' => 'docs/fitur/README.md', 'title' => 'Pratinjau Fase 2 & 3', 'group' => 'features'],
        'fitur-obrolan' => ['path' => 'docs/fitur/obrolan.md', 'title' => 'Obrolan (F2-1)', 'group' => 'features'],
        'fitur-catatan' => ['path' => 'docs/fitur/catatan.md', 'title' => 'Catatan bersama (F2-2)', 'group' => 'features'],
        'fitur-rapat-kalender' => ['path' => 'docs/fitur/rapat-kalender.md', 'title' => 'Rapat, notulen & kalender (F2-3)', 'group' => 'features'],
        'fitur-rapat-video' => ['path' => 'docs/fitur/rapat-video.md', 'title' => 'Rapat video & notulen otomatis', 'group' => 'features'],
        'fitur-rapat-video-privasi' => ['path' => 'docs/fitur/rapat-video-privasi.md', 'title' => 'Rapat video: privasi & UU PDP', 'group' => 'features'],
        'fitur-otomasi-whatsapp' => ['path' => 'docs/fitur/otomasi-whatsapp.md', 'title' => 'Otomasi, WhatsApp & Kinerja (F2-4)', 'group' => 'features'],
        'fitur-aplikasi-ponsel' => ['path' => 'docs/fitur/aplikasi-ponsel.md', 'title' => 'Aplikasi ponsel (F3-1, F3-2)', 'group' => 'features'],
        'fitur-okr' => ['path' => 'docs/fitur/okr.md', 'title' => 'OKR divisi (F3-3)', 'group' => 'features'],
        'fitur-mesin-fingerprint' => ['path' => 'docs/fitur/mesin-fingerprint.md', 'title' => 'Mesin fingerprint ADMS (F3-3)', 'group' => 'features'],
        'fitur-dashboard-peran' => ['path' => 'docs/fitur/dashboard-peran.md', 'title' => 'Dashboard per jabatan SPKD', 'group' => 'features'],
        'fitur-laporan-harian' => ['path' => 'docs/fitur/laporan-harian.md', 'title' => 'Laporan progres harian', 'group' => 'features'],
        'fitur-pengumuman' => ['path' => 'docs/fitur/pengumuman.md', 'title' => 'Pengumuman', 'group' => 'features'],
        'fitur-staf' => ['path' => 'docs/fitur/staf-pengajuan-workspace.md', 'title' => 'Staf: pengajuan & workspace', 'group' => 'features'],
        'fitur-akun-kata-sandi' => ['path' => 'docs/fitur/akun-kata-sandi.md', 'title' => 'Akun & kata sandi', 'group' => 'features'],
        'fitur-hiring' => ['path' => 'docs/fitur/hiring.md', 'title' => 'Hiring (rekrutmen)', 'group' => 'features'],
        'fitur-dashboard-pimpinan' => ['path' => 'docs/fitur/dashboard-pimpinan.md', 'title' => 'Dashboard pimpinan & Absensi', 'group' => 'features'],
        'fitur-ekspor-struktur' => ['path' => 'docs/fitur/ekspor-struktur-organisasi.md', 'title' => 'Ekspor PNG struktur organisasi', 'group' => 'features'],
        'architecture' => ['path' => 'docs/ARCHITECTURE.md', 'title' => 'Arsitektur', 'group' => 'technical'],
        'database' => ['path' => 'docs/DATABASE.md', 'title' => 'Database', 'group' => 'technical'],
        'deploy-rapat-video' => ['path' => 'docs/deploy/RAPAT-VIDEO.md', 'title' => 'Operasional rapat video', 'group' => 'technical'],
        'asvs-l1' => ['path' => 'docs/security/ASVS-L1.md', 'title' => 'OWASP ASVS L1', 'group' => 'security'],
        'audit-rapat' => ['path' => 'docs/security/AUDIT-RAPAT-2026-10.md', 'title' => 'Audit rapat video 2026-10', 'group' => 'security'],
    ],

    'patterns' => [
        ['glob' => 'docs/sprints/*/*SUMMARY*.md', 'group' => 'sprints'],
        ['glob' => 'docs/sprints/*/REVIEW-FIXES*.md', 'group' => 'sprints'],
        ['glob' => 'docs/sprints/REVIEW-FIXES*.md', 'group' => 'sprints'],
        ['glob' => 'docs/sprints/FITUR-*.md', 'group' => 'sprints'],
    ],

    // Rendered HTML is cached per file (keyed by path, size and mtime).
    'cache_ttl_seconds' => 86400,
];
