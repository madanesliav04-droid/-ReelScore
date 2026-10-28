param([string]$AdresseIP, [switch]$SansTelechargementModele, [switch]$PourTunnel)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
function Executer([string]$Programme, [string[]]$Arguments) {
    & $Programme @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Echec de $Programme. Corrigez le message ci-dessus puis relancez l'installation." }
}
$outils = @('node','npm.cmd','ffmpeg','ffprobe','python')
if ($PourTunnel) { $outils += 'cloudflared' } else { $outils += 'mkcert' }
foreach ($outil in $outils) {
    if (!(Get-Command $outil -ErrorAction SilentlyContinue)) { throw "$outil manque. Consultez docs/social-plus/WINDOWS_IPHONE.md, section Prerequis." }
}
$nodeVersion = & node --version
if ($nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 24) { throw 'Node.js 24 minimum requis.' }
if (!$PourTunnel) {
$adresses = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
    $_.IPAddress -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)' -and $_.AddressState -eq 'Preferred'
})
Write-Host 'Adresses privees disponibles :'
$adresses | Format-Table InterfaceAlias,IPAddress
if (!$AdresseIP) { $AdresseIP = Read-Host 'Copiez ici l adresse IPv4 de votre Wi-Fi (exemple 192.168.1.25)' }
if (!($adresses.IPAddress -contains $AdresseIP)) { throw 'Cette adresse privee ne correspond pas a une interface de ce PC.' }
$profil = $adresses | Where-Object IPAddress -eq $AdresseIP | Select-Object -First 1
$reseau = Get-NetConnectionProfile -InterfaceIndex $profil.InterfaceIndex -ErrorAction Stop
if ($reseau.NetworkCategory -ne 'Private') { throw 'Le Wi-Fi doit etre de confiance et son profil Windows doit etre Prive. Consultez le guide avant de continuer.' }
}
$prive = Join-Path $PSScriptRoot '.local-windows'
New-Item -ItemType Directory -Force $prive | Out-Null
# Limit local access to the current Windows account and SYSTEM; never publish this folder.
$sid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
Executer 'icacls.exe' @($prive,'/inheritance:r','/grant:r',"*${sid}:(OI)(CI)F",'*S-1-5-18:(OI)(CI)F')
if ($PourTunnel) { & (Join-Path $PSScriptRoot 'scripts/install-tunnel-font.ps1') -DossierPrive $prive }
Executer 'npm.cmd' @('ci','--no-audit','--no-fund')
$venv = Join-Path $prive 'python'
if (!(Test-Path (Join-Path $venv 'Scripts\python.exe'))) { Executer 'python' @('-m','venv',$venv) }
$pythonLocal = Join-Path $venv 'Scripts\python.exe'
Executer $pythonLocal @('-m','pip','install','numpy','Pillow','-r','engines/requirements-asr.txt')
$modele = Join-Path $prive 'whisper-small'
if (!$SansTelechargementModele) {
    Write-Host 'Telechargement unique du modele local gratuit Whisper small (environ 500 Mo). Aucun abonnement ni API payante.'
    Executer $pythonLocal @('scripts/download-local-model.py',$modele)
}
foreach ($fichier in @('model.bin','config.json','tokenizer.json')) {
    if (!(Test-Path (Join-Path $modele $fichier))) { throw "Modele local incomplet : $fichier. Relancez sans -SansTelechargementModele." }
}
$chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe","${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe","$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe","${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe","$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (!$chrome) { throw 'Installez Chrome ou Edge pour le moteur Social Kinetic.' }
if (!$PourTunnel) {
Executer 'mkcert' @('-install')
$cert = Join-Path $prive 'socialplus.pem'; $cle = Join-Path $prive 'socialplus-key.pem'
Executer 'mkcert' @('-cert-file',$cert,'-key-file',$cle,$AdresseIP,'localhost','127.0.0.1')
$ca = (& mkcert -CAROOT).Trim()
# Export ONLY the public root certificate. Never copy rootCA-key.pem.
$publicCA = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'SocialPlus-certificat-iPhone.cer'
Copy-Item (Join-Path $ca 'rootCA.pem') $publicCA -Force
@{ ip=$AdresseIP; port=8443; cert=$cert; key=$cle; runtime=@{SOCIALPLUS_PYTHON=$pythonLocal;SOCIALPLUS_ASR_PYTHON=$pythonLocal;SOCIALPLUS_ASR_MODEL_DIR=$modele;SOCIALPLUS_CHROMIUM=$chrome} } | ConvertTo-Json -Depth 3 | Set-Content (Join-Path $prive 'config.json') -Encoding UTF8
# Node accepts UTF-8 JSON; remove the BOM emitted by Windows PowerShell 5.1.
$configFile = Join-Path $prive 'config.json'
[IO.File]::WriteAllText($configFile,(Get-Content $configFile -Raw),(New-Object Text.UTF8Encoding($false)))
} else {
    $runtime = @{SOCIALPLUS_PYTHON=$pythonLocal;SOCIALPLUS_ASR_PYTHON=$pythonLocal;SOCIALPLUS_ASR_MODEL_DIR=$modele;SOCIALPLUS_CHROMIUM=$chrome} | ConvertTo-Json
    [IO.File]::WriteAllText((Join-Path $prive 'runtime-tunnel.json'),$runtime,(New-Object Text.UTF8Encoding($false)))
}
$env:SOCIALPLUS_PYTHON=$pythonLocal; $env:SOCIALPLUS_ASR_PYTHON=$pythonLocal; $env:SOCIALPLUS_ASR_MODEL_DIR=$modele; $env:SOCIALPLUS_CHROMIUM=$chrome
Executer 'npm.cmd' @('run','preflight')
$etat = (& node scripts/windows-local.mjs --owner-status).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Impossible de verifier le compte proprietaire.' }
if ($etat -ne 'ready') { Executer 'npm.cmd' @('run','owner') }
if ($PourTunnel) {
    Executer 'icacls.exe' @((Join-Path $PSScriptRoot '.env.local'),'/inheritance:r','/grant:r',"*${sid}:F",'*S-1-5-18:F')
}
if ($PourTunnel) {
    Write-Host "`nInstallation terminee. Lancez DEMARRER-TEST-IPHONE.cmd pour obtenir le lien HTTPS."
    Write-Host "Aucun certificat iPhone, aucune regle de port entrant et aucun compte Cloudflare requis."
} else {
Write-Host "`nInstallation terminee. Certificat public pour iPhone : $publicCA"
Write-Host "Adresse PC et iPhone : https://${AdresseIP}:8443"
Write-Host 'Configurez la regle pare-feu du guide, puis double-cliquez DEMARRER-SOCIALPLUS.cmd.'

}
