$ErrorActionPreference = "Stop"
$WorkingDir = "c:\Users\maxim\OneDrive\Escritorio\Proyectos\FCcasacas"

$ZipPath = Join-Path $WorkingDir "libwebp.zip"
$ExtractPath = Join-Path $WorkingDir "libwebp"

if (-not (Test-Path $ExtractPath)) {
    Write-Host "Downloading cwebp..."
    Invoke-WebRequest -Uri "https://github.com/webmproject/libwebp/releases/download/v1.3.2/libwebp-1.3.2-windows-x64.zip" -OutFile $ZipPath
    Expand-Archive -Path $ZipPath -DestinationPath $ExtractPath -Force
}

$CwebpPath = Get-ChildItem -Path $ExtractPath -Filter "cwebp.exe" -Recurse | Select-Object -First 1
if (-not $CwebpPath) {
    throw "cwebp.exe not found"
}
$CwebpExe = $CwebpPath.FullName

$SupabaseUrl = "https://domzojnsbhqbmbmmjdtq.supabase.co"
$AnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvbXpvam5zYmhxYm1ibW1qZHRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjQ1NDMsImV4cCI6MjA5NDcwMDU0M30.7SvJBYEZTcBFnfBW00KuQhW7p9b8EO2F2ODV78yTDIg"

$Headers = @{
    "apikey" = $AnonKey
    "Authorization" = "Bearer $AnonKey"
}

Write-Host "Fetching productos..."
$ProductsUrl = "$SupabaseUrl/rest/v1/productos?select=*"
$Productos = Invoke-RestMethod -Uri $ProductsUrl -Headers $Headers -Method Get

Write-Host "Found $($Productos.Length) publications."

$TotalOldBytes = 0
$TotalNewBytes = 0
$ImagesProcessed = 0

Add-Type -AssemblyName System.Drawing

foreach ($prod in $Productos) {
    $urlsToProcess = @()
    if ($prod.imagenes -and $prod.imagenes.Length -gt 0) {
        $urlsToProcess = $prod.imagenes
    } elseif ($prod.imagen_url) {
        $urlsToProcess += $prod.imagen_url
    }

    $newImagenes = @()
    $updated = $false

    foreach ($url in $urlsToProcess) {
        if ($url -match '\.webp$') {
            $newImagenes += $url
            continue
        }

        Write-Host "Processing $url..."
        $urlParts = $url -split '/'
        $filename = $urlParts[-1]
        $localFile = Join-Path $WorkingDir $filename
        
        Invoke-WebRequest -Uri $url -OutFile $localFile

        $oldFileInfo = Get-Item $localFile
        $TotalOldBytes += $oldFileInfo.Length

        # Get image width
        $img = [System.Drawing.Image]::FromFile($localFile)
        $width = $img.Width
        $img.Dispose()

        $newFilename = [System.IO.Path]::GetFileNameWithoutExtension($filename) + ".webp"
        $newLocalFile = Join-Path $WorkingDir $newFilename

        # cwebp args
        $args = @("-q", "85")
        if ($width -gt 1200) {
            $args += "-resize"
            $args += "1200"
            $args += "0"
        }
        $args += $localFile
        $args += "-o"
        $args += $newLocalFile

        Write-Host "Running cwebp $args"
        $process = Start-Process -FilePath $CwebpExe -ArgumentList $args -NoNewWindow -Wait -PassThru
        if ($process.ExitCode -ne 0) {
            Write-Host "cwebp failed for $filename"
            continue
        }

        $newFileInfo = Get-Item $newLocalFile
        $TotalNewBytes += $newFileInfo.Length
        $ImagesProcessed++

        # Upload
        $regex = 'camisetas-images/(.*)$'
        if ($url -match $regex) {
            $oldStoragePath = [uri]::UnescapeDataString($matches[1])
            $newStoragePath = [System.IO.Path]::GetDirectoryName($oldStoragePath) + "/" + $newFilename
            $newStoragePath = $newStoragePath -replace '\\', '/'
            if ($newStoragePath.StartsWith("/")) {
                $newStoragePath = $newStoragePath.Substring(1)
            }

            Write-Host "Uploading to $newStoragePath..."
            $uploadUrl = "$SupabaseUrl/storage/v1/object/camisetas-images/$newStoragePath"
            
            $fileBytes = [System.IO.File]::ReadAllBytes($newLocalFile)
            $uploadHeaders = @{
                "apikey" = $AnonKey
                "Authorization" = "Bearer $AnonKey"
                "Content-Type" = "image/webp"
                "Cache-Control" = "max-age=86400"
                "x-upsert" = "true"
            }

            try {
                Invoke-RestMethod -Uri $uploadUrl -Method Post -Headers $uploadHeaders -Body $fileBytes
                $publicUrl = "$SupabaseUrl/storage/v1/object/public/camisetas-images/$newStoragePath"
                $newImagenes += $publicUrl
                $updated = $true
            } catch {
                Write-Host "Upload failed: $_"
            }
        }

        Remove-Item $localFile -Force
        Remove-Item $newLocalFile -Force
    }

    if ($updated) {
        Write-Host "Updating db record for product $($prod.id)..."
        $updateUrl = "$SupabaseUrl/rest/v1/productos?id=eq.$($prod.id)"
        
        $updatePayload = @{}
        if ($prod.imagenes -and $prod.imagenes.Length -gt 0) {
            $updatePayload.imagenes = $newImagenes
            if ($newImagenes.Length -gt 0) {
                $updatePayload.imagen_url = $newImagenes[0]
            }
        } elseif ($prod.imagen_url) {
            $updatePayload.imagen_url = $newImagenes[0]
        }

        $jsonPayload = $updatePayload | ConvertTo-Json -Depth 10 -Compress

        $patchHeaders = @{
            "apikey" = $AnonKey
            "Authorization" = "Bearer $AnonKey"
            "Content-Type" = "application/json"
            "Prefer" = "return=minimal"
        }

        try {
            Invoke-RestMethod -Uri $updateUrl -Method Patch -Headers $patchHeaders -Body $jsonPayload
        } catch {
            Write-Host "DB update failed: $_"
        }
    }
}

Write-Host "=== REPORT ==="
Write-Host "Images processed: $ImagesProcessed"
$oldMb = [math]::Round($TotalOldBytes / 1MB, 2)
$newMb = [math]::Round($TotalNewBytes / 1MB, 2)
Write-Host "Old size: $oldMb MB"
Write-Host "New size: $newMb MB"
