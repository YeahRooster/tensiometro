@echo off
set /p msg="Ingresa una descripcion de los cambios (o presiona Enter para usar 'Actualizacion rapida'): "
if "%msg%"=="" set msg="Actualizacion rapida"

echo.
echo ------------------------------------------
echo 📤 Subiendo cambios a GitHub y Vercel...
echo ------------------------------------------
echo.

git add .
git commit -m "%msg%"
git push

echo.
echo ------------------------------------------
echo ✅ ¡LISTO! Tu app se esta actualizando en Vercel.
echo Espera 1 minuto y recarga tu link.
echo ------------------------------------------
echo.
pause
