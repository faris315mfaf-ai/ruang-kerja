<?php

namespace App\Http\Resources;

use App\Models\TaskStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin TaskStatus
 */
class TaskStatusResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var TaskStatus $status */
        $status = $this->resource;

        return [
            'id' => $status->id,
            'name' => $status->name,
            'category' => $status->category->value,
            'color' => $status->color,
            'position' => $status->position,
        ];
    }
}
