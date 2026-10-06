<?php

namespace App\Http\Requests\Meetings;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;

/** GET /rapat/bentrok?peserta[]=…&tanggal=YYYY-MM-DD&mulai=HH:MM&durasi=60&abaikan={meeting}. */
class ConflictsRequest extends MeetingRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'peserta' => ['present', 'array', 'max:100'],
            'peserta.*' => ['string', 'ulid'],
            'tanggal' => ['required', 'date_format:Y-m-d'],
            'mulai' => ['required', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'durasi' => ['required', 'integer', 'min:5', 'max:720'],
            'abaikan' => ['sometimes', 'nullable', 'string', 'ulid'],
        ];
    }

    /**
     * @return list<string>
     */
    public function userIds(): array
    {
        return array_values(array_map(strval(...), (array) $this->input('peserta', [])));
    }

    public function startsAt(): CarbonImmutable
    {
        $start = CarbonImmutable::createFromFormat('Y-m-d H:i', $this->string('tanggal')->toString().' '.$this->string('mulai')->toString(), config()->string('app.office_timezone'));

        return ($start instanceof CarbonImmutable ? $start : CarbonImmutable::now())->utc();
    }

    public function endsAt(): CarbonImmutable
    {
        return $this->startsAt()->addMinutes($this->integer('durasi'));
    }
}
