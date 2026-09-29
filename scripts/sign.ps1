# Profession-Archives 代码签名脚本（自签名 · 本机信任）
#
# 为什么需要：
#   未签名的 exe 会被 Windows 的几道信誉检查拦下，表现为"无法识别的应用 / 发布者未知"弹窗：
#     - Microsoft Defender SmartScreen（带「来自 Internet」标记时触发）
#     - 智能应用控制 Smart App Control（Win11，不需要网络标记，只要"未签名+无信誉"就拦）
#     - 「打开文件 - 安全警告 / 无法验证发布者」
#   给 exe 签上名、并让本机信任这张证书后，Windows 认为"发布者已知"，上述弹窗不再出现。
#
# 适用范围：
#   自签名只对**装了这张证书的机器**有效。发给别人不弹窗必须买正规代码签名证书（OV/EV）。
#
# 用法（普通身份 PowerShell，不要用管理员）：
#   pwsh -File scripts\sign.ps1 -Path 'release\Profession-Archives-v0.2.5-win-x64.exe'
#   pwsh -File scripts\sign.ps1 -Path '<exe>' -Subject 'CN=你的名字' -Years 5
#
# 本脚本会做三件事，每一步都可撤销：
#   1. 若当前用户没有本项目的自签名代码签名证书，则新建一张（存在 CurrentUser\My）
#   2. 把该证书装进 CurrentUser 的「受信任的根证书颁发机构」与「受信任的发布者」
#   3. 用该证书给目标 exe 签名（带时间戳；离线时自动降级为不带时间戳）
#
# 撤销：
#   1) 删除签名：  Set-AuthenticodeSignature -FilePath '<exe>' -Certificate $null
#   2) 移除信任：  在 certmgr.msc → 受信任的根证书颁发机构 / 受信任的发布者 里删除 CN=Profession-Archives
#   3) 删除证书：  Get-ChildItem Cert:\CurrentUser\My | Where-Object Subject -like '*Profession-Archives*' | Remove-Item

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Path,
  [string]$Subject = 'CN=Profession-Archives, O=Profession-Archives, C=CN',
  [int]$Years = 5,
  [string]$TimestampServer = 'http://timestamp.digicert.com'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Path)) { throw "找不到文件：$Path" }
$item = Get-Item -LiteralPath $Path
Write-Host "目标：$($item.FullName)  ($([math]::Round($item.Length / 1MB, 1)) MB)"

# ── 1) 取或建证书 ──────────────────────────────────────────────
$cert = Get-ChildItem Cert:\CurrentUser\My |
  Where-Object { $_.Subject -eq $Subject -and $_.HasPrivateKey } |
  Sort-Object NotAfter -Descending | Select-Object -First 1

if ($cert) {
  Write-Host "复用已有签名证书：$($cert.Thumbprint)  到期 $($cert.NotAfter.ToString('yyyy-MM-dd'))"
} else {
  Write-Host "新建自签名代码签名证书（$Years 年）…"
  $cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $Subject `
    -CertStoreLocation Cert:\CurrentUser\My `
    -KeyUsage DigitalSignature `
    -KeyAlgorithm RSA `
    -KeyLength 3072 `
    -NotAfter (Get-Date).AddYears($Years) `
    -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3')
  Write-Host "已创建：$($cert.Thumbprint)"
}

# ── 2) 让本机信任这张证书（否则签名有效但"发布者未知"）─────────
$cerDir = Join-Path $item.DirectoryName '_codesign'
New-Item -ItemType Directory -Force -Path $cerDir | Out-Null
$cerPath = Join-Path $cerDir 'profession-archives-codesign.cer'
Export-Certificate -Cert $cert -FilePath $cerPath -Force | Out-Null
Write-Host "证书已导出：$cerPath"

foreach ($store in @('Root', 'TrustedPublisher')) {
  $existing = Get-ChildItem "Cert:\CurrentUser\$store" | Where-Object Thumbprint -eq $cert.Thumbprint
  if ($existing) {
    Write-Host "已在「$store」中，跳过"
  } else {
    Import-Certificate -FilePath $cerPath -CertStoreLocation "Cert:\CurrentUser\$store" | Out-Null
    Write-Host "已加入「$store」（如需移除见脚本头部"撤销"说明）"
  }
}

# ── 3) 签名 ────────────────────────────────────────────────────
Write-Host "签名中…"
try {
  $sig = Set-AuthenticodeSignature -LiteralPath $item.FullName -Certificate $cert -TimestampServer $TimestampServer
} catch {
  Write-Warning "带时间戳签名失败（可能无网络），改为不带时间戳：$($_.Exception.Message)"
  $sig = Set-AuthenticodeSignature -LiteralPath $item.FullName -Certificate $cert
}

if ($sig.Status -ne 'Valid') {
  Write-Warning "签名状态：$($sig.Status)  $($sig.StatusMessage)"
}

# ── 4) 复核 ────────────────────────────────────────────────────
$check = Get-AuthenticodeSignature -LiteralPath $item.FullName
Write-Host ''
Write-Host "=== 结果 ==="
Write-Host "  签名状态 : $($check.Status)"
Write-Host "  签署者   : $($check.SignerCertificate.Subject)"
Write-Host "  指纹     : $($check.SignerCertificate.Thumbprint)"
if ($check.Status -eq 'Valid') {
  Write-Host '  ✓ 本机已信任该发布者，SmartScreen / 智能应用控制不会再拦这个 exe'
} else {
  Write-Host '  ⚠ 未达到 Valid：检查证书是否已装入 CurrentUser\Root 与 TrustedPublisher'
}

# ── 5) 交付提醒 ────────────────────────────────────────────────
Write-Host ''
Write-Host '提醒：签名后请重新打包 zip 再交付 ——'
Write-Host '      zip 不保存 NTFS 权限与完整性标签，用户解压后拿到的是干净且已签名的 exe。'
