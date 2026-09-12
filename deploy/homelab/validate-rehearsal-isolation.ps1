[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repositoryRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $repositoryRoot 'deploy/homelab/.env.example'
$productionComposeFile = Join-Path $repositoryRoot 'deploy/homelab/compose.yaml'
$rehearsalComposeFile = Join-Path $repositoryRoot 'deploy/homelab/compose.rehearsal.yaml'

function Add-Failure {
  param(
    [System.Collections.Generic.List[string]]$Failures,
    [string]$Message
  )

  $Failures.Add($Message)
}

function Get-ComposeModel {
  param(
    [string[]]$ComposeFiles,
    [string]$Description
  )

  $arguments = @('compose', '--env-file', $envFile)
  foreach ($composeFile in $ComposeFiles) {
    $arguments += @('-f', $composeFile)
  }
  $arguments += @('config', '--format', 'json')

  # Capture both streams. Compose output can contain resolved credentials, so
  # never write it to the host console or include it in an error message.
  $rendered = & docker @arguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose could not render the $Description model. Run the documented Compose render manually to inspect syntax."
  }

  $json = ($rendered | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine
  try {
    return $json | ConvertFrom-Json
  } catch {
    throw "Docker Compose returned a non-JSON $Description model. Ensure Docker Compose supports 'config --format json'."
  }
}

function Get-PropertyValue {
  param(
    [object]$Object,
    [string]$Name
  )

  if ($null -eq $Object) {
    return $null
  }

  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
}

function Test-RehearsalNamespace {
  param([string]$Value)

  return $Value -match '^nexus-migration-phase3-e078895(?:-|$)'
}

function Test-RehearsalEndpoint {
  param([object]$Value)

  if ($null -eq $Value) {
    return $false
  }

  $valueText = [string]$Value
  try {
    $uri = [Uri]$valueText
  } catch {
    return $false
  }

  return $uri.Scheme -in @('http', 'https') -and
    $uri.Host.EndsWith('.invalid', [System.StringComparison]::OrdinalIgnoreCase)
}

foreach ($requiredFile in @($envFile, $productionComposeFile, $rehearsalComposeFile)) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "Required homelab validation input is missing: $requiredFile"
  }
}

$rehearsalSource = Get-Content -LiteralPath $rehearsalComposeFile -Raw
$nonRehearsalVariables = @([regex]::Matches(
  $rehearsalSource,
  '\$\{([A-Za-z_][A-Za-z0-9_]*)'
) | Where-Object { $_.Groups[1].Value -notmatch '^REHEARSAL_' })
if ($nonRehearsalVariables.Count -gt 0) {
  throw 'Rehearsal Compose contains a non-REHEARSAL_* interpolation and could inherit production configuration.'
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker CLI is required for read-only Compose rendering but was not found on PATH.'
}

# Render both source definitions first. This invokes only `docker compose config`;
# it does not create, pull, start, stop, update, or remove Docker resources.
$productionModel = Get-ComposeModel -ComposeFiles @($productionComposeFile) -Description 'production'
$model = Get-ComposeModel -ComposeFiles @($productionComposeFile, $rehearsalComposeFile) -Description 'production-plus-rehearsal'
$failures = [System.Collections.Generic.List[string]]::new()
$productionIdentities = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::Ordinal)

$rehearsalJson = $model | ConvertTo-Json -Depth 100 -Compress
if ($rehearsalJson -match 'replace-with-production') {
  Add-Failure $failures 'Rendered rehearsal still inherits a production placeholder credential.'
}

foreach ($productionServiceProperty in @((Get-PropertyValue -Object $productionModel -Name 'services').PSObject.Properties)) {
  foreach ($identityKey in @('container_name', 'hostname')) {
    $identity = [string](Get-PropertyValue -Object $productionServiceProperty.Value -Name $identityKey)
    if ($identity) {
      $null = $productionIdentities.Add($identity)
    }
  }
}

$projectName = [string](Get-PropertyValue -Object $model -Name 'name')
if ($projectName -ne 'nexus-migration-phase3-e078895') {
  Add-Failure $failures "Rendered project name must be 'nexus-migration-phase3-e078895'; found a non-isolated project identity."
}

$services = Get-PropertyValue -Object $model -Name 'services'
if ($null -eq $services -or @($services.PSObject.Properties).Count -eq 0) {
  Add-Failure $failures 'Rendered model contains no services.'
}

$networks = Get-PropertyValue -Object $model -Name 'networks'
if ($null -eq $networks) {
  Add-Failure $failures 'Rendered model has no isolated network definition.'
} else {
  if ($null -ne $networks.PSObject.Properties['homelab-net']) {
    Add-Failure $failures "Rendered model still defines the production 'homelab-net' network."
  }

  $rehearsalNetwork = Get-PropertyValue -Object $networks -Name 'rehearsal-net'
  if ($null -eq $rehearsalNetwork) {
    Add-Failure $failures "Rendered model is missing the 'rehearsal-net' network definition."
  } else {
    $networkName = [string](Get-PropertyValue -Object $rehearsalNetwork -Name 'name')
    if (-not (Test-RehearsalNamespace $networkName)) {
      Add-Failure $failures "Network 'rehearsal-net' must use the exact nexus-migration-phase3-e078895 namespace."
    }
    if ((Get-PropertyValue -Object $rehearsalNetwork -Name 'external') -eq $true) {
      Add-Failure $failures "Network 'rehearsal-net' must not be external."
    }
    if ((Get-PropertyValue -Object $rehearsalNetwork -Name 'internal') -ne $true) {
      Add-Failure $failures "Network 'rehearsal-net' must be internal."
    }
  }
}

$volumes = Get-PropertyValue -Object $model -Name 'volumes'
if ($null -eq $volumes) {
  Add-Failure $failures 'Rendered model has no named rehearsal volumes.'
} else {
  foreach ($volumeProperty in $volumes.PSObject.Properties) {
    $volumeName = [string](Get-PropertyValue -Object $volumeProperty.Value -Name 'name')
    if ($volumeName -match '^nexus-vtt2-codex-') {
      Add-Failure $failures "Volume '$($volumeProperty.Name)' resolves to a production nexus-vtt2-codex-* volume."
    }
    if (-not (Test-RehearsalNamespace $volumeName)) {
      Add-Failure $failures "Volume '$($volumeProperty.Name)' is missing the exact nexus-migration-phase3-e078895 namespace."
    }
  }
}

$applicationServices = @(
  'postgres',
  'asset-server',
  'nexus-forge',
  'frontend',
  'backend',
  'doc-api',
  'doc-processor',
  'doc-websocket',
  'admin-ui',
  'dm-ui'
)

if ($null -ne $services) {
  foreach ($serviceProperty in $services.PSObject.Properties) {
    $serviceName = $serviceProperty.Name
    $service = $serviceProperty.Value

    $containerName = [string](Get-PropertyValue -Object $service -Name 'container_name')
    if ($containerName -match '^nexus-vtt2-(?!rehearsal-)') {
      Add-Failure $failures "Service '$serviceName' retains production container_name identity."
    }
    if ($containerName -and $productionIdentities.Contains($containerName)) {
      Add-Failure $failures "Service '$serviceName' container_name matches an explicit production identity."
    }
    if ($containerName -and -not (Test-RehearsalNamespace $containerName)) {
      Add-Failure $failures "Service '$serviceName' container_name is missing a unique rehearsal namespace."
    }

    $hostname = [string](Get-PropertyValue -Object $service -Name 'hostname')
    if ($hostname -match '^nexus-vtt2-(?!rehearsal-)') {
      Add-Failure $failures "Service '$serviceName' retains production hostname identity."
    }
    if ($hostname -and $productionIdentities.Contains($hostname)) {
      Add-Failure $failures "Service '$serviceName' hostname matches an explicit production identity."
    }
    if ($hostname -and -not (Test-RehearsalNamespace $hostname)) {
      Add-Failure $failures "Service '$serviceName' hostname is missing a unique rehearsal namespace."
    }

    $serviceNetworks = Get-PropertyValue -Object $service -Name 'networks'
    if ($null -eq $serviceNetworks -or $null -eq $serviceNetworks.PSObject.Properties['rehearsal-net']) {
      Add-Failure $failures "Service '$serviceName' is not attached to the isolated rehearsal-net network."
    }
    if ($null -ne $serviceNetworks -and $null -ne $serviceNetworks.PSObject.Properties['homelab-net']) {
      Add-Failure $failures "Service '$serviceName' remains attached to production homelab-net."
    }

    foreach ($mount in @(Get-PropertyValue -Object $service -Name 'volumes')) {
      if ($null -eq $mount) {
        continue
      }
      $source = [string](Get-PropertyValue -Object $mount -Name 'source')
      $mountType = [string](Get-PropertyValue -Object $mount -Name 'type')
      if ($mountType -eq 'bind' -and $source -match '^/mnt/docker-nas-vol1(?:/|$)') {
        Add-Failure $failures "Service '$serviceName' retains a production /mnt/docker-nas-vol1 bind mount."
      }
      if ($mountType -eq 'volume' -and $source -match '^nexus-vtt2-codex-') {
        Add-Failure $failures "Service '$serviceName' uses a production nexus-vtt2-codex-* volume."
      }
    }

    $ports = Get-PropertyValue -Object $service -Name 'ports'
    if ($null -ne $ports -and @($ports).Count -gt 0) {
      Add-Failure $failures "Service '$serviceName' publishes a host port; rehearsal must be private."
    }

    $environment = Get-PropertyValue -Object $service -Name 'environment'
    if ($null -ne $environment) {
      foreach ($endpointKey in @('CORS_ORIGIN', 'GOOGLE_CALLBACK_URL', 'DISCORD_CALLBACK_URL')) {
        $endpoint = Get-PropertyValue -Object $environment -Name $endpointKey
        if ($null -ne $endpoint -and -not (Test-RehearsalEndpoint $endpoint)) {
          Add-Failure $failures "Service '$serviceName' has a production or non-.invalid $endpointKey endpoint."
        }
      }
    }

    if ($applicationServices -contains $serviceName) {
      $image = [string](Get-PropertyValue -Object $service -Name 'image')
      if ($image -notmatch '@sha256:[0-9a-f]{64}$') {
        Add-Failure $failures "Application service '$serviceName' does not use an immutable sha256 image digest."
      }
    }
  }
}

if ($failures.Count -gt 0) {
  [Console]::Error.WriteLine('Rehearsal isolation validation failed:')
  foreach ($failure in $failures) {
    [Console]::Error.WriteLine("- $failure")
  }
  exit 1
}

Write-Output 'Rehearsal isolation validation passed: production and production-plus-rehearsal Compose models rendered; isolated graph contains no prohibited production resources.'
