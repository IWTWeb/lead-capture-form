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

function printHex(label, value) {
  console.log(`${label}:`, Buffer.from(value || '', 'utf8').toString('hex'));
}

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

  console.log("🔍 Incoming request method:", req.method);
  console.log("📦 Request body:", JSON.stringify(req.body, null, 2));

  // Print hex-encoded env values for debugging
  console.log('🔐 Hex-encoded env variables:');
  printHex('NETSUITE_ACCOUNT', NETSUITE_ACCOUNT);
  printHex('CONSUMER_KEY', CONSUMER_KEY);
  printHex('CONSUMER_SECRET', CONSUMER_SECRET);
  printHex('TOKEN_ID', TOKEN_ID);
  printHex('TOKEN_SECRET', TOKEN_SECRET);
  printHex('RESTLET_SCRIPT_ID', RESTLET_SCRIPT_ID);
  printHex('RESTLET_DEPLOY_ID', RESTLET_DEPLOY_ID);

  try {
    const requestUrl = `https://${NETSUITE_ACCOUNT.toLowerCase()}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=${RESTLET_SCRIPT_ID}&deploy=${RESTLET_DEPLOY_ID}&compid=${NETSUITE_ACCOUNT}`;
    console.log("🌐 NetSuite RESTlet URL:", requestUrl);

    const request_data = {
      url: requestUrl,
      method: 'POST',
      data: req.body,
    };

    const token = {
      key: TOKEN_ID,
      secret: TOKEN_SECRET,
    };

    const oauthData = oauth.authorize(request_data, token);
    const headers = oauth.toHeader(oauthData);
    headers['Authorization'] = `OAuth realm="${NETSUITE_ACCOUNT}", ${headers['Authorization'].replace(/^OAuth\s/, '')}`;
    headers['Content-Type'] = 'application/json';

    console.log("📤 OAuth headers:", headers);

    console.log("🚀 Sending request to NetSuite...");
    const nsResponse = await fetch(request_data.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    });

    console.log("📥 Received response from NetSuite");
    if (!nsResponse.ok) {
      const errText = await nsResponse.text();
      console.error("❌ NetSuite responded with status", nsResponse.status);
      console.error("🧾 Response body:", errText);
      throw new Error(`NetSuite error: ${nsResponse.status} - ${errText}`);
    }

    const nsResult = await nsResponse.json();
    console.log("✅ NetSuite response:", JSON.stringify(nsResult, null, 2));
    res.status(200).json(nsResult);
  } catch (error) {
    console.error("💥 Error proxying request:", error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
