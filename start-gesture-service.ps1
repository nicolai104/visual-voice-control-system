$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot

python .\gesture_service.py
