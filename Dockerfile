FROM node:18

USER node

WORKDIR /app

COPY --chown=node package.json .
COPY --chown=node package-lock.json .

ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci

COPY --chown=node . .
RUN npm run build

ENTRYPOINT [ "./bin/cli.js" ]
