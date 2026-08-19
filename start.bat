@echo off
echo ========================================
echo   Sentilyze - Sistem Baslatiliyor...
echo ========================================

:: 1. PostgreSQL
echo [1/3] PostgreSQL baslatiliyor...
set PATH=%PATH%;C:\Program Files\PostgreSQL\18\bin
pg_ctl -D "C:\Program Files\PostgreSQL\18\data" -l "C:\Program Files\PostgreSQL\18\data\postgresql.log" start
timeout /t 3 /nobreak >nul

:: 2. Strapi
echo [2/3] Strapi baslatiliyor (localhost:1337)...
start "Strapi Backend" cmd /k "cd /d C:\Users\tokta\OneDrive\Masaüstü\Sentilyze\strapi-backend && npm run develop"
timeout /t 5 /nobreak >nul

:: 3. Python Backend
echo [3/3] Python backend baslatiliyor (localhost:8000)...
start "Python Backend" cmd /k "cd /d C:\Users\tokta\OneDrive\Masaüstü\Sentilyze\backend && python main.py"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   Tum servisler baslatildi!
echo   Strapi  : http://localhost:1337
echo   Python  : http://localhost:8000
echo   Frontend: http://localhost:8081
echo ========================================
echo.
echo Frontend'i baslatmak icin:
echo   cd frontend
echo   npx expo start --web
echo.
pause
