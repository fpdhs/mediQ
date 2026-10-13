[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet("preflight", "seed", "verify")]
    [string]$Mode,
    [Parameter(Mandatory)]
    [ValidateSet("A", "B")]
    [string]$Hospital,
    [Parameter(Mandatory)]
    [string]$Dataset,
    [Parameter(Mandatory)]
    [string]$MediqRoot,
    [switch]$Apply
)

$ErrorActionPreference = "Stop"
$workspaceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$datasetRoot = [IO.Path]::GetFullPath($Dataset)
$allowedDataRoot = [IO.Path]::GetFullPath((Join-Path $workspaceRoot "artifacts/synthetic-hcc-ct"))
$mediqRootPath = [IO.Path]::GetFullPath($MediqRoot)
$resolvedScript = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "synthetic_hcc_orthanc.py"))
$envPath = [IO.Path]::GetFullPath((Join-Path $mediqRootPath ".env"))
$caPath = [IO.Path]::GetFullPath((Join-Path $mediqRootPath "data/local-tls/test-ca.crt"))
$markerPath = Join-Path $datasetRoot ".synthetic-hcc-dataset.json"

if (-not $datasetRoot.StartsWith($allowedDataRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw "DATASET_PATH_OUTSIDE_GENERATED_ARTIFACTS"
}
if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
    throw "GENERATED_SYNTHETIC_DATASET_MARKER_REQUIRED"
}
$datasetMarker = Get-Content -LiteralPath $markerPath -Raw | ConvertFrom-Json
if ($datasetMarker.status -ne "PASS" -or $datasetMarker.datasetType -ne "SYNTHETIC") {
    throw "GENERATED_SYNTHETIC_DATASET_NOT_VALIDATED"
}
if ($Mode -eq "seed" -and ($Hospital -ne "A" -or -not $Apply)) {
    throw "SOURCE_SEED_REQUIRES_HOSPITAL_A_AND_APPLY"
}
if ($Mode -ne "seed" -and $Apply) {
    throw "APPLY_ONLY_VALID_FOR_HOSPITAL_A_SEED"
}
if (-not (Test-Path -LiteralPath $envPath -PathType Leaf) -or -not (Test-Path -LiteralPath $caPath -PathType Leaf)) {
    throw "MEDIQ_LOCAL_TEST_CONFIGURATION_MISSING"
}

& git -C $mediqRootPath check-ignore --quiet -- .env
if ($LASTEXITCODE -ne 0) {
    throw "MEDIQ_LOCAL_ENV_FILE_MUST_BE_GIT_IGNORED"
}

$values = @{}
foreach ($line in [IO.File]::ReadAllLines($envPath)) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith("#")) { continue }
    $separator = $line.IndexOf("=")
    if ($separator -lt 1) { continue }
    $key = $line.Substring(0, $separator).Trim()
    $raw = $line.Substring($separator + 1).Trim()
    if ($raw.Length -ge 2 -and $raw.StartsWith('"') -and $raw.EndsWith('"')) {
        $value = ConvertFrom-Json -InputObject $raw
    }
    elseif ($raw.Length -ge 2 -and $raw.StartsWith("'") -and $raw.EndsWith("'")) {
        $value = $raw.Substring(1, $raw.Length - 2).Replace("''", "'")
    }
    else {
        $value = $raw
    }
    $values[$key] = [string]$value
}

$suffix = $Hospital.ToLowerInvariant()
$hospitalCode = $Hospital.ToUpperInvariant()
$usernameKey = "ORTHANC_${hospitalCode}_USERNAME"
$passwordKey = "ORTHANC_${hospitalCode}_PASSWORD"
if (-not $values.ContainsKey($usernameKey) -or [string]::IsNullOrEmpty($values[$usernameKey]) -or
    -not $values.ContainsKey($passwordKey) -or [string]::IsNullOrEmpty($values[$passwordKey])) {
    $values.Clear()
    throw "HOSPITAL_TEST_CREDENTIALS_MISSING"
}

$containerName = "mediq-orthanc-${suffix}-1"
$networkName = "mediq_hospital-${suffix}"
$hostName = "orthanc-${suffix}"
$containerState = (& docker inspect --format '{{.State.Status}}|{{.State.Health.Status}}' $containerName | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $containerState -ne "running|healthy") {
    $values.Clear()
    throw "HOSPITAL_TEST_ORTHANC_NOT_HEALTHY"
}
$portsJson = (& docker inspect --format '{{json .NetworkSettings.Ports}}' $containerName | Out-String).Trim() | ConvertFrom-Json
$published = @($portsJson.PSObject.Properties | Where-Object { $null -ne $_.Value -and @($_.Value).Count -gt 0 })
if ($published.Count -gt 0) {
    $values.Clear()
    throw "HOSPITAL_TEST_ORTHANC_HAS_PUBLISHED_PORTS"
}

$image = (& docker inspect --format '{{.Config.Image}}' $containerName | Out-String).Trim()
& docker image inspect $image *> $null
if ($LASTEXITCODE -ne 0) {
    $values.Clear()
    throw "HOSPITAL_TEST_ORTHANC_IMAGE_NOT_AVAILABLE_LOCALLY"
}

$mountArgs = @(
    "--mount", "type=bind,source=$datasetRoot,target=/dataset,readonly",
    "--mount", "type=bind,source=$resolvedScript,target=/client.py,readonly",
    "--mount", "type=bind,source=$caPath,target=/run/mediq/test-ca.crt,readonly"
)
$dockerArgs = @(
    "run", "--rm", "--interactive",
    "--network", $networkName,
    "--read-only",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=16m",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges:true",
    "--pids-limit", "100"
) + $mountArgs + @(
    "--entrypoint", "python3",
    $image,
    "/client.py",
    "--mode", $Mode,
    "--base-url", "https://${hostName}:8042",
    "--ca-cert", "/run/mediq/test-ca.crt",
    "--dataset", "/dataset",
    "--batch-size", "10"
)
if ($Mode -eq "seed") { $dockerArgs += "--apply" }

$payload = @{
    username = $values[$usernameKey]
    password = $values[$passwordKey]
} | ConvertTo-Json -Compress
$values.Clear()
$payload | & docker @dockerArgs
$dockerExit = $LASTEXITCODE
$payload = $null
exit $dockerExit
