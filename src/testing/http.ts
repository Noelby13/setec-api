import { createServer } from 'node:http';
import { Duplex } from 'node:stream';
import type { Application } from 'express';

/** Exercise Express over raw HTTP without opening a port or accessing a database. */
export function httpRequest(app: Application, path: string, method = 'GET', body?: unknown) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const socket = new Duplex({
      read() {},
      write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); },
    });
    socket.on('error', reject);
    socket.on('finish', () => {
      const raw = Buffer.concat(chunks).toString();
      const split = raw.indexOf('\r\n\r\n');
      try {
        resolve({ status: Number(raw.split(' ')[1]), body: JSON.parse(raw.slice(split + 4)) });
      } catch (error) { reject(error); }
    });
    createServer(app).emit('connection', socket);
    const payload = body === undefined ? '' : JSON.stringify(body);
    socket.push(`${method} ${path} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\n\r\n${payload}`);
  });
}
