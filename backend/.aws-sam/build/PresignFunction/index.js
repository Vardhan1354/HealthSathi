'use strict';
/**
 * HealthSathi – S3 Pre-sign Lambda
 * GET /api/presign?key=<s3Key>&type=<mimeType>
 *
 * Returns a pre-signed PUT URL so the browser can upload directly to S3
 * without routing the binary through Lambda (saves cost + avoids 6MB limit).
 * Lambda then reads from the same bucket via Textract / Rekognition.
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const UPLOAD_BUCKET = process.env.UPLOAD_BUCKET;
const s3 = new S3Client({ region: process.env.AWS_REGION });

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key',
};

// Allowed MIME types — only images and PDFs for medical analysis
const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'application/pdf',
]);

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const { key, type = 'image/jpeg' } = params;

  if (!key) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'key query param required' }) };
  }

  if (!ALLOWED_TYPES.has(type)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: `Unsupported file type: ${type}` }) };
  }

  // Sanitize key — only allow uploads/ or prescriptions/ or scans/ prefixes
  const sanitizedKey = key.replace(/[^a-zA-Z0-9._\-/]/g, '_');
  if (!/^(uploads|prescriptions|scans|reports)\//.test(sanitizedKey)) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Key must start with uploads/, prescriptions/, scans/, or reports/' }) };
  }

  try {
    const command = new PutObjectCommand({
      Bucket: UPLOAD_BUCKET,
      Key: sanitizedKey,
      ContentType: type,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5-minute window

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({ url, s3Key: sanitizedKey, expiresIn: 300 }),
    };
  } catch (err) {
    console.error('Presign error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to generate upload URL' }) };
  }
};
