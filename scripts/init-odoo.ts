const BASE = 'http://localhost:8069';
const DB = 'assetflow';
const PASSWORD = 'admin';

async function waitForOdoo() {
  for (let i = 0; i < 60; i++) {
    try {
      const resp = await fetch(`${BASE}/web/database/selector`);
      if (resp.ok) return;
    } catch {}
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Odoo did not start within 120s');
}

async function createDatabase() {
  const resp = await fetch(`${BASE}/web/database/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        master_pwd: PASSWORD,
        name: DB,
        login: 'admin',
        password: PASSWORD,
        lang: 'en_US',
        country_code: 'US',
        load_demo: true,
      },
    }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`DB creation failed: ${JSON.stringify(data.error)}`);
  return data;
}

async function installModule() {
  const sessionResp = await fetch(`${BASE}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: { db: DB, login: 'admin', password: PASSWORD },
    }),
  });
  const cookie = sessionResp.headers.get('set-cookie')?.split(';')[0] || '';

  const moduleResp = await fetch(`${BASE}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: {
        model: 'ir.module.module',
        method: 'button_immediate_install',
        args: [],
        kwargs: { domain: [['name', '=', 'assetflow']] },
      },
    }),
  });
  const data = await moduleResp.json();
  if (data.error) throw new Error(`Module install failed: ${JSON.stringify(data.error)}`);
  return data;
}

async function main() {
  // Check if DB already exists by trying to authenticate
  const checkResp = await fetch(`${BASE}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      params: { db: DB, login: 'admin', password: PASSWORD },
    }),
  });
  const checkData = await checkResp.json();
  if (checkData.result?.uid) {
    console.log(' Database already exists.');
    return;
  }

  console.log(' Creating database...');
  await createDatabase();

  console.log(' Installing AssetFlow module...');
  await installModule();

  console.log(' Done! Odoo ready at http://localhost:8069');
  console.log(' Login: admin / Password: admin');
}

console.log('Waiting for Odoo...');
await waitForOdoo();
await main();
