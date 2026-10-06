<?php

namespace App\Http\Controllers\Chat;

use App\Domain\Chat\Actions\CreateChannel;
use App\Domain\Chat\Actions\MarkChannelRead;
use App\Domain\Chat\Actions\OpenDirectConversation;
use App\Domain\Chat\Actions\SetChannelMuted;
use App\Domain\Chat\Queries\AttachableDriveFiles;
use App\Http\Controllers\Controller;
use App\Http\Requests\Chat\ChannelRequest;
use App\Http\Requests\Chat\DirectRequest;
use App\Http\Requests\Chat\MuteRequest;
use App\Models\Channel;
use App\Models\DriveFile;
use App\Models\Task;
use App\Models\User;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Channels: create, open a DM/group, read pointer, mute, and the pickers of
 * the composer (Drive files any reader can open, tasks for #KEY-n).
 */
class ChannelController extends Controller
{
    public function store(ChannelRequest $request, #[CurrentUser] User $user, CreateChannel $create): JsonResponse
    {
        Gate::authorize('create', Channel::class);

        /** @var list<string> $memberIds */
        $memberIds = array_values($request->array('member_ids'));

        $channel = $create->handle($user, [
            'name' => $request->string('name')->toString(),
            'topic' => $request->input('topic'),
            'private' => $request->boolean('private'),
            'member_ids' => $memberIds,
        ]);

        return response()->json(['id' => $channel->id], 201);
    }

    public function direct(DirectRequest $request, #[CurrentUser] User $user, OpenDirectConversation $open): JsonResponse
    {
        Gate::authorize('create', Channel::class);

        /** @var list<string> $userIds */
        $userIds = array_values($request->array('user_ids'));

        return response()->json(['id' => $open->handle($user, $userIds)->id]);
    }

    public function read(Channel $channel, #[CurrentUser] User $user, MarkChannelRead $markRead): JsonResponse
    {
        Gate::authorize('participate', $channel);

        return response()->json(['last_read_message_id' => $markRead->handle($channel, $user)]);
    }

    public function mute(MuteRequest $request, Channel $channel, #[CurrentUser] User $user, SetChannelMuted $mute): JsonResponse
    {
        Gate::authorize('participate', $channel);

        $mute->handle($channel, $user, $request->boolean('muted'));

        return response()->json(['muted' => $request->boolean('muted')]);
    }

    /** Drive picker: GET /obrolan/{channel}/file-drive?q= */
    public function files(Request $request, Channel $channel, #[CurrentUser] User $user, AttachableDriveFiles $attachable): JsonResponse
    {
        Gate::authorize('post', $channel);

        $search = $request->query('q');
        $files = $attachable->query($channel, $user, is_string($search) ? $search : null)->limit(30)->get();

        return response()->json([
            'files' => array_values($files->map(fn (DriveFile $file): array => [
                'id' => $file->id,
                'name' => $file->name,
                'kind' => $file->kind->value,
                'web_view_link' => $file->web_view_link,
                'size_bytes' => $file->size_bytes,
                'owner_email' => $file->owner_email,
            ])->all()),
        ]);
    }

    /** #KEY-n suggestions: GET /obrolan/rujukan/tugas?q= (tasks the viewer can see). */
    public function tasks(Request $request, #[CurrentUser] User $user): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));
        $query = Task::query()->visibleTo($user)->with('workspace:id,key');

        if (preg_match('/^#?([A-Za-z][A-Za-z0-9]{1,9})-(\d+)$/', $search, $match) === 1) {
            $query->whereHas('workspace', fn ($workspace) => $workspace->where('key', strtoupper($match[1])))
                ->where('tasks.number', (int) $match[2]);
        } elseif ($search !== '') {
            $query->where('tasks.title', 'ilike', '%'.addcslashes(ltrim($search, '#'), '%_\\').'%');
        }

        $tasks = $query->orderByDesc('tasks.updated_at')->limit(8)
            ->get(['tasks.id', 'tasks.workspace_id', 'tasks.number', 'tasks.title', 'tasks.status_category']);

        return response()->json([
            'tasks' => array_values($tasks->map(fn (Task $task): array => [
                'id' => $task->id,
                'key' => $task->displayKey(),
                'title' => $task->title,
                'status_category' => $task->status_category->value,
                'url' => $task->url(),
            ])->all()),
        ]);
    }
}
