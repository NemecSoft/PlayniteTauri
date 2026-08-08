$dir = 'd:\AI\Code\Playnite\PlayniteTauri\release\Game_Details\Kenshi剑士\videos'
Write-Host '=== all mp4 files ==='
Get-ChildItem -LiteralPath $dir -Recurse -Filter *.mp4 | ForEach-Object {
    $mb = [math]::Round($_.Length / 1MB, 1)
    Write-Host ("{0}  ({1} MB)" -f $_.FullName, $mb)
}
Write-Host ''
Write-Host '=== ffprobe availability ==='
$ff = Get-Command ffprobe -ErrorAction SilentlyContinue
if ($ff) { Write-Host 'ffprobe available' } else { Write-Host 'NO ffprobe' }
