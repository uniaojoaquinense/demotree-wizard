export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { accountId, scriptName, token, allowedOrigin, workerCode } = req.body || {};

  if (!accountId || !scriptName || !token || !allowedOrigin) {
    return res.status(400).json({ success: false, errors: [{ message: 'accountId, scriptName, token e allowedOrigin são obrigatórios' }] });
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, errors: [{ message: 'GOOGLE_API_KEY não configurada no servidor' }] });
  }

  try {
    const originClean = allowedOrigin.replace(/\/+$/, '');
    let code = workerCode;

    if (!code) {
      const getRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!getRes.ok) {
        const err = await getRes.text();
        return res.status(getRes.status).json({ success: false, errors: [{ message: 'Erro ao buscar worker: ' + err }] });
      }
      const raw = await getRes.text();
      try {
        const parsed = JSON.parse(raw);
        code = parsed.result?.script || parsed.script || raw;
      } catch {
        code = raw;
      }
    }

    if (!code) {
      return res.status(400).json({ success: false, errors: [{ message: 'Não foi possível obter o código do worker' }] });
    }

    const bindings = [
      { name: 'GOOGLE_API_KEY', type: 'secret_text', text: apiKey },
      { name: 'ALLOWED_ORIGIN', type: 'secret_text', text: originClean },
    ];

    const boundary = '----boundary-' + Date.now();
    const metadata = JSON.stringify({ main_module: 'worker.js', bindings });
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="worker.js"; filename="worker.js"\r\nContent-Type: application/javascript+module\r\n\r\n${code}\r\n`,
      `--${boundary}--\r\n`,
    ];

    const putRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: parts.join(''),
      }
    );

    const data = await putRes.json();

    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(putRes.ok ? 200 : putRes.status).json(data);

  } catch (e) {
    res.status(500).json({ success: false, errors: [{ message: e.message }] });
  }
}
