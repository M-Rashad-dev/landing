# Stops the dev servers started from this project (php artisan serve / next) — nothing else.
$root = 'W:\rashad\Landing'
Get-CimInstance Win32_Process |
  Where-Object { ($_.Name -in @('node.exe', 'php.exe')) -and $_.CommandLine -and $_.CommandLine.Contains($root) -and ($_.CommandLine -match 'artisan|next|server\.php') } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -Confirm:$false -ErrorAction SilentlyContinue; "stopped $($_.ProcessId)" }
