$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot

if (-not $env:PORT) {
  $env:PORT = "5173"
}

node .\server.mjs *> .\.server.log
