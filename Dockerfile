FROM node:20

USER node

WORKDIR /app

COPY --chown=node . .

RUN npm ci

RUN npm run build

ENTRYPOINT [ "./bin/cli.js" ]
