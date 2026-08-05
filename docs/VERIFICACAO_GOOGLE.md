# Verificação OAuth do Google — remover tela "app não verificado"

Como remover a tela **"O Google não verificou este app"** depois de publicar o app (In production).

> A publicação **não** remove o aviso. A tela só some com a **verificação** do app. Escopos sensíveis (ex.: `spreadsheets`) exigem verificação. Em In production não verificado, o Google também impõe limite (~100 usuários).

## Contexto

O OAuth Client pertence ao **wizard** (servido em `https://demotree-wizard.vercel.app`), pois é lá que o login acontece (`oauth-popup.html`). Logo, toda configuração de verificação é feita no projeto do wizard.

## O que o código deve ter

1. Escopos reduzidos em `api/config.js`:
   ```js
   GOOGLE_SCOPES: 'https://www.googleapis.com/auth/spreadsheets profile email'
   ```
2. Política de privacidade pública em `https://demotree-wizard.vercel.app/privacidade.html`.
3. Termos de Serviço públicos em `https://demotree-wizard.vercel.app/termos.html`.

## Passo a passo no Console Google

Acesse https://console.cloud.google.com logado como **uniaojoaquinense@gmail.com**, abra o projeto do wizard e vá em **APIs & Services → OAuth consent screen**.

### 1. Informações do app
- **App name**: Auto Setup — Site de Links
- **App logo** (300×300 PNG): use o `imgs/brasao.png` do capítulo
- **Support email**: `uniaojoaquinense@gmail.com`

### 2. Escopos
- Apenas: `email`, `profile` e `https://www.googleapis.com/auth/spreadsheets`.
- Confira que **`drive.file` NÃO está marcado**.

### 3. Domínio autorizado
- **Authorized domain**: `demotree-wizard.vercel.app`

### 4. Links da aplicação
- **Application home page**: `https://demotree-wizard.vercel.app`
- **Application privacy policy URL**: `https://demotree-wizard.vercel.app/privacidade.html`
- **Application terms of service URL**: `https://demotree-wizard.vercel.app/termos.html`

### 5. Developer contact info
- `uniaojoaquinense@gmail.com`

### 6. Verificação de domínio (se o Google pedir)
- `vercel.app` é subdomínio; o DNS não é seu, então a verificação pode falhar. Nesse caso será preciso um domínio próprio (ex.: `uniaojoaquinense.demolay.com.br`) — fora do escopo atual.

### 7. Submit for verification
- Clique em **Submit for verification**, marque o escopo sensível `spreadsheets` e preencha o questionário.

## Rascunho da justificativa (colar no submit)

> Aplicação interna do Capítulo União Joaquinense nº 300, usada pelos membros para criar um site de links e gerenciar uma planilha de materiais no Google Sheets.
> - `spreadsheets`: criar e editar a planilha que alimenta o site.
> - Os escopos são acessados apenas pelo admin, com o próprio consentimento. O token fica só no navegador e é revogável a qualquer hora.
> - Nenhum dado é compartilhado com terceiros; o uso é restrito aos membros do capítulo.

## O que NÃO remove a tela
- Deixar em Testing: mostra aviso, mas funciona para test users.
- Publicar sem verificação: o aviso persiste e pode bloquear o login acima de 100 usuários.

## Após a aprovação
Com a aprovação a tela some para todas as contas autorizadas. Aprovação pode levar ~3–7 dias úteis; escopos sensíveis são recusados com frequência em apps pessoais.