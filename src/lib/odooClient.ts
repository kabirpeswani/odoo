const ODOO_BASE_URL = process.env.ODOO_BASE_URL || 'http://localhost:8069';
const ODOO_DB = process.env.ODOO_DB || 'assetflow';
const ODOO_USERNAME = process.env.ODOO_USERNAME || 'admin';
const ODOO_PASSWORD = process.env.ODOO_PASSWORD || 'admin';

let sessionCookie: string | null = null;
let lastAuthAttempt = 0;

async function authenticate(): Promise<string> {
  if (sessionCookie) return sessionCookie;

  const resp = await fetch(`${ODOO_BASE_URL}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: { db: ODOO_DB, login: ODOO_USERNAME, password: ODOO_PASSWORD },
    }),
  });

  if (!resp.ok) {
    throw new Error(
      `Cannot connect to Odoo at ${ODOO_BASE_URL}. ` +
      `\n  Make sure Odoo is running (docker compose up) and the database "${ODOO_DB}" exists.` +
      `\n  First time? Open http://localhost:8069, create database "${ODOO_DB}", install AssetFlow module.`
    );
  }

  const data = await resp.json();
  if (data.error) {
    throw new Error(
      `Odoo auth failed for ${ODOO_USERNAME}@${ODOO_DB}: ${data.error.message}` +
      `\n  First time? Open http://localhost:8069, create database "${ODOO_DB}", install AssetFlow module.`
    );
  }

  const setCookie = resp.headers.get('set-cookie');
  if (setCookie) {
    sessionCookie = setCookie.split(';')[0];
  }
  return sessionCookie || '';
}

async function odooFetch(path: string, options?: RequestInit): Promise<any> {
  const cookie = await authenticate();
  const resp = await fetch(`${ODOO_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      ...options?.headers,
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Odoo ${options?.method || 'GET'} ${path} failed (${resp.status}): ${text}`);
  }
  return resp.json();
}

export async function odooGet(path: string): Promise<any> {
  return odooFetch(path, { method: 'GET' });
}

export async function odooPost(path: string, body: any): Promise<any> {
  return odooFetch(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
