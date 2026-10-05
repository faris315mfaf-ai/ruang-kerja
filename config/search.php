<?php

use App\Domain\Search\Providers\ActionsSearchProvider;
use App\Domain\Search\Providers\PeopleSearchProvider;
use App\Domain\Search\Providers\TaskSearchProvider;
use App\Domain\Search\Providers\WorkspaceSearchProvider;

return [

    /*
    |--------------------------------------------------------------------------
    | Search providers (command palette ⌘K and the mobile /cari screen)
    |--------------------------------------------------------------------------
    |
    | Each class implements App\Domain\Search\Contracts\SearchProvider and
    | returns ONLY records the viewer may see. Order here = group order
    | (DESIGN.md: Aksi · Tugas · Orang · Workspace · Dokumen). Modules insert
    | their provider at the right position with one line, e.g.
    | TaskSearchProvider::class after ActionsSearchProvider::class.
    |
    */

    'providers' => [
        ActionsSearchProvider::class,
        TaskSearchProvider::class,
        PeopleSearchProvider::class,
        WorkspaceSearchProvider::class,
    ],

    // Results per group when searching all groups ("Semua").
    'limit' => 5,

    // Results when one group is selected (mobile filter chip).
    'group_limit' => 20,

    /*
    |--------------------------------------------------------------------------
    | Extra actions
    |--------------------------------------------------------------------------
    |
    | Appended to the built-in "Aksi" entries. Shape:
    | ['id' => 'new-request', 'title' => 'Ajukan lembur', 'icon' => 'clock',
    |  'url' => '/pengajuan/baru?jenis=lembur', 'keywords' => ['overtime'],
    |  'roles' => [], 'quick' => false]
    |
    */

    'actions' => [],

];
