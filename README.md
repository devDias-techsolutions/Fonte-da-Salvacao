# AD Fonte da Salvação — Church Management Platform

Plataforma de gestão ministerial built on Google Apps Script + Google Sheets.

---

## Pré-requisitos

- Node.js 18+
- Conta Google com acesso à Planilha do projeto
- [Apps Script API ativada](https://script.google.com/home/usersettings)

---

## Setup inicial (primeira vez)

### 1. Instalar o clasp globalmente
```bash
npm install -g @google/clasp
```

### 2. Fazer login com sua conta Google
```bash
clasp login
```

### 3. Clonar o projeto GAS existente
Abra o projeto no Google Apps Script, copie o **Script ID** da URL e rode:
```bash
clasp clone SEU_SCRIPT_ID --rootDir .
```
Isso gera o `.clasp.json` localmente vinculando esta pasta ao projeto remoto.

> **Ou**, se for criar do zero vinculado a uma Planilha:
> ```bash
> clasp create --type sheets --title "AD Fonte da Salvação" --rootDir .
> ```

### 4. Enviar todos os arquivos
```bash
clasp push
```

### 5. Inicializar o banco de dados
No editor GAS (ou via `clasp open`), execute a função:
```
setupSpreadsheet()
```
Isso cria todas as 9 abas com schema completo e os dados iniciais.

### 6. Publicar como Web App
No GAS: **Implantar → Nova implantação → Web App**
- Executar como: `Eu (seu email)`
- Quem tem acesso: `Qualquer pessoa`

---

## Fluxo de trabalho diário

```bash
# Enviar alterações locais para o GAS
clasp push

# Abrir o projeto no browser
clasp open

# Puxar alterações feitas direto no editor GAS (raramente necessário)
clasp pull
```

---

## Credenciais padrão (primeiro acesso)

| Campo | Valor |
|-------|-------|
| Email | `admin@adfontesalvacao.com` |
| Senha | `Admin@1234` |

> ⚠️ O sistema força a troca de senha no primeiro login.

---

## Estrutura de arquivos

```
AD-FonteSalvacao/
├── appsscript.json        # Manifest GAS (fuso, escopos OAuth)
├── .claspignore           # Arquivos ignorados no push
│
├── Code.gs                # doGet(), roteamento, include()
├── Auth.gs                # Login, sessão, senhas
├── Util.gs                # Helpers compartilhados
├── SetupSheets.gs         # Criação das abas + seeds
├── Dashboard.gs           # KPIs e atividade recente
│
├── index.html             # SPA shell + design system
├── _login.html            # Tela de login
├── _primeiro-acesso.html  # Definição de primeira senha
├── _recuperar-senha.html  # Recuperação de senha
└── _home.html             # Dashboard principal
```

---

## Escopos OAuth utilizados

| Escopo | Motivo |
|--------|--------|
| `spreadsheets` | Leitura e escrita nas abas |
| `gmail.send` | Envio de e-mail de recuperação de senha |
| `cache` | Sessões via CacheService |
| `userinfo.email` | Identificação do usuário logado |
| `script.scriptapp` | URL do Web App para links de recuperação |

---

## Convenções do projeto

- **Zero backticks** em qualquer `<script>` — ES5 string concat obrigatório
- Toda função pública `.gs` começa com `Auth._auth(token)` 
- Soft-delete padrão (`Ativo = false`); exclusão permanente só para Admin
- Senhas: SHA-256 gerado **client-side** antes do envio ao servidor
