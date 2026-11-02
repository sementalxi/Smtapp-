FROM node:20-alpine
# Fontconfig + DejaVu ensure SMT welcome banner usernames render correctly in Sharp SVG.
RUN apk add --no-cache fontconfig ttf-dejavu
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
ENV NODE_ENV=production
CMD ["npm","start"]
