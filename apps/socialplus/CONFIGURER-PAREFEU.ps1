# Run once in PowerShell as Administrator, after INSTALLER-SOCIALPLUS.ps1.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$config = Get-Content '.local-windows/config.json' -Raw | ConvertFrom-Json
$interface = Get-NetIPAddress -AddressFamily IPv4 -IPAddress $config.ip -ErrorAction Stop
$profil = Get-NetConnectionProfile -InterfaceIndex $interface.InterfaceIndex
if ($profil.NetworkCategory -ne 'Private') { throw 'Le reseau selectionne doit etre Prive et de confiance.' }
$nom = 'SocialPlus-local-HTTPS'
if (Get-NetFirewallRule -Name $nom -ErrorAction SilentlyContinue) { Remove-NetFirewallRule -Name $nom }
New-NetFirewallRule -Name $nom -DisplayName 'Social+ HTTPS Wi-Fi prive uniquement' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8443 -LocalAddress $config.ip -RemoteAddress LocalSubnet -InterfaceAlias $interface.InterfaceAlias -Profile Private -Program (Get-Command node).Source | Out-Null
Write-Host 'Acces limite au sous-reseau local, a cette interface et au profil Prive. Aucun port routeur a ouvrir.'
