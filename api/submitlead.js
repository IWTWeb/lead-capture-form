import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import fetch from 'node-fetch';

// Log env variables for debugging (remove after testing)
console.log('ENV VARIABLES:', {
  NETSUITE_ACCOUNT: process.env.NETSUITE_ACCOUNT,
  CONSUMER_KEY: process.env.CONSUMER_KEY,
  CONSUMER_SECRET: process.env.CONSUMER_SECRET,
  TOKEN_ID: process.env.TOKEN_ID,
  TOKEN_SECRET: process.env.TOKEN_SECRET,
  RESTLET_SCRIPT_ID: process.env.RESTLET_SCRIPT_ID,
  RESTLET_DEPLOY_ID: process.env.RESTLET_DEPLOY_ID,
});

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
  console.log(`Incoming request method: ${req.method}`);

  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request');
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    console.log(`Method ${req.method} not allowed`);
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  console.log('Handling POST request');
  console.log('Request body:', req.body);

  try {
    const url = `https://${NETSUITE_ACCOUNT.toLowerCase()}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=${RESTLET_SCRIPT_ID}&deploy=${RESTLET_DEPLOY_ID}`;

    console.log('NetSuite RESTlet URL:', url);

    const request_data = {
      url,
      method: 'POST',
      data: req.body,
    };

    const token = {
      key: TOKEN_ID,
      secret: TOKEN_SECRET,
    };

    console.log('Generating OAuth header...');
    const headers = oauth.toHeader(oauth.authorize(request_data, token));
    headers['Content-Type'] = 'application/json';

    console.log('OAuth headers:', headers);

    console.log('Sending request to NetSuite...');
    const nsResponse = await fetch(request_data.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    });

    console.log('Received response from NetSuite');
    const responseText = await nsResponse.text();

    if (!nsResponse.ok) {
      console.error(`NetSuite responded with status ${nsResponse.status}`);
      console.error('Response body:', responseText);
      throw new Error(`NetSuite error: ${nsResponse.status} - ${responseText}`);
    }

    const nsResult = JSON.parse(responseText);
    console.log('NetSuite response JSON:', nsResult);
    res.status(200).json(nsResult);
  } catch (error) {
    console.error('Error proxying request:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
