const toText = (value) => (typeof value === "string" ? value.trim() : "");
const toNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? Math.round(value) : "";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, message: "POST only" });
    return;
  }

  let data;

  try {
    data = parseBody(req);
  } catch {
    sendJson(res, 400, {
      ok: false,
      message: "送信内容を読み取れませんでした。",
    });
    return;
  }

  const name = toText(data.name);
  const phone = toText(data.phone);

  if (!name || !phone) {
    sendJson(res, 400, {
      ok: false,
      message: "氏名と電話番号を入力してください。",
    });
    return;
  }

  const webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL;

  if (!webhookUrl) {
    sendJson(res, 500, {
      ok: false,
      message: "Google Sheets webhook URL is not configured.",
    });
    return;
  }

  const body = {
    submittedAt: new Date().toISOString(),
    name,
    phone,
    address: toText(data.address),
    age: toText(data.age),
    vehicle: toText(data.vehicle),
    area: toText(data.area),
    income: toText(data.income),
    start: toText(data.start),
    days: toText(data.days),
    confirmed: Boolean(data.confirmed),
    jobBasis: toText(data.jobBasis),
    weeklyAdvance: toNumber(data.weeklyAdvance),
    weeklyAdvanceNet: toNumber(data.weeklyAdvanceNet),
    pageUrl: toText(data.pageUrl),
    source: "POMS Driver Portal",
    userAgent: req.headers["user-agent"] || "",
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error("Google Sheets webhook failed", response.status, responseText);
      sendJson(res, 502, {
        ok: false,
        message: "スプレッドシートへの保存に失敗しました。",
      });
      return;
    }

    if (responseText) {
      try {
        const result = JSON.parse(responseText);
        if (result.ok === false) {
          console.error("Google Sheets webhook returned an error", result.error);
          sendJson(res, 502, {
            ok: false,
            message: "スプレッドシートへの保存に失敗しました。",
          });
          return;
        }
      } catch {
        // Apps Script may return non-JSON text depending on deployment settings.
      }
    }

    sendJson(res, 200, { ok: true });
  } catch (error) {
    console.error("Registration submit failed", error);
    sendJson(res, 500, {
      ok: false,
      message: "送信中にエラーが発生しました。",
    });
  }
};
