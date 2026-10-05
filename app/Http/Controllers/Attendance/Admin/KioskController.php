<?php

namespace App\Http\Controllers\Attendance\Admin;

use App\Domain\Attendance\Actions\DeleteKiosk;
use App\Domain\Attendance\Actions\IssueKioskActivation;
use App\Domain\Attendance\Actions\SaveKiosk;
use App\Domain\Attendance\Models\Kiosk;
use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\KioskRequest;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Admin › Lokasi & shift › Kiosk QR (HR, Super Admin).
 */
class KioskController extends Controller
{
    public function store(KioskRequest $request, #[CurrentUser] User $user, SaveKiosk $save): RedirectResponse
    {
        Gate::authorize('create', Kiosk::class);

        $kiosk = $save->handle($user, $request->attributesForAction());

        Inertia::flash('toast', ['type' => 'success', 'message' => "Kiosk {$kiosk->name} ditambahkan. Buat tautan aktivasi untuk perangkatnya."]);

        return back();
    }

    public function update(KioskRequest $request, Kiosk $kiosk, #[CurrentUser] User $user, SaveKiosk $save): RedirectResponse
    {
        Gate::authorize('update', $kiosk);

        $save->handle($user, $request->attributesForAction(), $kiosk);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Kiosk disimpan.']);

        return back();
    }

    /**
     * JSON: the plain link and pairing code are shown to HR once and never
     * stored. The code is typed on the device's /kiosk screen instead of
     * opening the link.
     */
    public function activation(Kiosk $kiosk, IssueKioskActivation $issue): JsonResponse
    {
        Gate::authorize('activate', $kiosk);

        $activation = $issue->handle($kiosk);

        return response()->json([
            'url' => route('kiosk.activate.show', ['token' => $activation['token']]),
            'code' => $activation['code'],
            'pairUrl' => route('kiosk.unpaired'),
            'expiresAt' => $activation['expires_at']->toIso8601ZuluString(),
        ])->header('Cache-Control', 'no-store');
    }

    public function destroy(Kiosk $kiosk, DeleteKiosk $delete): RedirectResponse
    {
        Gate::authorize('delete', $kiosk);

        $delete->handle($kiosk);

        Inertia::flash('toast', ['type' => 'success', 'message' => "Kiosk {$kiosk->name} dihapus."]);

        return back();
    }
}
