$port = 3063
$base = "http://127.0.0.1:$port"

# Find the actual video paths via the API first (avoids hardcoding Chinese paths)
Write-Host "=== /api/videos result ==="
$api = Invoke-WebRequest -Uri ($base + '/api/videos?dir=/games/Kenshi%E5%89%91%E5%A3%AB/') -TimeoutSec 5 -UseBasicParsing
$json = $api.Content | ConvertFrom-Json
Write-Host ("root: " + ($json.root -join ', '))
foreach ($d in $json.dirs) {
    Write-Host ("dir {0}: {1}" -f $d.name, ($d.files -join ', '))
}

# Probe each video: HEAD + Range, check HTTP status + content-type + content-range
function Probe([string]$path) {
    $uri = $base + '/games/Kenshi%E5%89%91%E5%A3%AB/' + $path
    $uri = $uri.Replace('[', '%5B').Replace(']', '%5D').Replace(' ', '%20')
    Write-Host ("--- probing: {0} ---" -f $path)
    try {
        $req = [System.Net.HttpWebRequest]::Create($uri)
        $req.Method = 'HEAD'
        $req.Timeout = 8000
        $resp = $req.GetResponse()
        Write-Host ("  HEAD: HTTP {0}, Accept-Ranges={1}, Content-Type={2}, Content-Length={3}" -f [int]$resp.StatusCode, $resp.Headers['Accept-Ranges'], $resp.Headers['Content-Type'], $resp.Headers['Content-Length'])
        $resp.Close()
    } catch { Write-Host ("  HEAD ERR: " + $_.Exception.Message) }
    try {
        $req2 = [System.Net.HttpWebRequest]::Create($uri)
        $req2.Method = 'GET'
        $req2.Timeout = 8000
        $req2.AddRange('bytes', 0, 1023)
        $resp2 = $req2.GetResponse()
        Write-Host ("  Range GET: HTTP {0}, Content-Range={1}, Accept-Ranges={2}" -f [int]$resp2.StatusCode, $resp2.Headers['Content-Range'], $resp2.Headers['Accept-Ranges'])
        $resp2.Close()
    } catch { Write-Host ("  Range ERR: " + $_.Exception.Message) }
}

# Need actual file names. Get them from the API JSON (files are relative paths).
$all = @()
foreach ($f in $json.root) { $all += $f }
foreach ($d in $json.dirs) { foreach ($f in $d.files) { $all += $f } }
foreach ($v in $all) { Probe $v }
