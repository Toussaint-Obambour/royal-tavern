# Image Docker — Le Royal Tavern
# Utilisation :  docker build -t royal-tavern .  &&  docker run -p 3000:3000 -v $(pwd)/data:/app/data royal-tavern
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Les données (menu, commandes) sont dans /app/data — montez un volume pour les conserver
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
