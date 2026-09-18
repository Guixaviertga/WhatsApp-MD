FROM node:20-slim

# ffmpeg é necessário para converter vídeos em figurinhas animadas;
# build-essential/python3 cobrem dependências nativas eventuais do npm.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg build-essential python3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

# As sessões (credenciais do WhatsApp) devem ser persistidas fora do
# container — monte um volume em /app/sessions.
VOLUME ["/app/sessions"]

CMD ["node", "src/index.js"]
