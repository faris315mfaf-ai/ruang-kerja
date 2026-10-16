<?php

namespace App\Http\Controllers\Api\Hiring;

use App\Domain\Hiring\Actions\SaveHiringSettings;
use App\Domain\Hiring\Enums\ReviewerRole;
use App\Domain\Hiring\Queries\HiringPeople;
use App\Http\Controllers\Controller;
use App\Http\Requests\Hiring\SettingsRequest;
use App\Models\HiringSetting;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * Hiring › Pengaturan (HR & Super Admin): default final approvers copied to
 * new positions and the checklist template per reviewer role. Reviewers get
 * 403, everyone else 404 (HiringSettingPolicy).
 */
class SettingsController extends Controller
{
    public function __construct(private readonly HiringPeople $people) {}

    /**
     * GET /hiring/pengaturan
     */
    public function show(#[CurrentUser] User $user): JsonResponse
    {
        Gate::authorize('view', HiringSetting::class);

        return response()->json($this->payload($user));
    }

    /**
     * PUT /hiring/pengaturan {default_final_approver_ids: [...], checklist_template: {hr, interviewer, approver}}
     */
    public function update(SettingsRequest $request, #[CurrentUser] User $user, SaveHiringSettings $save): JsonResponse
    {
        Gate::authorize('update', HiringSetting::class);

        $save->handle($user, [
            'default_final_approver_ids' => $request->approverIds(),
            'checklist_template' => $request->template(),
        ]);

        return response()->json(['message' => 'Pengaturan hiring disimpan.', ...$this->payload($user)]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(User $user): array
    {
        $setting = HiringSetting::forCompany($user->company_id);
        $people = $this->people->byId($setting->default_final_approver_ids);

        return [
            'settings' => [
                'default_final_approver_ids' => $setting->default_final_approver_ids,
                'default_final_approvers' => array_values(array_filter(array_map(
                    fn (string $id): ?array => ($person = $people->get($id)) !== null ? [...HiringPeople::person($person), 'active' => $person->isActive()] : null,
                    $setting->default_final_approver_ids,
                ))),
                'checklist_template' => $setting->template(),
            ],
            'roles' => array_map(fn (ReviewerRole $role): array => ['value' => $role->value, 'label' => $role->label()], ReviewerRole::cases()),
            'limits' => ['approvers' => 10, 'items_per_role' => 12, 'label' => 200],
            'employees' => $this->people->options($user->company_id),
        ];
    }
}
