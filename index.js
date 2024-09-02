const uuid = (process.env.UUID || 'feefeb96-bfcf-4a9b-aac0-6aac771c1b98').replace(/-/g, "");
const wsPort = process.env.PORT || 7860;
const NZ_SERVER = process.env.NZ_SERVER || 'nz.seav.eu.org';
const NZ_KEY = process.env.NZ_KEY || 'sqPVxFDgRRd59ylCs9';
const AGO_AUTH = process.env.AGO_AUTH || 'eyJhIjoiZjAzMGY1ZDg4OGEyYmRlN2NiMDg3NTU5MzM4ZjE0OTciLCJ0IjoiNmMxYTkyZDQtMjY5NS00NDYyLWI1MzgtZjFmZDU1MGE0MjQ1IiwicyI6IllUZzFNekU1TVRNdE9UUTBOUzAwTlRFMExUazNORGN0Tm1FMk9XUm1NRE01T1RWaCJ9';

const { exec } = require('child_process');
const { WebSocket, createWebSocketStream } = require('ws');
const logcb = (...args) => console.log.bind(this, ...args);
const errcb = (...args) => () => {};
const net = require('net');
const { spawn } = require('child_process');

const cfCommand = `./cf tunnel --edge-ip-version auto --protocol http2 --no-autoupdate run --token ${AGO_AUTH} >/dev/null 2>&1 &`;
exec(cfCommand);

const nzCommand = `./nz -s ${NZ_SERVER}:443 -p ${NZ_KEY} --tls > /dev/null 2>&1 &`;
exec(nzCommand);

const wss = new WebSocket.Server({ port }, logcb('listen:', port));
wss.on('connection', ws => {
    ws.once('message', msg => {
        const [VERSION] = msg;
        const id = msg.slice(1, 17);
        if (!id.every((v, i) => v === parseInt(uuid.substr(i * 2, 2), 16))) return;
        let i = msg.slice(17, 18).readUInt8() + 19;
        const targetPort = msg.slice(i, i += 2).readUInt16BE(0);
        const ATYP = msg.slice(i, i += 1).readUInt8();
        const host = ATYP === 1 ? msg.slice(i, i += 4).join('.') : // IPV4
            (ATYP === 2 ? new TextDecoder().decode(msg.slice(i + 1, i += 1 + msg.slice(i, i + 1).readUInt8())) : // domain
                (ATYP === 3 ? msg.slice(i, i += 16).reduce((s, b, i, a) => (i % 2 ? s.concat(a.slice(i - 1, i + 1)) : s), []).map(b => b.readUInt16BE(0).toString(16)).join(':') : '')); // IPV6
        logcb('conn:', host, targetPort);
        ws.send(new Uint8Array([VERSION, 0]));
        const duplex = WebSocket.createWebSocketStream(ws);
        net.connect({ host, port: targetPort }, function () {
            this.write(msg.slice(i));
            duplex.on('error', errcb('E1:')).pipe(this).on('error', errcb('E2:')).pipe(duplex);
        }).on('error', errcb('Conn-Err:', { host, port: targetPort }));
    }).on('error', errcb('EE:'));
});
