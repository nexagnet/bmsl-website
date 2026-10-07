import net from 'node:net';

// Minimal in-process SMTP server for tests (synthetic data only, loopback only). It speaks just enough SMTP for
// nodemailer over plain TCP and keeps the raw messages so a test can assert exactly what crossed the wire. It is
// the CI-safe stand-in for Mailpit (which is used for the local Docker proof, see docs/runbooks/lead-email.md).

export type SinkMode = 'accept' | 'reject-recipient-550' | 'tempfail-451';
export type SinkMessage = { from: string; to: string[]; raw: string };

export function createSmtpSink() {
  const messages: SinkMessage[] = [];
  const sockets = new Set<net.Socket>();
  let mode: SinkMode = 'accept';
  let server: net.Server | undefined;
  let port = 0;

  const onConnection = (socket: net.Socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => undefined);
    let inData = false;
    let buffer = '';
    let from = '';
    let to: string[] = [];
    const reply = (line: string) => socket.write(`${line}\r\n`);
    reply('220 sink ESMTP');
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      for (;;) {
        if (inData) {
          const end = buffer.indexOf('\r\n.\r\n');
          if (end === -1) return;
          messages.push({ from, to, raw: buffer.slice(0, end) });
          buffer = buffer.slice(end + 5);
          inData = false;
          reply('250 queued');
          continue;
        }
        const eol = buffer.indexOf('\r\n');
        if (eol === -1) return;
        const line = buffer.slice(0, eol);
        buffer = buffer.slice(eol + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') reply('250 sink');
        else if (cmd === 'MAIL') {
          from = line.replace(/^MAIL FROM:\s*<?([^>\s]*)>?.*$/i, '$1');
          to = [];
          reply('250 ok');
        } else if (cmd === 'RCPT') {
          if (mode === 'reject-recipient-550') reply('550 5.1.1 recipient rejected');
          else if (mode === 'tempfail-451') reply('451 4.3.0 try again later');
          else {
            to.push(line.replace(/^RCPT TO:\s*<?([^>\s]*)>?.*$/i, '$1'));
            reply('250 ok');
          }
        } else if (cmd === 'DATA') {
          inData = true;
          reply('354 go ahead');
        } else if (cmd === 'RSET' || cmd === 'NOOP') reply('250 ok');
        else if (cmd === 'QUIT') {
          reply('221 bye');
          socket.end();
        } else reply('502 not implemented');
      }
    });
  };

  return {
    messages,
    get port() {
      return port;
    },
    setMode(next: SinkMode) {
      mode = next;
    },
    /** Starts listening; pass the previous port to come back "up" where the app expects the SMTP server. */
    async start(fixedPort = 0) {
      server = net.createServer(onConnection);
      await new Promise<void>((resolve, reject) => {
        server!.once('error', reject);
        server!.listen(fixedPort, '127.0.0.1', () => resolve());
      });
      port = (server.address() as net.AddressInfo).port;
      return port;
    },
    /** Goes "down": refuses new connections and drops open ones, like an unavailable SMTP server. */
    async stop() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
      server = undefined;
    },
  };
}
