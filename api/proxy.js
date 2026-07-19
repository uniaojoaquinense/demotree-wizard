export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, method, token, body } = req.body;

  if (!url || !token) {
    return res.status(400).json({ error: 'url e token são obrigatórios' });
  }

  try {
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/javascript',
    };
    if (method === 'GET') delete headers['Content-Type'];

    const fetchOpts = { method: method || 'GET', headers };

    if (body && method !== 'GET') {
      fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
      if (typeof body === 'string') {
        headers['Content-Type'] = 'application/javascript';
      } else {
        headers['Content-Type'] = 'application/json';
      }
    }

    const response = await fetch(url, fetchOpts);
    const data = await response.json();

    res.setHeader('Cache-Control', 'no-cache');
    res.status(response.ok ? 200 : response.status).json(data);
  } catch (e) {
    res.status(500).json({ success: false, errors: [{ message: e.message }] });
  }
}
