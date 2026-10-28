# Runtime dependency only: preserve the locked V28's declared font family on Windows.
param([Parameter(Mandatory=$true)][string]$DossierPrive)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$collection = New-Object System.Drawing.Text.InstalledFontCollection
try { $present = @($collection.Families | ForEach-Object Name) -contains 'DejaVu Sans Condensed' } finally { $collection.Dispose() }
if ($present) { Write-Host 'Police DejaVu Sans Condensed deja disponible.'; return }
$archive = Join-Path $DossierPrive 'dejavu-2.37.zip'
$url = 'https://github.com/dejavu-fonts/dejavu-fonts/releases/download/version_2_37/dejavu-fonts-ttf-2.37.zip'
if (!(Test-Path $archive)) { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $archive }
if ((Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne '7576310b219e04159d35ff61dd4a4ec4cdba4f35c00e002a136f00e96a908b0a') { throw 'Archive de police non conforme. Aucun fichier installe.' }
$extrait = Join-Path $DossierPrive 'dejavu'
Expand-Archive -Path $archive -DestinationPath $extrait -Force
$polices = Join-Path $env:LOCALAPPDATA 'Microsoft\Windows\Fonts'
New-Item -ItemType Directory -Force $polices | Out-Null
$registre = 'HKCU:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts'
New-Item -Path $registre -Force | Out-Null
foreach ($font in @(@('DejaVuSansCondensed.ttf','DejaVu Sans Condensed (TrueType)'),@('DejaVuSansCondensed-Bold.ttf','DejaVu Sans Condensed Bold (TrueType)'))) {
    $source = Join-Path $extrait ('dejavu-fonts-ttf-2.37\ttf\'+$font[0])
    $destination = Join-Path $polices $font[0]
    Copy-Item $source $destination -Force
    New-ItemProperty -Path $registre -Name $font[1] -Value $destination -PropertyType String -Force | Out-Null
}
Write-Host 'Police historique gratuite installee pour votre compte Windows. Licence conservee avec l archive dans .local-windows.'
Write-Host 'Si Chrome ne voit pas la police, fermez ses fenetres puis relancez le test (ou reconnectez votre session Windows).'
