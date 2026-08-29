# Imagem para rodar o agendador em qualquer host de container
# (Railway, Fly.io, Render pago, VPS com Docker).
FROM node:20-slim

WORKDIR /app

# Instala só as dependências de produção
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# DATA_DIR é onde a sessão do WhatsApp (auth/) e a fila (messages.json) ficam.
# Aponte um VOLUME PERSISTENTE para /data no host, senão o QR precisa ser
# reescaneado a cada reinício.
ENV DATA_DIR=/data
ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/server.js"]
