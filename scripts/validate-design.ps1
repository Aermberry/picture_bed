# Validate yigecli design deliverable (index.html + assets + required sections).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$fail = @()

foreach ($rel in @('index.html', 'styles.css', 'app.js')) {
  if (-not (Test-Path (Join-Path $root $rel))) { $fail += "missing: $rel" }
}

$htmlPath = Join-Path $root 'index.html'
if (Test-Path $htmlPath) {
  $html = Get-Content $htmlPath -Raw
  $requiredIds = @(
    'overview', 'scope', 'architecture', 'modules', 'cli',
    'extract', 'upload', 'rewrite', 'config', 'agent',
    'errors', 'testing', 'delivery', 'risks'
  )
  foreach ($id in $requiredIds) {
    if ($html -notmatch ('id="' + $id + '"')) { $fail += "missing section: #$id" }
  }
  if ($html -notmatch 'yigecli') { $fail += 'missing product name yigecli' }
  if ($html -notmatch 'GitHub') { $fail += 'missing GitHub host reference' }
  if ($html -notmatch 'Contents API') { $fail += 'missing Contents API reference' }
}

if ($fail.Count -gt 0) {
  $fail | ForEach-Object { Write-Host "FAIL $_" }
  exit 1
}
Write-Host "PASS: design document sections and assets OK"
exit 0
