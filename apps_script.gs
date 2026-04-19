const SPREADSHEET_ID = "1a_S-_3TxbR7zx0gGWyYE36QSY0_jzIY17Ga_CJl7x2k";
const LINE_CHANNEL_ACCESS_TOKEN = "T9Epjp1uiWQgXJEdXjgdGlbLemM+QhBNG7iypsFmnvt+MCJUC1/LQy8JP59iNcrOzIUvIfF10tBEr1TKdiWq6kXjUt9Re4azA7+h9p0E0tirFHxO9w7kI/uu1KTWknF6endxHNrcPHrGoH2sSDCjeQdB04t89/1O/w1cDnyilFU=";
const LINE_ADMIN_TO = "Cdd25f5f6b6f42bb676ee3a78e5170dfb";
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "CHANGE_THIS_ADMIN_PASSWORD";
const ADMIN_SESSION_TTL_SECONDS = 21600;
const DRIVER_SESSION_DAYS = 180;
const DRIVER_ATTENDANCE_URL = "https://pos-driver-system.vercel.app/attendance.html";
const DRIVER_ADVANCE_URL = "https://pos-driver-system.vercel.app/advance.html";

function setupPomsBaseSheets() {
  setupBaseSheets_();
  setupReadableSpreadsheet_();
  return { ok: true, message: "POMS base sheets are ready" };
}

function testPomsAdminLine() {
  return pushLineText_("【POMS テスト通知】\n管理者LINE通知の接続に成功しました。");
}

function testPomsAllClockedOutSummary() {
  const date = getBusinessDate_();
  cleanupDuplicateAttendanceRowsForDate_(date);
  return notifyAdminAllClockedOutSummary_(date);
}

function cleanupPomsBlankRows() {
  const ss = getSpreadsheet_();
  let deleted = 0;
  let sorted = 0;
  ss.getSheets().forEach(function(sheet) {
    if (getSheetKind_(sheet.getName())) {
      repairVisibleRows_(sheet);
      deleted += cleanupEmptyAndBrokenRows_(sheet).deleted;
      if (sortDataRowsNewestFirst_(sheet).sorted) sorted += 1;
    }
  });
  return { ok: true, deleted: deleted, sortedSheets: sorted };
}

function sortPomsSheetsNewestFirst() {
  const ss = getSpreadsheet_();
  let sorted = 0;
  ss.getSheets().forEach(function(sheet) {
    if (getSheetKind_(sheet.getName())) {
      repairVisibleRows_(sheet);
      cleanupEmptyAndBrokenRows_(sheet);
      if (sortDataRowsNewestFirst_(sheet).sorted) sorted += 1;
    }
  });
  return { ok: true, sortedSheets: sorted };
}

function onEdit(e) {
  try {
    const sheet = e && e.range ? e.range.getSheet() : null;
    if (!sheet) return;
    const kind = getSheetKind_(sheet.getName());
    if (!kind) return;
    repairVisibleRows_(sheet);
    cleanupEmptyAndBrokenRows_(sheet);
    if (kind === "Attendance" || kind === "Advance") {
      sortDataRowsNewestFirst_(sheet);
    }
  } catch (error) {
    // Editing should never be blocked by cleanup.
  }
}

const SHEETS = {
  drivers: "ドライバー管理",
  sites: "現場管理",
  adminLogins: "管理者ログイン履歴",
  adminUsers: "管理者管理",
  driverSessions: "システム_ログイン保持",
  lineSources: "LINE取得履歴"
};

const SHEET_ALIASES = {
  "ドライバー管理": ["Drivers"],
  "現場管理": ["Sites"],
  "管理者ログイン履歴": ["AdminLogins"],
  "管理者管理": ["AdminUsers"],
  "システム_ログイン保持": ["DriverSessions"],
  "LINE取得履歴": ["LineSources"]
};

const BASE_SHEET_KINDS = {
  "ドライバー管理": "Drivers",
  "現場管理": "Sites",
  "管理者ログイン履歴": "AdminLogins",
  "管理者管理": "AdminUsers",
  "システム_ログイン保持": "DriverSessions",
  "LINE取得履歴": "LineSources"
};

const MONTH_PREFIX_LABELS = {
  Attendance: "出勤",
  Advance: "前払い",
  Holiday: "休み希望",
  FixedShift: "確定シフト"
};

const MONTH_LABEL_KINDS = {
  "出勤": "Attendance",
  "前払い": "Advance",
  "休み希望": "Holiday",
  "確定シフト": "FixedShift"
};

const HIDDEN_SHEETS = ["システム_ログイン保持", "LINE取得履歴"];

const HEADERS = {
  Drivers: ["id", "name", "siteId", "siteName", "contractType", "lifecycle", "unitPrice", "advanceFee", "bankName", "branchName", "accountNumber", "accountHolder", "lineUserId", "displayName", "note", "createdAt", "updatedAt", "pin"],
  Sites: ["id", "name", "sort", "active", "updatedAt"],
  Attendance: ["id", "date", "driverId", "driverName", "siteId", "siteName", "status", "startTime", "endTime", "note", "createdAt", "updatedAt", "workType"],
  Advance: ["id", "date", "dateFrom", "dateTo", "driverId", "driverName", "siteId", "siteName", "count", "workedDays", "unitPrice", "salesAmount", "requestedAmount", "fee", "transferAmount", "amount", "tag", "note", "bankName", "branchName", "accountNumber", "accountHolder", "createdAt", "updatedAt"],
  Holiday: ["id", "driverId", "driverName", "siteId", "siteName", "days", "note", "updatedAt", "targetYearMonth"],
  FixedShift: ["id", "driverId", "driverName", "siteId", "siteName", "days", "updatedAt", "targetYearMonth"],
  AdminLogins: ["id", "username", "success", "loggedAt", "userAgent", "language", "screen", "timeZone", "path"],
  AdminUsers: ["id", "username", "pin", "displayName", "role", "active", "createdAt", "updatedAt"],
  DriverSessions: ["token", "driverId", "driverName", "createdAt", "expiresAt", "lastUsedAt", "active"],
  LineSources: ["id", "sourceType", "sourceId", "userId", "groupId", "roomId", "replyToken", "messageText", "timestamp", "createdAt"]
};

const HEADER_LABELS = {
  Drivers: {
    id: "内部ID",
    name: "ドライバー名",
    siteId: "現場ID",
    siteName: "所属現場",
    contractType: "契約区分",
    lifecycle: "状態",
    unitPrice: "日当単価",
    advanceFee: "前払い手数料設定",
    bankName: "銀行名",
    branchName: "支店名",
    accountNumber: "口座番号",
    accountHolder: "口座名義",
    lineUserId: "LINEユーザーID",
    displayName: "表示名",
    note: "メモ",
    createdAt: "作成日時",
    updatedAt: "更新日時",
    pin: "4桁PIN"
  },
  Sites: {
    id: "現場ID",
    name: "現場名",
    sort: "並び順",
    active: "使用中",
    updatedAt: "更新日時"
  },
  Attendance: {
    id: "内部ID",
    date: "勤務日",
    driverId: "ドライバーID",
    driverName: "ドライバー名",
    siteId: "現場ID",
    siteName: "現場名",
    status: "状態",
    startTime: "出勤時刻",
    endTime: "退勤時刻",
    note: "メモ",
    createdAt: "作成日時",
    updatedAt: "更新日時",
    workType: "勤務区分"
  },
  Advance: {
    id: "内部ID",
    date: "申請日",
    dateFrom: "対象開始日",
    dateTo: "対象終了日",
    driverId: "ドライバーID",
    driverName: "ドライバー名",
    siteId: "現場ID",
    siteName: "現場名",
    count: "申請回数",
    workedDays: "実働日数",
    unitPrice: "日当単価",
    salesAmount: "売上金額",
    requestedAmount: "前払い希望額",
    fee: "前払い手数料",
    transferAmount: "振込予定額",
    amount: "申請額",
    tag: "タグ",
    note: "メモ",
    bankName: "銀行名",
    branchName: "支店名",
    accountNumber: "口座番号",
    accountHolder: "口座名義",
    createdAt: "作成日時",
    updatedAt: "更新日時"
  },
  Holiday: {
    id: "内部ID",
    driverId: "ドライバーID",
    driverName: "ドライバー名",
    siteId: "現場ID",
    siteName: "現場名",
    days: "休み希望日",
    note: "メモ",
    updatedAt: "更新日時",
    targetYearMonth: "対象月"
  },
  FixedShift: {
    id: "内部ID",
    driverId: "ドライバーID",
    driverName: "ドライバー名",
    siteId: "現場ID",
    siteName: "現場名",
    days: "確定出勤日",
    updatedAt: "更新日時",
    targetYearMonth: "対象月"
  },
  AdminLogins: {
    id: "内部ID",
    username: "管理者名",
    success: "ログイン成功",
    loggedAt: "ログイン日時",
    userAgent: "端末情報",
    language: "言語",
    screen: "画面サイズ",
    timeZone: "タイムゾーン",
    path: "アクセス画面"
  },
  AdminUsers: {
    id: "内部ID",
    username: "管理者名",
    pin: "4桁PIN",
    displayName: "表示名",
    role: "権限",
    active: "使用中",
    createdAt: "作成日時",
    updatedAt: "更新日時"
  },
  DriverSessions: {
    token: "ログイントークン",
    driverId: "ドライバーID",
    driverName: "ドライバー名",
    createdAt: "作成日時",
    expiresAt: "有効期限",
    lastUsedAt: "最終利用日時",
    active: "使用中"
  },
  LineSources: {
    id: "内部ID",
    sourceType: "LINE種別",
    sourceId: "通知先ID",
    userId: "ユーザーID",
    groupId: "グループID",
    roomId: "ルームID",
    replyToken: "返信トークン",
    messageText: "受信メッセージ",
    timestamp: "LINE時刻",
    createdAt: "取得日時"
  }
};

const HIDDEN_COLUMNS = {
  Drivers: ["id", "siteId", "contractType", "advanceFee", "displayName", "note", "createdAt", "updatedAt"],
  Sites: ["id", "sort", "updatedAt"],
  Attendance: ["id", "driverId", "siteId", "createdAt", "updatedAt"],
  Advance: ["id", "date", "driverId", "siteId", "count", "amount", "tag", "note", "createdAt", "updatedAt"],
  Holiday: ["id", "driverId", "siteId", "updatedAt"],
  FixedShift: ["id", "driverId", "siteId", "updatedAt"],
  AdminLogins: ["id", "userAgent", "language", "screen", "timeZone", "path"],
  AdminUsers: ["id", "role", "createdAt", "updatedAt"],
  DriverSessions: ["token", "driverId", "createdAt", "expiresAt", "lastUsedAt", "active"],
  LineSources: ["id", "userId", "groupId", "roomId", "replyToken", "timestamp"]
};

function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    setupBaseSheets_();

    if (params.type === "dashboard") {
      requireAdmin_(params.adminToken);
      return json_({
        ok: true,
        month: params.month || getMonthKey_(new Date()),
        data: getDashboard_(params.month || getMonthKey_(new Date()))
      });
    }

    if (params.type === "advance_calc") {
      requireDriver_(params.driverToken, params.driverId);
      return json_(calculateAdvance_(params));
    }

    if (params.type === "advance_calendar") {
      requireDriver_(params.driverToken, params.driverId);
      return json_(getAdvanceCalendar_(params));
    }

    if (params.type === "holiday_load") {
      return json_(loadHoliday_(params));
    }

    if (params.type === "driver_by_line") {
      return json_(getDriverByLine_(params.lineUserId));
    }

    if (params.type === "driver_by_id") {
      return json_(getDriverByIdPublic_(params.driverId));
    }

    if (params.type === "driver_attendance") {
      requireDriver_(params.driverToken, params.driverId);
      return json_(getDriverAttendance_(params.driverId, params.date || getBusinessDate_()));
    }

    return json_({ ok: true, message: "POMS GAS API is running" });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData && e.postData.contents ? e.postData.contents : "{}");
    if (Array.isArray(body.events)) {
      if (isLineWebhookVerify_(body)) return json_({ ok: true, verified: true });
      return json_(handleLineWebhook_(body));
    }
    setupBaseSheets_();
    const type = body.type;

    if (type === "admin_auth") return json_(authenticateAdmin_(body));
    if (type === "driver_auth") return json_(authenticateDriver_(body));
    if (type === "driver_session_check") requireDriver_(body.driverToken, body.driverId);
    if (type === "driver_line_link") requireDriver_(body.driverToken, body.driverId);
    if (type === "attendance" && body.action === "admin_fix") requireAdmin_(body.adminToken);
    if (type === "attendance" && body.action !== "admin_fix") requireDriver_(body.driverToken, body.driverId);
    if (type === "advance") requireDriver_(body.driverToken, body.driverId);
    if (type === "holiday_save" && body.driverToken) requireDriver_(body.driverToken, body.driverId);
    if (type === "holiday_save" && !body.driverToken) requireAdmin_(body.adminToken);
    if (type === "fixed_shift_save") requireAdmin_(body.adminToken);
    if (type === "driver_upsert") requireAdmin_(body.adminToken);
    if (type === "driver_lifecycle") requireAdmin_(body.adminToken);
    if (type === "driver_line_reset") requireAdmin_(body.adminToken);
    if (type === "attendance_clear") requireAdmin_(body.adminToken);
    if (type === "site_upsert") requireAdmin_(body.adminToken);

    if (type === "attendance") return json_(saveAttendance_(body));
    if (type === "driver_session_check") return json_(checkDriverSession_(body));
    if (type === "driver_line_link") return json_(linkDriverLine_(body));
    if (type === "advance") return json_(saveAdvance_(body));
    if (type === "holiday_save") return json_(saveHoliday_(body));
    if (type === "fixed_shift_save") return json_(saveFixedShift_(body));
    if (type === "driver_upsert") return json_(upsertDriver_(body));
    if (type === "driver_lifecycle") return json_(switchDriverLifecycle_(body));
    if (type === "driver_line_reset") return json_(resetDriverLine_(body));
    if (type === "attendance_clear") return json_(clearAttendance_(body));
    if (type === "site_upsert") return json_(upsertSite_(body));
    if (type === "admin_login") return json_(saveAdminLogin_(body));

    return json_({ ok: false, error: "Unknown type: " + type });
  } catch (error) {
    return json_({ ok: false, error: String(error && error.message ? error.message : error) });
  }
}

function saveAdminLogin_(body) {
  const sheet = getOrCreateSheet_(SHEETS.adminLogins, HEADERS.AdminLogins);
  const client = body.client || {};
  const row = normalizeRow_(HEADERS.AdminLogins, {
    id: body.id || makeId_("login"),
    username: body.username || "",
    success: body.success === true,
    loggedAt: body.loggedAt || new Date().toISOString(),
    userAgent: client.userAgent || "",
    language: client.language || "",
    screen: client.screen || "",
    timeZone: client.timeZone || "",
    path: client.path || ""
  });
  appendRow_(sheet, row);
  return { ok: true, saved: "admin_login", loggedAt: row.loggedAt };
}

function authenticateAdmin_(body) {
  const username = String(body.username || "").trim();
  const pin = normalizePin_(body.password || body.pin);
  const adminSheet = getOrCreateSheet_(SHEETS.adminUsers, HEADERS.AdminUsers);
  const adminRows = readObjects_(adminSheet).filter(function(row) {
    return row.username && String(row.active) !== "false";
  });
  let success = false;
  if (adminRows.length) {
    success = adminRows.some(function(row) {
      return String(row.username || "").trim() === username && normalizePin_(row.pin) === pin;
    });
  } else {
    if (!ADMIN_PASSWORD || ADMIN_PASSWORD === "CHANGE_THIS_ADMIN_PASSWORD") {
      throw new Error("AdminUsersシートに管理者を登録してください");
    }
    success = username === ADMIN_USERNAME && normalizePin_(ADMIN_PASSWORD) === pin;
  }
  saveAdminLogin_({
    id: body.id || makeId_("login"),
    username: username || "未入力",
    success: success,
    loggedAt: new Date().toISOString(),
    client: body.client || {}
  });
  if (!success) {
    return { ok: false, error: "名前またはパスワードが違います" };
  }
  const token = Utilities.getUuid() + "." + Utilities.getUuid();
  CacheService.getScriptCache().put("admin:" + token, username, ADMIN_SESSION_TTL_SECONDS);
  return {
    ok: true,
    token: token,
    username: username,
    expiresIn: ADMIN_SESSION_TTL_SECONDS
  };
}

function authenticateDriver_(body) {
  const name = String(body.name || body.driverName || "").trim();
  const driverId = String(body.driverId || "").trim();
  const pin = normalizePin_(body.password || body.pin);
  const sheet = getOrCreateSheet_(SHEETS.drivers, HEADERS.Drivers);
  const rows = readObjects_(sheet);
  let driver = rows.find(function(row) {
    const active = String(row.lifecycle || "active") !== "inactive";
    const idMatch = driverId ? String(row.id || "") === driverId : true;
    const nameMatch = name ? String(row.name || "").trim() === name || String(row.displayName || "").trim() === name : true;
    return active && idMatch && nameMatch && normalizePin_(row.pin) === pin;
  });
  if (!driver && driverId) {
    driver = rows.find(function(row) {
      const active = String(row.lifecycle || "active") !== "inactive";
      const nameMatch = name ? String(row.name || "").trim() === name || String(row.displayName || "").trim() === name : true;
      return active && nameMatch && normalizePin_(row.pin) === pin;
    });
  }
  if (!driver) {
    return { ok: false, error: "名前または4桁PINが違います" };
  }
  const lineUserId = String(body.lineUserId || "").trim();
  const lineDisplayName = String(body.lineDisplayName || "").trim();
  const linkedDriver = lineUserId ? updateDriverLine_(driver.id, lineUserId, lineDisplayName) : driver;
  const token = Utilities.getUuid() + "." + Utilities.getUuid();
  saveDriverSession_(linkedDriver, token);
  CacheService.getScriptCache().put("driver:" + token, linkedDriver.id, ADMIN_SESSION_TTL_SECONDS);
  return {
    ok: true,
    token: token,
    driver: sanitizeDriver_(linkedDriver),
    expiresIn: ADMIN_SESSION_TTL_SECONDS
  };
}

function linkDriverLine_(body) {
  const driver = updateDriverLine_(body.driverId, body.lineUserId, body.lineDisplayName || "");
  return { ok: true, driver: sanitizeDriver_(driver) };
}

function checkDriverSession_(body) {
  const driver = getDriverById_(body.driverId);
  if (!driver) throw new Error("ドライバーが見つかりません");
  const lineUserId = String(body.lineUserId || "").trim();
  const lineDisplayName = String(body.lineDisplayName || "").trim();
  const storedLineId = String(driver.lineUserId || "").trim();
  if (!storedLineId) {
    throw new Error("LINE連携が解除されています。名前と4桁PINで再ログインしてください。");
  }
  if (lineUserId) {
    if (storedLineId !== lineUserId) {
      throw new Error("このLINEは別のドライバーとして登録されています。管理者に確認してください。");
    }
  }
  return { ok: true, driver: sanitizeDriver_(driver) };
}

function updateDriverLine_(driverId, lineUserId, lineDisplayName) {
  const lineId = String(lineUserId || "").trim();
  if (!driverId || !lineId) throw new Error("LINE連携情報が不足しています");
  const sheet = getOrCreateSheet_(SHEETS.drivers, HEADERS.Drivers);
  const rows = readObjects_(sheet);
  const driverIndex = rows.findIndex(function(row) {
    return String(row.id || "") === String(driverId || "");
  });
  if (driverIndex < 0) throw new Error("ドライバーが見つかりません");
  const conflict = rows.find(function(row) {
    return String(row.id || "") !== String(driverId || "") && String(row.lineUserId || "") === lineId;
  });
  if (conflict) {
    throw new Error("このLINEは別のドライバーに連携済みです。管理者に確認してください。");
  }
  const driver = rows[driverIndex];
  if (driver.lineUserId && String(driver.lineUserId) !== lineId) {
    throw new Error("このドライバーは別のLINEと連携済みです。管理者に確認してください。");
  }
  const lineColumn = HEADERS.Drivers.indexOf("lineUserId") + 1;
  const updatedColumn = HEADERS.Drivers.indexOf("updatedAt") + 1;
  sheet.getRange(driverIndex + 2, lineColumn).setValue(lineId);
  sheet.getRange(driverIndex + 2, updatedColumn).setValue(new Date().toISOString());
  driver.lineUserId = lineId;
  driver.updatedAt = new Date().toISOString();
  return driver;
}

function resetDriverLine_(body) {
  const driverId = String(body.driverId || "").trim();
  if (!driverId) throw new Error("ドライバーIDがありません");
  const driver = clearDriverLine_(driverId);
  clearDriverSessions_(driverId);
  return { ok: true, cleared: "line", driver: sanitizeDriver_(driver) };
}

function clearDriverLine_(driverId) {
  const sheet = getOrCreateSheet_(SHEETS.drivers, HEADERS.Drivers);
  const rows = readObjects_(sheet);
  const driverIndex = rows.findIndex(function(row) {
    return String(row.id || "") === String(driverId || "");
  });
  if (driverIndex < 0) throw new Error("ドライバーが見つかりません");
  const lineColumn = HEADERS.Drivers.indexOf("lineUserId") + 1;
  const updatedColumn = HEADERS.Drivers.indexOf("updatedAt") + 1;
  sheet.getRange(driverIndex + 2, lineColumn).setValue("");
  sheet.getRange(driverIndex + 2, updatedColumn).setValue(new Date().toISOString());
  const driver = rows[driverIndex];
  driver.lineUserId = "";
  driver.updatedAt = new Date().toISOString();
  return driver;
}

function clearDriverSessions_(driverId) {
  const sheet = getOrCreateSheet_(SHEETS.driverSessions, HEADERS.DriverSessions);
  const rows = readObjects_(sheet);
  const activeColumn = HEADERS.DriverSessions.indexOf("active") + 1;
  rows.forEach(function(row, index) {
    if (String(row.driverId || "") === String(driverId || "")) {
      sheet.getRange(index + 2, activeColumn).setValue(false);
    }
  });
}

function requireAdmin_(token) {
  const value = token ? CacheService.getScriptCache().get("admin:" + token) : "";
  if (!value) {
    throw new Error("管理者ログインが必要です。再ログインしてください。");
  }
  return value;
}

function requireDriver_(token, driverId) {
  const value = token ? CacheService.getScriptCache().get("driver:" + token) : "";
  if (value && String(value) === String(driverId || "")) {
    touchDriverSession_(token);
    return value;
  }
  const sessionDriverId = getDriverSessionDriverId_(token);
  if (!sessionDriverId || String(sessionDriverId) !== String(driverId || "")) {
    throw new Error("ドライバーログインが必要です。再ログインしてください。");
  }
  CacheService.getScriptCache().put("driver:" + token, sessionDriverId, ADMIN_SESSION_TTL_SECONDS);
  return sessionDriverId;
}

function saveDriverSession_(driver, token) {
  const sheet = getOrCreateSheet_(SHEETS.driverSessions, HEADERS.DriverSessions);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DRIVER_SESSION_DAYS * 24 * 60 * 60 * 1000);
  const row = normalizeRow_(HEADERS.DriverSessions, {
    token: token,
    driverId: driver.id,
    driverName: driver.name || "",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastUsedAt: now.toISOString(),
    active: true
  });
  upsertByKeys_(sheet, HEADERS.DriverSessions, row, ["token"]);
  return row;
}

function getDriverSessionDriverId_(token) {
  if (!token) return "";
  const sheet = getOrCreateSheet_(SHEETS.driverSessions, HEADERS.DriverSessions);
  const rows = readObjects_(sheet);
  const now = new Date().toISOString();
  const row = rows.find(function(item) {
    return item.token === token && String(item.active) !== "false" && String(item.expiresAt || "") > now;
  });
  return row ? row.driverId : "";
}

function touchDriverSession_(token) {
  if (!token) return;
  const sheet = getOrCreateSheet_(SHEETS.driverSessions, HEADERS.DriverSessions);
  const rows = readObjects_(sheet);
  const index = rows.findIndex(function(row) { return row.token === token; });
  if (index >= 0) {
    const column = HEADERS.DriverSessions.indexOf("lastUsedAt") + 1;
    sheet.getRange(index + 2, column).setValue(new Date().toISOString());
  }
}

function saveAttendance_(body) {
  const date = normalizeDateKey_(body.date || getBusinessDate_());
  const sheet = getMonthSheet_("Attendance", date);
  const now = new Date().toISOString();
  const row = normalizeRow_(HEADERS.Attendance, {
    id: body.id || makeId_("att"),
    date: date,
    driverId: body.driverId,
    driverName: body.driverName,
    siteId: body.siteId,
    siteName: body.siteName,
    status: normalizeStatus_(body.status || (body.action === "end" ? "finished" : "working")),
    startTime: body.startTime || "",
    endTime: body.endTime || "",
    note: body.note || "",
    createdAt: body.createdAt || now,
    updatedAt: now,
    workType: body.workType || "normal"
  });
  deleteAttendanceRowsForDriverDate_(sheet, row.date, row.driverId);
  appendRow_(sheet, row);
  notifyAdminLine_("attendance", row);
  if (isFinishedStatus_(row.status)) notifyAdminAllClockedOutSummary_(row.date);
  return { ok: true, saved: "attendance", sheet: sheet.getName(), updatedAt: now };
}

function saveAdvance_(body) {
  const date = normalizeDateKey_(body.date || body.dateFrom || getBusinessDate_());
  const sheet = getMonthSheet_("Advance", date);
  const now = new Date().toISOString();
  const driver = getDriverById_(body.driverId) || {};
  const dateFrom = normalizeDateKey_(body.dateFrom || date);
  const dateTo = normalizeDateKey_(body.dateTo || date);
  const overlap = findOverlappingAdvance_(body.driverId, dateFrom, dateTo);
  if (overlap) {
    return {
      ok: false,
      error: "申請済み期間と重複しています",
      overlap: overlap
    };
  }
  const countedDays = countWorkedDays_(body.driverId, dateFrom, dateTo);
  const workedDays = countedDays || Number(body.workedDays || body.count || 0);
  const unitPrice = Number(body.unitPrice || driver.unitPrice || 0);
  const salesAmount = Number(body.salesAmount || (unitPrice * workedDays));
  const requestedAmount = Number(body.requestedAmount || body.amount || Math.round(salesAmount * 0.5));
  const fee = calculateAdvanceFee_(requestedAmount);
  const transferAmount = Number(body.transferAmount || Math.max(requestedAmount - fee, 0));
  const row = normalizeRow_(HEADERS.Advance, {
    id: body.id || makeId_("adv"),
    date: date,
    dateFrom: dateFrom,
    dateTo: dateTo,
    driverId: body.driverId,
    driverName: body.driverName || driver.name || "",
    siteId: body.siteId || driver.siteId || "",
    siteName: body.siteName || driver.siteName || "",
    count: Number(body.count || 1),
    workedDays: workedDays,
    unitPrice: unitPrice,
    salesAmount: salesAmount,
    requestedAmount: requestedAmount,
    fee: fee,
    transferAmount: transferAmount,
    amount: requestedAmount,
    tag: body.tag || "",
    note: body.note || "",
    bankName: body.bankName || driver.bankName || "",
    branchName: body.branchName || driver.branchName || "",
    accountNumber: body.accountNumber || driver.accountNumber || "",
    accountHolder: body.accountHolder || driver.accountHolder || "",
    createdAt: body.createdAt || now,
    updatedAt: now
  });
  appendRow_(sheet, row);
  notifyAdminLine_("advance", row);
  notifyDriverLine_("advance_submitted", row);
  return { ok: true, saved: "advance", sheet: sheet.getName(), updatedAt: now };
}

function clearAttendance_(body) {
  const date = normalizeDateKey_(body.date || getBusinessDate_());
  const driverId = String(body.driverId || "").trim();
  if (!driverId) throw new Error("ドライバーIDがありません");
  const sheet = getMonthSheet_("Attendance", date);
  deleteAttendanceRowsForDriverDate_(sheet, date, driverId);
  return { ok: true, cleared: "attendance", driverId: driverId, date: date };
}

function notifyAdminLine_(kind, row) {
  if (!isLineReady_()) return { ok: false, skipped: true, reason: "LINE settings are empty" };

  let text = "";
  if (kind === "attendance") {
    const actionText = isFinishedStatus_(row.status) ? "退勤" : isWorkingStatus_(row.status) ? "出勤" : "勤務報告";
    const timeText = isFinishedStatus_(row.status) ? row.endTime : row.startTime;
    const workTypeText = row.workType === "substitute" ? "代走" : "通常";
    text = [
      "【POMS 勤怠通知】",
      (row.driverName || "-") + "さんが" + actionText + "しました",
      "ドライバー: " + (row.driverName || "-"),
      "現場: " + (row.siteName || "-"),
      "勤務日: " + (row.date || "-"),
      "区分: " + workTypeText,
      "時刻: " + (timeText || "-"),
      row.note ? "メモ: " + row.note : ""
    ].filter(Boolean).join("\n");
  }

  if (kind === "advance") {
    text = buildAdvanceTransferMessage_(row);
  }

  if (!text) return { ok: false, skipped: true, reason: "message is empty" };
  return pushLineText_(text);
}

function notifyDriverLine_(kind, row) {
  if (!isLineTokenReady_()) return { ok: false, skipped: true, reason: "LINE settings are empty" };
  const driver = getDriverById_(row.driverId) || {};
  if (!driver.lineUserId) return { ok: false, skipped: true, reason: "driver lineUserId is empty" };
  let text = "";
  if (kind === "advance_submitted") {
    text = [
      "【POMS 前払い申請】",
      "前払い申請が提出されました。",
      "ドライバー: " + (row.driverName || "-"),
      "対象期間: " + formatSlashDate_(row.dateFrom || row.date) + "〜" + formatSlashDate_(row.dateTo || row.date),
      "実働日数: " + (row.workedDays || 0) + "日",
      "振込予定: ¥" + formatYen_(row.transferAmount),
      "",
      "管理者確認後に処理されます。"
    ].join("\n");
  }
  if (!text) return { ok: false, skipped: true, reason: "message is empty" };
  return pushLineTextTo_(driver.lineUserId, text);
}

function notifyAdminAllClockedOutSummary_(dateValue) {
  if (!isLineReady_()) return { ok: false, skipped: true };
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  const sheet = getMonthSheet_("Attendance", date);
  const rows = readObjects_(sheet).filter(function(row) {
    return normalizeDateKey_(row.date) === date && !isOffStatus_(row.status);
  });
  if (!rows.length) return { ok: false, skipped: true, reason: "no attendance" };
  const working = rows.filter(function(row) { return isWorkingStatus_(row.status); });
  if (working.length) return { ok: false, skipped: true, reason: "still working" };
  const unique = {};
  rows.forEach(function(row) { unique[row.driverId || row.driverName] = row; });
  const members = Object.keys(unique).map(function(key) { return unique[key]; });
  const grouped = {};
  members.forEach(function(row) {
    const site = row.siteName || "現場未設定";
    if (!grouped[site]) grouped[site] = [];
    grouped[site].push(row.driverName || "未設定");
  });
  const lines = [
    "【POMS 本日全員退勤】",
    "出勤中の全員が退勤しました。",
    "勤務日: " + date,
    "出勤人数: " + members.length + "名",
    "",
    "現場ごとの出勤メンバー"
  ];
  Object.keys(grouped).sort().forEach(function(site) {
    lines.push("");
    lines.push("【" + site + "】" + grouped[site].length + "名");
    grouped[site].sort().forEach(function(name) {
      lines.push("・" + name);
    });
  });
  return pushLineText_(lines.join("\n"));
}

function deleteAttendanceRowsForDriverDate_(sheet, dateValue, driverId) {
  const date = normalizeDateKey_(dateValue);
  if (!date || !driverId) return;
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return;
  const headers = values[0].map(function(header) {
    return getCanonicalHeader_(sheet.getName(), header);
  });
  const dateIndex = headers.indexOf("date");
  const driverIndex = headers.indexOf("driverId");
  if (dateIndex < 0 || driverIndex < 0) return;
  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    const row = values[rowIndex];
    if (normalizeDateKey_(row[dateIndex]) === date && String(row[driverIndex] || "") === String(driverId || "")) {
      sheet.deleteRow(rowIndex + 1);
    }
  }
}

function cleanupDuplicateAttendanceRowsForDate_(dateValue) {
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  const sheet = getMonthSheet_("Attendance", date);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 2) return { ok: true, deleted: 0 };
  const headers = values[0].map(function(header) {
    return getCanonicalHeader_(sheet.getName(), header);
  });
  const dateIndex = headers.indexOf("date");
  const driverIndex = headers.indexOf("driverId");
  if (dateIndex < 0 || driverIndex < 0) return { ok: true, deleted: 0 };
  const latestByDriver = {};
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    if (normalizeDateKey_(row[dateIndex]) === date && row[driverIndex]) {
      latestByDriver[String(row[driverIndex])] = rowIndex;
    }
  }
  let deleted = 0;
  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    const row = values[rowIndex];
    const driverId = String(row[driverIndex] || "");
    if (normalizeDateKey_(row[dateIndex]) === date && driverId && latestByDriver[driverId] !== rowIndex) {
      sheet.deleteRow(rowIndex + 1);
      deleted += 1;
    }
  }
  return { ok: true, deleted: deleted };
}

function handleLineWebhook_(body) {
  const sheet = getOrCreateSheet_(SHEETS.lineSources, HEADERS.LineSources);
  const saved = [];
  (body.events || []).forEach(function(event) {
    const source = event.source || {};
    const sourceId = source.groupId || source.roomId || source.userId || "";
    const row = normalizeRow_(HEADERS.LineSources, {
      id: makeId_("line"),
      sourceType: source.type || "",
      sourceId: sourceId,
      userId: source.userId || "",
      groupId: source.groupId || "",
      roomId: source.roomId || "",
      replyToken: event.replyToken || "",
      messageText: event.message && event.message.text ? event.message.text : "",
      timestamp: event.timestamp || "",
      createdAt: new Date().toISOString()
    });
    appendRow_(sheet, row);
    saved.push(row);
  });
  return { ok: true, saved: saved.length };
}

function isLineWebhookVerify_(body) {
  const events = body && Array.isArray(body.events) ? body.events : [];
  if (!events.length) return true;
  return events.every(function(event) {
    const replyToken = String(event.replyToken || "");
    return /^0+$/.test(replyToken);
  });
}

function buildAdvanceTransferMessage_(row) {
  const requestedAmount = Number(row.requestedAmount || row.amount || 0);
  const percentageFee = Math.round(requestedAmount * 0.08);
  return [
    "前払い申込",
    "",
    "【ドライバー名】" + (row.driverName || ""),
    "",
    "①前払い金額:¥" + formatYen_(row.transferAmount),
    "",
    "②前払い希望額¥" + formatYen_(requestedAmount),
    "③前払い手数料¥" + formatYen_(requestedAmount) + "×8%=¥" + formatYen_(percentageFee) + "+260=¥" + formatYen_(row.fee),
    "",
    "(期間 " + formatSlashDate_(row.dateFrom || row.date) + "〜" + formatSlashDate_(row.dateTo || row.date) + " " + (row.workedDays || row.count || 0) + "日分) 50%",
    "",
    "売上金額¥" + formatYen_(row.salesAmount),
    "",
    "口座情報",
    "銀行:" + (row.bankName || ""),
    "支店:" + (row.branchName || ""),
    "普通預金",
    "口座番号:" + (row.accountNumber || ""),
    "名義:" + (row.accountHolder || ""),
    "",
    "【振込名義人】",
    "(株)パシフィックワンマイルサポート"
  ].join("\n");
}

function calculateAdvanceFee_(requestedAmount) {
  return Math.round(Number(requestedAmount || 0) * 0.08 + 260);
}

function formatYen_(value) {
  return Number(value || 0).toLocaleString("ja-JP");
}

function formatMonthDay_(value) {
  if (!value) return "";
  const date = new Date(normalizeDateKey_(value) + "T00:00:00");
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "M月d日");
}

function formatSlashDate_(value) {
  if (!value) return "";
  const date = new Date(normalizeDateKey_(value) + "T00:00:00");
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "M/d");
}

function normalizeDateKey_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const text = String(value).trim();
  const direct = text.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (direct) {
    return direct[1] + "-" + String(direct[2]).padStart(2, "0") + "-" + String(direct[3]).padStart(2, "0");
  }
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return text;
}

function normalizeDateList_(value) {
  if (Array.isArray(value)) {
    return value.map(function(item) { return normalizeDateKey_(item); }).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map(function(item) { return normalizeDateKey_(item.trim()); })
    .filter(Boolean);
}

function normalizeStatus_(status) {
  const value = String(status || "").trim();
  if (value === "working" || value === "稼働中" || value === "出勤中" || value === "出勤") return "working";
  if (value === "finished" || value === "退勤済み" || value === "退勤完了" || value === "退勤") return "finished";
  if (value === "off" || value === "休み" || value === "休" || value === "未出勤") return "off";
  return value || "off";
}

function isWorkingStatus_(status) {
  return normalizeStatus_(status) === "working";
}

function isFinishedStatus_(status) {
  return normalizeStatus_(status) === "finished";
}

function isOffStatus_(status) {
  return normalizeStatus_(status) === "off";
}

function isLineReady_() {
  return isLineTokenReady_() &&
    getLineAdminTargets_().length > 0;
}

function isLineTokenReady_() {
  return LINE_CHANNEL_ACCESS_TOKEN &&
    LINE_CHANNEL_ACCESS_TOKEN !== "YOUR_LINE_CHANNEL_ACCESS_TOKEN_HERE";
}

function pushLineText_(text) {
  const targets = getLineAdminTargets_();
  if (!targets.length) return { ok: false, skipped: true, reason: "LINE_ADMIN_TO is empty" };
  const results = targets.map(function(target) {
    return pushLineTextTo_(target, text);
  });
  return { ok: true, sent: results.length, results: results };
}

function getLineAdminTargets_() {
  return String(LINE_ADMIN_TO || "")
    .split(/[,\n]/)
    .map(function(value) { return value.trim(); })
    .filter(function(value) {
      return value && value !== "YOUR_ADMIN_LINE_USER_OR_GROUP_ID_HERE";
    });
}

function pushLineTextTo_(to, text) {
  const url = "https://api.line.me/v2/bot/message/push";
  const payload = {
    to: to,
    messages: [
      {
        type: "text",
        text: text
      }
    ]
  };
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + LINE_CHANNEL_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("LINE通知に失敗しました: " + code + " " + response.getContentText());
  }
  return { ok: true };
}

function replyLineText_(replyToken, text) {
  const url = "https://api.line.me/v2/bot/message/reply";
  const payload = {
    replyToken: replyToken,
    messages: [
      {
        type: "text",
        text: text
      }
    ]
  };
  const response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + LINE_CHANNEL_ACCESS_TOKEN
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error("LINE返信に失敗しました: " + code + " " + response.getContentText());
  }
  return { ok: true };
}

function sendMorningDriverAttendanceNotices() {
  return sendDriverScheduledAttendanceNotices_("morning", getBusinessDate_());
}

function sendNightDriverCheckoutNotices() {
  return sendDriverScheduledAttendanceNotices_("night", getBusinessDate_());
}

function sendDriverScheduledAttendanceNotices_(kind, dateValue) {
  if (!isLineTokenReady_()) return { ok: false, skipped: true, reason: "LINE settings are empty" };
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  const drivers = getActiveDrivers_().filter(function(driver) {
    return driver.lineUserId && !isDriverHoliday_(driver.id, date) && shouldSendLineAttendanceNotice(driver.id, date);
  });
  const sent = [];
  drivers.forEach(function(driver) {
    const row = getAttendanceRow_(driver.id, date);
    const attendanceUrl = DRIVER_ATTENDANCE_URL + "?driverId=" + encodeURIComponent(driver.id);
    let text = "";
    if (kind === "morning") {
      text = [
        "【POMS 出勤確認】",
        driver.name + "さん、おはようございます。",
        "本日は出勤日です。",
        "出勤が完了したら、下記URLから出勤報告をお願いします。",
        attendanceUrl
      ].join("\n");
    } else {
      const finished = row && isFinishedStatus_(row.status);
      text = finished
        ? [
          "【POMS 退勤確認】",
          driver.name + "さん、本日の退勤報告は完了しています。",
          "お疲れさまでした。",
          "勤務日: " + date,
          "退勤時刻: " + (row.endTime || "-")
        ].join("\n")
        : [
          "【POMS 退勤確認】",
          driver.name + "さん、退勤報告の確認時間です。",
          "退勤が完了している場合は、下記URLから退勤報告をお願いします。",
          attendanceUrl
        ].join("\n");
    }
    pushLineTextTo_(driver.lineUserId, text);
    sent.push(driver.id);
  });
  return { ok: true, kind: kind, date: date, sent: sent.length };
}

function setupPomsLineTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    const fn = trigger.getHandlerFunction();
    if (fn === "sendMorningDriverAttendanceNotices" || fn === "sendNightDriverCheckoutNotices") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("sendMorningDriverAttendanceNotices")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
  ScriptApp.newTrigger("sendNightDriverCheckoutNotices")
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .create();
  return { ok: true, message: "POMS LINE triggers created" };
}

function getActiveDrivers_() {
  return readObjects_(getOrCreateSheet_(SHEETS.drivers, HEADERS.Drivers)).filter(function(driver) {
    return String(driver.lifecycle || "active") !== "inactive";
  });
}

function getAttendanceRow_(driverId, dateValue) {
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  const sheet = getMonthSheet_("Attendance", date);
  return readObjects_(sheet).find(function(row) {
    return String(row.driverId || "") === String(driverId || "") && normalizeDateKey_(row.date) === date;
  }) || null;
}

function isDriverHoliday_(driverId, dateValue) {
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  const month = getMonthKey_(new Date(date + "T00:00:00"));
  const sheet = getNamedMonthSheet_("Holiday", month);
  const rows = readObjects_(sheet);
  return rows.some(function(row) {
    const days = normalizeDateList_(row.days);
    return String(row.driverId || "") === String(driverId || "") && days.indexOf(date) !== -1;
  });
}

function saveHoliday_(body) {
  const month = body.targetYearMonth || getHolidayTargetMonth_();
  const sheet = getNamedMonthSheet_("Holiday", month);
  const now = new Date().toISOString();
  const row = normalizeRow_(HEADERS.Holiday, {
    id: body.id || makeId_("hol"),
    driverId: body.driverId,
    driverName: body.driverName,
    siteId: body.siteId,
    siteName: body.siteName,
    days: Array.isArray(body.days) ? body.days.join(",") : String(body.days || ""),
    note: body.note || "",
    updatedAt: now,
    targetYearMonth: month
  });
  upsertByKeys_(sheet, HEADERS.Holiday, row, ["driverId"]);
  return { ok: true, saved: "holiday", sheet: sheet.getName(), updatedAt: now };
}

function saveFixedShift_(body) {
  const month = body.targetYearMonth || getMonthKey_(new Date());
  const sheet = getNamedMonthSheet_("FixedShift", month);
  const now = new Date().toISOString();
  const row = normalizeRow_(HEADERS.FixedShift, {
    id: body.id || makeId_("fix"),
    driverId: body.driverId,
    driverName: body.driverName,
    siteId: body.siteId,
    siteName: body.siteName,
    days: Array.isArray(body.days) ? body.days.join(",") : String(body.days || ""),
    updatedAt: now,
    targetYearMonth: month
  });
  upsertByKeys_(sheet, HEADERS.FixedShift, row, ["driverId"]);
  return { ok: true, saved: "fixed_shift", sheet: sheet.getName(), updatedAt: now };
}

function upsertDriver_(body) {
  const sheet = getOrCreateSheet_(SHEETS.drivers, HEADERS.Drivers);
  const now = new Date().toISOString();
  const row = normalizeRow_(HEADERS.Drivers, {
    id: body.id || makeId_("drv"),
    name: body.name,
    siteId: body.siteId,
    siteName: body.siteName,
    contractType: body.contractType || "",
    lifecycle: body.lifecycle || "active",
    unitPrice: Number(body.unitPrice || 0),
    advanceFee: Number(body.advanceFee || 0),
    bankName: body.bankName || "",
    branchName: body.branchName || "",
    accountNumber: body.accountNumber || "",
    accountHolder: body.accountHolder || "",
    lineUserId: body.lineUserId || "",
    displayName: body.displayName || body.name || "",
    note: body.note || "",
    createdAt: body.createdAt || now,
    updatedAt: now,
    pin: normalizePin_(body.pin || "0000")
  });
  upsertByKeys_(sheet, HEADERS.Drivers, row, ["id"]);
  return { ok: true, saved: "driver", driverId: row.id, updatedAt: now };
}

function upsertSite_(body) {
  const sheet = getOrCreateSheet_(SHEETS.sites, HEADERS.Sites);
  const now = new Date().toISOString();
  const row = normalizeRow_(HEADERS.Sites, {
    id: body.id || makeId_("site"),
    name: body.name || "",
    sort: Number(body.sort || 1),
    active: body.active === false || String(body.active) === "false" ? false : true,
    updatedAt: now
  });
  if (!row.name) throw new Error("site name is required");
  upsertByKeys_(sheet, HEADERS.Sites, row, ["id"]);
  syncDriverSiteName_(row.id, row.name);
  return { ok: true, saved: "site", siteId: row.id, updatedAt: now };
}

function syncDriverSiteName_(siteId, siteName) {
  if (!siteId) return;
  const sheet = getOrCreateSheet_(SHEETS.drivers, HEADERS.Drivers);
  const rows = readObjects_(sheet);
  const siteNameColumn = HEADERS.Drivers.indexOf("siteName") + 1;
  const updatedAtColumn = HEADERS.Drivers.indexOf("updatedAt") + 1;
  rows.forEach(function(row, index) {
    if (String(row.siteId || "") === String(siteId)) {
      sheet.getRange(index + 2, siteNameColumn).setValue(siteName);
      sheet.getRange(index + 2, updatedAtColumn).setValue(new Date().toISOString());
    }
  });
}

function switchDriverLifecycle_(body) {
  if (!body.id) throw new Error("driver id is required");
  const sheet = getOrCreateSheet_(SHEETS.drivers, HEADERS.Drivers);
  const rows = readObjects_(sheet);
  const next = body.lifecycle || "inactive";
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].id === body.id) {
      sheet.getRange(i + 2, HEADERS.Drivers.indexOf("lifecycle") + 1).setValue(next);
      sheet.getRange(i + 2, HEADERS.Drivers.indexOf("updatedAt") + 1).setValue(new Date().toISOString());
      return { ok: true, driverId: body.id, lifecycle: next };
    }
  }
  throw new Error("driver not found: " + body.id);
}

function loadHoliday_(params) {
  const month = params.targetYearMonth || getHolidayTargetMonth_();
  const driverId = params.driverId || "";
  const userId = params.userId || params.lineUserId || "";
  const driver = driverId ? { id: driverId } : getDriverByLine_(userId).driver;
  if (!driver || !driver.id) return { ok: true, found: false };

  const sheet = getNamedMonthSheet_("Holiday", month);
  const rows = readObjects_(sheet);
  const row = rows.find(function(item) { return item.driverId === driver.id; });
  if (!row) return { ok: true, found: false };
  return {
    ok: true,
    found: true,
    dates: String(row.days || "").split(",").filter(Boolean),
    note: row.note || "",
    updatedAt: row.updatedAt || ""
  };
}

function getDriverByLine_(lineUserId) {
  const sheet = getOrCreateSheet_(SHEETS.drivers, HEADERS.Drivers);
  const rows = readObjects_(sheet);
  const driver = rows.find(function(row) { return row.lineUserId && row.lineUserId === lineUserId; });
  return { ok: true, found: Boolean(driver), driver: driver ? sanitizeDriver_(driver) : null };
}

function getDriverByIdPublic_(driverId) {
  const driver = getDriverById_(driverId);
  return { ok: true, found: Boolean(driver), driver: driver ? sanitizeDriver_(driver) : null };
}

function getDriverAttendance_(driverId, dateValue) {
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  const sheet = getMonthSheet_("Attendance", date);
  const rows = readObjects_(sheet);
  const row = rows.find(function(item) {
    return String(item.driverId || "") === String(driverId || "") && normalizeDateKey_(item.date) === date;
  });
  return {
    ok: true,
    found: Boolean(row),
    row: row || null
  };
}

function getDriverById_(driverId) {
  if (!driverId) return null;
  const sheet = getOrCreateSheet_(SHEETS.drivers, HEADERS.Drivers);
  const rows = readObjects_(sheet);
  return rows.find(function(row) { return row.id === driverId; }) || null;
}

function sanitizeDriver_(driver) {
  const safe = {};
  Object.keys(driver || {}).forEach(function(key) {
    if (key !== "pin") safe[key] = driver[key];
  });
  return safe;
}

function normalizePin_(value) {
  const digits = String(value === undefined || value === null ? "" : value).replace(/\D/g, "");
  if (!digits) return "";
  return digits.slice(-4).padStart(4, "0");
}

function calculateAdvance_(params) {
  const driver = getDriverById_(params.driverId) || {};
  const dateFrom = normalizeDateKey_(params.dateFrom || getBusinessDate_());
  const dateTo = normalizeDateKey_(params.dateTo || dateFrom);
  const workedDays = countWorkedDays_(params.driverId, dateFrom, dateTo);
  const advances = getDriverAdvances_(params.driverId);
  const overlap = advances.find(function(row) {
    return rangesOverlap_(dateFrom, dateTo, row.dateFrom || row.date, row.dateTo || row.date);
  }) || null;
  const unitPrice = Number(driver.unitPrice || 0);
  const salesAmount = unitPrice * workedDays;
  const requestedAmount = Math.round(salesAmount * 0.5);
  const fee = calculateAdvanceFee_(requestedAmount);
  return {
    ok: true,
    driverId: params.driverId,
    dateFrom: dateFrom,
    dateTo: dateTo,
    workedDays: workedDays,
    unitPrice: unitPrice,
    salesAmount: salesAmount,
    requestedAmount: requestedAmount,
    fee: fee,
    transferAmount: Math.max(requestedAmount - fee, 0),
    hasOverlap: Boolean(overlap),
    overlap: overlap,
    advances: advances
  };
}

function getAdvanceCalendar_(params) {
  const month = params.month || getMonthKey_(new Date());
  const driverId = params.driverId || "";
  const attendanceSheet = getNamedMonthSheet_("Attendance", month);
  const workedDates = readObjects_(attendanceSheet).filter(function(row) {
    const date = normalizeDateKey_(row.date);
    return row.driverId === driverId && date.indexOf(month) === 0 && !isOffStatus_(row.status);
  }).map(function(row) {
    return normalizeDateKey_(row.date);
  }).filter(Boolean);

  return {
    ok: true,
    driverId: driverId,
    month: month,
    workedDates: Array.from(new Set(workedDates)).sort(),
    advances: getDriverAdvances_(driverId)
  };
}

function getDriverAdvances_(driverId) {
  if (!driverId) return [];
  const ss = getSpreadsheet_();
  return ss.getSheets().filter(function(sheet) {
    return /^(Advance|前払い)_\d{4}_\d{2}$/.test(sheet.getName());
  }).reduce(function(acc, sheet) {
    return acc.concat(readObjects_(sheet).filter(function(row) {
      return row.driverId === driverId;
    }));
  }, []).sort(function(a, b) {
    return String(b.dateFrom || b.date || "").localeCompare(String(a.dateFrom || a.date || ""));
  });
}

function findOverlappingAdvance_(driverId, dateFrom, dateTo) {
  return getDriverAdvances_(driverId).find(function(row) {
    return rangesOverlap_(dateFrom, dateTo, row.dateFrom || row.date, row.dateTo || row.date);
  }) || null;
}

function rangesOverlap_(startA, endA, startB, endB) {
  startA = normalizeDateKey_(startA);
  endA = normalizeDateKey_(endA);
  startB = normalizeDateKey_(startB);
  endB = normalizeDateKey_(endB);
  if (!startA || !endA || !startB || !endB) return false;
  const aStart = startA <= endA ? startA : endA;
  const aEnd = startA <= endA ? endA : startA;
  const bStart = startB <= endB ? startB : endB;
  const bEnd = startB <= endB ? endB : startB;
  return aStart <= bEnd && bStart <= aEnd;
}

function countWorkedDays_(driverId, dateFrom, dateTo) {
  dateFrom = normalizeDateKey_(dateFrom);
  dateTo = normalizeDateKey_(dateTo);
  if (!driverId || !dateFrom || !dateTo) return 0;
  const start = dateFrom <= dateTo ? dateFrom : dateTo;
  const end = dateFrom <= dateTo ? dateTo : dateFrom;
  const months = getMonthsBetween_(start, end);
  const workedDates = {};
  months.forEach(function(month) {
    const sheet = getNamedMonthSheet_("Attendance", month);
    readObjects_(sheet).forEach(function(row) {
      const date = normalizeDateKey_(row.date);
      if (row.driverId === driverId && date >= start && date <= end && !isOffStatus_(row.status)) {
        workedDates[date] = true;
      }
    });
  });
  return Object.keys(workedDates).length;
}

function getMonthsBetween_(dateFrom, dateTo) {
  const start = new Date((dateFrom <= dateTo ? dateFrom : dateTo) + "T00:00:00");
  const end = new Date((dateFrom <= dateTo ? dateTo : dateFrom) + "T00:00:00");
  const months = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    months.push(getMonthKey_(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months;
}

function getDashboard_(month) {
  const drivers = readObjects_(getOrCreateSheet_(SHEETS.drivers, HEADERS.Drivers));
  const sites = readObjects_(getOrCreateSheet_(SHEETS.sites, HEADERS.Sites));
  return {
    drivers: drivers,
    sites: sites,
    attendance: readObjects_(getNamedMonthSheet_("Attendance", month)),
    advance: readObjects_(getNamedMonthSheet_("Advance", month)),
    holiday: readObjects_(getNamedMonthSheet_("Holiday", month)),
    fixedShift: readObjects_(getNamedMonthSheet_("FixedShift", month))
  };
}

function shouldSendLineAttendanceNotice(driverId, dateValue) {
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  const month = getMonthKey_(new Date(date + "T00:00:00"));
  const sheet = getNamedMonthSheet_("FixedShift", month);
  const rows = readObjects_(sheet);
  const row = rows.find(function(item) { return item.driverId === driverId; });
  if (!row) return true;
  const days = normalizeDateList_(row.days);
  return days.indexOf(date) === -1;
}

function setupBaseSheets_() {
  const driversSheet = getOrCreateSheet_(SHEETS.drivers, HEADERS.Drivers);
  getOrCreateSheet_(SHEETS.adminLogins, HEADERS.AdminLogins);
  const adminUsersSheet = getOrCreateSheet_(SHEETS.adminUsers, HEADERS.AdminUsers);
  getOrCreateSheet_(SHEETS.driverSessions, HEADERS.DriverSessions);
  getOrCreateSheet_(SHEETS.lineSources, HEADERS.LineSources);
  if (adminUsersSheet.getLastRow() < 2) {
    const now = new Date().toISOString();
    const initialPin = ADMIN_PASSWORD && ADMIN_PASSWORD !== "CHANGE_THIS_ADMIN_PASSWORD" ? ADMIN_PASSWORD : "1234";
    appendRow_(adminUsersSheet, normalizeRow_(HEADERS.AdminUsers, {
      id: "admin_default",
      username: ADMIN_USERNAME || "admin",
      pin: normalizePin_(initialPin),
      displayName: "管理者",
      role: "owner",
      active: true,
      createdAt: now,
      updatedAt: now
    }));
  }
  if (driversSheet.getLastRow() < 2) {
    const now = new Date().toISOString();
    appendRow_(driversSheet, normalizeRow_(HEADERS.Drivers, {
      id: "drv_demo_001",
      name: "石塚 歩汰",
      siteId: "site_kawaguchi",
      siteName: "川口領家 Amazon",
      contractType: "日当",
      lifecycle: "active",
      unitPrice: 22000,
      bankName: "",
      branchName: "",
      accountNumber: "",
      accountHolder: "",
      displayName: "石塚 歩汰",
      createdAt: now,
      updatedAt: now,
      pin: "1234"
    }));
  }
  const sitesSheet = getOrCreateSheet_(SHEETS.sites, HEADERS.Sites);
  if (sitesSheet.getLastRow() < 2) {
    const now = new Date().toISOString();
    appendRow_(sitesSheet, normalizeRow_(HEADERS.Sites, { id: "site_kawaguchi", name: "川口領家 Amazon", sort: 1, active: true, updatedAt: now }));
    appendRow_(sitesSheet, normalizeRow_(HEADERS.Sites, { id: "site_shinjuku", name: "新宿上落合 Amazon", sort: 2, active: true, updatedAt: now }));
  }
}

function setupReadableSpreadsheet_() {
  const ss = getSpreadsheet_();
  setupGuideSheet_(ss);
  Object.keys(SHEETS).forEach(function(key) {
    const sheet = ss.getSheetByName(SHEETS[key]);
    if (sheet) formatReadableSheet_(sheet);
  });
  ss.getSheets().forEach(function(sheet) {
    if (getSheetKind_(sheet.getName())) {
      formatReadableSheet_(sheet);
    }
  });
  hideLegacyDuplicateSheets_(ss);
  hideSystemSheets_(ss);
}

function setupGuideSheet_(ss) {
  const name = "はじめに";
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name, 0);
  const rows = [
    ["POMS スプレッドシートの使い方", ""],
    ["基本", "通常の登録・変更は管理画面から行ってください。スプレッドシートは確認・分析・一括確認用です。"],
    ["ドライバー登録", "ドライバー管理シートで、ドライバー名・所属現場・日当単価・口座情報・4桁PINを確認できます。"],
    ["現場登録", "現場追加や変更は管理画面の「管理 > 現場管理」から行うのが安全です。"],
    ["管理者", "管理者管理シートで管理者名と4桁PINを管理できます。管理者は毎回ログインが必要です。"],
    ["月別データ", "出勤_年月、前払い_年月、休み希望_年月、確定シフト_年月の形で月ごとに保存されます。"],
    ["出勤退勤の取消", "出勤_年月シートで対象ドライバー・対象日の行を削除すると、次回勤務報告画面を開いた時に未出勤として反映されます。管理者画面の「勤怠取消」でも同じ操作ができます。"],
    ["LINEログイン解除", "ドライバー管理シートのLINEユーザーIDを空欄にすると、次回LIFFを開いた時に名前と4桁PINの再ログインが必要になります。管理者画面の「LINE解除」でも同じ操作ができます。"],
    ["非表示シート", "ログイン保持やLINE取得履歴など、普段触らないシステム用シートは非表示にしています。必要な場合はシート一覧から再表示できます。"]
  ];
  sheet.clear();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 2).setBackground("#111827").setFontColor("#ffffff").setFontWeight("bold");
  sheet.getRange(2, 1, rows.length - 1, 1).setBackground("#e8f5e9").setFontWeight("bold");
  sheet.setColumnWidths(1, 1, 160);
  sheet.setColumnWidths(2, 1, 760);
}

function hideSystemSheets_(ss) {
  HIDDEN_SHEETS.concat(["DriverSessions", "LineSources"]).forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (sheet && ss.getSheets().length > 1) {
      try {
        sheet.hideSheet();
      } catch (error) {
        // Some sheets cannot be hidden in edge cases; visibility is optional.
      }
    }
  });
}

function hideLegacyDuplicateSheets_(ss) {
  Object.keys(SHEET_ALIASES).forEach(function(name) {
    const current = ss.getSheetByName(name);
    if (!current) return;
    SHEET_ALIASES[name].forEach(function(alias) {
      const legacy = ss.getSheetByName(alias);
      if (legacy && ss.getSheets().length > 1) {
        try {
          legacy.hideSheet();
        } catch (error) {
          // Keep legacy data safe even if hiding fails.
        }
      }
    });
  });
  ss.getSheets().forEach(function(sheet) {
    const match = sheet.getName().match(/^(Attendance|Advance|Holiday|FixedShift)_(\d{4})_(\d{2})$/);
    if (!match) return;
    const label = MONTH_PREFIX_LABELS[match[1]];
    const current = label ? ss.getSheetByName(label + "_" + match[2] + "_" + match[3]) : null;
    if (current && ss.getSheets().length > 1) {
      try {
        sheet.hideSheet();
      } catch (error) {
        // Keep legacy data safe even if hiding fails.
      }
    }
  });
}

function formatReadableSheet_(sheet) {
  const kind = getSheetKind_(sheet.getName());
  if (!kind || !HEADERS[kind]) return;
  const headers = HEADERS[kind];
  sheet.setFrozenRows(1);
  sheet.showColumns(1, Math.max(headers.length, 1));
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground("#111827")
    .setFontColor("#ffffff")
    .setFontWeight("bold");
  headers.forEach(function(header, index) {
    const column = index + 1;
    if (HIDDEN_COLUMNS[kind] && HIDDEN_COLUMNS[kind].indexOf(header) !== -1) {
      sheet.hideColumns(column);
    }
  });
  try {
    sheet.autoResizeColumns(1, headers.length);
  } catch (error) {
    // autoResizeColumns can fail on very large sheets; formatting is optional.
  }
}

function getSpreadsheet_() {
  const spreadsheetId = getSpreadsheetId_(SPREADSHEET_ID);
  if (!spreadsheetId || spreadsheetId === "YOUR_SPREADSHEET_ID_HERE") {
    throw new Error("SPREADSHEET_IDを設定してください");
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getSpreadsheetId_(value) {
  const text = String(value || "").trim();
  const match = text.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : text;
}

function getMonthSheet_(prefix, dateValue) {
  const month = getMonthKey_(new Date(normalizeDateKey_(dateValue) + "T00:00:00"));
  return getNamedMonthSheet_(prefix, month);
}

function getNamedMonthSheet_(prefix, month) {
  const label = MONTH_PREFIX_LABELS[prefix] || prefix;
  const name = label + "_" + String(month).replace("-", "_");
  return getOrCreateSheet_(name, HEADERS[prefix]);
}

function getSheetKind_(sheetName) {
  if (HEADERS[sheetName]) return sheetName;
  if (BASE_SHEET_KINDS[sheetName]) return BASE_SHEET_KINDS[sheetName];
  const text = String(sheetName || "");
  const legacyMatch = text.match(/^(Attendance|Advance|Holiday|FixedShift)_\d{4}_\d{2}$/);
  if (legacyMatch) return legacyMatch[1];
  const jpMatch = text.match(/^(出勤|前払い|休み希望|確定シフト)_\d{4}_\d{2}$/);
  return jpMatch ? MONTH_LABEL_KINDS[jpMatch[1]] : "";
}

function getSheetAliases_(name) {
  const aliases = SHEET_ALIASES[name] ? SHEET_ALIASES[name].slice() : [];
  const monthMatch = String(name || "").match(/^(出勤|前払い|休み希望|確定シフト)_(\d{4})_(\d{2})$/);
  if (monthMatch) {
    const kind = MONTH_LABEL_KINDS[monthMatch[1]];
    if (kind) aliases.push(kind + "_" + monthMatch[2] + "_" + monthMatch[3]);
  }
  return aliases;
}

function findOrRenameSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  const aliases = getSheetAliases_(name);
  for (let i = 0; i < aliases.length; i += 1) {
    const aliasSheet = ss.getSheetByName(aliases[i]);
    if (aliasSheet) {
      try {
        aliasSheet.setName(name);
      } catch (error) {
        // If rename fails, keep using the existing sheet so data is not lost.
      }
      return ss.getSheetByName(name) || aliasSheet;
    }
  }
  return null;
}

function getDisplayHeaders_(sheetName, headers) {
  const kind = getSheetKind_(sheetName);
  const labels = HEADER_LABELS[kind] || {};
  return headers.map(function(header) {
    return labels[header] || header;
  });
}

function getCanonicalHeader_(sheetName, headerValue) {
  const header = String(headerValue || "");
  const kind = getSheetKind_(sheetName);
  const labels = HEADER_LABELS[kind] || {};
  const canonical = Object.keys(labels).find(function(key) {
    return String(labels[key]) === header;
  });
  return canonical || header;
}

function getOrCreateSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sheet = findOrRenameSheet_(ss, name);
  if (!sheet) sheet = ss.insertSheet(name);
  const displayHeaders = getDisplayHeaders_(name, headers);
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const canonicalFirstRow = firstRow.map(function(header) {
    return getCanonicalHeader_(name, header);
  });
  const needsHeader = firstRow.join("") === "" || canonicalFirstRow[0] !== headers[0];
  if (needsHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([displayHeaders]);
    sheet.setFrozenRows(1);
  } else {
    const existingHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    const canonicalHeaders = existingHeaders.map(function(header) {
      return getCanonicalHeader_(name, header);
    });
    const missingHeaders = headers.filter(function(header) {
      return canonicalHeaders.indexOf(header) === -1;
    });
    const needsJapaneseLabels = headers.some(function(header, index) {
      return String(existingHeaders[index] || "") !== String(displayHeaders[index] || "");
    });
    if (missingHeaders.length || needsJapaneseLabels) {
      sheet.getRange(1, 1, 1, headers.length).setValues([displayHeaders]);
    }
  }
  return sheet;
}

function readObjects_(sheet) {
  repairVisibleRows_(sheet);
  cleanupEmptyAndBrokenRows_(sheet);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0].map(function(header) {
    return getCanonicalHeader_(sheet.getName(), header);
  });
  return values.slice(1).filter(function(row) {
    return row.join("") !== "";
  }).map(function(row) {
    const obj = {};
    headers.forEach(function(header, index) {
      obj[header] = row[index];
    });
    return obj;
  });
}

function normalizeRow_(headers, obj) {
  const row = {};
  headers.forEach(function(header) {
    row[header] = obj[header] === undefined ? "" : obj[header];
  });
  return row;
}

function appendRow_(sheet, rowObj) {
  cleanupEmptyAndBrokenRows_(sheet);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(header) {
    return getCanonicalHeader_(sheet.getName(), header);
  });
  insertDataRowAtTop_(sheet, headers.map(function(header) { return rowObj[header] === undefined ? "" : rowObj[header]; }));
}

function upsertByKeys_(sheet, headers, rowObj, keys) {
  const rows = readObjects_(sheet);
  const index = rows.findIndex(function(row) {
    return keys.every(function(key) {
      return valuesMatchForKey_(key, row[key], rowObj[key]);
    });
  });
  const values = headers.map(function(header) { return rowObj[header] === undefined ? "" : rowObj[header]; });
  if (index >= 0) {
    sheet.getRange(index + 2, 1, 1, headers.length).setValues([values]);
  } else {
    insertDataRowAtTop_(sheet, values);
  }
}

function insertDataRowAtTop_(sheet, values) {
  if (sheet.getMaxRows() < 2) {
    sheet.insertRowsAfter(1, 1);
  } else {
    sheet.insertRowBefore(2);
  }
  sheet.getRange(2, 1, 1, values.length).setValues([values]);
}

function cleanupEmptyAndBrokenRows_(sheet) {
  const kind = getSheetKind_(sheet.getName());
  if (!kind) return { deleted: 0 };
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { deleted: 0 };
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0].map(function(header) {
    return getCanonicalHeader_(sheet.getName(), header);
  });
  let deleted = 0;
  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    const row = values[rowIndex];
    const hasAnyValue = row.some(function(cell) { return String(cell || "").trim() !== ""; });
    if (!hasAnyValue || isBrokenDataRow_(kind, headers, row)) {
      sheet.deleteRow(rowIndex + 1);
      deleted += 1;
    }
  }
  return { deleted: deleted };
}

function repairVisibleRows_(sheet) {
  const kind = getSheetKind_(sheet.getName());
  if (!kind) return { repaired: 0 };
  if (kind !== "Attendance" && kind !== "Advance") return { repaired: 0 };
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn < 1) return { repaired: 0 };
  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0].map(function(header) {
    return getCanonicalHeader_(sheet.getName(), header);
  });
  const drivers = readSheetObjectsWithoutCleanup_(getOrCreateSheet_(SHEETS.drivers, HEADERS.Drivers));
  const sites = readSheetObjectsWithoutCleanup_(getOrCreateSheet_(SHEETS.sites, HEADERS.Sites));
  let repaired = 0;
  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];
    const get = function(key) {
      const index = headers.indexOf(key);
      return index >= 0 ? row[index] : "";
    };
    const set = function(key, value) {
      const index = headers.indexOf(key);
      if (index < 0 || value === undefined || value === null || value === "") return;
      if (String(row[index] || "").trim() !== "") return;
      row[index] = value;
      sheet.getRange(rowIndex + 1, index + 1).setValue(value);
      repaired += 1;
    };
    const hasVisibleData = ["date", "dateFrom", "dateTo", "driverName", "siteName", "status", "startTime", "endTime", "note", "workType"].some(function(key) {
      return String(get(key) || "").trim() !== "";
    });
    if (!hasVisibleData) continue;
    const driverName = String(get("driverName") || "").trim();
    const driver = drivers.find(function(item) {
      return driverName && (String(item.name || "").trim() === driverName || String(item.displayName || "").trim() === driverName);
    });
    if (driver) {
      set("driverId", driver.id);
      set("siteId", driver.siteId);
      set("siteName", driver.siteName);
    }
    const siteName = String(get("siteName") || (driver && driver.siteName) || "").trim();
    const site = sites.find(function(item) { return siteName && String(item.name || "").trim() === siteName; });
    if (site) set("siteId", site.id);
    set("id", makeId_(kind === "Attendance" ? "att" : "adv"));
    set("createdAt", new Date().toISOString());
    set("updatedAt", new Date().toISOString());
    if (kind === "Attendance") {
      set("workType", "normal");
      if (!String(get("status") || "").trim() && String(get("endTime") || "").trim()) set("status", "finished");
      if (!String(get("status") || "").trim() && String(get("startTime") || "").trim()) set("status", "working");
    }
  }
  return { repaired: repaired };
}

function readSheetObjectsWithoutCleanup_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0].map(function(header) {
    return getCanonicalHeader_(sheet.getName(), header);
  });
  return values.slice(1).filter(function(row) {
    return row.join("") !== "";
  }).map(function(row) {
    const obj = {};
    headers.forEach(function(header, index) {
      obj[header] = row[index];
    });
    return obj;
  });
}

function sortDataRowsNewestFirst_(sheet) {
  const kind = getSheetKind_(sheet.getName());
  if (!kind) return { sorted: false };
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 2 || lastColumn < 1) return { sorted: false };
  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const displayHeaders = values[0];
  const headers = displayHeaders.map(function(header) {
    return getCanonicalHeader_(sheet.getName(), header);
  });
  const body = values.slice(1).filter(function(row) {
    return row.some(function(cell) { return String(cell || "").trim() !== ""; });
  });
  if (body.length <= 1) return { sorted: false };
  body.sort(function(a, b) {
    return getSortTimeForRow_(kind, headers, b) - getSortTimeForRow_(kind, headers, a);
  });
  sheet.getRange(2, 1, body.length, lastColumn).setValues(body);
  const extraRows = lastRow - 1 - body.length;
  if (extraRows > 0) {
    sheet.getRange(2 + body.length, 1, extraRows, lastColumn).clearContent();
  }
  return { sorted: true };
}

function getSortTimeForRow_(kind, headers, row) {
  const get = function(key) {
    const index = headers.indexOf(key);
    return index >= 0 ? row[index] : "";
  };
  const candidates = [];
  if (kind === "Attendance") candidates.push(get("updatedAt"), get("createdAt"), get("date"));
  else if (kind === "Advance") candidates.push(get("createdAt"), get("updatedAt"), get("date"), get("dateFrom"));
  else if (kind === "AdminLogins") candidates.push(get("loggedAt"));
  else if (kind === "LineSources") candidates.push(get("createdAt"), get("timestamp"));
  else candidates.push(get("updatedAt"), get("createdAt"), get("date"), get("name"));
  for (let i = 0; i < candidates.length; i += 1) {
    const value = candidates[i];
    if (!value) continue;
    if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return value.getTime();
    const parsed = new Date(String(value));
    if (!isNaN(parsed.getTime())) return parsed.getTime();
    const dateKey = normalizeDateKey_(value);
    if (dateKey) {
      const dateParsed = new Date(dateKey + "T00:00:00");
      if (!isNaN(dateParsed.getTime())) return dateParsed.getTime();
    }
  }
  return 0;
}

function isBrokenDataRow_(kind, headers, row) {
  const get = function(key) {
    const index = headers.indexOf(key);
    return index >= 0 ? row[index] : "";
  };
  if (kind === "Attendance") {
    return !normalizeDateKey_(get("date")) ||
      (!String(get("driverId") || "").trim() && !String(get("driverName") || "").trim()) ||
      !String(get("status") || "").trim();
  }
  if (kind === "Advance") {
    return (!String(get("driverId") || "").trim() && !String(get("driverName") || "").trim()) ||
      !normalizeDateKey_(get("dateFrom") || get("date")) ||
      !normalizeDateKey_(get("dateTo") || get("dateFrom") || get("date"));
  }
  if (kind === "Drivers") {
    return !String(get("name") || "").trim() && !String(get("pin") || "").trim();
  }
  if (kind === "Sites") {
    return !String(get("name") || "").trim();
  }
  return false;
}

function valuesMatchForKey_(key, left, right) {
  if (key === "date" || key === "dateFrom" || key === "dateTo") {
    return normalizeDateKey_(left) === normalizeDateKey_(right);
  }
  return String(left || "") === String(right || "");
}

function getBusinessDate_() {
  const now = new Date();
  if (now.getHours() < 3) now.setDate(now.getDate() - 1);
  return Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function getMonthKey_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM");
}

function getHolidayTargetMonth_() {
  const now = new Date();
  const add = now.getDate() <= 13 ? 1 : 2;
  const target = new Date(now.getFullYear(), now.getMonth() + add, 1);
  return getMonthKey_(target);
}

function makeId_(prefix) {
  return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
