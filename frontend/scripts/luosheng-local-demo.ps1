[CmdletBinding()]
param(
    [ValidateRange(1, 900)]
    [int]$Seconds = 900,
    [switch]$Smoke
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$buildPath = Join-Path ([IO.Path]::GetTempPath()) ('luosheng-dated-dist-' + [guid]::NewGuid())
$buildEnvironment = @{
    VITE_GUIDE_PRESET_ENABLED = 'true'
    VITE_GUIDE_SITE_ENABLED = 'true'
    VITE_GUIDE_TURNS_ENABLED = 'true'
    NODE_ENV = 'production'
    VITEST = 'false'
}
$demoEnvironment = @{
    LUOSHENG_LOCAL_DEMO = '1'
    LUOSHENG_LOCAL_DEMO_DATED = '1'
    LUOSHENG_LOCAL_DEMO_SMOKE = $(if ($Smoke) { '1' } else { '0' })
    LUOSHENG_LOCAL_DEMO_SECONDS = [string]$Seconds
    LUOSHENG_DATED_DEMO_DIST = $buildPath
    LUOSHENG_DATED_DEMO_ROLLBACK_DIST = $null
}

function Invoke-WithProcessEnvironment($Values, [scriptblock]$Command) {
    $previous = @{}
    try {
        foreach ($key in $Values.Keys) {
            $previous[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
            [Environment]::SetEnvironmentVariable($key, $Values[$key], 'Process')
        }
        & $Command
    } finally {
        foreach ($key in $previous.Keys) {
            [Environment]::SetEnvironmentVariable($key, $previous[$key], 'Process')
        }
    }
}

Push-Location -LiteralPath $repo
try {
    Invoke-WithProcessEnvironment $buildEnvironment {
        & pnpm --dir frontend exec vite build --outDir $buildPath
        if ($LASTEXITCODE -ne 0) { throw "Local preview build failed (exit $LASTEXITCODE)." }
    }
    Push-Location -LiteralPath (Join-Path $repo 'backend')
    try {
        Invoke-WithProcessEnvironment $demoEnvironment {
            & mvn -B '-Dtest=GuideExhibitIntegrationTests#serveLocalCandidate' test
            if ($LASTEXITCODE -ne 0) { throw "Local preview failed (exit $LASTEXITCODE)." }
        }
    } finally {
        Pop-Location
    }
} finally {
    Pop-Location
}
