// voice-relay.js
// Run: node voice-relay.js
// Set RELAY_SECRET env var or edit DEFAULT_SECRET below.

const dgram = require('dgram');
const server = dgram.createSocket('udp4');

const DEFAULT_SECRET = process.env.RELAY_SECRET; // change this in production
const PORT = parseInt(process.env.RELAY_PORT || '51000', 10);
const CLIENT_TIMEOUT_MS = 30_000;
const MAX_CLIENTS = 200;

let clients = new Map(); // key: endpoint string -> {address, port, lastSeen, name}

function endpointKey(rinfo) {
  return `${rinfo.address}:${rinfo.port}`;
}

server.on('message', (msg, rinfo) => {
  try {
    if (!msg || msg.length < 2) return; // must have at least tokenLen + something

    let offset = 0;
    const tokenLen = msg.readUInt8(offset); offset += 1;
    if (tokenLen <= 0 || offset + tokenLen > msg.length) return;
    const token = msg.slice(offset, offset + tokenLen).toString('utf8'); offset += tokenLen;

    // quick auth
    if (token !== DEFAULT_SECRET) return; // drop silently

    if (offset >= msg.length) return;
    const nameLen = msg.readUInt8(offset); offset += 1;
    let senderName = '';
    if (nameLen > 0 && offset + nameLen <= msg.length) {
      senderName = msg.slice(offset, offset + nameLen).toString('utf8'); offset += nameLen;
    }

    const payload = msg.slice(offset);
    if (payload.length === 0) return;

    const key = `${rinfo.address}:${rinfo.port}`;
    clients.set(key, { address: rinfo.address, port: rinfo.port, lastSeen: Date.now(), name: senderName });

    // Broadcast to others (naive)
    const entries = Array.from(clients.entries());
    if (entries.length > MAX_CLIENTS) {
      // keep only recent ones
      entries.sort((a, b) => b[1].lastSeen - a[1].lastSeen);
      entries.slice(MAX_CLIENTS).forEach(([k]) => clients.delete(k));
    }

    for (const [k, c] of clients) {
      if (k === key) continue; // don't echo back to sender
      // re-wrap: we forward with a small 1-byte nameLen + name + payload so receiver knows sender
      const nameBuf = Buffer.from(c.name || '', 'utf8');
      const out = Buffer.alloc(1 + nameBuf.length + payload.length);
      out.writeUInt8(nameBuf.length, 0);
      nameBuf.copy(out, 1);
      payload.copy(out, 1 + nameBuf.length);
      server.send(out, c.port, c.address, (err) => {});
    }

  } catch (e) {
    // ignore malformed
  }
});

server.on('listening', () => {
  const addr = server.address();
  console.log(`Voice relay listening ${addr.address}:${addr.port}`);
});

server.bind(PORT);

// clean stale clients
setInterval(() => {
  const now = Date.now();
  for (const [k, c] of clients) {
    if (now - c.lastSeen > CLIENT_TIMEOUT_MS) clients.delete(k);
  }
}, 10_000);
 
