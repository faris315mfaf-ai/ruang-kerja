<?php

namespace App\Http\Resources;

use App\Models\Label;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Label
 */
class LabelResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        /** @var Label $label */
        $label = $this->resource;

        return [
            'id' => $label->id,
            'name' => $label->name,
            'color' => $label->color,
        ];
    }
}
