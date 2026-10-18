<?php

namespace App\Http\Controllers\Api\Reports;

use App\Domain\Monitoring\Queries\DailyWorkMonitor;
use App\Domain\Reports\Services\ReportReaders;
use App\Domain\Reports\Support\ReportDay;
use App\Domain\Tenancy\Support\CurrentCompany;
use App\Http\Controllers\Controller;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Laporan tim of the Android app (Bagian 4 / B4-C): the daily reports of one
 * office date of everyone the viewer reads (ReportReaders — direct reports,
 * the divisions a Kepala Divisi leads, everyone for Direksi / HR / Super
 * Admin; never the viewer), counted against the schedule by the web work
 * monitoring query (DailyWorkMonitor). Drafts are only counted / flagged,
 * their content is never sent; task titles only for tasks the viewer may see.
 * A viewer who reads nobody gets 403. Contract: docs/sesi/ponsel-b4c-laporan.md.
 */
class TeamReportController extends Controller
{
    public function __invoke(Request $request, #[CurrentUser] User $user, ReportReaders $readers, DailyWorkMonitor $monitor): JsonResponse
    {
        $people = $readers->readableUsers($user);

        if (! $people->exists()) {
            return response()->json(['message' => 'Anda tidak membaca laporan harian orang lain.'], 403);
        }

        $today = ReportDay::today();
        $date = $request->query('tanggal');

        if ($date === null || $date === '') {
            $date = $today;
        }

        if (! is_string($date) || ! ReportDay::isDate($date) || ! checkdate((int) substr($date, 5, 2), (int) substr($date, 8, 2), (int) substr($date, 0, 4)) || $date > $today) {
            $message = 'Tanggal harus berformat YYYY-MM-DD dan tidak melewati hari ini.';

            return response()->json(['message' => $message, 'errors' => ['tanggal' => [$message]]], 422);
        }

        $users = $people->with('division:id,name')->orderBy('name')->get();
        $now = CarbonImmutable::now();

        return response()->json($monitor->for(
            $user,
            $users,
            CarbonImmutable::parse($date, CurrentCompany::timezone()),
            $now,
        ));
    }
}
