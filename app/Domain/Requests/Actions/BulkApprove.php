<?php

namespace App\Domain\Requests\Actions;

use App\Models\EmployeeRequest;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Validation\ValidationException;

/**
 * "Setujui N pengajuan" (desktop): approves each one independently; one
 * failure does not undo the others.
 */
final class BulkApprove
{
    public function __construct(private readonly ApproveStep $approve) {}

    /**
     * @param  list<string>  $requestIds
     * @return array{approved: list<string>, failed: array<string, string>}
     */
    public function handle(User $actor, array $requestIds): array
    {
        $approved = [];
        $failed = [];

        $requests = EmployeeRequest::query()->visibleTo($actor)->whereKey($requestIds)->get()->keyBy('id');

        foreach (array_values(array_unique($requestIds)) as $id) {
            $request = $requests->get($id);

            if ($request === null) {
                $failed[$id] = 'Pengajuan tidak ditemukan.';

                continue;
            }

            try {
                $this->approve->handle($actor, $request);
                $approved[] = $id;
            } catch (AuthorizationException|ValidationException $e) {
                $failed[$id] = $e->getMessage();
            }
        }

        return ['approved' => $approved, 'failed' => $failed];
    }
}
