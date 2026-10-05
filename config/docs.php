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
*/

return [
    'groups' => [
        'start' => 'Mulai di sini',
        'product' => 'Produk & desain',
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
        'architecture' => ['path' => 'docs/ARCHITECTURE.md', 'title' => 'Arsitektur', 'group' => 'technical'],
        'database' => ['path' => 'docs/DATABASE.md', 'title' => 'Database', 'group' => 'technical'],
        'asvs-l1' => ['path' => 'docs/security/ASVS-L1.md', 'title' => 'OWASP ASVS L1', 'group' => 'security'],
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
