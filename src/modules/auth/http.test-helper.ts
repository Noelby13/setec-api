import { Application } from 'express';
import { createServer } from 'node:http';
import { Duplex } from 'node:stream';

export function isolatedHttp(app: Application) {
  const server = createServer(app);
  async function request(path: string, method = 'GET', body?: unknown, token?: string) {
    return new Promise<{ status: number; body: any }>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const socket = new Duplex({
        read() {},
        write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); },
      });
      socket.on('error', reject);
      socket.on('finish', () => {
        const raw = Buffer.concat(chunks).toString();
        const [head, payload] = raw.split('\r\n\r\n');
        try { resolve({ status: Number(head.split(' ')[1]), body: payload.startsWith('{') || payload.startsWith('[') ? JSON.parse(payload) : { message: payload } }); }
        catch (error) { reject(error); }
      });
      server.emit('connection', socket);
      const payload = body ? JSON.stringify(body) : '';
      socket.push(`${method} ${path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\n${token ? `Authorization: Bearer ${token}\r\n` : ''}\r\n${payload}`);
    });
  }
  return { request, close: () => server.close() };
}
