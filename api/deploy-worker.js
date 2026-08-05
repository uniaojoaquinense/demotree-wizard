export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, scriptName, workerCode, token, allowedOrigin } = req.body || {};

  if (!accountId || !scriptName || !workerCode || !token) {
    return res.status(400).json({ success: false, errors: [{ message: 'accountId, scriptName, workerCode e token são obrigatórios' }] });
  }

  try {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, errors: [{ message: 'GOOGLE_API_KEY não configurada no servidor' }] });
    }

    const bindings = [
      { name: 'GOOGLE_API_KEY', type: 'secret_text', text: apiKey }
    ];
    if (allowedOrigin) {
      bindings.push({ name: 'ALLOWED_ORIGIN', type: 'secret_text', text: allowedOrigin });
    }
    const boundary = '----boundary-demotree-' + Date.now();
    const metadata = JSON.stringify({
      main_module: 'worker.js',
      bindings
    });

    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="worker.js"; filename="worker.js"\r\nContent-Type: application/javascript+module\r\n\r\n${workerCode}\r\n`,
      `--${boundary}--\r\n`,
    ];

    const body = parts.join('');

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      }
    );

    const data = await response.json();

    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(response.ok ? 200 : response.status).json(data);

  } catch (e) {
    res.status(500).json({ success: false, errors: [{ message: e.message }] });
  }
}
