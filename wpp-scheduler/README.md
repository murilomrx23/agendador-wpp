# 📅 Agendador de WhatsApp

Sistema focado: você **cola a oferta pronta**, escolhe o **grupo** e a **hora**, e
o serviço **dispara sozinho** no seu grupo de WhatsApp — sem precisar do seu PC
ligado, desde que rode num host sempre ativo.

```
Você agenda no painel  ──►  serviço (sempre ligado)  ──►  seu grupo de WhatsApp
        (QR escaneado 1x, sessão salva em auth/)         (dispara na hora marcada)
```

## Como funciona

- Conecta ao WhatsApp por **QR code** (biblioteca Baileys — WhatsApp Web).
- A sessão fica salva em `auth/` → escaneia **uma vez só**.
- Um **agendador** verifica a cada poucos segundos e envia as mensagens vencidas,
  respeitando um **intervalo mínimo** entre envios.
- Painel web para conectar, agendar, listar e cancelar.

## Rodar localmente (teste)

```bash
cd wpp-scheduler
npm install
cp .env.example .env      # opcional: defina uma senha para o painel
npm start
# abra http://localhost:8080 e escaneie o QR
```

No celular: **WhatsApp → Aparelhos conectados → Conectar um aparelho** e aponte
para o QR do painel.

## "Dispara com o PC desligado?" / "e se eu não estiver logado?"

O que dispara é o **processo do serviço rodando**. Logo:

| Situação | Dispara? |
| --- | --- |
| PC ligado, você logado (mesmo com tela bloqueada) | ✅ |
| PC ligado, usuário **deslogado**, serviço rodando como app normal | ❌ (ao deslogar, o SO fecha seus apps) |
| PC ligado, deslogado, serviço rodando como **serviço do sistema** | ✅ |
| PC em suspensão/hibernação | ⏸️ dispara atrasado ao acordar |
| **Host sempre ligado (recomendado)** | ✅ 24h, independe do seu PC |

O login do **WhatsApp** não exige ninguém logado nem navegador aberto: a sessão
vive no `auth/`.

### Para disparar com o PC deslogado (mas ligado)

- **Windows:** Agendador de Tarefas → nova tarefa → *"Executar estando o usuário
  conectado ou não"*, ação `node caminho\wpp-scheduler\src\server.js`. Desative a
  suspensão automática.
- **Linux:** rode como serviço `systemd` (roda no boot, sem login).
- Em ambos, evite que a máquina durma.

## Rodar num host sempre ligado (RECOMENDADO — sem depender do seu PC)

Assim o serviço fica **24h no ar** e você **nunca** depende do seu computador.

> ⚠️ Dois pontos que não podem faltar em qualquer host:
> 1. **Disco persistente** montado em `/data` (variável `DATA_DIR=/data`) — é onde
>    fica a sessão do WhatsApp (`auth/`). Sem isso, o QR pede rescan a cada deploy.
> 2. **Não pode "dormir"** — evite planos free que hibernam (a conexão cai).

### Opção A — Railway (mais fácil)

1. Crie conta em railway.app e conecte o seu GitHub.
2. **New Project → Deploy from GitHub repo** → selecione este repositório.
3. Em Settings, aponte o **Root Directory** para `wpp-scheduler`.
4. Em **Variables**, adicione `DATA_DIR=/data` (e `DASHBOARD_PASSWORD` se quiser senha).
5. Em **Volumes**, crie um volume e monte em `/data`.
6. Deploy → abra a URL pública → escaneie o QR. Pronto, roda sozinho.

### Opção B — Fly.io (tem o `fly.toml` pronto)

```bash
cd wpp-scheduler
fly launch --no-deploy          # usa o fly.toml já incluído
fly volumes create wpp_data --size 1 --region gru
fly deploy
fly open                        # abra e escaneie o QR
```

### Opção C — VPS com Docker ou pm2

```bash
# Docker (usa o Dockerfile incluído; monte um volume em /data)
docker build -t wpp-scheduler .
docker run -d --restart=always -p 8080:8080 -v wpp_data:/data wpp-scheduler

# ou sem Docker, com pm2 (inicia sozinho no boot)
npm install && npm i -g pm2
pm2 start src/server.js --name wpp-scheduler
pm2 startup && pm2 save
```

## Segurança

- Defina `DASHBOARD_PASSWORD` no `.env` se o painel ficar exposto na internet
  (o painel pede usuário `admin` + essa senha).
- A pasta `auth/` é a sua sessão do WhatsApp — **nunca** versione nem compartilhe.

## ⚠️ Aviso importante (risco de bloqueio)

Isto usa o WhatsApp Web de forma **não-oficial**. O WhatsApp pode **bloquear**
números que disparam muito ou parecem spam. Boas práticas:

- Use um **número dedicado** (não o seu pessoal principal).
- **Poucos grupos**, mensagens espaçadas (o `MIN_SEND_GAP_SECONDS` já ajuda).
- Não faça disparos em massa para desconhecidos — aqui é para **seus** grupos.

Use por sua conta e risco; é o seu número e o seu grupo.

## API (para integração futura)

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/status` | Conexão + QR (data URL) + conta |
| `GET` | `/api/groups` | Grupos em que você participa |
| `GET` | `/api/messages` | Lista das agendadas |
| `POST` | `/api/messages` | Agenda `{ text, imageUrl?, groupJid, groupName, scheduledAt }` |
| `POST` | `/api/messages/:id/send-now` | Dispara na hora |
| `DELETE` | `/api/messages/:id` | Remove |
| `POST` | `/api/logout` | Desconecta o WhatsApp |
