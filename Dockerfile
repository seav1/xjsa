FROM node:alpine

WORKDIR .

COPY package.json index.js cf nz ./

RUN apk update &&\
    apk add --no-cache bash &&\
    chmod +x cf nz &&\
    npm install

CMD ["node", "index.js"]

EXPOSE 7860
