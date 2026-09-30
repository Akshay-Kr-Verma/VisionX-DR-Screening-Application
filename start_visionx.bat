@echo off

echo ==========================================
echo       VisionX-DR Screening Application
echo ==========================================
echo.

echo Starting FastAPI backend...
start "VisionX Backend" cmd /k "cd /d D:\VisionX-DR-Screening-Application\backend && call venv\Scripts\activate && uvicorn app.main:app --reload"

timeout /t 3 /nobreak >nul

echo Starting React frontend...
start "VisionX Frontend" cmd /k "cd /d D:\VisionX-DR-Screening-Application\frontend && npm run dev"

timeout /t 5 /nobreak >nul

echo Opening VisionX-DR...
start http://localhost:5173

echo.
echo VisionX-DR has been started.