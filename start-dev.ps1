# PowerShell script to start the development server with environment variables
$env:DATABASE_URL="file:./dev.db"
$env:DEFAULT_SURGERY_SLUG="ide-lane"
$env:ADMIN_PASSCODE="admin123"
$env:NEXTAUTH_SECRET="your-secret-here"
$env:NEXTAUTH_URL="http://localhost:3000"

Write-Host "Starting NHS Signposting development server..."
Write-Host "Database: $env:DATABASE_URL"
Write-Host "Default Surgery: $env:DEFAULT_SURGERY_SLUG"
Write-Host "Admin Passcode: $env:ADMIN_PASSCODE"
Write-Host ""
Write-Host "Server will be available at: http://localhost:3000"
Write-Host "Admin panel: http://localhost:3000/admin"
Write-Host ""

npm run dev
