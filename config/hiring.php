<?php

return [

    /*
    | Days applicant data is kept (keputusan pemilik 6 Okt 2026, UU PDP):
    | counted from the final decision (Diterima / Ditolak), from HR deleting
    | the candidate, or from the position being closed for undecided
    | candidates. After that the candidate and everything attached to it
    | (checklist, answers, points, notes, decisions, notifications) is
    | deleted permanently by PurgeExpiredApplicantData (daily).
    */
    'retention_days' => (int) env('HIRING_RETENTION_DAYS', 30),

];
