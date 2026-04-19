const GAS_URL = "https://script.google.com/macros/s/AKfycbz0c1HDLpVuXmlb_9Qnh3wA3mVBeZgqloLb-j30nxCyWJzhv2kTru122-C4v1pLvupO/exec";

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

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});

  if (isLineVerifyPayload(body)) {
    res.status(200).json({ ok: true, verified: true });
    return;
  }

  try {
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
