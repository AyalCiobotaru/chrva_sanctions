import net from 'node:net';
import tls from 'node:tls';

const CRLF = '\r\n';

export function isEmailDeliveryConfigured() {
  return Boolean(text(process.env.CHRVA_SMTP_HOST)) && !isDryRun();
}

export async function sendEmail(message) {
  const normalized = normalizeMessage(message);

  if (isDryRun()) {
    return {
      sent: false,
      dryRun: true,
      recipientCount: normalized.envelopeTo.length,
      messageId: ''
    };
  }

  const config = smtpConfig();

  if (!config.host) {
    return {
      sent: false,
      dryRun: true,
      recipientCount: normalized.envelopeTo.length,
      messageId: ''
    };
  }

  const client = await SmtpClient.connect(config);
  try {
    await client.greeting();
    await client.ehlo();

    if (config.startTls) {
      await client.command('STARTTLS', [220]);
      await client.secure(config.host);
      await client.ehlo();
    }

    if (config.username || config.password) {
      await client.auth(config.username, config.password);
    }

    await client.command(`MAIL FROM:<${normalized.envelopeFrom}>`, [250]);

    for (const recipient of normalized.envelopeTo) {
      await client.command(`RCPT TO:<${recipient}>`, [250, 251]);
    }

    await client.command('DATA', [354]);
    await client.writeData(renderMessage(normalized));
    const dataResponse = await client.read([250]);
    await client.command('QUIT', [221]);

    return {
      sent: true,
      dryRun: false,
      recipientCount: normalized.envelopeTo.length,
      messageId: parseMessageId(dataResponse.message)
    };
  } finally {
    client.close();
  }
}

function smtpConfig() {
  const port = Number.parseInt(process.env.CHRVA_SMTP_PORT || '', 10);
  const secure = envFlag('CHRVA_SMTP_SECURE', false);

  return {
    host: text(process.env.CHRVA_SMTP_HOST),
    port: Number.isInteger(port) ? port : secure ? 465 : 25,
    secure,
    startTls: envFlag('CHRVA_SMTP_STARTTLS', false),
    username: text(process.env.CHRVA_SMTP_USER),
    password: text(process.env.CHRVA_SMTP_PASSWORD)
  };
}

function normalizeMessage(message) {
  const from = normalizeAddress(message?.from);
  const to = normalizeAddresses(message?.to);
  const cc = normalizeAddresses(message?.cc);
  const bcc = normalizeAddresses(message?.bcc);
  const replyTo = normalizeAddresses(message?.replyTo);
  const subject = text(message?.subject);
  const html = text(message?.html);
  const plainText = text(message?.text) || htmlToText(html);
  const envelopeTo = [...new Set([...to, ...cc, ...bcc].map((address) => address.email.toLowerCase()))];

  if (!from.email) {
    throw validationError('From address is required.');
  }

  if (to.length === 0 && cc.length === 0 && bcc.length === 0) {
    throw validationError('At least one recipient is required.');
  }

  if (!subject) {
    throw validationError('Subject is required.');
  }

  if (!html && !plainText) {
    throw validationError('Email body is required.');
  }

  return {
    from,
    to,
    cc,
    bcc,
    replyTo,
    subject,
    html,
    text: plainText,
    envelopeFrom: from.email,
    envelopeTo
  };
}

function renderMessage(message) {
  const boundary = `chrva-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headers = [
    ['From', formatAddress(message.from)],
    ['To', formatAddresses(message.to)],
    message.cc.length ? ['Cc', formatAddresses(message.cc)] : null,
    message.replyTo.length ? ['Reply-To', formatAddresses(message.replyTo)] : null,
    ['Subject', encodeHeader(message.subject)],
    ['Date', new Date().toUTCString()],
    ['MIME-Version', '1.0'],
    ['Content-Type', `multipart/alternative; boundary="${boundary}"`]
  ].filter(Boolean);

  const parts = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.text,
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.html || escapeHtml(message.text).replace(/\n/g, '<br>'),
    `--${boundary}--`,
    ''
  ];

  return `${headers.map(([name, value]) => `${name}: ${value}`).join(CRLF)}${CRLF}${CRLF}${parts.join(CRLF)}`;
}

class SmtpClient {
  static connect(config) {
    return new Promise((resolve, reject) => {
      const socket = config.secure
        ? tls.connect(config.port, config.host, { servername: config.host })
        : net.connect(config.port, config.host);
      const client = new SmtpClient(socket);

      socket.once(config.secure ? 'secureConnect' : 'connect', () => resolve(client));
      socket.once('error', reject);
    });
  }

  constructor(socket) {
    this.socket = socket;
    this.buffer = '';
    this.pending = [];
    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk) => {
      this.buffer += chunk;
      this.flush();
    });
    this.socket.on('error', (error) => {
      for (const pending of this.pending.splice(0)) {
        pending.reject(error);
      }
    });
  }

  greeting() {
    return this.read([220]);
  }

  ehlo() {
    return this.command(`EHLO ${process.env.CHRVA_SMTP_HELO || 'chrva-modernized.local'}`, [250]);
  }

  async auth(username, password) {
    const token = Buffer.from(`\0${username}\0${password}`).toString('base64');
    await this.command(`AUTH PLAIN ${token}`, [235]);
  }

  command(command, expectedCodes) {
    this.socket.write(`${command}${CRLF}`);
    return this.read(expectedCodes);
  }

  writeData(data) {
    const escaped = data
      .replace(/\r?\n/g, CRLF)
      .split(CRLF)
      .map((line) => line.startsWith('.') ? `.${line}` : line)
      .join(CRLF);
    this.socket.write(`${escaped}${CRLF}.${CRLF}`);
  }

  read(expectedCodes) {
    return new Promise((resolve, reject) => {
      this.pending.push({ expectedCodes, resolve, reject });
      this.flush();
    });
  }

  secure(host) {
    return new Promise((resolve, reject) => {
      this.socket = tls.connect({
        socket: this.socket,
        servername: host
      });
      this.socket.setEncoding('utf8');
      this.socket.once('secureConnect', resolve);
      this.socket.once('error', reject);
      this.socket.on('data', (chunk) => {
        this.buffer += chunk;
        this.flush();
      });
    });
  }

  close() {
    this.socket.end();
  }

  flush() {
    const current = this.pending[0];

    if (!current) {
      return;
    }

    const response = parseResponse(this.buffer);

    if (!response) {
      return;
    }

    this.buffer = this.buffer.slice(response.length);
    this.pending.shift();

    if (current.expectedCodes.includes(response.code)) {
      current.resolve(response);
    } else {
      const error = new Error(`SMTP command failed with ${response.code}: ${response.message}`);
      error.code = 'ERR_SMTP';
      current.reject(error);
    }
  }
}

function parseResponse(buffer) {
  const lines = buffer.split(CRLF);
  let length = 0;
  const responseLines = [];

  for (const line of lines) {
    if (!line) {
      return null;
    }

    length += line.length + CRLF.length;
    responseLines.push(line);

    if (/^\d{3} /.test(line)) {
      return {
        code: Number(line.slice(0, 3)),
        message: responseLines.map((value) => value.slice(4)).join('\n'),
        length
      };
    }
  }

  return null;
}

function normalizeAddresses(value) {
  const values = Array.isArray(value) ? value : text(value).split(',');
  return values.map(normalizeAddress).filter((address) => address.email);
}

function normalizeAddress(value) {
  if (typeof value === 'object' && value !== null) {
    return {
      email: text(value.email),
      name: text(value.name)
    };
  }

  return {
    email: text(value),
    name: ''
  };
}

function formatAddresses(addresses) {
  return addresses.map(formatAddress).join(', ');
}

function formatAddress(address) {
  return address.name ? `"${address.name.replace(/"/g, '\\"')}" <${address.email}>` : address.email;
}

function encodeHeader(value) {
  return /[^\x00-\x7F]/.test(value) ? `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=` : value;
}

function htmlToText(value) {
  return text(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseMessageId(value) {
  return text(value).match(/queued as\s+(\S+)/i)?.[1] ?? '';
}

function isDryRun() {
  return envFlag('CHRVA_EMAIL_DRY_RUN', false);
}

function envFlag(name, defaultValue) {
  const value = text(process.env[name]).toLowerCase();

  if (!value) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'y'].includes(value);
}

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = 'ERR_VALIDATION';
  return error;
}

function text(value) {
  return value == null ? '' : String(value).trim();
}
