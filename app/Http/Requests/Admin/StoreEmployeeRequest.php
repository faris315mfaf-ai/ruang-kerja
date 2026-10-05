<?php

namespace App\Http\Requests\Admin;

use App\Models\User;
use Illuminate\Support\Facades\Gate;

class StoreEmployeeRequest extends EmployeeFormRequest
{
    public function authorize(): bool
    {
        return Gate::forUser($this->actor())->allows('create', User::class);
    }

    protected function employee(): ?User
    {
        return null;
    }
}
