# Static web server for Windows using built-in PowerShell (nothing to install).
# Started by start-windows.bat. To change the port, edit $Port below.

$Port = 8080
$Root = Join-Path $PSScriptRoot "html"
$RootFull = [System.IO.Path]::GetFullPath($Root)

$Mime = @{
  ".html" = "text/html; charset=utf-8"; ".css" = "text/css; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"; ".json" = "application/json; charset=utf-8"
  ".png" = "image/png"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"; ".gif" = "image/gif"
  ".svg" = "image/svg+xml"; ".ico" = "image/x-icon"; ".mp3" = "audio/mpeg"
  ".ttf" = "font/ttf"; ".woff" = "font/woff"; ".woff2" = "font/woff2"; ".csv" = "text/csv; charset=utf-8"
}

$Listener = New-Object System.Net.HttpListener
$Listener.Prefixes.Add("http://localhost:$Port/")
try {
  $Listener.Start()
} catch {
  Write-Host "Khong mo duoc cong $Port (co the dang bi chuong trinh khac dung)." -ForegroundColor Red
  Write-Host "Mo file start-server.ps1, doi `$Port = 8080 thanh so khac (vd 8081) roi chay lai."
  Read-Host "Nhan Enter de thoat"
  exit 1
}

$Url = "http://localhost:$Port/"
Write-Host "Vong quay may man dang chay:" -ForegroundColor Green
Write-Host "  Vong quay : $Url"
Write-Host "  Dashboard : ${Url}dashboard.html"
Write-Host "Dong cua so nay de tat."
Start-Process $Url

while ($Listener.IsListening) {
  try {
    $Context = $Listener.GetContext()
  } catch {
    break
  }
  $Response = $Context.Response
  try {
    $Path = [System.Uri]::UnescapeDataString($Context.Request.Url.AbsolutePath)
    if ($Path.EndsWith("/")) { $Path += "index.html" }
    $File = [System.IO.Path]::GetFullPath((Join-Path $RootFull $Path.TrimStart("/")))

    if (-not $File.StartsWith($RootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
      $Response.StatusCode = 403
    } elseif (Test-Path -LiteralPath $File -PathType Leaf) {
      $Ext = [System.IO.Path]::GetExtension($File).ToLower()
      $Type = $Mime[$Ext]
      if (-not $Type) { $Type = "application/octet-stream" }
      $Bytes = [System.IO.File]::ReadAllBytes($File)
      $Response.ContentType = $Type
      $Response.ContentLength64 = $Bytes.Length
      $Response.OutputStream.Write($Bytes, 0, $Bytes.Length)
    } else {
      $Response.StatusCode = 404
    }
  } catch {
    $Response.StatusCode = 500
  } finally {
    $Response.OutputStream.Close()
  }
}
