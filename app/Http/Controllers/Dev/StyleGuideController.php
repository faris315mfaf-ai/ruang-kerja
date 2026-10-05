<?php

namespace App\Http\Controllers\Dev;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Living style guide of the "Arus" design system (/dev/komponen): every
 * primitive in light & night, mirroring docs/ruangkerja-design/screens/
 * Komponen.dc.html so module work can be compared side by side. Local
 * environment only (404 elsewhere), Super Admin only (Gate `viewStyleGuide`).
 */
class StyleGuideController extends Controller
{
    public function __invoke(): Response
    {
        abort_unless(app()->environment('local'), 404);
        Gate::authorize('viewStyleGuide');

        return Inertia::render('dev/komponen');
    }
}
