$ErrorActionPreference = "Stop"

if (-not $env:ZHIPUAI_API_KEY) {
  Write-Warning "ZHIPUAI_API_KEY is not set; transcription requests will be rejected."
}

python -m voice_service
