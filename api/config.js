export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.status(200).json({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',
    GOOGLE_SCOPES: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file profile email',
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
    TEMPLATE_OWNER: 'uniaojoaquinense',
    TEMPLATE_REPO: 'uniaojoaquinense.github.io',
    WORKER_SCRIPT_NAME: 'demolay-proxy',
    WIZARD_URL: 'https://demotree-wizard.vercel.app',
  });
}
