# ZapCRM

CRM para WhatsApp com interface estilo WhatsApp Web, mensagens em tempo real e resposta automática.

## Executar localmente

```bash
npm install
npm run dev
```

O frontend fica em `http://localhost:5000` e a API em `http://localhost:3001`.

## Deploy normal no Render

Crie um **Web Service** a partir deste repositório. Não é necessário Blueprint nem `render.yaml`.

O frontend já vem compilado na pasta `dist/`, por isso o Render não precisa de fazer build.

**Build Command**

```bash
npm install --omit=dev
```

**Start Command**

```bash
npm start
```

Adicione a variável de ambiente:

```text
APP_PASSWORD=uma-senha-segura
```

O Render fornece a variável `PORT` automaticamente e o servidor usa essa porta.

## Configurar a Evolution API

Depois de entrar no CRM:

1. Abra **Configurações**.
2. Informe a URL pública da Evolution API.
3. Informe a API Key.
4. Salve e conecte via QR Code.

O webhook deve apontar para:

```text
https://SEU-SERVICO.onrender.com/webhook/evolution
```