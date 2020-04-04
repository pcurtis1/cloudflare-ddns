FROM node:alpine

COPY . /app
RUN cd /app && npm i

CMD node /app/index.js