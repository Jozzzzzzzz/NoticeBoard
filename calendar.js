// Google Calendar integration. Inactive until the user supplies OAuth
// credentials via .env (see .env.example / README for setup steps).
const { google } = require('googleapis');

function isConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REFRESH_TOKEN
  );
}

function getClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

// Returns upcoming events (default: next 30 days) as a simplified array.
async function getUpcomingEvents({ maxResults = 20, daysAhead = 30 } = {}) {
  if (!isConfigured()) {
    throw new Error('Google Calendar is not configured — see .env.example');
  }

  const calendar = getClient();
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  const res = await calendar.events.list({
    calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
    timeMin,
    timeMax,
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return (res.data.items || []).map((event) => ({
    id: event.id,
    heading: event.summary || '(no title)',
    start: event.start.dateTime || event.start.date,
    end: event.end.dateTime || event.end.date,
    allDay: Boolean(event.start.date),
  }));
}

module.exports = { isConfigured, getUpcomingEvents };
