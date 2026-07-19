let CONFIG = null;

const S = {
  sheetId: null,
  sheetUrl: null,
  proxyUrl: null,
  repoOwner: null,
  repoName: null,
  githubUser: null,
  githubToken: null,
};

function $(id) { return document.getElementById(id); }

function goToStep(n) {
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
  $(`step-${n}`).classList.add('active');
  document.querySelector(`.step[data-step="${n}"]`).classList.add('active');
}

function completeStep(n) {
  document.querySelector(`.step[data-step="${n}"]`).classList.add('done');
  if (n < 3) goToStep(n + 1);
  else goToStep('done');
}

function toast(msg, type = '') {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'show ' + type;
  setTimeout(() => el.className = '', 3500);
}

function setStatus(id, msg, type) {
  const el = $(id);
  el.textContent = msg;
  el.className = 'status ' + (type || '');
}

// ═══════════════════════════════════════════════════════
// STEP 1 — GOOGLE
// ═══════════════════════════════════════════════════════
let googleTokenClient = null;

function stepGoogle() {
  if (!CONFIG) { setStatus('status-google', 'Carregando configurações...', 'loading'); return; }
  if (!CONFIG.GOOGLE_CLIENT_ID) { setStatus('status-google', 'Erro: GOOGLE_CLIENT_ID não configurado.', 'error'); return; }

  const btn = $('btn-google');
  btn.disabled = true;
  setStatus('status-google', 'Abrindo popup do Google...', 'loading');

  if (!googleTokenClient) {
    googleTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      scope: CONFIG.GOOGLE_SCOPES,
      callback: handleGoogleAuth,
      error_callback: (err) => {
        setStatus('status-google', 'Erro: ' + (err.message || 'Autorização cancelada'), 'error');
        btn.disabled = false;
      },
    });
  }
  googleTokenClient.requestAccessToken({ prompt: 'consent' });
}

async function handleGoogleAuth(resp) {
  if (resp.error) {
    setStatus('status-google', 'Erro: ' + resp.error, 'error');
    $('btn-google').disabled = false;
    return;
  }

  S.googleToken = resp.access_token;
  setStatus('status-google', 'Criando planilha...', 'loading');

  try {
    const sheet = await createSheet(resp.access_token);
    S.sheetId = sheet.spreadsheetId;
    S.sheetUrl = sheet.spreadsheetUrl;
    setStatus('status-google', 'Tornando planilha pública...', 'loading');
    await makeSheetPublic(resp.access_token, S.sheetId);
    setStatus('status-google', `✅ Planilha criada e publicada! ID: ${S.sheetId}`, 'success');
    toast('Planilha criada com sucesso!', 'success');
    completeStep(1);
  } catch (e) {
    setStatus('status-google', 'Erro ao criar planilha: ' + e.message, 'error');
    $('btn-google').disabled = false;
  }
}

const WORKER_TEMPLATE_CODE = `export default {
  async fetch(request, env) {
    const SHEET_ID = '__SHEET_ID__';
    const url = new URL(request.url);
    const range = url.searchParams.get('range') || 'Sheet1!A:F';
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    const apiUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID + '/values/' + encodeURIComponent(range) + '?key=' + env.GOOGLE_API_KEY;
    try {
      const response = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }
  }
};`;

async function createSheet(token) {
  const r1 = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties: { title: 'Links — Capítulo Demolay' },
      sheets: [
        { properties: { title: 'Sheet1' } },
        { properties: { title: 'Sheet2' } },
      ],
    }),
  });
  if (!r1.ok) throw new Error(await r1.text());
  const sheet = await r1.json();

  const sheet1Url = `https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values/Sheet1!A1:F1?valueInputOption=USER_ENTERED`;
  await fetch(sheet1Url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      values: [['Categoria', 'Ordem Cat', 'Subcategoria', 'Ordem Subcat', 'Link', 'URL']],
    }),
  });

  const sheet2Url = `https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values/Sheet2!A1:B2?valueInputOption=USER_ENTERED`;
  await fetch(sheet2Url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      values: [['chave', 'valor'], ['nome', 'Meu Capítulo']],
    }),
  });

  return sheet;
}

async function makeSheetPublic(token, sheetId) {
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${sheetId}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'anyone', role: 'reader' }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error('Falha ao tornar planilha pública: ' + err);
  }
}

// ═══════════════════════════════════════════════════════
// STEP 2 — CLOUDFLARE
// ═══════════════════════════════════════════════════════

async function deployWorker(accountId, scriptName, code) {
  const token = $('cf-token').value.trim();
  const res = await fetch('/api/deploy-worker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, scriptName, workerCode: code, token }),
  });
  return res.json();
}

async function stepCloudflare() {
  if (!CONFIG) { setStatus('status-cloudflare', 'Carregando configurações...', 'loading'); return; }
  if (!CONFIG.GOOGLE_API_KEY_CONFIGURED) { setStatus('status-cloudflare', 'GOOGLE_API_KEY não configurado no servidor.', 'error'); return; }

  const token = $('cf-token').value.trim();
  if (!token) {
    setStatus('status-cloudflare', 'Cole seu API Token do Cloudflare primeiro.', 'error');
    return;
  }

  const btn = document.querySelector('.btn-cloudflare');
  btn.disabled = true;
  setStatus('status-cloudflare', 'Validando token...', 'loading');

  try {
    async function cfApi(url, method, body) {
      const r = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method, token, body }),
      });
      return r.json();
    }

    const accData = await cfApi('https://api.cloudflare.com/client/v4/accounts', 'GET');
    if (!accData.success) throw new Error(accData.errors?.[0]?.message || 'Token inválido');
    if (!accData.result?.length) throw new Error('Nenhuma conta encontrada neste token');

    const accountId = accData.result[0].id;
    const scriptName = CONFIG.WORKER_SCRIPT_NAME;

    setStatus('status-cloudflare', 'Criando worker...', 'loading');

    let workerCode = WORKER_TEMPLATE_CODE
      .replace('__SHEET_ID__', S.sheetId);

    const createData = await deployWorker(accountId, scriptName, workerCode);
    if (!createData.success) throw new Error(createData.errors?.[0]?.message || 'Falha ao criar worker');

    const accountName = accData.result[0].name || '';
    let subdomain = accountName.match(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/);
    subdomain = subdomain
      ? subdomain[1].split('@')[0].toLowerCase()
      : accountName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    try {
      setStatus('status-cloudflare', 'Ativando subdomínio workers.dev...', 'loading');
      await cfApi(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
        'PUT',
        { subdomain: subdomain }
      );
    } catch (_) {}

    let subdomainConfirmed = '';
    try {
      const subData = await cfApi(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/subdomain`,
        'GET'
      );
      subdomainConfirmed = subData.success ? subData.result?.name || '' : '';
    } catch (_) {}

    subdomain = subdomainConfirmed || subdomain;

    if (!subdomain) {
      throw new Error('Não foi possível determinar o subdomínio do Workers. Acesse https://dash.cloudflare.com -> Workers & Pages -> Seu subdomínio e defina um, depois tente novamente.');
    }
    S.proxyUrl = `https://${scriptName}.${subdomain}.workers.dev`;

    setStatus('status-cloudflare', `Validando worker...`, 'loading');

    let workerOk = false;
    try {
      const check = await fetch(S.proxyUrl, { method: 'HEAD' });
      workerOk = check.ok;
    } catch (_) {}

    if (!workerOk) {
      const dashboardUrl = `https://dash.cloudflare.com/?to=/:account/workers`;

      setStatus('status-cloudflare',
        `⚠️ Worker criado, mas o subdomínio <strong>${subdomain}.workers.dev</strong> está desativado.<br><br>` +
        `1. <a href="${dashboardUrl}" target="_blank">Abra o Cloudflare Dashboard</a><br>` +
        `2. Vá em <strong>Workers & Pages</strong><br>` +
        `3. Clique em <strong>${subdomain}.workers.dev</strong> (à esquerda)<br>` +
        `4. Ative o <strong>toggle</strong> (de Off para On)<br><br>` +
        `Depois clique em <strong>Verificar</strong> abaixo.`,
        'error'
      );

      const btn = document.querySelector('.btn-cloudflare');
      btn.textContent = '🔄 Verificar';
      btn.onclick = async () => {
        btn.disabled = true;
        setStatus('status-cloudflare', 'Verificando...', 'loading');
        try {
          const retry = await fetch(S.proxyUrl, { method: 'HEAD' });
          if (retry.ok) {
            setStatus('status-cloudflare', `✅ Worker criado! URL: ${S.proxyUrl}`, 'success');
            toast('Worker ativado!', 'success');
            btn.textContent = '✅ Concluído';
            btn.disabled = true;
            completeStep(2);
          } else {
            setStatus('status-cloudflare',
              `Ainda não está ativo. Ative o toggle no dashboard e clique em <strong>Verificar</strong> novamente.`,
              'error'
            );
            btn.disabled = false;
          }
        } catch (_) {
          setStatus('status-cloudflare', 'Ainda não está acessível. Ative o toggle e tente de novo.', 'error');
          btn.disabled = false;
        }
      };
      return;
    }

    setStatus('status-cloudflare', `✅ Worker criado e ativo! URL: ${S.proxyUrl}`, 'success');
    toast('Worker criado com sucesso!', 'success');
    completeStep(2);

  } catch (e) {
    setStatus('status-cloudflare', 'Erro: ' + e.message, 'error');
    btn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════════
// STEP 3 - GITHUB
// ═══════════════════════════════════════════════════════
let ghDeviceCode = null;
let ghPollInterval = null;
let ghInterval = 5;

function stepGitHub() {
  if (!CONFIG) { setStatus('status-github', 'Carregando configurações...', 'loading'); return; }
  if (!CONFIG.GITHUB_CLIENT_ID) { setStatus('status-github', 'GITHUB_CLIENT_ID não configurado no servidor.', 'error'); return; }

  const btn = $('btn-github');
  btn.disabled = true;
  setStatus('status-github', 'Iniciando autenticação GitHub...', 'loading');

  fetch('/api/github', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'device_code', client_id: CONFIG.GITHUB_CLIENT_ID }),
  })
    .then(r => r.json())
    .then(codeData => {
      if (codeData.error) throw new Error(codeData.error_description || codeData.error);
      ghDeviceCode = codeData.device_code;
      ghInterval = codeData.interval || 5;
      const statusEl = $('status-github');
      statusEl.className = 'status loading';
      statusEl.innerHTML = `Código: <strong id="code-to-copy">${codeData.user_code}</strong> <button class="btn-copy" onclick="navigator.clipboard.writeText('${codeData.user_code}');this.textContent='Copiado!'">Copiar</button><br><span style="font-size:0.9em">Acesse <a href="${codeData.verification_uri}" target="_blank">github.com/login/device</a> e insira este código.</span>`;
      toast(`Código: ${codeData.user_code} — Use o botão Copiar`, '');
      ghPollInterval = setInterval(pollGitHubAuth, ghInterval * 1000);
    })
    .catch(e => {
      setStatus('status-github', 'Erro: ' + e.message, 'error');
      btn.disabled = false;
    });
}

async function pollGitHubAuth() {
  try {
    const res = await fetch('/api/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'poll_token',
        client_id: CONFIG.GITHUB_CLIENT_ID,
        device_code: ghDeviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    const data = await res.json();

    if (data.access_token) {
      clearInterval(ghPollInterval);
      S.githubToken = data.access_token;
      setStatus('status-github', 'Autorizado! Criando repositório...', 'loading');
      await setupGitHubRepo();
      return;
    }

    if (data.error === 'authorization_pending') return;
    if (data.error === 'slow_down') {
      clearInterval(ghPollInterval);
      ghInterval += 5;
      ghPollInterval = setInterval(pollGitHubAuth, ghInterval * 1000);
      return;
    }

    clearInterval(ghPollInterval);
    throw new Error(data.error_description || data.error);

  } catch (e) {
    clearInterval(ghPollInterval);
    setStatus('status-github', 'Erro: ' + e.message, 'error');
    $('btn-github').disabled = false;
  }
}

async function setupGitHubRepo() {
  const token = S.githubToken;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };

  try {
    const userRes = await fetch('https://api.github.com/user', { headers });
    const user = await userRes.json();
    S.githubUser = user.login;

    const repoName = `${S.githubUser}.github.io`;
    const checkRes = await fetch(`https://api.github.com/repos/${S.githubUser}/${repoName}`, { headers });

    if (checkRes.ok) {
      S.repoOwner = S.githubUser;
      S.repoName = repoName;
      setStatus('status-github', `Repositório ${repoName} já existe. Atualizando...`, 'loading');
      await updateConfigInRepo(headers);
    } else {
      setStatus('status-github', 'Criando repositório a partir do template...', 'loading');
      let repo = null;

      const createRes = await fetch(
        `https://api.github.com/repos/${CONFIG.TEMPLATE_OWNER}/${CONFIG.TEMPLATE_REPO}/generate`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            owner: S.githubUser, name: repoName,
            description: 'Links e recursos do capítulo Demolay', private: false,
          }),
        }
      );

      if (createRes.ok) {
        repo = await createRes.json();
      } else {
        setStatus('status-github', 'Fazendo fork do template...', 'loading');
        const forkRes = await fetch(
          `https://api.github.com/repos/${CONFIG.TEMPLATE_OWNER}/${CONFIG.TEMPLATE_REPO}/forks`,
          { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' } }
        );

        if (!forkRes.ok) {
          const forkErr = await forkRes.json();
          if (forkRes.status === 409 && forkErr.errors?.[0]?.message?.includes('already exists')) {
            const existingRes = await fetch(
              `https://api.github.com/repos/${S.githubUser}/${CONFIG.TEMPLATE_REPO}`, { headers }
            );
            if (existingRes.ok) repo = await existingRes.json();
            else throw new Error('Fork já existe, mas não foi possível acessá-lo.');
          } else {
            throw new Error(forkErr.message || 'Falha ao fazer fork');
          }
        } else {
          repo = await forkRes.json();
        }

        if (repo && repo.name !== repoName) {
          const renameRes = await fetch(`https://api.github.com/repos/${repo.full_name}`, {
            method: 'PATCH',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: repoName }),
          });
          if (!renameRes.ok) throw new Error((await renameRes.json()).message || 'Falha ao renomear');
          repo = await renameRes.json();
        }
      }

      if (!repo) throw new Error('Não foi possível criar o repositório');
      S.repoOwner = repo.owner.login;
      S.repoName = repo.name;
      await new Promise(r => setTimeout(r, 8000));
      await updateConfigInRepo(headers);
    }
  } catch (e) {
    setStatus('status-github', 'Erro: ' + e.message, 'error');
    $('btn-github').disabled = false;
  }
}

async function updateConfigInRepo(headers) {
  const { repoOwner, repoName } = S;

  try {
    const newConfig = buildConfigContent();

    const getRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/config.js`, { headers }
    );
    let sha = null;
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }

    const commitRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/contents/config.js`, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Configuração automática do setup',
          content: btoa(newConfig),
          sha: sha || undefined,
        }),
      }
    );

    if (!commitRes.ok) {
      const errBody = await commitRes.json();
      if (commitRes.status === 409) {
        await new Promise(r => setTimeout(r, 2000));
        const retryGet = await fetch(
          `https://api.github.com/repos/${repoOwner}/${repoName}/contents/config.js`, { headers }
        );
        if (retryGet.ok) {
          const existing = await retryGet.json();
          const retryPut = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/contents/config.js`, {
              method: 'PUT',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: 'Configuração automática do setup',
                content: btoa(newConfig),
                sha: existing.sha,
              }),
            }
          );
          if (!retryPut.ok) throw new Error((await retryPut.json()).message || 'Falha ao atualizar config.js (retry)');
        } else {
          const retryCreate = await fetch(
            `https://api.github.com/repos/${repoOwner}/${repoName}/contents/config.js`, {
              method: 'PUT',
              headers: { ...headers, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: 'Configuração automática do setup',
                content: btoa(newConfig),
              }),
            }
          );
          if (!retryCreate.ok) throw new Error((await retryCreate.json()).message || 'Falha ao criar config.js (retry)');
        }
      } else {
        throw new Error(errBody.message || 'Falha ao atualizar config.js');
      }
    }

    setStatus('status-github', 'Atualizando arquivos do admin...', 'loading');
    await updateAdminFiles(headers);

    setStatus('status-github', 'Config.js atualizado. Ativando GitHub Pages...', 'loading');
    await enablePages(headers);

  } catch (e) {
    throw e;
  }
}

async function updateAdminFiles(headers) {
  const { repoOwner, repoName } = S;
  const templateOwner = CONFIG.TEMPLATE_OWNER;
  const templateRepo = CONFIG.TEMPLATE_REPO;
  const branch = 'main';
  const adminFiles = ['admin/app.js', 'admin/index.html', 'admin/style.css'];

  for (const filePath of adminFiles) {
    try {
      const rawRes = await fetch(
        `https://raw.githubusercontent.com/${templateOwner}/${templateRepo}/${branch}/${filePath}`
      );
      if (!rawRes.ok) { console.warn('Não foi possível buscar ' + filePath + ' do template'); continue; }
      const content = await rawRes.text();

      const getRes = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, { headers }
      );
      let sha = null;
      if (getRes.ok) {
        const existing = await getRes.json();
        sha = existing.sha;
      }

      const putRes = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, {
          method: 'PUT',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Admin — atualização automática',
            content: btoa(unescape(encodeURIComponent(content))),
            sha: sha || undefined,
          }),
        }
      );
      if (!putRes.ok) console.warn('Falha ao atualizar ' + filePath + ':', await putRes.text());
    } catch (e) {
      console.warn('Erro ao atualizar ' + filePath + ':', e.message);
    }
  }
}

async function enablePages(headers) {
  const { repoOwner, repoName } = S;

  try {
    const pagesRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/pages`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: { branch: 'main', path: '/' } }),
    });
    if (!pagesRes.ok && pagesRes.status !== 409) {
      console.warn('Pages activation warning:', await pagesRes.json());
    }

    const isUserSite = repoName === `${repoOwner}.github.io`;
    const siteUrl = isUserSite
      ? `https://${repoOwner}.github.io/`
      : `https://${repoOwner}.github.io/${repoName}/`;
    const adminUrl = isUserSite
      ? `https://${repoOwner}.github.io/admin/`
      : `${siteUrl}admin/`;

    setStatus('status-github', `✅ Repositório criado! Site: ${siteUrl}`, 'success');

    $('site-url').href = siteUrl;
    $('site-url').innerHTML = `<i class="fa-solid fa-globe"></i> ${siteUrl}`;
    $('admin-url').href = adminUrl;
    $('admin-url').innerHTML = `<i class="fa-solid fa-lock"></i> ${adminUrl}`;

    toast('Site criado com sucesso!', 'success');
    completeStep(3);

  } catch (e) {
    throw e;
  }
}

function esc(v) { return (v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

function buildConfigContent() {
  return [
    'const CONFIG = {',
    "    PROXY_URL: '" + esc(S.proxyUrl) + "',",
    "    SHEET_ID: '" + esc(S.sheetId) + "',",
    "    SCOPES: '" + esc(CONFIG.GOOGLE_SCOPES) + "',",
    "    SHEET_LINKS: 'Sheet1',",
    "    SHEET_CONFIG: 'Sheet2',",
    "    RANGE_LINKS: 'Sheet1!A:F',",
    "    RANGE_CONFIG: 'Sheet2!A:B',",
    "    WIZARD_URL: '" + esc(CONFIG.WIZARD_URL || 'https://demotree-wizard.vercel.app') + "',",
    '};',
    '',
  ].join('\n');
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
async function init() {
  try {
    const res = await fetch('/api/config');
    CONFIG = await res.json();
  } catch (e) {
    console.error('Falha ao carregar config:', e);
    document.querySelectorAll('.btn').forEach(b => b.disabled = true);
    document.querySelectorAll('.status').forEach(el => {
      el.textContent = 'Erro ao carregar configurações do servidor.';
      el.className = 'status error';
    });
    return;
  }
}

init();
