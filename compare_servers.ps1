# Compare nodejs (8899) vs our server response for the SAME video + request
# Video: videos/实况1.mp4 (216275743 bytes). nodejs path is /videos/实况1.mp4
#         our path is /games/Kenshi剑士/videos/实况1.mp4

function Compare-Range([string]$label, [string]$start, [string]$end, [string]$nodeUrl, [string]$ourUrl) {
    Write-Host ("===== {0}  (Range bytes={1}-{2}) =====" -f $label, $start, $end)
    foreach ($pair in @(
        @{ Name='NODEJS(8899)'; Url=$nodeUrl },
        @{ Name='OURS (3063)'; Url=$ourUrl }
    )) {
        try {
            $req = [System.Net.HttpWebRequest]::Create($pair.Url)
            $req.Method = 'GET'
            $req.Timeout = 15000
            if ($start -ne '') { $req.AddRange('bytes', $start, $end) }
            $resp = $req.GetResponse()
            $hdrs = $resp.Headers
            $len = $resp.ContentLength
            # read body (limited)
            $stream = $resp.GetResponseStream()
            $buf = New-Object byte[] 64
            $read = $stream.Read($buf, 0, 64)
            Write-Host ("  {0}: HTTP {1} Content-Type={2} Content-Length={3} Content-Range={4} Accept-Ranges={5} Cache-Control={6} ETag={7} Last-Modified={8}" -f `
                $pair.Name, [int]$resp.StatusCode, $hdrs['Content-Type'], $hdrs['Content-Length'], `
                $hdrs['Content-Range'], $hdrs['Accept-Ranges'], $hdrs['Cache-Control'], $hdrs['ETag'], $hdrs['Last-Modified'])
            Write-Host ("       first 16 bytes read: {0}" -f (($buf[0..([math]::Min(15,$read-1))] | ForEach-Object { $_.ToString('X2') }) -join ' '))
            $resp.Close()
        } catch {
            Write-Host ("  {0}: ERR {1}" -f $pair.Name, $_.Exception.Message)
        }
    }
    Write-Host ""
}

# Full GET (no Range)
Write-Host "########## FULL GET (no Range) ##########"
Compare-Range "FULL" "" "" `
    "http://127.0.0.1:8899/videos/实况1.mp4" `
    "http://127.0.0.1:3063/games/Kenshi%E5%89%91%E5%A3%AB/videos/实况1.mp4"

# Range from 0
Write-Host "########## RANGE bytes=0-1023 ##########"
Compare-Range "HEADSTART" "0" "1023" `
    "http://127.0.0.1:8899/videos/实况1.mp4" `
    "http://127.0.0.1:3063/games/Kenshi%E5%89%91%E5%A3%AB/videos/实况1.mp4"

# Range near end (moov area)
Write-Host "########## RANGE bytes=(size-100000)-(size-1) ##########"
Compare-Range "TAIL" "216175743" "216275742" `
    "http://127.0.0.1:8899/videos/实况1.mp4" `
    "http://127.0.0.1:3063/games/Kenshi%E5%89%91%E5%A3%AB/videos/实况1.mp4"
