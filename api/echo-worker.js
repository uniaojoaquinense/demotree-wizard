export default async function handler(req, res) {
  const { workerCode } = req.body || {};
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    length: workerCode?.length || 0,
    first100: workerCode?.substring(0, 100),
    chars: workerCode ? [...new Set(workerCode)].sort().join('') : '',
  });
}
