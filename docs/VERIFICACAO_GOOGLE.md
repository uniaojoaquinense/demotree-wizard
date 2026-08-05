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
- **App name**: `DemotreeWizard - AutoSetup` (DEVE bater com o nome exibido na página inicial, `<title>` e `<h1>` do wizard — já alinhado). Se o nome no console for diferente, **altere no console** para `DemotreeWizard - AutoSetup`.
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

### 6. Verificação de domínio (obrigatória — foi o erro "site não registrado para você")
- O Google exige provar que você é o dono do domínio da home page. `vercel.app` é subdomínio e o DNS não é seu, então use o **Search Console com método de arquivo HTML**:
  1. Acesse https://search.google.com/search-console e adicione uma propriedade do tipo **URL prefix** = `https://demotree-wizard.vercel.app`.
  2. Escolha o método **"HTML file"** e baixe o arquivo gerado (ex.: `google1234abcd.html`).
  3. Coloque esse arquivo na **raiz do repo do wizard** (`demotreemaster/google1234abcd.html`), commite e faça deploy na Vercel (`vercel --prod`).
  4. Volte ao Search Console e clique em **Verify** — o Google acessará `https://demotree-wizard.vercel.app/google1234abcd.html`.
  5. Depois, no **OAuth consent screen**, em **Verify domain**, selecione esse domínio verificado.
- Se não quiser depender de `vercel.app`, o caminho robusto é um **domínio próprio** (ex.: `uniaojoaquinense.demolay.com.br`) — fora do escopo atual.

### 7. Submit for verification
- Clique em **Submit for verification**, marque o escopo sensível `spreadsheets` e preencha o questionário.

## Erros típicos já vistos e como resolver

| Erro | Causa | Correção |
|---|---|---|
| Site da home page não registrado | Domínio não verificado | Passo 6 (Search Console + arquivo HTML) |
| Home page sem link à Política de Privacidade | Faltava link no `index.html` | Já corrigido: rodapé `.legal` no `index.html` aponta para `privacidade.html` |
| URL da Política de Privacidade não funciona | Ponto final digitado a mais (`...privacidade.html.`) ou página não publicada | Usar exatamente `https://demotree-wizard.vercel.app/privacidade.html` (sem ponto final) |
| Home page não explica a finalidade | Faltava texto descritivo | Já corrigido: seção `.purpose` no `index.html` |
| Nome do app não corresponde | Nome no console ≠ nome na home | Alinhar para `DemotreeWizard - AutoSetup` em ambos |

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