{{ $greeting }}, {{ $firstName }}.
Ini ringkasan {{ $dateLabel }}.

@foreach ($digest->sections as $section)
{{ $section->title }}
@foreach ($section->items as $item)
- {{ $item->code ? $item->code.' ' : '' }}{{ $item->title }}{{ $item->detail ? ' · '.$item->detail : '' }}{{ $item->badge ? ' ['.$item->badge.']' : '' }}{{ $item->trailing ? ' '.$item->trailing : '' }}
@endforeach
@if ($section->more)
  {{ $section->more }}
@endif
@if ($section->note)
  {{ $section->note }}
@endif

@endforeach
Buka RuangKerja: {{ $appUrl }}

—
Email ini dikirim pukul {{ $sendTimeLabel }} karena Anda mengaktifkan ringkasan harian.
Atur notifikasi: {{ $settingsUrl }}
