@echo off
rem Sample commands demonstrating rdf.py against the Chelan RDF files.
rem Run from the repo root:
rem     private\chelan_commands.bat

setlocal enabledelayedexpansion

set REPO=.
set RDF=public\crmms\
set SCRIPTS=%REPO%\scripts\rdf.py

set RES=%RDF%res.rdf
set STREAMFLOW=%RDF%streamflow.rdf

echo ============================================================
echo 1. Info: inspect res data
echo ============================================================
python "%SCRIPTS%" info "%RES%"

echo.
echo ============================================================
echo 2. Info: inspect streamflow data
echo ============================================================
python "%SCRIPTS%" info "%STREAMFLOW%"

echo ============================================================
echo 3. Convert all slots in res
echo ============================================================
for /f "usebackq delims=" %%S in (`python "%SCRIPTS%" slots "%RES%" --series-only`) do (
    set "SLOT=%%S"

    set "SAFE=%%S"
    set "SAFE=!SAFE: =_!"
    set "SAFE=!SAFE:.=_!"

    set "OUT=%RDF%res_!SAFE!.csv"
    echo   slot : !SLOT!
    echo   out  : !OUT!
    python "%SCRIPTS%" convert "%RES%" --slot "!SLOT!" --output "!OUT!"
    echo.
)

echo ============================================================
echo 4. Convert all slots in streamflow
echo ============================================================
for /f "usebackq delims=" %%S in (`python "%SCRIPTS%" slots "%STREAMFLOW%" --series-only`) do (
    set "SLOT=%%S"

    set "SAFE=%%S"
    set "SAFE=!SAFE: =_!"
    set "SAFE=!SAFE:.=_!"

    set "OUT=%RDF%streamflow_!SAFE!.csv"
    echo   slot : !SLOT!
    echo   out  : !OUT!
    python "%SCRIPTS%" convert "%STREAMFLOW%" --slot "!SLOT!" --output "!OUT!"
    echo.
)

echo Done.

endlocal
