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
1. Faça push deste repositório para o GitHub.
2. No Render, escolha **New + → Blueprint** e selecione o repositório.
3. Confirme o `render.yaml`. Ele cria um Web Service Node.js na região de Frankfurt.
4. O Render executa `npm ci && npm run build` e inicia com `npm start`.
5. A variável `APP_PASSWORD` é gerada automaticamente pelo Blueprint. Consulte o valor nas variáveis de ambiente do serviço para entrar no CRM.
6. O disco persistente `/data` mantém conversas e configurações entre reinícios.

O `render.yaml` inclui o health check `/api/status`. Depois do deploy, configure a URL e a API Key da Evolution API no separador **Configurações** do CRM. O endereço do webhook será:
`https://<teu-servico>.onrender.com/webhook/evolution`

Nota: a Evolution API precisa de estar acessível publicamente pelo Render. Não coloque a API Key no código nem no GitHub; guarde-a apenas nas configurações da aplicação.

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
