<?php

namespace App\Http\Controllers\Api\Reports;

use App\Domain\Attendance\Services\ScheduleResolver;
use App\Domain\Reports\Actions\SaveDailyReport;
use App\Domain\Reports\Actions\SubmitDailyReport;
use App\Domain\Reports\Data\DailyReportInput;
use App\Domain\Reports\Data\DailyReportItemInput;
use App\Domain\Reports\Queries\MyDailyReports;
use App\Domain\Reports\Queries\ReportTaskOptions;
use App\Domain\Reports\Support\ReportDay;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\DailyReportApiRequest;
use App\Http\Requests\Reports\SaveDailyReportRequest;
use App\Models\DailyReport;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Container\Attributes\CurrentUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * Laporan progres harian of the Android app (Bagian 4 / B4-C): today's form,
 * autosave, "Kirim" and the task picker search, as JSON over the very web
 * pieces (MyDailyReports, SaveDailyReport, SubmitDailyReport — tasks moved
 * through MoveTask under the task policy —, ReportTaskOptions) and the same
 * DailyReportPolicy. A save for a date other than today's office date answers
 * 403 `laporan_terkunci`. Contract: docs/sesi/ponsel-b4c-laporan.md.
 */
class DailyReportController extends Controller
{
    public const string LOCKED = 'laporan_terkunci';

    public function __construct(private readonly MyDailyReports $mine) {}

    public function today(#[CurrentUser] User $user, ScheduleResolver $schedules): JsonResponse
    {
        Gate::authorize('create', DailyReport::class);

        $today = ReportDay::today();
        $deadline = ReportDay::locksAt($today);
        $locked = CarbonImmutable::now()->gt($deadline);
        $form = $this->mine->form($user);
        $schedule = $schedules->forDate($user, ScheduleResolver::parseDate($today));

        return response()->json([
            'date' => $today,
            'deadline' => $deadline->toIso8601String(),
            'locked' => $locked,
            'scheduled' => $schedule->isWorkday(),
            'holiday' => $schedule->isHoliday() ? $schedule->holiday?->name : null,
            'can' => ['edit' => ! $locked, 'submit' => ! $locked],
            'report' => [...$form['report'], 'locked' => $locked],
            'suggestions' => $form['suggestions'],
            'chosen' => $form['chosen'],
            'limits' => [
                'items' => SaveDailyReport::MAX_ITEMS,
                'note' => SaveDailyReportRequest::NOTE_MAX,
                'text' => SaveDailyReportRequest::TEXT_MAX,
            ],
        ]);
    }

    /**
     * Autosave of the draft (or of a sent report, until 23.59). Idempotent:
     * the same body stores the same report.
     */
    public function save(DailyReportApiRequest $form, #[CurrentUser] User $user, SaveDailyReport $save): JsonResponse
    {
        Gate::authorize('create', DailyReport::class);

        $input = $form->toInput();

        if ($input->reportDate !== ReportDay::today()) {
            return self::locked($input->reportDate);
        }

        try {
            $report = $save->handle($user, $input);
        } catch (ValidationException $exception) {
            return self::lockedOr($exception, $input->reportDate);
        }

        return response()->json(['report' => $this->present($report, $user)]);
    }

    /**
     * "Kirim": stores the content, moves the tasks with a "pindahkan ke"
     * column and sets submitted_at on the first send. All or nothing, as on
     * the web: a refused move is a 422 and nothing is stored.
     */
    public function submit(DailyReportApiRequest $form, #[CurrentUser] User $user, SubmitDailyReport $submit): JsonResponse
    {
        Gate::authorize('create', DailyReport::class);

        $input = $form->toInput();

        if ($input->reportDate !== ReportDay::today()) {
            return self::locked($input->reportDate);
        }

        $before = $this->statusesBefore($user, $input);

        try {
            $report = $submit->handle($user, $input);
        } catch (ValidationException $exception) {
            return self::lockedOr($exception, $input->reportDate);
        }

        return response()->json([
            'report' => $this->present($report, $user),
            'move_results' => $this->moveResults($input, $before),
            'message' => 'Laporan hari ini terkirim.',
        ]);
    }

    /**
     * Task picker search: other tasks I can see, by key ("PRJ-12") or title.
     */
    public function tasks(Request $request, #[CurrentUser] User $user, ReportTaskOptions $options): JsonResponse
    {
        Gate::authorize('create', DailyReport::class);

        $term = $request->query('q');

        return response()->json(['tasks' => $options->search($user, is_string($term) ? mb_substr($term, 0, 100) : '')]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(DailyReport $report, User $user): array
    {
        return [...$this->mine->detail($report, $user), 'locked' => false];
    }

    /**
     * Current column of each task that has a "pindahkan ke" target, before sending.
     *
     * @return array<string, array{id: string, name: string, category: string}>
     */
    private function statusesBefore(User $user, DailyReportInput $input): array
    {
        $ids = $this->movedTaskIds($input);

        if ($ids === []) {
            return [];
        }

        $before = [];

        foreach (Task::query()->visibleTo($user)->whereKey($ids)->with('status:id,name,category')->get() as $task) {
            $before[$task->id] = self::status($task->status);
        }

        return $before;
    }

    /**
     * Per item with a "pindahkan ke" column: where the task was, where it is
     * asked to go and whether this send moved it.
     *
     * @param  array<string, array{id: string, name: string, category: string}>  $before
     * @return list<array{task_id: string, task_key: string|null, moved: bool, from: array{id: string, name: string, category: string}|null, to: array{id: string, name: string, category: string}|null, error: string|null}>
     */
    private function moveResults(DailyReportInput $input, array $before): array
    {
        $ids = $this->movedTaskIds($input);

        if ($ids === []) {
            return [];
        }

        $tasks = Task::query()->with('workspace:id,key')->whereKey($ids)->get(['id', 'workspace_id', 'number', 'status_id'])->keyBy('id');
        $targets = TaskStatus::query()->whereKey(array_values(array_filter(array_map(
            fn (DailyReportItemInput $item): ?string => $item->taskId === null ? null : $item->moveStatusId,
            $input->items,
        ))))->get(['id', 'name', 'category'])->keyBy('id');

        $results = [];

        foreach ($input->items as $item) {
            if ($item->taskId === null || $item->moveStatusId === null) {
                continue;
            }

            $task = $tasks->get($item->taskId);
            $target = $targets->get($item->moveStatusId);
            $from = $before[$item->taskId] ?? null;
            $reached = $task !== null && $target !== null && $task->status_id === $target->id;

            $results[] = [
                'task_id' => $item->taskId,
                'task_key' => $task?->displayKey(),
                'moved' => $reached && $from !== null && $from['id'] !== $target->id,
                'from' => $from,
                'to' => $target === null ? null : self::status($target),
                'error' => $reached ? null : 'Tugas atau kolom tujuan tidak ditemukan lagi; status tugas tidak berubah.',
            ];
        }

        return $results;
    }

    /**
     * @return list<string>
     */
    private function movedTaskIds(DailyReportInput $input): array
    {
        return array_values(array_unique(array_filter(array_map(
            fn (DailyReportItemInput $item): ?string => $item->moveStatusId === null ? null : $item->taskId,
            $input->items,
        ))));
    }

    /**
     * @return array{id: string, name: string, category: string}
     */
    private static function status(TaskStatus $status): array
    {
        return ['id' => $status->id, 'name' => $status->name, 'category' => $status->category->value];
    }

    private static function lockedOr(ValidationException $exception, string $date): JsonResponse
    {
        if (array_key_exists('report_date', $exception->errors())) {
            return self::locked($date);
        }

        throw $exception;
    }

    private static function locked(string $date): JsonResponse
    {
        $message = 'Laporan tanggal itu sudah terkunci (batas pukul 23.59). Muat ulang untuk menulis laporan hari ini.';

        return response()->json([
            'code' => self::LOCKED,
            'message' => $message,
            'report_date' => $date,
            'today' => ReportDay::today(),
            'errors' => ['report_date' => [$message]],
        ], 403);
    }
}
