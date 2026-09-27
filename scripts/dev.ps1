$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$frontendRoot = Join-Path $projectRoot 'frontend'
$viteEntry = Join-Path $frontendRoot 'node_modules/vite/bin/vite.js'
$logDirectory = Join-Path $projectRoot '.dev'
$uvCommand = (Get-Command uv -ErrorAction Stop).Source
$nodeCommand = (Get-Command node -ErrorAction Stop).Source

if (-not (Test-Path -LiteralPath $viteEntry)) {
    throw 'Frontend dependencies missing. Run npm --prefix frontend ci first.'
}

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$processes = @()

try {
    $processes += Start-Process -FilePath $uvCommand -ArgumentList @(
        'run', 'uvicorn', 'backend.app.main:app', '--reload', '--reload-dir', 'backend',
        '--host', '127.0.0.1', '--port', '8000'
    ) -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $logDirectory 'backend.stdout.log') `
        -RedirectStandardError (Join-Path $logDirectory 'backend.stderr.log')

    $processes += Start-Process -FilePath $nodeCommand -ArgumentList @(
        "`"$viteEntry`"", '--host', '127.0.0.1', '--port', '5173', '--strictPort'
    ) -WorkingDirectory $frontendRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $logDirectory 'frontend.stdout.log') `
        -RedirectStandardError (Join-Path $logDirectory 'frontend.stderr.log')

    Write-Host 'Frontend: http://127.0.0.1:5173'
    Write-Host 'Backend:  http://127.0.0.1:8000/api/health'
    Write-Host "Logs: $logDirectory"
    Write-Host 'Press Ctrl+C to stop both development servers.'

    while ($true) {
        foreach ($process in $processes) {
            if ($process.HasExited) {
                throw "A development server exited with code $($process.ExitCode). Check $logDirectory."
            }
        }
        Start-Sleep -Milliseconds 500
    }
}
finally {
    foreach ($process in $processes) {
        if (-not $process.HasExited) {
            # Invoke outside the cancelled PowerShell pipeline so Ctrl+C can
            # still stop the reload worker and all other descendants.
            $stopInfo = New-Object System.Diagnostics.ProcessStartInfo
            $stopInfo.FileName = 'taskkill.exe'
            $stopInfo.Arguments = "/PID $($process.Id) /T /F"
            $stopInfo.UseShellExecute = $false
            $stopInfo.CreateNoWindow = $true
            $stopProcess = [System.Diagnostics.Process]::Start($stopInfo)
            $stopProcess.WaitForExit()
        }
    }
}
