$ErrorActionPreference = "Stop"

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$sqlFile = Join-Path $scriptDirectory "create_daily_sales_database.sql"

if (-not $env:MYSQL_HOST) {
    throw "Set MYSQL_HOST to the MySQL server hostname before running this script."
}
if (-not $env:MYSQL_USER) {
    throw "Set MYSQL_USER to a MySQL user with permission to create the database and table."
}
if (-not (Get-Command mysql.exe -ErrorAction SilentlyContinue)) {
    throw "mysql.exe was not found on PATH. Install the MySQL client or add its bin folder to PATH."
}

$mysqlArguments = @(
    "--protocol=tcp",
    "--host=$env:MYSQL_HOST",
    "--port=$(if ($env:MYSQL_PORT) { $env:MYSQL_PORT } else { "3306" })",
    "--user=$env:MYSQL_USER"
)

$hadPassword = -not [string]::IsNullOrWhiteSpace($env:MYSQL_PASSWORD)
$oldMysqlPwd = $env:MYSQL_PWD

try {
    if ($hadPassword) {
        # MYSQL_PWD avoids putting the password in the mysql command arguments.
        $env:MYSQL_PWD = $env:MYSQL_PASSWORD
    } else {
        Write-Host "MYSQL_PASSWORD is not set; the mysql client will prompt for it."
    }

    Get-Content -Raw -Path $sqlFile | & mysql.exe @mysqlArguments
    if ($LASTEXITCODE -ne 0) {
        throw "mysql.exe failed with exit code $LASTEXITCODE."
    }

    Write-Host "Daily Sales integration database and table are ready."
}
finally {
    if ($null -eq $oldMysqlPwd) {
        Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
    } else {
        $env:MYSQL_PWD = $oldMysqlPwd
    }
}
