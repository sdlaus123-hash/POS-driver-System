const crypto = require("crypto");
const GAS_URL = process.env.POMS_GAS_URL || "";

module.exports.config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function hasValidLineSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const actualBuffer = Buffer.from(String(signature));
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function isLineVerifyPayload(body) {
  const events = Array.isArray(body && body.events) ? body.events : [];
  if (!events.length) return true;
  return events.every((event) => /^0+$/.test(String(event.replyToken || "")));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(200).json({ ok: true, message: "POMS LINE webhook relay is running" });
    return;
  }

  const rawBody = await readRawBody(req);
  if (!hasValidLineSignature(rawBody, req.headers["x-line-signature"], process.env.LINE_CHANNEL_SECRET)) {
    res.status(401).json({ ok: false, message: "Invalid LINE signature" });
    return;
  }
  let body;
  try {
    body = JSON.parse(rawBody.toString("utf8") || "{}");
  } catch {
    res.status(400).json({ ok: false, message: "Invalid JSON" });
    return;
  }

  if (isLineVerifyPayload(body)) {
    res.status(200).json({ ok: true, verified: true });
    return;
  }

  try {
    if (!GAS_URL) throw new Error("POMS_GAS_URL is not configured");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const response = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      redirect: "follow",
      signal: controller.signal
    });
    clearTimeout(timeout);

    res.status(200).json({
      ok: true,
      forwarded: response.ok,
      status: response.status
    });
  } catch (error) {
    // LINE only needs a 200 response. Keep the webhook alive even if GAS is slow.
    res.status(200).json({
      ok: true,
      forwarded: false,
      warning: String(error && error.message ? error.message : error)
    });
  }
};
