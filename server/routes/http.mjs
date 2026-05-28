export async function readJson(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

export function empty(response, status = 204) {
  response.writeHead(status, corsHeaders());
  response.end();
  return true;
}

export function json(response, body, status = 200, extraHeaders = {}) {
  response.writeHead(status, {
    ...corsHeaders(),
    'content-type': 'application/json',
    ...extraHeaders
  });
  response.end(JSON.stringify(body, null, 2));
  return true;
}

export function excel(response, body, filename) {
  response.writeHead(200, {
    ...corsHeaders(),
    'content-disposition': `inline; filename=${filename}`,
    'content-type': 'application/vnd.ms-excel; charset=utf-8'
  });
  response.end(body);
  return true;
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type'
  };
}
