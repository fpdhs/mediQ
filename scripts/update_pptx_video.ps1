$ErrorActionPreference = 'Stop'

$downloadDir = Join-Path $env:USERPROFILE "Downloads"
$pptxFile = Get-ChildItem -Path $downloadDir -Filter "*Medi*Q*.pptx" | Where-Object { $_.Name -notmatch "backup" } | Select-Object -First 1

if (-not $pptxFile) {
    throw "Target PPTX file not found in $downloadDir"
}
$pptxPath = $pptxFile.FullName

$videoFile = Get-ChildItem -Path $downloadDir -Filter "mediq-architecture-flow-1080p-*.mp4" | Select-Object -First 1
if (-not $videoFile) {
    throw "Converted MP4 video not found in $downloadDir"
}
$videoMp4 = $videoFile.FullName

Write-Output "Target PPTX: $pptxPath"
Write-Output "Video File:  $videoMp4"

$ppt = New-Object -ComObject PowerPoint.Application
$ppt.WindowState = 2 # Minimized

try {
    Write-Output "Opening Presentation..."
    $pres = $ppt.Presentations.Open($pptxPath, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoTrue)
    
    $slideCount = $pres.Slides.Count
    Write-Output "Total slides in presentation: $slideCount"
    
    $targetSlideIndex = 23
    $slide = $pres.Slides.Item($targetSlideIndex)
    Write-Output "Target Slide: #$targetSlideIndex (Slide ID: $($slide.SlideID))"
    
    Write-Output "Inspecting and removing existing shapes on Slide $targetSlideIndex..."
    for ($i = $slide.Shapes.Count; $i -ge 1; $i--) {
        $s = $slide.Shapes.Item($i)
        Write-Output " - Removing Shape $($i): Name='$($s.Name)', Type=$($s.Type)"
        $s.Delete()
    }
    
    # 20 inches x 11.25 inches in points: 20 * 72 = 1440, 11.25 * 72 = 810
    $widthPt = 1440
    $heightPt = 810
    
    Write-Output "Inserting new architecture flow MP4 video (Embedded, 1440x810 pt)..."
    $newShape = $slide.Shapes.AddMediaObject2(
        $videoMp4,
        $false, # LinkToFile = False (Embed directly into presentation)
        $true,  # SaveWithDocument = True
        0,      # Left
        0,      # Top
        $widthPt,
        $heightPt
    )
    
    $newShape.Name = "MediQ_Architecture_Flow_1080p_Video"
    Write-Output "New video shape created: $($newShape.Name), Type: $($newShape.Type)"
    
    # Try setting autoplay / play settings
    try {
        $newShape.AnimationSettings.PlaySettings.PlayOnEntry = [Microsoft.Office.Core.MsoTriState]::msoTrue
        $newShape.AnimationSettings.PlaySettings.HideWhileNotPlaying = [Microsoft.Office.Core.MsoTriState]::msoFalse
        Write-Output "Configured video play settings: PlayOnEntry=True"
    } catch {
        Write-Output "Notice: PlaySettings setup skipped: $($_.Exception.Message)"
    }
    
    Write-Output "Saving presentation..."
    $pres.Save()
    Write-Output "Presentation saved successfully!"
    $pres.Close()
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
    throw
} finally {
    $ppt.Quit()
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}

Write-Output "All operations completed successfully."
