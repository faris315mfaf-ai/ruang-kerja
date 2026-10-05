<?php

/*
|--------------------------------------------------------------------------
| Requests & approvals (Pengajuan)
|--------------------------------------------------------------------------
|
| See docs/PRD.md M2, docs/ARCHITECTURE.md §3.4 and docs/sprints/sprint-4/PLAN.md.
|
*/

return [

    'attachments' => [
        // Private disk; files are only served through the request policy.
        'disk' => env('REQUEST_ATTACHMENT_DISK', 'local'),
        'directory' => 'request-attachments',
        'max_kilobytes' => 5120,
        'max_files' => 5,
        'mimes' => ['pdf', 'jpg', 'jpeg', 'png'],
    ],

    'reason_max_length' => 500,

    // Fallback approver roles (in order) when every planned step was skipped.
    'fallback_roles' => ['hr', 'direksi', 'super_admin'],

];
