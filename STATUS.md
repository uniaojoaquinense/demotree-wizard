# STATUS — 18/07/2026

## Projeto
**demotree-wizard** — Wizard de setup automático para sites de links Demolay.
3 passos: Google Sheets → Cloudflare Worker → GitHub Pages.

## Últimas alterações

### Fase 1 ✅ — Proteger GOOGLE_API_KEY (concluída)

**Problema original:** A chave `GOOGLE_API_KEY` ficava exposta no browser (via `/api/config`) e hardcoded no código do Cloudflare Worker.

**Solução:**
- `api/deploy-worker.js` (NOVO) — endpoint server-side que faz upload do Worker com a chave como **secret_text binding** via multipart/form-data. A chave nunca chega ao browser.
- `app.js` — Worker template convertido de Service Worker (`addEventListener`) para **ES Module** (`export default { async fetch(request, env) }`). Agora lê `env.GOOGLE_API_KEY` em vez de constante hardcoded.
- `api/config.js` — `GOOGLE_API_KEY` substituído por `GOOGLE_API_KEY_CONFIGURED: true/false`. A chave real não sai mais do servidor.
- Bug fix: `completeStep(2)` duplicado no stepCloudflare removido.

**Deploy:** https://demotree-wizard.vercel.app (produção)
**Commit:** `a62e904` — branch `main`

## Próximos passos (pendentes)

### Fase 2 — Sync do template para repositórios filhos
- Criar `.github/workflows/sync-template.yml` no template `uniaojoaquinense/uniaojoaquinense.github.io`
- Workflow compara `admin/` com template e abre PR (não faz merge automático)
- Como o wizard copia o template inteiro via fork/generate, o workflow já vem incluso nos filhos

### Abordagem escolhida
A — Workflow dispatch nos repositórios filhos (recomendado):
- Roda manual (`workflow_dispatch`) ou semanal
- Busca `admin/` do template, compara com local, abre PR
- Seguro: PR evita sobrescrever customizações do usuário

## Links
- Repo: https://github.com/uniaojoaquinense/demotree-wizard
- Produção: https://demotree-wizard.vercel.app
- Template: https://github.com/uniaojoaquinense/uniaojoaquinense.github.io
