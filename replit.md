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
