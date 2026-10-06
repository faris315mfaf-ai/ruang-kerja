<?php

namespace App\Policies;

use App\Domain\Organization\Enums\Role;
use App\Models\User;
use Illuminate\Auth\Access\Response;

/**
 * "Kinerja saya" (/kinerja, /kinerja/{user}; F2-4). There is no model behind
 * the page, so this is registered as the `viewPerformance` gate
 * (AutomationServiceProvider). PRD §9 "karyawan bisa melihat data dirinya":
 *
 * - everyone sees their own page;
 * - the direct manager (users.manager_id) and HR see an employee's page;
 * - nobody else — not Direksi, Kepala Divisi of another line, Super Admin.
 *
 * Denied → 404 (the person's existence is not confirmed).
 */
class PerformancePolicy
{
    public function view(User $viewer, User $subject): Response
    {
        if (! $viewer->isActive() || $viewer->company_id !== $subject->company_id) {
            return Response::denyAsNotFound();
        }

        if ($viewer->is($subject)) {
            return Response::allow();
        }

        $allowed = $subject->manager_id === $viewer->id || $viewer->hasRole(Role::Hr);

        return $allowed ? Response::allow() : Response::denyAsNotFound();
    }
}
