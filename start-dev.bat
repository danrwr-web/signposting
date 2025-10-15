@echo off
echo Starting NHS Signposting development server...
echo.

REM Set environment variables
set DATABASE_URL=file:./dev.db
set DEFAULT_SURGERY_SLUG=ide-lane
set ADMIN_PASSCODE=admin123
set NEXTAUTH_SECRET=your-secret-here
set NEXTAUTH_URL=http://localhost:3000

echo Database: %DATABASE_URL%
echo Default Surgery: %DEFAULT_SURGERY_SLUG%
echo Admin Passcode: %ADMIN_PASSCODE%
echo.
echo Server will be available at: http://localhost:3000
echo Admin panel: http://localhost:3000/admin
echo.

REM Start the development server
npm run dev

pause
