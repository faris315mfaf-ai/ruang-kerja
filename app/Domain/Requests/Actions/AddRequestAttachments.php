<?php

namespace App\Domain\Requests\Actions;

use App\Domain\Requests\Services\RequestAttachmentStore;
use App\Models\Attachment;
use App\Models\EmployeeRequest;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Adds files to an own request that is still being edited (draft or sent back
 * for revision) without touching its other fields — the mobile app uploads
 * attachments one by one (camera, gallery, file). Same private disk, limits
 * and naming as the web form (RequestAttachmentStore, config/requests.php);
 * the "sick > n days needs a letter" rule is still checked by SubmitRequest.
 */
final class AddRequestAttachments
{
    public function __construct(private readonly RequestAttachmentStore $attachments) {}

    /**
     * @param  list<UploadedFile>  $files
     * @return Collection<int, Attachment> the new attachments
     */
    public function handle(User $actor, EmployeeRequest $request, array $files): Collection
    {
        $stored = [];

        try {
            return DB::transaction(function () use ($actor, $request, $files, &$stored): Collection {
                $request = EmployeeRequest::query()->lockForUpdate()->findOrFail($request->id);

                if ($request->user_id !== $actor->id) {
                    throw new AuthorizationException('Hanya pemohon yang bisa menambah lampiran.');
                }

                if (! $request->status->isEditable()) {
                    throw ValidationException::withMessages(['attachments' => 'Lampiran hanya bisa diubah pada draf atau pengajuan yang diminta revisi.']);
                }

                $max = config()->integer('requests.attachments.max_files', 5);

                if ($request->attachments()->count() + count($files) > $max) {
                    throw ValidationException::withMessages(['attachments' => "Maksimal {$max} lampiran."]);
                }

                $before = array_values(array_map('strval', $request->attachments()->pluck('id')->all()));
                $stored = $this->attachments->store($request, $actor, $files);
                $request->touch();

                return $request->attachments()->whereKeyNot($before)->orderBy('created_at')->orderBy('id')->get();
            });
        } catch (Throwable $e) {
            $this->attachments->delete($stored);

            throw $e;
        }
    }
}
