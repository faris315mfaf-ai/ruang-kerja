{{ $payload->title }}

@if ($payload->subject && $payload->subject->code){{ $payload->subject->code }} @endif{{ $payload->subject?->title }}

@if ($payload->body){{ $payload->body }}

@endif
{{ $actionLabel }}: {{ $actionUrl }}

—
Atur notifikasi: {{ $settingsUrl }}
