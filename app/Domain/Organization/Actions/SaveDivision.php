<?php

namespace App\Domain\Organization\Actions;

use App\Domain\Organization\Support\UniqueViolations;
use App\Models\Division;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Creates a division in the actor's company, or updates an existing one.
 * Input is validated by DivisionRequest (unique code, parent cycle, single board).
 * Audited automatically (division.created / division.updated).
 */
final class SaveDivision
{
    /**
     * @param  array{name: string, code: string, parent_id: string|null, head_user_id: string|null, is_board: bool}  $data
     *
     * @throws ValidationException
     */
    public function handle(User $actor, array $data, ?Division $division = null): Division
    {
        // Concurrent saves that both passed DivisionRequest: the unique indexes decide.
        return UniqueViolations::asValidation(fn (): Division => DB::transaction(function () use ($actor, $data, $division): Division {
            $division ??= new Division(['company_id' => $actor->company_id]);

            $division->fill([
                'name' => $data['name'],
                'code' => $data['code'],
                // The board unit sits at the top of the chart: it never has a parent.
                'parent_id' => $data['is_board'] ? null : $data['parent_id'],
                'head_user_id' => $data['head_user_id'],
                'is_board' => $data['is_board'],
            ])->save();

            return $division;
        }), [
            'divisions_one_board_per_company_unique' => ['is_board', 'Unit Direksi sudah ada. Hanya boleh ada satu unit Direksi.'],
            'divisions_company_id_code_unique' => ['code', "Kode {$data['code']} sudah dipakai divisi lain (termasuk yang sudah dihapus)."],
        ]);
    }
}
