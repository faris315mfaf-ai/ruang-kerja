<?php

namespace App\Http\Resources\Api;

use App\Http\Presenters\RequestPresenter;
use App\Models\EmployeeRequest;
use App\Models\User;
use Illuminate\Support\Facades\Gate;

/**
 * Request detail of the mobile app (Pengajuan saya + Persetujuan): the web
 * detail presenter verbatim — approval timeline per round/step, payload per
 * type, colleagues absent, cancellation, HR's cancel preview, sick-leave
 * details hidden from substitute approvers — with three API changes:
 *
 * - attachment `url` points at the API stream (Bearer) instead of the web route;
 * - `can` gains the app's buttons (submit/resubmit/delete/attach/approve/
 *   reject/revise) next to the web ones;
 * - staff never get a `balance` key at all (keputusan pemilik 6 Okt 2026;
 *   the web sends null), and editable requests carry their `form` values.
 */
final class RequestDetail
{
    public function __construct(private readonly RequestPresenter $presenter) {}

    /**
     * @return array<string, mixed>
     */
    public function make(EmployeeRequest $request, User $viewer): array
    {
        $detail = $this->presenter->detail($request, $viewer);
        $gate = Gate::forUser($viewer);

        $detail['attachments'] = array_map(fn (array $attachment): array => [
            ...$attachment,
            'url' => route('api.v1.requests.attachments.show', ['employeeRequest' => $request->id, 'attachment' => $attachment['id']]),
        ], is_array($detail['attachments']) ? $detail['attachments'] : []);

        if ($viewer->isStaffOnly()) {
            unset($detail['balance']);
        }

        $can = is_array($detail['can']) ? $detail['can'] : [];
        $edit = (bool) ($can['edit'] ?? false);
        $decide = (bool) ($can['decide'] ?? false);
        $draft = $request->status->value === 'draft';

        $detail['can'] = [
            ...$can,
            'submit' => $edit && $draft,
            'resubmit' => $edit && ! $draft,
            'delete' => $gate->allows('delete', $request),
            'attach' => $edit,
            'approve' => $decide,
            'reject' => $decide,
            'revise' => $decide,
        ];
        $detail['form'] = $edit ? RequestFormValues::of($request) : null;

        return $detail;
    }
}
