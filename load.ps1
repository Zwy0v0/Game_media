param(
  [string]$Base = $env:BASE,
  [string]$Token = $env:TOKEN,
  [string]$VideoId = $env:VIDEO_ID,
  [int]$Count = $(if ($env:COUNT) { [int]$env:COUNT } else { 50 }),
  [int]$SleepMs = $(if ($env:SLEEPMS) { [int]$env:SLEEPMS } else { 0 })
)

if (-not $Base -or -not $Token -or -not $VideoId) {
  Write-Error "Please set BASE, TOKEN, VIDEO_ID (env vars or params)."
  exit 1
}

for ($i=1; $i -le $Count; $i++) {
  Write-Host "[$i/$Count] POST /api/v1/videos/$VideoId/transcode"
  try {
    curl.exe -s -X POST "$Base/api/v1/videos/$VideoId/transcode" `
      -H "Authorization: Bearer $Token" > $null
  } catch {
    Write-Warning $_.Exception.Message
  }
  if ($SleepMs -gt 0) { Start-Sleep -Milliseconds $SleepMs }
}

Write-Host "Done."
