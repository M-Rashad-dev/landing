<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $heading }}</title>
</head>
<body style="margin:0;padding:0;background:#f5fbf8;font-family:Tahoma,Arial,sans-serif;color:#13261d;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5fbf8;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3e8e6;border-radius:14px;overflow:hidden;" dir="rtl">
<tr><td style="background:#2fcf91;height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 8px;text-align:right;">
<p style="margin:0 0 6px;font-size:12px;color:#6b7a74;">{{ __('alerts.brand') }}</p>
<h1 style="margin:0;font-size:20px;line-height:1.5;color:#13261d;">{{ $heading }}</h1>
<p style="margin:10px 0 0;font-size:14px;line-height:1.8;color:#3d4a45;">{{ $intro }}</p>
</td></tr>
@if (count($rows) > 0)
<tr><td style="padding:16px 28px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e8e6;border-radius:10px;border-collapse:separate;" dir="rtl">
@foreach ($rows as $row)
<tr>
<td style="padding:10px 14px;font-size:13px;color:#6b7a74;text-align:right;{{ $loop->last ? '' : 'border-bottom:1px solid #eef2f0;' }}">{{ $row['label'] }}</td>
<td style="padding:10px 14px;font-size:14px;font-weight:bold;color:#13261d;text-align:left;{{ $loop->last ? '' : 'border-bottom:1px solid #eef2f0;' }}">{{ $row['value'] }}</td>
</tr>
@endforeach
</table>
</td></tr>
@endif
@if ($actionUrl)
<tr><td style="padding:22px 28px 4px;text-align:right;">
<a href="{{ $actionUrl }}" style="display:inline-block;background:#0b7a55;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:11px 22px;border-radius:9px;">{{ $actionLabel }}</a>
</td></tr>
@endif
<tr><td style="padding:22px 28px 26px;text-align:right;">
<p style="margin:0;font-size:12px;line-height:1.7;color:#8a9893;">{{ __('alerts.footer') }}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
