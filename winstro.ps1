# Check if Git is installed
if (Get-Command git -ErrorAction SilentlyContinue) {
    Write-Host "[winstro*script]: Git is already installed."
    Start-Sleep -Seconds 1.5
    Clear-Host
} else {
    Write-Host "[winstro*script]: Git is not installed. Installing Git..."
    $gitInstallerPath = "$env:TEMP\Git-Installer.exe"
    Invoke-WebRequest -Uri "https://github.com/git-for-windows/git/releases/download/v2.51.0.windows.1/Git-2.51.0-64-bit.exe" -OutFile $gitInstallerPath
    Start-Process -FilePath $gitInstallerPath -ArgumentList "/VERYSILENT", "/NORESTART" -Wait
    Remove-Item $gitInstallerPath
    Write-Host "[winstro*script]: Git installed successfully."
}

# Check if Bun is installed
if (Get-Command bun -ErrorAction SilentlyContinue) {
    Write-Host "[winstro*script]: Bun is already installed."
    Start-Sleep -Seconds 1.5
    Clear-Host
} else {
    # Install bun
    Write-Host "[winstro*script]: Bun is not installed. Installing Bun..."
    Write-Host "[winstro*script]: Installing Bun..."
    Invoke-WebRequest -Uri "https://bun.sh/install.ps1" -OutFile "install_bun.ps1"
    & .\install_bun.ps1
    Remove-Item .\install_bun.ps1
    Clear-Host
}

# Add Bun to PATH
Write-Host "[winstro*script]: Adding Bun to PATH..."
$env:Path += ";$env:USERPROFILE\.bun\bin"
[System.Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::User)
Write-Host "[winstro*script]: Bun installed successfully."
Start-Sleep -Seconds 1.5
Clear-Host

# Add Git to PATH (if not already added by the installer)
$gitPath = "C:\Program Files\Git\cmd"
if (-not ($env:Path -like "*$gitPath*")) {
    Write-Host "[winstro*script]: Adding Git to PATH..."
    $env:Path += ";$gitPath"
    [System.Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableTarget]::User)
    Write-Host "[winstro*script]: Git added to PATH successfully."
    Start-Sleep -Seconds 1.5
    Clear-Host
} else {
    Write-Host "[winstro*script]: Git is already in PATH."
}

# Restart the script to ensure Bun & git are available in the current session
Write-Host "[winstro*script]: Restarting the script to apply changes..."
Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile", "-ExecutionPolicy Bypass", "-File `"$PSCommandPath`"" -Verb RunAs
exit

# Clone the repository
Write-Host "[winstro*script]: Cloning the repository..."
git clone https://github.com/rearrangement/winstro winstro
Set-Location .\winstro
Write-Host "[winstro*script]: Repository cloned successfully."
Start-Sleep -Seconds 1.5
Clear-Host

# Install dependencies
Write-Host "[winstro*script]: Installing dependencies..."
bun i
Write-Host "[winstro*script]: Dependencies installed successfully."
Start-Sleep -Seconds 1.5
Clear-Host

# Run the main script
bun run main