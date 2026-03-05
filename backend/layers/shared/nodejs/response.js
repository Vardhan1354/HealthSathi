'use strict';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Api-Key',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const ok    = (body)           => ({ statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(body) });
const created = (body)         => ({ statusCode: 201, headers: CORS_HEADERS, body: JSON.stringify(body) });
const badRequest = (msg)       => ({ statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: msg }) });
const unauthorized = (msg)     => ({ statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: msg || 'Unauthorized' }) });
const notFound = (msg)         => ({ statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: msg || 'Not found' }) });
const serverError = (err, ctx) => {
  console.error('[ERROR]', err);
  return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Internal server error', requestId: ctx?.awsRequestId }) };
};

const parseBody = (event) => {
  try { return JSON.parse(event.body || '{}'); }
  catch { throw new Error('Invalid JSON body'); }
};

module.exports = { ok, created, badRequest, notFound, unauthorized, serverError, parseBody };
