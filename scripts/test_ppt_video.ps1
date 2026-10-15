$ErrorActionPreference = 'Stop'
$videoPath = "C:\Users\user\Downloads\mediq-architecture-flow-1080p-1792025400503.mp4"
Write-Output "Testing video path: $videoPath (Exists: $(Test-Path $videoPath))"

$ppt = New-Object -ComObject PowerPoint.Application
$ppt.WindowState = 2 # ppWindowMinimized

try {
    $pres = $ppt.Presentations.Add(0) # 0 = WithWindow: False
    $slide = $pres.Slides.Add(1, 12) # 12 = ppLayoutBlank
    Write-Output "Trying AddMediaObject2..."
    $shape = $slide.Shapes.AddMediaObject2($videoPath, $false, $true, 0, 0, 960, 540)
    Write-Output "Success! Shape created: $($shape.Name), Type: $($shape.Type)"
    $pres.Close()
} catch {
    Write-Output "Error adding media: $($_.Exception.Message)"
} finally {
    $ppt.Quit()
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
