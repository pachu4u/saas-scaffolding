#Requires -Version 5.1
<#
.SYNOPSIS
    riogentix dev startup script

.DESCRIPTION
    Starts all local development services for the riogentix monorepo:
    Docker Compose (Traefik, Keycloak, Postgres, Redis), runs Prisma
    migrations, optionally seeds the database, and launches the Turborepo
    dev server.

.PARAMETER Seed
    If specified, runs the database seed after migrations.

.EXAMPLE
    .\dev.ps1
    .\dev.ps1 -Seed
#>
param(
    [switch]$Seed
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
$ROOT = "C:\Users\kguru\projects\saas-scaffolding\.claude\worktrees\focused-greider-11cea3"
$COMPOSE_FILE         = Join-Path $ROOT "infra\compose\docker-compose.yml"
$COMPOSE_OVERRIDE     = Join-Path $ROOT "infra\compose\docker-compose.dev-override.yml"
$CERT_FILE            = Join-Path $ROOT "infra\certs\local.pem"
$CERTS_DIR            = Join-Path $ROOT "infra\certs"

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
function Write-Header {
    Write-Host ""
    Write-Host "  ██████╗ ██╗ ██████╗  ██████╗ ███████╗███╗   ██╗████████╗██╗██╗  ██╗" -ForegroundColor Cyan
    Write-Host "  ██╔══██╗██║██╔═══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██║╚██╗██╔╝" -ForegroundColor Cyan
    Write-Host "  ██████╔╝██║██║   ██║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ██║ ╚███╔╝ " -ForegroundColor Cyan
    Write-Host "  ██╔══██╗██║██║   ██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ██║ ██╔██╗ " -ForegroundColor Cyan
    Write-Host "  ██║  ██║██║╚██████╔╝╚██████╔╝███████╗██║ ╚████║   ██║   ██║██╔╝ ██╗" -ForegroundColor Cyan
    Write-Host "  ╚═╝  ╚═╝╚═╝ ╚═════╝  ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝╚═╝  ╚═╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  dev startup" -ForegroundColor DarkCyan
    Write-Host "  ─────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
    Write-Host ""
}

function Write-Step {
    param([string]$Message)
    Write-Host "  ▶  $Message" -ForegroundColor Yellow
}

function Write-Ok {
    param([string]$Message)
    Write-Host "  ✓  $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "  ℹ  $Message" -ForegroundColor DarkCyan
}

function Write-Warn {
    param([string]$Message)
    Write-Host "  ⚠  $Message" -ForegroundColor DarkYellow
}

function Write-Fail {
    param([string]$Message)
    Write-Host ""
    Write-Host "  ✗  $Message" -ForegroundColor Red
    Write-Host ""
}

function Test-CommandExists {
    param([string]$Command)
    $null = Get-Command $Command -ErrorAction SilentlyContinue
    return $?
}

# ---------------------------------------------------------------------------
# 1. Branded header
# ---------------------------------------------------------------------------
Write-Header

# ---------------------------------------------------------------------------
# 2. Prerequisites
# ---------------------------------------------------------------------------
Write-Step "Checking prerequisites..."

# Docker Desktop
if (-not (Test-CommandExists "docker")) {
    Write-Fail "Docker is not on PATH. Please install Docker Desktop and ensure it is running."
    exit 1
}

$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Docker daemon is not running. Please start Docker Desktop and try again."
    exit 1
}
Write-Ok "Docker Desktop is running."

# pnpm
if (-not (Test-CommandExists "pnpm")) {
    Write-Fail "pnpm is not on PATH. Install it with: npm install -g pnpm"
    exit 1
}
Write-Ok "pnpm is available."

# ---------------------------------------------------------------------------
# 3. TLS certificates (mkcert, optional)
# ---------------------------------------------------------------------------
Write-Host ""
Write-Step "Checking local TLS certificates..."

if (Test-Path $CERT_FILE) {
    Write-Ok "Certificate found at infra\certs\local.pem — skipping mkcert."
} else {
    Write-Warn "Certificate not found at infra\certs\local.pem."

    if (Test-CommandExists "mkcert") {
        Write-Step "Running mkcert to generate local certificates..."

        if (-not (Test-Path $CERTS_DIR)) {
            New-Item -ItemType Directory -Path $CERTS_DIR -Force | Out-Null
        }

        Push-Location $CERTS_DIR
        try {
            mkcert -install 2>&1 | Out-Null
            mkcert `
                "localhost" `
                "lvh.me" `
                "*.lvh.me" `
                "traefik.lvh.me" `
                "keycloak.lvh.me" `
                "app.lvh.me"

            # mkcert names output files after the first domain; rename to expected names
            $generated = Get-ChildItem -Path $CERTS_DIR -Filter "localhost+*.pem" | Select-Object -First 1
            if ($generated) {
                $keyFile = $generated.FullName -replace "\.pem$", "-key.pem"
                Copy-Item $generated.FullName (Join-Path $CERTS_DIR "local.pem") -Force
                if (Test-Path $keyFile) {
                    Copy-Item $keyFile (Join-Path $CERTS_DIR "local-key.pem") -Force
                }
            }

            Write-Ok "Certificates generated in infra\certs\"
        } catch {
            Write-Warn "mkcert ran but encountered an error: $_"
            Write-Warn "Continuing without certificates — HTTPS may not work."
        } finally {
            Pop-Location
        }
    } else {
        Write-Warn "mkcert is not installed. HTTPS will not be available locally."
        Write-Host ""
        Write-Host "  To enable local HTTPS:" -ForegroundColor DarkGray
        Write-Host "    1. Install mkcert: https://github.com/FiloSottile/mkcert#installation" -ForegroundColor DarkGray
        Write-Host "       (e.g. via Chocolatey: choco install mkcert)" -ForegroundColor DarkGray
        Write-Host "    2. Re-run this script." -ForegroundColor DarkGray
        Write-Host ""
        Write-Info "Continuing without local TLS certificates..."
    }
}

# ---------------------------------------------------------------------------
# 4. Start Docker Compose
# ---------------------------------------------------------------------------
Write-Host ""
Write-Step "Starting Docker Compose services..."

docker compose `
    -f $COMPOSE_FILE `
    -f $COMPOSE_OVERRIDE `
    up -d

if ($LASTEXITCODE -ne 0) {
    Write-Fail "docker compose up failed (exit code $LASTEXITCODE). Check the output above."
    exit 1
}

Write-Ok "Docker Compose services started."

# ---------------------------------------------------------------------------
# 5. Wait for Postgres
# ---------------------------------------------------------------------------
Write-Host ""
Write-Step "Waiting for Postgres to become healthy..."

$pgReady = $false
$maxAttempts = 20
$attempt = 0

while (-not $pgReady -and $attempt -lt $maxAttempts) {
    $attempt++

    # Try docker exec pg_isready first; fall back to a simple sleep if the
    # container name is unknown or pg_isready is unavailable.
    $pgCheck = docker exec postgres pg_isready -U postgres 2>&1
    if ($LASTEXITCODE -eq 0) {
        $pgReady = $true
    } else {
        # Also try the second postgres instance common in this stack
        $pgCheck2 = docker exec postgres-keycloak pg_isready -U postgres 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pgReady = $true
        }
    }

    if (-not $pgReady) {
        Write-Host "  .  Attempt $attempt/$maxAttempts — not ready yet, retrying in 3s..." -ForegroundColor DarkGray
        Start-Sleep -Seconds 3
    }
}

if ($pgReady) {
    Write-Ok "Postgres is ready."
} else {
    Write-Warn "Postgres did not report ready after $maxAttempts attempts."
    Write-Info "Waiting an extra 5s and proceeding anyway..."
    Start-Sleep -Seconds 5
}

# ---------------------------------------------------------------------------
# 6. Prisma migrations
# ---------------------------------------------------------------------------
Write-Host ""
Write-Step "Running Prisma migrations..."

Push-Location $ROOT
try {
    pnpm --filter "@platform/db" db:migrate
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Prisma migration failed (exit code $LASTEXITCODE)."
        exit 1
    }
    Write-Ok "Prisma migrations complete."
} finally {
    Pop-Location
}

# ---------------------------------------------------------------------------
# 7. Optional seed
# ---------------------------------------------------------------------------
if ($Seed) {
    Write-Host ""
    Write-Step "Seeding database..."

    Push-Location $ROOT
    try {
        pnpm --filter "@platform/db" db:seed
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Database seed failed (exit code $LASTEXITCODE)."
            exit 1
        }
        Write-Ok "Database seeded."
    } finally {
        Pop-Location
    }
}

# ---------------------------------------------------------------------------
# 8. Service URLs
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  ─────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host "  Service URLs" -ForegroundColor Cyan
Write-Host "  ─────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""
Write-Host "    Web app   " -NoNewline -ForegroundColor DarkGray
Write-Host "http://localhost:3000" -ForegroundColor White
Write-Host "    Keycloak  " -NoNewline -ForegroundColor DarkGray
Write-Host "http://localhost:8080" -ForegroundColor White
Write-Host "    Traefik   " -NoNewline -ForegroundColor DarkGray
Write-Host "http://traefik.lvh.me" -ForegroundColor White
Write-Host ""
Write-Host "  ─────────────────────────────────────────────────────────────────────" -ForegroundColor DarkGray
Write-Host ""

# ---------------------------------------------------------------------------
# 9. Prompt to start dev server
# ---------------------------------------------------------------------------
$answer = Read-Host "  Start Turborepo dev server now? [Y/n]"

if ($answer -eq "" -or $answer -match "^[Yy]") {
    Write-Host ""
    Write-Step "Starting dev server (pnpm turbo run dev)..."
    Write-Info "Press Ctrl+C to stop."
    Write-Host ""

    Push-Location $ROOT
    try {
        pnpm turbo run dev
    } finally {
        Pop-Location
    }
} else {
    Write-Host ""
    Write-Info "Skipping dev server. Run manually with:"
    Write-Host "    pnpm turbo run dev" -ForegroundColor White
    Write-Host ""
    Write-Ok "riogentix dev environment is ready."
    Write-Host ""
}
