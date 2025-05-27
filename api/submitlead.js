import crypto from 'crypto';
import OAuth from 'oauth-1.0a';
import fetch from 'node-fetch';

// Environment variables from Vercel
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

  console.log("🔍 Incoming request method:", req.method);
  console.log("📦 Request body:", JSON.stringify(req.body, null, 2));

  try {
    const url = `https://${NETSUITE_ACCOUNT.toLowerCase()}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=${RESTLET_SCRIPT_ID}&deploy=${RESTLET_DEPLOY_ID}&compid=${NETSUITE_ACCOUNT}`;
    console.log("🌐 NetSuite RESTlet URL:", url);

    const oauth_timestamp = Math.floor(Date.now() / 1000).toString();
    const oauth_nonce = crypto.randomBytes(16).toString('hex');

    console.log("🔑 Auth Values:");
    console.log("  - Account:", NETSUITE_ACCOUNT);
    console.log("  - Consumer Key:", CONSUMER_KEY);
    console.log("  - Token ID:", TOKEN_ID);
    console.log("🕒 Timestamp Debug:");
    console.log("  - oauth_timestamp:", oauth_timestamp);
    console.log("  - Local Time:", new Date(Number(oauth_timestamp) * 1000).toLocaleString());
    console.log("  - UTC Time:", new Date(Number(oauth_timestamp) * 1000).toUTCString());
    console.log("🌀 Using oauth_nonce:", oauth_nonce);

    const request_data = {
      url,
      method: 'POST',
    };

    const token = { key: TOKEN_ID, secret: TOKEN_SECRET };
    const oauthData = oauth.authorize(request_data, token);

    let authHeader = oauth.toHeader(oauthData);
    authHeader.Authorization = `OAuth realm="${NETSUITE_ACCOUNT}", ` + authHeader.Authorization.slice(6);

    const headers = {
      ...authHeader,
      'Content-Type': 'application/json',
    };

    console.log("📤 OAuth headers:", headers);

    console.log("🚀 Sending request to NetSuite...");
    const nsResponse = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    });

    console.log("📥 Received response from NetSuite");

    const text = await nsResponse.text();

    if (!nsResponse.ok) {
      console.error("❌ NetSuite responded with status", nsResponse.status);
      console.error("🧾 Response body:", text);
      throw new Error(`NetSuite error: ${nsResponse.status} - ${text}`);
    }

    const json = JSON.parse(text);
    console.log("✅ NetSuite response:", JSON.stringify(json, null, 2));
    res.status(200).json(json);

  } catch (error) {
    console.error("💥 Error proxying request:", error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
