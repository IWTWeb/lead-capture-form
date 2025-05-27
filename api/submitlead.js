import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import fetch from 'node-fetch';

const NETSUITE_ACCOUNT = process.env.NETSUITE_ACCOUNT;
const CONSUMER_KEY = process.env.CONSUMER_KEY;
const CONSUMER_SECRET = process.env.CONSUMER_SECRET;
const TOKEN_ID = process.env.TOKEN_ID;
const TOKEN_SECRET = process.env.TOKEN_SECRET;
const RESTLET_SCRIPT_ID = process.env.RESTLET_SCRIPT_ID;
const RESTLET_DEPLOY_ID = process.env.RESTLET_DEPLOY_ID;

// Initialize OAuth
const oauth = new OAuth({
  consumer: { key: CONSUMER_KEY, secret: CONSUMER_SECRET },
  signature_method: 'HMAC-SHA256',
  hash_function(base_string, key) {
    return crypto.createHmac('sha256', key).update(base_string).digest('base64');
  },
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  try {
    // Build URL with required query parameters (script, deploy, compid)
    const baseUrl = `https://${NETSUITE_ACCOUNT.toLowerCase()}.restlets.api.netsuite.com/app/site/hosting/restlet.nl`;
    const urlParams = new URLSearchParams({
      script: RESTLET_SCRIPT_ID,
      deploy: RESTLET_DEPLOY_ID,
      compid: NETSUITE_ACCOUNT,
    });
    const requestUrl = `${baseUrl}?${urlParams.toString()}`;

    const oauthTimestamp = Math.floor(Date.now() / 1000);
    const oauthNonce = crypto.randomBytes(16).toString('hex');

    // Prepare all parameters for signing:
    // This includes query parameters + OAuth params + (optionally) body parameters
    // NetSuite expects the body parameters included in the signature base string
    // But they are NOT included in the Authorization header
    const allParams = {
      // Query params
      script: RESTLET_SCRIPT_ID,
      deploy: RESTLET_DEPLOY_ID,
      compid: NETSUITE_ACCOUNT,
      // OAuth params (without signature yet)
      oauth_consumer_key: CONSUMER_KEY,
      oauth_token: TOKEN_ID,
      oauth_nonce: oauthNonce,
      oauth_timestamp: oauthTimestamp.toString(),
      oauth_signature_method: 'HMAC-SHA256',
      oauth_version: '1.0',
      // Add body parameters flattened here (assumes flat object)
      ...req.body,
    };

    // Build request data object for oauth-1.0a
    const request_data = {
      url: baseUrl,
      method: 'POST',
      data: allParams,
    };

    // Generate oauth_signature
    const oauth_signature = oauth.getSignature(request_data, TOKEN_SECRET, CONSUMER_SECRET);

    // Build OAuth-only params for Authorization header (exclude body and query params)
    const oauthHeaderParams = {
      oauth_consumer_key: CONSUMER_KEY,
      oauth_token: TOKEN_ID,
      oauth_nonce: oauthNonce,
      oauth_timestamp: oauthTimestamp.toString(),
      oauth_signature_method: 'HMAC-SHA256',
      oauth_version: '1.0',
      oauth_signature,
    };

    // Format Authorization header string per OAuth 1.0 spec
    const authHeader =
      'OAuth ' +
      Object.entries(oauthHeaderParams)
        .map(([k, v]) => `${k}="${encodeURIComponent(v)}"`)
        .join(', ');

    // Prepare headers
    const headers = {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    };

    // Send POST with JSON body (req.body only) and proper OAuth header
    const nsResponse = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    });

    if (!nsResponse.ok) {
      const errText = await nsResponse.text();
      throw new Error(`NetSuite error: ${nsResponse.status} - ${errText}`);
    }

    const nsResult = await nsResponse.json();
    res.status(200).json(nsResult);
  } catch (error) {
    console.error('💥 Error proxying request:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
