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

const oauth = new OAuth({
  consumer: { key: CONSUMER_KEY, secret: CONSUMER_SECRET },
  signature_method: 'HMAC-SHA1',
  hash_function(base_string, key) {
    return crypto.createHmac('sha1', key).update(base_string).digest('base64');
  },
});

export default async function handler(req, res) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*'); // Or specify your domain
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    // Respond to preflight request
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  try {
    const request_data = {
      url: `https://${NETSUITE_ACCOUNT.toLowerCase()}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=${RESTLET_SCRIPT_ID}&deploy=${RESTLET_DEPLOY_ID}`,
      method: 'POST',
      data: req.body,
    };

    const token = {
      key: TOKEN_ID,
      secret: TOKEN_SECRET,
    };

    const headers = oauth.toHeader(oauth.authorize(request_data, token));
    headers['Content-Type'] = 'application/json';

    const nsResponse = await fetch(request_data.url, {
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
    console.error('Error proxying request:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
