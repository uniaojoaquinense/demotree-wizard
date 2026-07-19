# Auto Setup — Site de Links Demolay

Wizard que cria automaticamente um site de links para capítulos Demolay.

## Fluxo

1. **Google** — Cria planilha com estrutura pronta (Sheet1 + Sheet2)
2. **Cloudflare** — Cria worker proxy na conta do usuário
3. **GitHub** — Cria repositório a partir do template, ativa Pages

## Pré-requisitos

### 1. Google Cloud
- Acessar https://console.cloud.google.com
- Ativar **Google Sheets API**
- Criar **Google API Key** (APIs → Credenciais → Criar chave)
  - Restringir por **HTTP referrers**: `*.workers.dev`
- **GOOGLE_CLIENT_ID** já existente: `897683631001-ugml9ertq7bldbtmsugcejhitav6l4dp.apps.googleusercontent.com`

### 2. GitHub OAuth App
- Acessar https://github.com/settings/developers → OAuth Apps → New OAuth App
- Application name: `Auto Setup Links`
- Homepage URL: `https://demotree-wizard.vercel.app`
- Callback URL: `https://demotree-wizard.vercel.app`
- Marcar **Enable Device Flow**
- Copiar o **Client ID**

### 3. Template Repository
- Settings do `uniaojoaquinense/uniaojoaquinense.github.io` → marcar ✅ **Template repository**

## Variáveis de ambiente (Vercel)

No dashboard da Vercel (Project → Settings → Environment Variables), adicionar:

| Nome | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | `897683631001-...` |
| `GOOGLE_API_KEY` | chave criada no passo 1 |
| `GITHUB_CLIENT_ID` | client ID do passo 2 |

## Deploy

```bash
npm i -g vercel
vercel --prod
```

Após configurar as env vars no dashboard, rodar `vercel --prod` novamente.
