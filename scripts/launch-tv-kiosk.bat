@echo off
REM Launches the NoticeBoard TV view in Chrome kiosk mode: fullscreen,
REM no address bar, no tabs, no browser chrome at all. Press Alt+F4 to
REM close it, or Esc/Alt+Tab to switch away depending on Windows settings.
REM
REM Edit the URL below if this PC's LAN IP changes, or point it at the
REM Tailscale IP if the TV is on a different device than the server.

set NB_URL=http://localhost:3000

set CHROME="C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist %CHROME% set CHROME="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

start "" %CHROME% --kiosk --incognito --noerrdialogs --disable-translate --no-first-run --autoplay-policy=no-user-gesture-required %NB_URL%
