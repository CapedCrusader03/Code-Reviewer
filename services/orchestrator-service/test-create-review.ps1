# Test script for POST /internal/reviews endpoint

Write-Host "`n=== Testing POST /internal/reviews ===" -ForegroundColor Green

$body = @{
    job_id = [guid]::NewGuid().ToString()
    repo = "octocat/Hello-World"
    pr_number = 99
    commit_sha = "test789xyz"
    diff = "diff --git a/README.md b/README.md`nindex 123..456`n--- a/README.md`n+++ b/README.md`n@@ -1,1 +1,2 @@`n Hello World`n+Test change"
} | ConvertTo-Json

Write-Host "`nRequest Body:" -ForegroundColor Cyan
Write-Host $body

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/internal/reviews" `
                                  -Method POST `
                                  -Body $body `
                                  -ContentType "application/json"
    
    Write-Host "`nResponse:" -ForegroundColor Green
    Write-Host "Review ID: $($response.review_id)" -ForegroundColor Yellow
    
    Write-Host "`n=== SUCCESS ===" -ForegroundColor Green
    Write-Host "Created review with ID: $($response.review_id)`n"
    
} catch {
    Write-Host "`nError:" -ForegroundColor Red
    Write-Host $_.Exception.Message
}

