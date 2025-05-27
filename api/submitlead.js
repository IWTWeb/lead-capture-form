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

// Initialize OAuth 1.0a with HMAC-SHA256
const oauth = new OAuth({
  consumer: { key: CONSUMER_KEY, secret: CONSUMER_SECRET },
  signature_method: 'HMAC-SHA256',
  hash_function(base_string, key) {
    return crypto.createHmac('sha256', key).update(base_string).digest('base64');
  },
});

export default async function handler(req, res) {
  // CORS headers
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

  try {
    // Construct RESTlet URL (NetSuite account ID must be lowercase)
    const requestUrl = `https://${NETSUITE_ACCOUNT.toLowerCase()}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=${RESTLET_SCRIPT_ID}&deploy=${RESTLET_DEPLOY_ID}&compid=${NETSUITE_ACCOUNT}`;
    console.log("🌐 NetSuite RESTlet URL:", requestUrl);

    // Prepare OAuth parameters (timestamp and nonce)
    const oauthTimestamp = Math.floor(Date.now() / 1000);
    const oauthNonce = crypto.randomBytes(16).toString('hex');

    console.log("🔑 Auth Values:");
    console.log("  - Account:", NETSUITE_ACCOUNT);
    console.log("  - Consumer Key:", CONSUMER_KEY);
    console.log("  - Consumer Secret:", CONSUMER_SECRET ? '✅ (set)' : '❌ (missing)');
    console.log("  - Token ID:", TOKEN_ID);
    console.log("  - Token Secret:", TOKEN_SECRET ? '✅ (set)' : '❌ (missing)');
    console.log("🕒 Timestamp Debug:");
    console.log("  - oauth_timestamp:", oauthTimestamp);
    console.log("  - Local Time:", new Date(oauthTimestamp * 1000).toLocaleString());
    console.log("  - UTC Time:", new Date(oauthTimestamp * 1000).toUTCString());
    console.log("🌀 Using oauth_nonce:", oauthNonce);

    // The data to send (will be included in signature base string)
    const request_data = {
      url: requestUrl,
      method: 'POST',
      data: req.body,
    };

    // Prepare OAuth parameters for signature
    const oauthParams = {
      oauth_consumer_key: CONSUMER_KEY,
      oauth_token: TOKEN_ID,
      oauth_nonce: oauthNonce,
      oauth_timestamp: oauthTimestamp.toString(),
      oauth_signature_method: 'HMAC-SHA256',
      oauth_version: '1.0',
    };

    // Generate OAuth signature
    oauthParams.oauth_signature = oauth.getSignature(request_data, TOKEN_SECRET, oauthParams);

    // Format OAuth Authorization header (key/value pairs quoted, comma separated)
    const authHeader = Object.entries(oauthParams)
      .map(([key, val]) => `${key}="${encodeURIComponent(val)}"`)
      .join(', ');

    const headers = {
      Authorization: `OAuth ${authHeader}`,
      'Content-Type': 'application/json',
    };

    console.log("📤 OAuth headers:", headers);

    // Send POST request to NetSuite RESTlet with JSON body and OAuth header
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
