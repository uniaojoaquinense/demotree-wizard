export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, client_id, device_code, grant_type } = req.body;

    let url, body;
    if (action === 'device_code') {
      url = 'https://github.com/login/device/code';
      body = { client_id, scope: 'repo' };
    } else if (action === 'poll_token') {
      url = 'https://github.com/login/oauth/access_token';
      body = { client_id, device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' };
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    res.setHeader('Cache-Control', 'no-cache');
    res.status(response.ok ? 200 : response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
