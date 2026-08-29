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

## Rodar num host sempre ligado (recomendado)

Assim você **nunca** depende do seu PC. Opções:

- **Railway / Render / Fly.io:** suba a pasta `wpp-scheduler`, comando de start
  `npm start`. **Importante:** o disco precisa ser **persistente** (para manter a
  pasta `auth/`), senão você teria que reescanear o QR a cada reinício. No Fly,
  use um *volume*; no Railway, um *volume* montado. Evite planos "free" que
  **dormem** (a conexão do WhatsApp cairia).
- **VPS (ex.: R$ 20–30/mês):** `git clone`, `npm install`, e rode com `pm2`:
  ```bash
  npm i -g pm2
  pm2 start src/server.js --name wpp-scheduler
  pm2 startup && pm2 save    # inicia sozinho no boot
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
