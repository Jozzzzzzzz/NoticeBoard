# NoticeBoard

A TV notice board / home dashboard system. Runs on a Windows PC as a
background service: an Express + SQLite backend, a fullscreen TV dashboard,
a phone/PC page for manual entry and voice-to-text, and a single
`/api/command` endpoint that Siri, Alexa, and the web UI all share.

## Architecture

- **Backend** — Node.js + Express + SQLite (`better-sqlite3`), WebSocket
  (`ws`) for live sync. All state lives in `data/noticeboard.db`.
- **TV frontend** (`public/index.html`) — dark, minimal, four pages
  (Overview, Tasks, Ideas, Calendar). Opens fullscreen in a TV's browser.
  Switches pages instantly via WebSocket when a command comes in.
- **Phone/PC view** (`public/manage.html`) — responsive page for adding,
  completing, and deleting items by form, typed command, or voice (mic
  button, using the browser's built-in Web Speech API — no external
  service, no cost).
- **Command layer** (`commandParser.js`) — fixed-pattern parsing, no LLM,
  so it's free and instant. Understands two syntaxes (see below). This is
  the single entry point Siri Shortcuts, Alexa (via IFTTT), and the web UI
  all call.
- **Calendar** (`calendar.js`) — optional Google Calendar sync, merged into
  the TV's Calendar page alongside locally-created check-in dates.

## Setup (local development)

```bash
npm install
npm run dev
```

Open `http://localhost:3000` for the TV view, `http://localhost:3000/manage.html`
for the phone/PC view.

Copy `.env.example` to `.env` if you want to set an API token or configure
Google Calendar (both optional — the app works with neither set).

## Command syntax

Both styles are understood by `/api/command` and the on-page command bar:

**Natural language:**
```
add note: buy milk
add task: call plumber check in by 25/12/2026
add idea: paint the shed
show calendar
show tasks
complete 4
delete 7
```

**Terminal / flag style:**
```
add-note -heading "Buy milk"
add-task -heading "Call plumber" -body "ask about pricing" -checkin 25/12/2026
add-idea -heading "Paint the shed"
show -page calendar
complete -id 4
delete -id 7
```

Check-in dates use `dd/mm/yyyy`. Valid pages: `overview`, `tasks`, `ideas`,
`calendar`.

## API reference

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/items` | List all items (`?type=note\|task\|idea` to filter) |
| GET | `/api/items/:id` | Get one item |
| POST | `/api/items` | Create an item — `{ type, heading, body, checkin_date }` |
| PUT | `/api/items/:id` | Update an item |
| DELETE | `/api/items/:id` | Delete an item |
| POST | `/api/command` | Run a command (see syntax above) — `{ text }` |
| GET | `/api/calendar/events` | Upcoming Google Calendar events (if configured) |
| GET | `/api/health` | Health check |

Writes (`POST`/`PUT`/`DELETE` on `/api/items`, `POST /api/command`) require
an `X-Api-Token` header if `API_TOKEN` is set in `.env`. Reads are always
open, so the TV/phone pages load without a prompt. Leave `API_TOKEN` blank
while developing on your own LAN; set it before exposing the server beyond
your home network.

## Voice integration

### Siri Shortcuts

1. Open the **Shortcuts** app → new shortcut.
2. Add action **Get Contents of URL**.
   - URL: `http://<server-ip>:3000/api/command`
   - Method: `POST`
   - Headers: `Content-Type: application/json`, and `X-Api-Token: <your token>` if set
   - Request Body (JSON): `{ "text": "add note: buy milk" }` — or use
     **Ask for Text** as an action before this one, and reference that
     variable inside the JSON body to make it dynamic.
3. Name the shortcut (e.g. "Notice Board") and optionally add it to Siri
   with a custom phrase.

### Alexa (via IFTTT)

1. Create an IFTTT applet: **If** "Say a specific phrase" (Alexa) **Then**
   "Make a web request" (Webhooks).
2. Webhook settings:
   - URL: `http://<server-ip>:3000/api/command`
   - Method: `POST`
   - Content type: `application/json`
   - Headers: `X-Api-Token: <your token>` if set
   - Body: `{ "text": "<the phrase you said>" }`
3. Requires your server to be reachable from the internet (Tailscale
   Funnel, or a locked-down port-forward) since IFTTT calls from the cloud.

## Google Calendar setup (optional)

1. Create a project in the [Google Cloud Console](https://console.cloud.google.com/),
   enable the **Google Calendar API**.
2. Create OAuth 2.0 credentials (type: Desktop app), note the Client ID and
   Client Secret.
3. Use the OAuth consent flow once (e.g. via
   [Google's OAuth Playground](https://developers.google.com/oauthplayground))
   with scope `https://www.googleapis.com/auth/calendar.readonly` to obtain
   a **refresh token**.
4. Fill in `.env`: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
   `GOOGLE_REFRESH_TOKEN`, and `GOOGLE_CALENDAR_ID` (defaults to `primary`).
5. Restart the server — the TV Calendar page will now show Google events
   alongside locally-added check-in dates.

## Deployment (Windows service)

To run persistently in the background and survive reboots:

```bash
# Run PowerShell/cmd as Administrator
npm run service:install
```

To remove it:

```bash
npm run service:uninstall
```

## Remote access

Use [Tailscale](https://tailscale.com/) to reach the server from outside
your home network without exposing it to the open internet. Point Siri
Shortcuts / IFTTT webhooks at the server's Tailscale IP or Tailscale
Funnel URL. Set `API_TOKEN` in `.env` before doing this.

## Project structure

```
server.js          Express app, WebSocket server, route wiring
db.js               SQLite connection + schema
auth.js             API token middleware
commandParser.js     Fixed-pattern command parsing (both syntaxes)
calendar.js          Google Calendar client
routes/items.js       CRUD routes for notes/tasks/ideas
routes/calendar.js    Calendar events route
public/index.html     TV dashboard
public/manage.html     Phone/PC page (forms + command bar + mic)
public/api-token.js    Shared fetch helper that attaches the API token
install-service.js     Installs the Windows service (node-windows)
uninstall-service.js   Removes the Windows service
```
