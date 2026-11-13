$ErrorActionPreference = 'Stop'
$taskToolRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..\.tools\tbls'))
$taskToolArchive = Join-Path $taskToolRoot 'tbls.zip'
New-Item -ItemType Directory -Path $taskToolRoot -Force | Out-Null
Invoke-WebRequest -Uri 'https://github.com/k1LoW/tbls/releases/download/v1.96.1/tbls_v1.96.1_windows_amd64.zip' -OutFile $taskToolArchive
$taskToolDigest = (Get-FileHash -LiteralPath $taskToolArchive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($taskToolDigest -ne 'ecd641e0d1ffde95350b1336cb03603c7f7fd8c7fc20a996323ea80d8594a5c6') {
    throw 'tbls 下载文件的 SHA-256 与官方发布不符，已停止。'
}
Expand-Archive -LiteralPath $taskToolArchive -DestinationPath $taskToolRoot -Force
& (Join-Path $taskToolRoot 'tbls.exe') version
