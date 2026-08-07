# WhatsApp CRM

Dashboard de CRM estilo WhatsApp com resposta automática via bot.

## Stack
- **Frontend:** React 18 + Vite + Tailwind CSS (tema verde WhatsApp, modo escuro/claro)
- **Backend:** Node.js + Express + Socket.io (porta 3001)
- **WhatsApp:** Evolution API (conexão via QR Code)

## Como rodar
```bash
npm run dev
```
- Frontend: http://localhost:5000
- Backend API: http://localhost:3001

## Como publicar no Render
Este é um Web Service Node.js normal, sem Blueprint ou ficheiro de configuração obrigatório.

1. Faça push deste repositório para o GitHub.
2. No Render, escolha **New + → Web Service**.
3. Selecione o repositório e escolha **Node**.
4. Use estes comandos:
   - **Build Command:** `npm install --omit=dev` (o frontend já vem compilado em `dist/`; depois de alterar código do frontend, correr `npm run build` e fazer commit do `dist/`)
   - **Start Command:** `npm start`
5. Adicione a variável `APP_PASSWORD` com uma senha sua.
6. Faça o deploy.

Depois do deploy, configure a URL e a API Key da Evolution API no separador **Configurações** do CRM. O endereço do webhook será:
`https://<teu-servico>.onrender.com/webhook/evolution`

As conversas e configurações são guardadas em `data/data.json`. No plano normal do Render, o disco local é temporário; para manter os dados depois de reinícios, adicione um Persistent Disk no Render ou ligue uma base de dados externa.

## Como conectar o WhatsApp
1. Acesse a aba **Configurações** (ícone de engrenagem)
2. Preencha a **URL da Evolution API** e a **API Key**
3. Clique em **Salvar configurações**
4. Clique em **Conectar via QR Code**
5. Escaneie com o WhatsApp: *Dispositivos conectados → Conectar dispositivo*

## Evolution API (gratuita e auto-hospedável)
- Repositório: https://github.com/EvolutionAPI/evolution-api
- Alternativas hosted: evoapi.io, evoapicloud.com

## Funcionalidades
- Lista de conversas em tempo real (WebSocket)
- Chat estilo WhatsApp (bolhas, horário, status de entrega)
- Resposta automática configurável (bot on/off + mensagem)
- Resposta manual nas conversas
- Pesquisa de conversas
- Modo escuro/claro
- Webhook `/webhook/evolution` para receber mensagens da Evolution API

## Dados
- Conversas e configurações salvas em `./data/data.json`
- Configurações: botEnabled, botMessage, evolutionApiUrl, evolutionApiKey, instanceName

## User preferences
- Interface em português (pt-BR)
- Design estilo WhatsApp Web (verde #25D366)
