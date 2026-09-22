# Validate design deliverable: docs/ F-P-module-AC layout + HTML presentation assets.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$fail = @()

foreach ($rel in @(
  'index.html', 'styles.css', 'app.js',
  'docs/architecture.md', 'docs/features-index.md', 'docs/design-reading-guide.md',
  'docs/design/module-ingest.md', 'docs/design/module-transfer.md',
  'docs/design/module-rewrite.md', 'docs/design/module-cliops.md',
  'docs/design/cross-cutting.md'
)) {
  if (-not (Test-Path (Join-Path $root $rel))) { $fail += "missing: $rel" }
}

$htmlPath = Join-Path $root 'index.html'
if (Test-Path $htmlPath) {
  $html = Get-Content $htmlPath -Raw
  foreach ($id in @('guide', 'features', 'architecture', 'modules', 'cli', 'docs')) {
    if ($html -notmatch ('id="' + $id + '"')) { $fail += "missing section: #$id" }
  }
}

$fiPath = Join-Path $root 'docs/features-index.md'
if (Test-Path $fiPath) {
  $fi = Get-Content $fiPath -Raw
  foreach ($fid in @('F1 ', 'F4 ', 'F7 ', 'F10 ')) {
    if ($fi -notmatch $fid) { $fail += "features-index missing $fid" }
  }
  if ($fi -notmatch 'P0') { $fail += 'features-index missing P0' }
  if ($fi -notmatch 'AC') { $fail += 'features-index missing AC' }
}

if ($fail.Count -gt 0) {
  $fail | ForEach-Object { Write-Host "FAIL $_" }
  exit 1
}
Write-Host "PASS: docs F/P/module/AC layout and HTML presentation OK"
exit 0
