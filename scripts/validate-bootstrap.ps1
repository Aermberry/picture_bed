# Validate AgentGo bootstrap layout and delivery rules presence.
# Exit 0 on pass; non-zero on fail. No secrets.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$required = @(
  'AGENTS.md',
  '.agents/changelog.md',
  '.agents/rules/delivery.md',
  '.agents/memory/project-overview.md',
  '.agents/memory/source-index.md',
  '.agents/memory/review-findings.md',
  '.agents/memory/open-items.md',
  '.agents/memory/outcomes.md',
  '.agents/memory/decisions.md',
  '.agents/memory/gotchas.md',
  '.agents/memory/patterns.md',
  '.agents/memory/secret-requirements.md'
)
$fail = @()
foreach ($rel in $required) {
  $p = Join-Path $root $rel
  if (-not (Test-Path $p)) { $fail += "missing: $rel" }
}
$delivery = Join-Path $root '.agents/rules/delivery.md'
if (Test-Path $delivery) {
  $text = Get-Content $delivery -Raw
  if ($text -notmatch 'Commit after every change') { $fail += 'delivery.md missing commit rule' }
  if ($text -notmatch 'Tests before delivery') { $fail += 'delivery.md missing test rule' }
}
if ($fail.Count -gt 0) {
  $fail | ForEach-Object { Write-Host "FAIL $_" }
  exit 1
}
Write-Host "PASS: bootstrap layout and delivery rules OK"
exit 0
