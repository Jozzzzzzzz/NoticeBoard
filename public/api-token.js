// Shared helper: attaches the API token (if the user has set one) to write
// requests, and prompts once if the server rejects a request as unauthorized.
const NB_TOKEN_KEY = 'nb_api_token';

function nbGetToken() {
  return localStorage.getItem(NB_TOKEN_KEY) || '';
}

function nbSetToken(token) {
  if (token) localStorage.setItem(NB_TOKEN_KEY, token);
  else localStorage.removeItem(NB_TOKEN_KEY);
}

// Wraps fetch: adds X-Api-Token header when a token is stored, and if the
// server responds 401, prompts the user for a token and retries once.
async function nbFetch(url, options = {}) {
  const opts = { ...options, headers: { ...(options.headers || {}) } };
  const token = nbGetToken();
  if (token) opts.headers['X-Api-Token'] = token;

  let res = await fetch(url, opts);
  if (res.status === 401) {
    const entered = window.prompt('This server requires an API token. Enter it:');
    if (entered) {
      nbSetToken(entered);
      opts.headers['X-Api-Token'] = entered;
      res = await fetch(url, opts);
    }
  }
  return res;
}
