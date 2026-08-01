/**
 * POMS Rebuilt v2
 *
 * Goal:
 * - Keep the existing web API names mostly compatible.
 * - Use one stable set of Sheets as the database.
 * - Keep derived views (ledger/calendar/daily report) rebuildable.
 * - Remove secrets from source code. Set them in Script Properties:
 *   SPREADSHEET_ID, LINE_CHANNEL_ACCESS_TOKEN, LINE_ADMIN_TO,
 *   ADMIN_USERNAME, ADMIN_PASSWORD, DRIVER_ATTENDANCE_URL, DRIVER_ADVANCE_URL.
 */

const POMS_VERSION = "2.1.0";

const POMS_SHEETS = {
  Drivers: "ドライバー管理",
  Sites: "現場管理",
  Attendance: "退勤管理",
  Advance: "前払い管理",
  Holiday: "休み希望管理",
  FixedShift: "休み確定日管理",
  WorkLedger: "稼働台帳",
  MasterData: "マスターデータ",
  AdvanceTemplate: "前払いテンプレート",
  CalendarOverrides: "カレンダー補正",
  AdvanceUnapplied: "前払い未申請戻し",
  Destinations: "日報送信先設定",
  AdminUsers: "管理者管理",
  AdminLogins: "管理者ログイン履歴",
  DriverSessions: "システム_ログイン保持",
  LineSources: "LINE取得履歴",
  Assignments: "現場異動予約",
  NotificationQueue: "システム_通知待ち",
  Guide: "POMS_運用ガイド"
};

const POMS_CALENDAR_PREFIX = "管理カレンダー_";
const POMS_CURRENT_CALENDAR_SHEET = "前払いカレンダー";

const POMS_SESSION = {
  adminTtlSeconds: 6 * 60 * 60,
  driverTtlSeconds: 180 * 24 * 60 * 60
};

const POMS_LINE_POLICY = {
  adminAttendance: false,
  adminAdvance: true,
  adminAllClockedOutSummary: false,
  adminMorningSummary: true,
  adminNightSummary: true,
  driverAdvance: true,
  driverScheduledAttendance: false
};

const POMS_DEFAULTS = {
  spreadsheetId: "",
  adminUsername: "admin",
  adminPassword: "",
  lineAdminTo: "",
  lineChannelAccessToken: "",
  attendanceDestinationSpreadsheetId: "",
  attendanceDestinationSheetName: "フォームの回答 31",
  driverAttendanceUrl: "https://pos-driver-system.vercel.app/attendance.html",
  driverAdvanceUrl: "https://pos-driver-system.vercel.app/advance.html"
};

const POMS_HEADERS = {
  Drivers: ["id", "name", "siteId", "siteName", "contractType", "lifecycle", "unitPrice", "advanceFee", "bankName", "branchName", "accountNumber", "accountHolder", "lineUserId", "displayName", "note", "createdAt", "updatedAt", "pin", "companyAdvanceBalance", "advanceStopped", "advanceLimitRate"],
  Sites: ["id", "name", "sort", "active", "updatedAt", "advanceFeePercent", "advanceFeeFixed", "advanceFeeEnabled", "advanceFeeMemo", "advanceFeeRate", "transferFee"],
  Attendance: ["id", "date", "driverId", "driverName", "siteId", "siteName", "status", "startTime", "endTime", "note", "createdAt", "updatedAt", "workType"],
  Advance: ["id", "date", "dateFrom", "dateTo", "driverId", "driverName", "siteId", "siteName", "count", "workedDays", "selectedDates", "unitPrice", "salesAmount", "requestedAmount", "fee", "transferAmount", "amount", "tag", "note", "bankName", "branchName", "accountNumber", "accountHolder", "createdAt", "updatedAt", "companyAdvanceBalance", "alreadyAdvancedThisMonth", "advanceLimitRate", "maxAdvanceAmount", "advanceFeeRate", "transferFee", "safetyCheckResult"],
  Holiday: ["id", "driverId", "driverName", "siteId", "siteName", "days", "note", "updatedAt", "targetYearMonth"],
  FixedShift: ["id", "driverId", "driverName", "siteId", "siteName", "days", "updatedAt", "targetYearMonth"],
  WorkLedger: ["date", "driverId", "driverName", "siteId", "siteName", "unitPrice", "attendanceStatus", "startTime", "endTime", "calendarMark", "advanceStatus", "advanceIds", "advanceRequestedAmount", "advanceFee", "advanceTransferAmount", "advanceDateRange", "dailyReportStatus", "dailyReportSentAt", "source", "updatedAt"],
  CalendarOverrides: ["date", "driverId", "driverName", "siteId", "siteName", "unitPrice", "calendarMark", "attendanceStatus", "startTime", "endTime", "note", "updatedAt"],
  AdvanceUnapplied: ["date", "driverId", "driverName", "reason", "createdAt"],
  Destinations: ["対象月", "日報送信先URL", "送信先シート名", "使用中", "メモ", "更新日時"],
  MasterData: ["ドライバーID", "ドライバー名", "所属現場", "日当単価", "会社建替残高", "前払い停止", "前払い上限率", "現場別前払い手数料率", "振込手数料", "Webログイン4桁PIN", "LINEユーザーID", "銀行名", "支店名", "口座番号", "口座名義", "状態", "メモ"],
  AdminUsers: ["id", "username", "pin", "displayName", "role", "active", "createdAt", "updatedAt"],
  AdminLogins: ["id", "username", "success", "loggedAt", "userAgent", "language", "screen", "timeZone", "path"],
  DriverSessions: ["token", "driverId", "driverName", "createdAt", "expiresAt", "lastUsedAt", "active"],
  LineSources: ["id", "sourceType", "sourceId", "userId", "groupId", "roomId", "replyToken", "messageText", "timestamp", "createdAt"],
  Assignments: ["id", "driverId", "driverName", "siteId", "siteName", "effectiveFrom", "effectiveTo", "unitPrice", "note", "updatedAt"],
  NotificationQueue: ["id", "kind", "payload", "status", "createdAt", "sentAt", "error"],
  Guide: ["項目", "状態", "説明"]
};

const POMS_LABELS = {
  Drivers: {
    id: "内部ID", name: "ドライバー名", siteId: "現場ID", siteName: "所属現場",
    contractType: "契約区分", lifecycle: "状態", unitPrice: "日当単価",
    advanceFee: "前払い手数料設定", bankName: "銀行名", branchName: "支店名",
    accountNumber: "口座番号", accountHolder: "口座名義", lineUserId: "LINEユーザーID",
    displayName: "表示名", note: "メモ", createdAt: "作成日時",
    updatedAt: "更新日時", pin: "4桁PIN", companyAdvanceBalance: "会社建替残高",
    advanceStopped: "前払い停止", advanceLimitRate: "前払い上限率"
  },
  Sites: {
    id: "現場ID", name: "現場名", sort: "並び順", active: "使用中",
    updatedAt: "更新日時", advanceFeePercent: "前払い手数料率",
    advanceFeeFixed: "固定手数料", advanceFeeEnabled: "手数料使用",
    advanceFeeMemo: "手数料メモ", advanceFeeRate: "前払い手数料率",
    transferFee: "振込手数料"
  },
  Attendance: {
    id: "内部ID", date: "勤務日", driverId: "ドライバーID",
    driverName: "ドライバー名", siteId: "現場ID", siteName: "現場名",
    status: "状態", startTime: "出勤時刻", endTime: "退勤時刻",
    note: "メモ", createdAt: "作成日時", updatedAt: "更新日時", workType: "勤務区分"
  },
  Advance: {
    id: "内部ID", date: "申請日", dateFrom: "対象開始日", dateTo: "対象終了日",
    driverId: "ドライバーID", driverName: "ドライバー名", siteId: "現場ID",
    siteName: "現場名", count: "申請回数", workedDays: "実働日数",
    selectedDates: "選択稼働日", unitPrice: "日当単価", salesAmount: "売上金額",
    requestedAmount: "前払い希望額", fee: "前払い手数料",
    transferAmount: "振込予定額", amount: "申請額", tag: "タグ", note: "メモ",
    bankName: "銀行名", branchName: "支店名", accountNumber: "口座番号",
    accountHolder: "口座名義", createdAt: "作成日時", updatedAt: "更新日時",
    companyAdvanceBalance: "会社建替残高", alreadyAdvancedThisMonth: "当月前払い済み",
    advanceLimitRate: "前払い上限率", maxAdvanceAmount: "前払い可能額",
    advanceFeeRate: "前払い手数料率", transferFee: "振込手数料",
    safetyCheckResult: "安全チェック結果"
  },
  Holiday: {
    id: "内部ID", driverId: "ドライバーID", driverName: "ドライバー名",
    siteId: "現場ID", siteName: "現場名", days: "休み希望日",
    note: "メモ", updatedAt: "更新日時", targetYearMonth: "対象月"
  },
  FixedShift: {
    id: "内部ID", driverId: "ドライバーID", driverName: "ドライバー名",
    siteId: "現場ID", siteName: "現場名", days: "休み確定日",
    updatedAt: "更新日時", targetYearMonth: "対象月"
  },
  WorkLedger: {
    date: "勤務日", driverId: "ドライバーID", driverName: "ドライバー名",
    siteId: "現場ID", siteName: "現場名", unitPrice: "日当単価",
    attendanceStatus: "勤怠状態", startTime: "出勤時刻", endTime: "退勤時刻",
    calendarMark: "カレンダー表示", advanceStatus: "前払い状態",
    advanceIds: "前払いID", advanceRequestedAmount: "前払い希望額",
    advanceFee: "手数料", advanceTransferAmount: "振込予定額",
    advanceDateRange: "前払い対象", dailyReportStatus: "日報送信判定",
    dailyReportSentAt: "日報送信日時", source: "元データ", updatedAt: "更新日時"
  },
  AdminUsers: {
    id: "内部ID", username: "管理者名", pin: "4桁PIN", displayName: "表示名",
    role: "権限", active: "使用中", createdAt: "作成日時", updatedAt: "更新日時"
  },
  AdminLogins: {
    id: "内部ID", username: "管理者名", success: "ログイン成功",
    loggedAt: "ログイン日時", userAgent: "端末情報", language: "言語",
    screen: "画面サイズ", timeZone: "タイムゾーン", path: "アクセス画面"
  },
  DriverSessions: {
    token: "ログイントークン", driverId: "ドライバーID", driverName: "ドライバー名",
    createdAt: "作成日時", expiresAt: "有効期限", lastUsedAt: "最終利用日時",
    active: "使用中"
  },
  LineSources: {
    id: "内部ID", sourceType: "LINE種別", sourceId: "通知先ID",
    userId: "ユーザーID", groupId: "グループID", roomId: "ルームID",
    replyToken: "返信トークン", messageText: "受信メッセージ",
    timestamp: "LINE時刻", createdAt: "取得日時"
  },
  Assignments: {
    id: "内部ID", driverId: "ドライバーID", driverName: "ドライバー名",
    siteId: "現場ID", siteName: "異動先現場", effectiveFrom: "適用開始日",
    effectiveTo: "適用終了日", unitPrice: "適用単価", note: "備考", updatedAt: "更新日時"
  }
};

const POMS_HIDDEN_COLUMNS = {
  Drivers: ["id", "siteId", "contractType", "advanceFee", "displayName", "note", "createdAt", "updatedAt"],
  Sites: ["id", "sort", "updatedAt"],
  Attendance: ["id", "driverId", "siteId", "createdAt", "updatedAt"],
  Advance: ["id", "date", "driverId", "siteId", "count", "selectedDates", "amount", "tag", "note", "createdAt", "updatedAt"],
  WorkLedger: ["driverId", "siteId", "advanceIds", "source", "updatedAt"],
  AdminLogins: ["id", "userAgent", "language", "screen", "timeZone", "path"],
  DriverSessions: ["token", "driverId", "createdAt", "expiresAt", "lastUsedAt", "active"],
  LineSources: ["id", "userId", "groupId", "roomId", "replyToken", "timestamp"]
  ,Assignments: ["id", "driverId", "siteId", "updatedAt"]
  ,NotificationQueue: ["id", "payload", "error"]
};

const POMS_SHEET_ALIASES = {
  "ドライバー管理": ["Drivers"],
  "現場管理": ["Sites"],
  "退勤管理": ["出勤管理", "Attendance"],
  "前払い管理": ["Advance"],
  "休み希望管理": ["Holiday"],
  "休み確定日管理": ["FixedShift", "確定シフト管理"],
  "管理者管理": ["AdminUsers"],
  "管理者ログイン履歴": ["AdminLogins"],
  "システム_ログイン保持": ["DriverSessions"],
  "LINE取得履歴": ["LineSources"],
  "現場異動予約": ["Assignments"],
  "稼働台帳": ["WorkLedger"]
};

const POMS_SITE_DAILY_REPORT_NAMES = {
  "川口領家 Amazon": "Amazon 川口",
  "新宿上落合 Amazon": "Amazon新宿上落合",
  "町田Amazon": "Amazon町田",
  "町田 Amazon": "Amazon町田"
};

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("POMS管理")
      .addItem("初期設定 / 修復", "setupPomsOperationalRebuildNow")
      .addItem("修正を反映", "applyPomsOperationalManualCorrectionsNow")
      .addItem("管理カレンダー更新", "refreshPomsOperationalCalendarThisMonth")
      .addItem("前月カレンダー更新", "refreshPomsOperationalCalendarPreviousMonth")
      .addItem("稼働台帳を再作成", "rebuildPomsWorkLedgerThisMonth")
      .addItem("日報送信先を準備", "setupPomsAttendanceDestinationSettings")
      .addItem("日報送信先の重複を確認", "analyzePomsAttendanceDestinationDuplicatesNow")
      .addItem("今月の退勤を日報へ再送", "syncPomsOperationalDailyReportThisMonthToToday")
      .addItem("選択した済を未申請へ戻す", "markSelectedCalendarAdvanceAsUnappliedNow")
      .addItem("マスターデータ更新", "refreshPomsMasterDataSheet")
      .addItem("現場異動予約を準備", "setupPomsAssignmentsSheet")
      .addItem("前払いテンプレートを表示", "setupPomsAdvanceTemplateSheet")
      .addItem("自動反映を有効化", "setupPomsOperationalAutoReflectTrigger")
      .addItem("LINE/定期処理トリガー設定", "setupPomsLineTriggers")
      .addItem("今日の退勤漏れを補正", "autoFinishUnclosedAttendanceTodayNow")
      .addSeparator()
      .addItem("運用ガイド / 設定診断", "refreshPomsOperationsGuideNow")
      .addToUi();
  } catch (error) {
    Logger.log("onOpen menu skipped: " + error);
  }
}

function setupPomsBaseSheets() {
  return setupPomsOperationalRebuildNow();
}

function setupPomsOperationalRebuildNow() {
  return withPomsLock_("setupPomsOperationalRebuildNow", function() {
    ensureBaseSheets_();
    refreshPomsOperationsGuideNow();
    migrateLegacyMonthlySheets_();
    setupPomsAttendanceDestinationSettings();
    setupPomsAdvanceTemplateSheet();
    refreshPomsMasterDataSheet_(false);
    const ledger = rebuildPomsWorkLedger_(getMonthKey_(new Date()));
    const calendar = refreshPomsOperationalCalendar_(getMonthKey_(new Date()));
    const organizedCalendars = cleanupPomsDuplicateCalendarSheets_(calendar.sheet);
    const monthlyTrigger = setupPomsMonthlyRolloverTrigger();
    formatAllCoreSheets_();
    return {
      ok: true,
      version: POMS_VERSION,
      message: "POMS v2 の基本シート、稼働台帳、管理カレンダーを準備しました",
      ledger: ledger,
      calendar: calendar,
      organizedCalendars: organizedCalendars,
      monthlyTrigger: monthlyTrigger,
      warnings: getSetupWarnings_()
    };
  });
}

function doGet(e) {
  try {
    ensureBaseSheetsReady_();
    const params = e && e.parameter ? e.parameter : {};
    const type = String(params.type || "").trim();

    if (type === "dashboard") {
      requireAdmin_(params.adminToken);
      return json_({ ok: true, month: params.month || getMonthKey_(new Date()), data: getDashboard_(params.month || getMonthKey_(new Date())) });
    }
    if (type === "advance_calc") {
      requireDriver_(params.driverToken, params.driverId);
      return json_(calculateAdvance_(params));
    }
    if (type === "advance_calendar") {
      requireDriver_(params.driverToken, params.driverId);
      return json_(getAdvanceCalendar_(params));
    }
    if (type === "holiday_load") {
      requireDriver_(params.driverToken, params.driverId);
      return json_(loadHoliday_(params));
    }
    if (type === "driver_by_line") {
      return json_({ ok: false, error: "LINE自動ログインAPIを使用してください" });
    }
    if (type === "driver_by_id") {
      requireDriver_(params.driverToken, params.driverId);
      return json_(getDriverByIdPublic_(params.driverId));
    }
    if (type === "driver_attendance") {
      requireDriver_(params.driverToken, params.driverId);
      return json_(getDriverAttendance_(params.driverId, params.date || getBusinessDate_()));
    }
    return json_({ ok: true, version: POMS_VERSION, message: "POMS GAS API is running" });
  } catch (error) {
    return json_({ ok: false, error: errorMessage_(error) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e && e.postData && e.postData.contents ? e.postData.contents : "{}");
    if (Array.isArray(body.events)) {
      if (isLineWebhookVerify_(body)) return json_({ ok: true, verified: true });
      return json_(handleLineWebhook_(body));
    }

    ensureBaseSheetsReady_();
    const type = String(body.type || "").trim();

    if (type === "admin_auth") return json_(authenticateAdmin_(body));
    if (type === "admin_login") {
      requireAdmin_(body.adminToken);
      return json_(saveAdminLogin_(body));
    }
    if (type === "driver_auth") return json_(authenticateDriver_(body));
    if (type === "driver_line_auto_login") return json_(autoLoginDriverByLine_(body));

    if (type === "driver_session_check") {
      requireDriver_(body.driverToken, body.driverId);
      return json_(checkDriverSession_(body));
    }
    if (type === "driver_line_link") {
      requireDriver_(body.driverToken, body.driverId);
      return json_(linkDriverLine_(body));
    }
    if (type === "attendance") {
      if (body.action === "admin_fix") requireAdmin_(body.adminToken);
      else requireDriver_(body.driverToken, body.driverId);
      return json_(saveAttendance_(body));
    }
    if (type === "advance") {
      requireDriver_(body.driverToken, body.driverId);
      return json_(saveAdvance_(body));
    }
    if (type === "holiday_save") {
      if (body.driverToken) requireDriver_(body.driverToken, body.driverId);
      else requireAdmin_(body.adminToken);
      return json_(saveHoliday_(body));
    }
    if (type === "fixed_shift_save") {
      requireAdmin_(body.adminToken);
      return json_(saveFixedShift_(body));
    }
    if (type === "driver_upsert") {
      requireAdmin_(body.adminToken);
      return json_(upsertDriver_(body));
    }
    if (type === "driver_lifecycle") {
      requireAdmin_(body.adminToken);
      return json_(switchDriverLifecycle_(body));
    }
    if (type === "driver_line_reset") {
      requireAdmin_(body.adminToken);
      return json_(resetDriverLine_(body));
    }
    if (type === "attendance_clear") {
      requireAdmin_(body.adminToken);
      return json_(clearAttendance_(body));
    }
    if (type === "site_upsert") {
      requireAdmin_(body.adminToken);
      return json_(upsertSite_(body));
    }

    return json_({ ok: false, error: "Unknown type: " + type });
  } catch (error) {
    return json_({ ok: false, error: errorMessage_(error) });
  }
}

function onEdit(e) {
  if (getScriptProperty_("POMS_INSTALLABLE_ON_EDIT", "") === "1") return;
  handlePomsOperationalEdit(e);
}

function setupPomsOperationalAutoReflectTrigger() {
  const ss = getSpreadsheet_();
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "handlePomsOperationalEdit") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("handlePomsOperationalEdit").forSpreadsheet(ss).onEdit().create();
  setScriptProperty_("POMS_INSTALLABLE_ON_EDIT", "1");
  return {
    ok: true,
    message: "自動反映を有効化しました。simple onEdit は二重実行防止のため停止状態になります。"
  };
}

function handlePomsOperationalEdit(e) {
  try {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();
    if (sheetName === POMS_SHEETS.MasterData) {
      return handlePomsMasterDataEdit_(e);
    }
    if (sheetName === POMS_SHEETS.Assignments) {
      CacheService.getScriptCache().remove("poms:assignments");
      queuePomsOperationalRefresh_(getBusinessDate_());
      queuePomsOperationalRefresh_(getOffsetMonthKey_(1) + "-01");
      return { ok: true, queued: true };
    }
    if (isPomsOperationalCalendarSheet_(sheetName)) {
      if (isPomsCalendarDestinationRange_(e.range)) {
        return handlePomsCalendarDestinationEdit_(sheet);
      }
      return handlePomsOperationalCalendarEdit_(sheet, e.range);
    }
    const kind = getSheetKind_(sheetName);
    if (!kind) return;
    if (["Attendance", "Advance", "Drivers", "Sites", "FixedShift", "Holiday"].indexOf(kind) === -1) return;
    return withPomsLock_("handlePomsOperationalEdit", function() {
      const months = getEditedMonths_(sheet, e.range, kind);
      normalizeEditedSheet_(sheet);
      if (kind === "Drivers" || kind === "Sites") {
        refreshPomsMasterDataSheet_(false);
      }
      months.forEach(function(month) {
        queuePomsOperationalRefresh_(month + "-01");
      });
      const dailyReports = {};
      if (kind === "Attendance") {
        months.forEach(function(month) {
          try {
            dailyReports[month] = forceSyncPomsCheckoutToDailyReportUnsafe_(month);
          } catch (error) {
            dailyReports[month] = { ok: false, error: errorMessage_(error) };
            Logger.log("daily report sync skipped: " + month + " " + error);
          }
        });
      }
      return { ok: true, sheet: sheetName, kind: kind, months: months, dailyReports: dailyReports };
    });
  } catch (error) {
    Logger.log("handlePomsOperationalEdit failed: " + errorMessage_(error));
  }
}

function authenticateAdmin_(body) {
  const username = String(body.username || "").trim();
  enforceAuthRateLimit_("admin", username);
  const pin = normalizePin_(body.password || body.pin);
  const adminSheet = getOrCreateSheet_(POMS_SHEETS.AdminUsers, POMS_HEADERS.AdminUsers);
  const admins = readObjects_(adminSheet).filter(function(row) {
    return String(row.active || "true").toLowerCase() !== "false";
  });
  const success = admins.some(function(row) {
    return String(row.username || "").trim() === username && normalizePin_(row.pin) === pin;
  });
  saveAdminLogin_({
    id: body.id || makeId_("login"),
    username: username || "未入力",
    success: success,
    loggedAt: new Date().toISOString(),
    client: body.client || {}
  });
  if (!success) {
    recordAuthFailure_("admin", username);
    return { ok: false, error: "名前またはパスワードが違います" };
  }
  clearAuthFailures_("admin", username);
  const token = Utilities.getUuid() + "." + Utilities.getUuid();
  CacheService.getScriptCache().put("admin:" + token, username, POMS_SESSION.adminTtlSeconds);
  return { ok: true, token: token, username: username, expiresIn: POMS_SESSION.adminTtlSeconds };
}

function saveAdminLogin_(body) {
  const sheet = getOrCreateSheet_(POMS_SHEETS.AdminLogins, POMS_HEADERS.AdminLogins);
  const client = body.client || {};
  const row = normalizeRow_(POMS_HEADERS.AdminLogins, {
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

function requireAdmin_(token) {
  const value = token ? CacheService.getScriptCache().get("admin:" + token) : "";
  if (!value) throw new Error("管理者ログインが必要です。再ログインしてください。");
  return value;
}

function authRateKey_(kind, identity) {
  const key = String(identity || "unknown").trim().toLowerCase().replace(/[^a-z0-9_\-\u3000-\u9fff]/g, "_");
  return "auth-fail:" + kind + ":" + key.slice(0, 80);
}

function enforceAuthRateLimit_(kind, identity) {
  const count = Number(CacheService.getScriptCache().get(authRateKey_(kind, identity)) || 0);
  if (count >= 5) throw new Error("ログイン試行回数が上限に達しました。10分後に再度お試しください。");
}

function recordAuthFailure_(kind, identity) {
  const cache = CacheService.getScriptCache();
  const key = authRateKey_(kind, identity);
  cache.put(key, String(Number(cache.get(key) || 0) + 1), 600);
}

function clearAuthFailures_(kind, identity) {
  CacheService.getScriptCache().remove(authRateKey_(kind, identity));
}

function verifyLineAccessToken_(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) throw new Error("LINE認証情報がありません。名前とPINでログインしてください。");
  const response = UrlFetchApp.fetch("https://api.line.me/v2/profile", {
    method: "get",
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) throw new Error("LINE認証を確認できませんでした。名前とPINでログインしてください。");
  const profile = JSON.parse(response.getContentText() || "{}");
  if (!profile.userId) throw new Error("LINEユーザーを確認できませんでした。");
  return profile;
}

function authenticateDriver_(body) {
  const name = String(body.name || body.driverName || "").trim();
  enforceAuthRateLimit_("driver", name || body.driverId);
  const driverId = String(body.driverId || "").trim();
  const pin = normalizePin_(body.password || body.pin);
  const rows = readObjects_(getOrCreateSheet_(POMS_SHEETS.Drivers, POMS_HEADERS.Drivers));
  let driver = rows.find(function(row) {
    if (String(row.lifecycle || "active") === "inactive") return false;
    const idMatch = driverId ? String(row.id || "") === driverId : true;
    const nameMatch = name ? pomsCompare_(row.name) === pomsCompare_(name) || pomsCompare_(row.displayName) === pomsCompare_(name) : true;
    return idMatch && nameMatch && normalizePin_(row.pin) === pin;
  });
  if (!driver && driverId) {
    driver = rows.find(function(row) {
      if (String(row.lifecycle || "active") === "inactive") return false;
      const nameMatch = name ? pomsCompare_(row.name) === pomsCompare_(name) || pomsCompare_(row.displayName) === pomsCompare_(name) : true;
      return nameMatch && normalizePin_(row.pin) === pin;
    });
  }
  if (!driver) {
    recordAuthFailure_("driver", name || driverId);
    return { ok: false, error: "名前または4桁PINが違います" };
  }
  clearAuthFailures_("driver", name || driverId);
  const lineUserId = String(body.lineUserId || "").trim();
  const lineDisplayName = String(body.lineDisplayName || "").trim();
  if (lineUserId) driver = updateDriverLine_(driver.id, lineUserId, lineDisplayName);
  const token = Utilities.getUuid() + "." + Utilities.getUuid();
  saveDriverSession_(driver, token);
  CacheService.getScriptCache().put("driver:" + token, driver.id, POMS_SESSION.adminTtlSeconds);
  return { ok: true, token: token, driver: privateDriver_(driver), expiresIn: POMS_SESSION.driverTtlSeconds };
}

function autoLoginDriverByLine_(body) {
  const verifiedProfile = verifyLineAccessToken_(body.lineAccessToken);
  const lineUserId = String(verifiedProfile.userId || "").trim();
  if (!lineUserId) return { ok: true, found: false, reason: "lineUserId is empty" };
  const requestedDriverId = String(body.driverId || "").trim();
  const rows = readObjects_(getOrCreateSheet_(POMS_SHEETS.Drivers, POMS_HEADERS.Drivers));
  const driver = rows.find(function(row) {
    const active = String(row.lifecycle || "active") !== "inactive";
    const lineMatch = String(row.lineUserId || "").trim() === lineUserId;
    const idMatch = requestedDriverId ? String(row.id || "") === requestedDriverId : true;
    return active && lineMatch && idMatch;
  });
  if (!driver) return { ok: true, found: false, reason: "driver is not linked to this LINE" };
  const token = Utilities.getUuid() + "." + Utilities.getUuid();
  saveDriverSession_(driver, token);
  CacheService.getScriptCache().put("driver:" + token, driver.id, POMS_SESSION.adminTtlSeconds);
  return { ok: true, found: true, token: token, driver: privateDriver_(driver), expiresIn: POMS_SESSION.driverTtlSeconds };
}

function requireDriver_(token, driverId) {
  const cached = token ? CacheService.getScriptCache().get("driver:" + token) : "";
  if (cached && String(cached) === String(driverId || "")) {
    touchDriverSession_(token);
    return cached;
  }
  const sessionDriverId = getDriverSessionDriverId_(token);
  if (!sessionDriverId || String(sessionDriverId) !== String(driverId || "")) {
    throw new Error("ドライバーログインが必要です。再ログインしてください。");
  }
  CacheService.getScriptCache().put("driver:" + token, sessionDriverId, POMS_SESSION.adminTtlSeconds);
  touchDriverSession_(token);
  return sessionDriverId;
}

function checkDriverSession_(body) {
  const driver = getDriverById_(body.driverId);
  if (!driver) throw new Error("ドライバーが見つかりません");
  const lineUserId = String(body.lineUserId || "").trim();
  const storedLineId = String(driver.lineUserId || "").trim();
  if (lineUserId && storedLineId && storedLineId !== lineUserId) {
    throw new Error("このLINEは別のドライバーとして登録されています。管理者に確認してください。");
  }
  return { ok: true, driver: privateDriver_(driver) };
}

function saveDriverSession_(driver, token) {
  const sheet = getOrCreateSheet_(POMS_SHEETS.DriverSessions, POMS_HEADERS.DriverSessions);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + POMS_SESSION.driverTtlSeconds * 1000);
  const row = normalizeRow_(POMS_HEADERS.DriverSessions, {
    token: token,
    driverId: driver.id,
    driverName: driver.name || "",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastUsedAt: now.toISOString(),
    active: true
  });
  upsertByKeys_(sheet, POMS_HEADERS.DriverSessions, row, ["token"]);
  return row;
}

function getDriverSessionDriverId_(token) {
  if (!token) return "";
  const now = new Date().toISOString();
  const rows = readObjects_(getOrCreateSheet_(POMS_SHEETS.DriverSessions, POMS_HEADERS.DriverSessions));
  const row = rows.find(function(item) {
    return item.token === token && String(item.active || "true").toLowerCase() !== "false" && String(item.expiresAt || "") > now;
  });
  return row ? row.driverId : "";
}

function touchDriverSession_(token) {
  if (!token) return;
  const cache = CacheService.getScriptCache();
  const touchKey = "driver-touch:" + token;
  if (cache.get(touchKey)) return;
  const sheet = getOrCreateSheet_(POMS_SHEETS.DriverSessions, POMS_HEADERS.DriverSessions);
  const rows = readObjects_(sheet);
  const index = rows.findIndex(function(row) { return row.token === token; });
  if (index >= 0) {
    setCellByHeader_(sheet, index + 2, "lastUsedAt", new Date().toISOString());
    cache.put(touchKey, "1", 21600);
  }
}

function linkDriverLine_(body) {
  const driver = updateDriverLine_(body.driverId, body.lineUserId, body.lineDisplayName || "");
  return { ok: true, driver: privateDriver_(driver) };
}

function updateDriverLine_(driverId, lineUserId, lineDisplayName) {
  const lineId = String(lineUserId || "").trim();
  if (!driverId || !lineId) throw new Error("LINE連携情報が不足しています");
  const sheet = getOrCreateSheet_(POMS_SHEETS.Drivers, POMS_HEADERS.Drivers);
  const rows = readObjects_(sheet);
  const driverIndex = rows.findIndex(function(row) { return String(row.id || "") === String(driverId); });
  if (driverIndex < 0) throw new Error("ドライバーが見つかりません");
  const duplicated = rows.some(function(row) {
    return String(row.id || "") !== String(driverId) && String(row.lineUserId || "").trim() === lineId;
  });
  if (duplicated) throw new Error("このLINEは別のドライバーに連携済みです。管理者に確認してください。");
  const stored = String(rows[driverIndex].lineUserId || "").trim();
  if (stored && stored !== lineId) throw new Error("このドライバーは別のLINEと連携済みです。管理者に確認してください。");
  setCellByHeader_(sheet, driverIndex + 2, "lineUserId", lineId);
  if (lineDisplayName) setCellByHeader_(sheet, driverIndex + 2, "displayName", lineDisplayName);
  setCellByHeader_(sheet, driverIndex + 2, "updatedAt", new Date().toISOString());
  return getDriverById_(driverId);
}

function resetDriverLine_(body) {
  const driverId = String(body.driverId || "").trim();
  if (!driverId) throw new Error("ドライバーIDがありません");
  clearDriverLine_(driverId);
  clearDriverSessions_(driverId);
  return { ok: true, driverId: driverId };
}

function clearDriverLine_(driverId) {
  const sheet = getOrCreateSheet_(POMS_SHEETS.Drivers, POMS_HEADERS.Drivers);
  const rows = readObjects_(sheet);
  const index = rows.findIndex(function(row) { return String(row.id || "") === String(driverId); });
  if (index < 0) throw new Error("ドライバーが見つかりません");
  setCellByHeader_(sheet, index + 2, "lineUserId", "");
  setCellByHeader_(sheet, index + 2, "updatedAt", new Date().toISOString());
}

function clearDriverSessions_(driverId) {
  const sheet = getOrCreateSheet_(POMS_SHEETS.DriverSessions, POMS_HEADERS.DriverSessions);
  const rows = readObjects_(sheet);
  rows.forEach(function(row, index) {
    if (String(row.driverId || "") === String(driverId || "")) {
      setCellByHeader_(sheet, index + 2, "active", false);
    }
  });
}

function saveAttendance_(body) {
  return withPomsLock_("saveAttendance", function() {
    const now = new Date().toISOString();
    const isAdminFix = String(body.action || "") === "admin_fix";
    let driver = getDriverById_(body.driverId) || {};
    if (!driver.id) throw new Error("ドライバーが見つかりません");
    const requestedAction = String(body.action || "").toLowerCase();
    if (!isAdminFix && ["start", "end"].indexOf(requestedAction) === -1) throw new Error("出勤または退勤を指定してください");
    const status = isAdminFix ? normalizeAttendanceStatusFromBody_(body) : (requestedAction === "end" ? "finished" : "working");
    const date = isAdminFix ? getAttendanceDateForBody_(body, status) : getBusinessDate_();
    if (!isAdminFix) driver = resolveDriverForDate_(driver, date);
    const sheet = getOrCreateSheet_(POMS_SHEETS.Attendance, POMS_HEADERS.Attendance);
    const existing = findAttendanceRow_(sheet, date, body.driverId || driver.id);
    const currentTime = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "HH:mm");
    const startTime = (isAdminFix ? normalizeTimeValue_(body.startTime || "") : "") ||
      (existing ? existing.row.startTime : "") ||
      (isWorkingStatus_(status) || isFinishedStatus_(status) ? currentTime : "");
    const endTime = isFinishedStatus_(status)
      ? ((isAdminFix ? normalizeTimeValue_(body.endTime || body.time || body.checkoutTime || "") : "") || currentTime)
      : "";
    const row = normalizeRow_(POMS_HEADERS.Attendance, {
      id: body.id || (existing ? existing.row.id : "") || makeId_("att"),
      date: date,
      driverId: driver.id,
      driverName: driver.name || "",
      siteId: isAdminFix && body.siteId ? body.siteId : (driver.siteId || ""),
      siteName: isAdminFix && body.siteName ? body.siteName : (driver.siteName || ""),
      status: status,
      startTime: startTime,
      endTime: endTime,
      note: body.note || (existing ? existing.row.note : "") || "",
      createdAt: (existing ? existing.row.createdAt : "") || now,
      updatedAt: now,
      workType: isAdminFix ? (body.workType || (existing ? existing.row.workType : "") || "normal") : "normal"
    });
    if (!row.driverId) throw new Error("ドライバーIDがありません");
    if (!row.driverName) throw new Error("ドライバー名がありません");
    if (existing) {
      writeRowByHeaders_(sheet, existing.rowNumber, POMS_HEADERS.Attendance, row);
    } else {
      appendRow_(sheet, row);
    }
    let dailyReport = { ok: false, skipped: true };
    if (isFinishedStatus_(row.status)) dailyReport = safeAppendAttendanceDestinationRow_(row);
    if (POMS_LINE_POLICY.adminAttendance) notifyAdminLine_("attendance", row);
    if (POMS_LINE_POLICY.adminAllClockedOutSummary && isFinishedStatus_(row.status)) notifyAdminAllClockedOutSummary_(row.date);
    refreshPomsOperationalOutputsAfterChange_(row.date);
    return { ok: true, saved: "attendance", sheet: sheet.getName(), row: row, dailyReport: dailyReport, updatedAt: now };
  });
}

function normalizeAttendanceStatusFromBody_(body) {
  const rawStatus = String(body && body.status || "").trim();
  const action = String(body && body.action || "").trim().toLowerCase();
  if (["end", "checkout", "clockout", "clock_out", "finish", "finished", "退勤", "退勤済み"].indexOf(action) !== -1) return "finished";
  if (["off", "rest", "holiday", "休み", "休"].indexOf(action) !== -1) return "off";
  if (["start", "checkin", "clockin", "clock_in", "work", "working", "出勤", "出勤中"].indexOf(action) !== -1) return "working";
  const hasCheckoutTime = Boolean(normalizeTimeValue_(body && (body.endTime || body.checkoutTime) || ""));
  const normalized = normalizeStatus_(rawStatus);
  if (hasCheckoutTime && (!rawStatus || !isOffStatus_(normalized))) return "finished";
  if (rawStatus && normalized) return normalized;
  if (normalizeTimeValue_(body && (body.endTime || body.checkoutTime) || "")) return "finished";
  return "working";
}

function getAttendanceDateForBody_(body, status) {
  const requestedDate = normalizeDateKey_(body && body.date || "");
  if (!isFinishedStatus_(status)) return requestedDate || getBusinessDate_();
  const businessDate = getBusinessDate_();
  if (!requestedDate) return businessDate;
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  if (isBeforePomsBusinessDateCutoff_() && requestedDate === today) return businessDate;
  return requestedDate;
}

function clearAttendance_(body) {
  return withPomsLock_("clearAttendance", function() {
    const date = normalizeDateKey_(body.date || getBusinessDate_());
    const driverId = String(body.driverId || "").trim();
    if (!driverId) throw new Error("ドライバーIDがありません");
    const sheet = getOrCreateSheet_(POMS_SHEETS.Attendance, POMS_HEADERS.Attendance);
    const rows = readObjects_(sheet);
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      if (normalizeDateKey_(rows[index].date) === date && String(rows[index].driverId || "") === driverId) {
        sheet.deleteRow(index + 2);
      }
    }
    refreshPomsOperationalOutputsAfterChange_(date);
    return { ok: true, cleared: "attendance", driverId: driverId, date: date };
  });
}

function saveAdvance_(body) {
  return withPomsLock_("saveAdvance", function() {
    const now = new Date().toISOString();
    let driver = getDriverById_(body.driverId) || {};
    if (!driver.id) throw new Error("ドライバーが見つかりません");
    const baseDate = normalizeDateKey_(body.date || body.dateFrom || getBusinessDate_());
    let dateFrom = normalizeDateKey_(body.dateFrom || baseDate);
    let dateTo = normalizeDateKey_(body.dateTo || dateFrom);
    const requestedDates = normalizeAdvanceSelectedDates_(body.selectedDates || body.selectedAvailableDates || body.workedDates || "", dateFrom);
    if (requestedDates.length) {
      dateFrom = requestedDates[0];
      dateTo = requestedDates[requestedDates.length - 1];
    }
    const rangeWorkedDates = getWorkedDates_(driver.id, dateFrom, dateTo);
    const workedDates = requestedDates.length
      ? requestedDates.filter(function(date) { return rangeWorkedDates.indexOf(date) !== -1; })
      : rangeWorkedDates;
    if (requestedDates.length && workedDates.length !== requestedDates.length) {
      return { ok: false, error: "日報が未登録の稼働日が含まれています。日報登録後に再申請してください。", requestedDates: requestedDates, workedDates: workedDates };
    }
    if (!workedDates.length) {
      return { ok: false, error: "申請できる稼働日がありません。退勤済みの日報を確認してください。", dateFrom: dateFrom, dateTo: dateTo, workedDates: [] };
    }
    const effectiveDrivers = workedDates.map(function(workedDate) { return resolveDriverForDate_(driver, workedDate); });
    const assignmentKeys = uniqueText_(effectiveDrivers.map(function(item) {
      return [item.siteId || item.siteName || "", pomsNumber_(item.unitPrice)].join("|");
    }));
    if (assignmentKeys.length > 1) {
      return { ok: false, error: "現場または単価が異なる稼働日が含まれています。異動前と異動後を分けて申請してください。" };
    }
    driver = effectiveDrivers[0] || driver;
    const overlap = findOverlappingAdvance_(driver.id, dateFrom, dateTo, workedDates);
    if (overlap) return { ok: false, error: "申請済みの稼働日が含まれています", overlap: overlap };
    const unitPrice = pomsNumber_(driver.unitPrice);
    if (unitPrice <= 0) return { ok: false, error: "日当単価が未設定のため、前払い申請できません。", driverId: driver.id, driverName: driver.name || "" };
    const safety = calculateSafeAdvanceRequest_(body, driver, workedDates, unitPrice);
    const sheet = getOrCreateSheet_(POMS_SHEETS.Advance, POMS_HEADERS.Advance);
    if (!safety.ok && isAdvanceBlockedSafety_(safety)) {
      const blockedRow = buildAdvanceSafetyAuditRow_(body, driver, baseDate, dateFrom, dateTo, workedDates, unitPrice, safety, now);
      appendRow_(sheet, blockedRow);
      applyPomsAdvanceSafetyFormatting_(sheet);
      queuePomsLineNotification_("admin:advance_blocked", blockedRow);
      refreshPomsOperationalOutputsAfterChange_(dateFrom);
      return Object.assign({ savedAudit: true, sheet: sheet.getName() }, safety);
    }
    if (!safety.ok) return safety;
    const row = normalizeRow_(POMS_HEADERS.Advance, {
      id: body.id || makeId_("adv"),
      date: baseDate,
      dateFrom: dateFrom,
      dateTo: dateTo,
      driverId: driver.id,
      driverName: driver.name || "",
      siteId: driver.siteId || "",
      siteName: driver.siteName || "",
      count: Number(body.count || 1),
      workedDays: workedDates.length,
      selectedDates: workedDates.join(","),
      unitPrice: unitPrice,
      salesAmount: safety.salesAmount,
      requestedAmount: safety.requestedAmount,
      fee: safety.fee,
      transferAmount: safety.transferAmount,
      amount: safety.requestedAmount,
      tag: body.tag || "",
      note: body.note || "",
      bankName: driver.bankName || "",
      branchName: driver.branchName || "",
      accountNumber: driver.accountNumber || "",
      accountHolder: driver.accountHolder || "",
      createdAt: now,
      updatedAt: now,
      companyAdvanceBalance: safety.companyAdvanceBalance,
      alreadyAdvancedThisMonth: safety.alreadyAdvancedThisMonth,
      advanceLimitRate: safety.advanceLimitRate,
      maxAdvanceAmount: safety.maxAdvanceAmount,
      advanceFeeRate: safety.advanceFeeRate,
      transferFee: safety.transferFee,
      safetyCheckResult: safety.safetyCheckResult
    });
    appendRow_(sheet, row);
    applyPomsAdvanceSafetyFormatting_(sheet);
    if (POMS_LINE_POLICY.adminAdvance) queuePomsLineNotification_("admin:advance", row);
    if (POMS_LINE_POLICY.driverAdvance) queuePomsLineNotification_("driver:advance_submitted", row);
    refreshPomsOperationalOutputsAfterChange_(row.dateFrom || row.date);
    return { ok: true, saved: "advance", sheet: sheet.getName(), row: row, safety: safety, warning: safety.webWarningMessage || "", updatedAt: now };
  });
}

function calculateSafeAdvanceRequest_(body, driver, workedDates, unitPrice) {
  driver = driver || {};
  const driverId = String(body.driverId || driver.id || "").trim();
  if (pomsBoolean_(driver.advanceStopped, false)) {
    return { ok: false, error: "前払い停止中のため申請できません。", driverId: driverId, driverName: driver.name || "" };
  }
  const selectedWorkedDays = (workedDates || []).length;
  if (selectedWorkedDays <= 0) return { ok: false, error: "実働日数が0日のため申請できません。" };
  const selectedSalesAmount = pomsNumber_(unitPrice) * selectedWorkedDays;
  const baseDate = normalizeDateKey_(body.dateTo || body.dateFrom || body.date || getBusinessDate_());
  const month = normalizeMonthKey_(baseDate || getBusinessDate_());
  const cumulativeWorkedDates = getWorkedDates_(driverId, month + "-01", baseDate);
  const cumulativeWorkedDays = Math.max(cumulativeWorkedDates.length, selectedWorkedDays);
  const cumulativeSalesAmount = pomsNumber_(unitPrice) * cumulativeWorkedDays;
  const advanceLimitRate = normalizePomsRate_(driver.advanceLimitRate, 50);
  const companyAdvanceBalance = pomsNumber_(driver.companyAdvanceBalance);
  const alreadyAdvancedThisMonth = getAlreadyAdvancedThisMonth_(driverId, baseDate);
  const advanceLimitAmount = Math.floor(cumulativeSalesAmount * advanceLimitRate / 100);
  const payrollSafeAdvanceLimit = Math.max(cumulativeSalesAmount - companyAdvanceBalance, 0);
  const allowedAdvanceTotal = Math.min(advanceLimitAmount, payrollSafeAdvanceLimit);
  const maxAdvanceAmount = Math.max(allowedAdvanceTotal - alreadyAdvancedThisMonth, 0);
  const requestedRaw = body.requestedAmount !== undefined && body.requestedAmount !== "" ? body.requestedAmount :
    (body.amount !== undefined && body.amount !== "" ? body.amount : maxAdvanceAmount);
  const requestedAmount = pomsNumber_(requestedRaw);
  const payrollEstimateAfterRequest = cumulativeSalesAmount - alreadyAdvancedThisMonth - requestedAmount - companyAdvanceBalance;
  const remainingAfterRequest = maxAdvanceAmount - requestedAmount;
  if (maxAdvanceAmount <= 0) {
    return {
      ok: false, error: "前払い可能額が0円以下のため申請できません。",
      safetyCheckResult: "回収不足", requestedAmount: requestedAmount, maxAdvanceAmount: maxAdvanceAmount,
      salesAmount: selectedSalesAmount, cumulativeSalesAmount: cumulativeSalesAmount,
      companyAdvanceBalance: companyAdvanceBalance, alreadyAdvancedThisMonth: alreadyAdvancedThisMonth,
      advanceLimitRate: advanceLimitRate, payrollEstimateAfterRequest: payrollEstimateAfterRequest
    };
  }
  if (requestedAmount <= 0) return { ok: false, error: "前払い希望額が0円のため申請できません。", maxAdvanceAmount: maxAdvanceAmount };
  if (requestedAmount > maxAdvanceAmount) {
    return {
      ok: false, error: "前払い希望額が前払い可能額を超えています。",
      safetyCheckResult: "回収不足", requestedAmount: requestedAmount, maxAdvanceAmount: maxAdvanceAmount,
      salesAmount: selectedSalesAmount, cumulativeSalesAmount: cumulativeSalesAmount,
      companyAdvanceBalance: companyAdvanceBalance, alreadyAdvancedThisMonth: alreadyAdvancedThisMonth,
      advanceLimitRate: advanceLimitRate, payrollEstimateAfterRequest: payrollEstimateAfterRequest
    };
  }
  const feeConfig = getPomsOperationalAdvanceFeeConfig_(driver.siteId || driver.siteName);
  const fee = calculateAdvanceFee_(requestedAmount, driver.siteId || driver.siteName);
  return {
    ok: true,
    salesAmount: selectedSalesAmount,
    cumulativeSalesAmount: cumulativeSalesAmount,
    cumulativeWorkedDays: cumulativeWorkedDays,
    requestedAmount: requestedAmount,
    fee: fee,
    transferAmount: Math.max(requestedAmount - fee, 0),
    companyAdvanceBalance: companyAdvanceBalance,
    alreadyAdvancedThisMonth: alreadyAdvancedThisMonth,
    advanceLimitRate: advanceLimitRate,
    advanceLimitAmount: advanceLimitAmount,
    payrollSafeAdvanceLimit: payrollSafeAdvanceLimit,
    maxAdvanceAmount: maxAdvanceAmount,
    payrollEstimateAfterRequest: payrollEstimateAfterRequest,
    remainingAdvanceCapacity: remainingAfterRequest,
    advanceFeeRate: feeConfig.percent,
    transferFee: feeConfig.fixed,
    safetyCheckResult: payrollEstimateAfterRequest < 10000 ? "建替注意" : "OK",
    webWarningMessage: payrollEstimateAfterRequest < 10000 ? "月末振込見込みが1万円未満です。管理者確認が入る場合があります。" : ""
  };
}

function buildAdvanceSafetyAuditRow_(body, driver, date, dateFrom, dateTo, workedDates, unitPrice, safety, now) {
  return normalizeRow_(POMS_HEADERS.Advance, {
    id: body.id || makeId_("adv_blocked"),
    date: date,
    dateFrom: dateFrom,
    dateTo: dateTo,
    driverId: body.driverId || driver.id || "",
    driverName: body.driverName || driver.name || "",
    siteId: body.siteId || driver.siteId || "",
    siteName: body.siteName || driver.siteName || "",
    count: Number(body.count || 1),
    workedDays: (workedDates || []).length,
    selectedDates: (workedDates || []).join(","),
    unitPrice: unitPrice,
    salesAmount: safety.salesAmount || 0,
    requestedAmount: safety.requestedAmount || pomsNumber_(body.requestedAmount || body.amount),
    fee: 0,
    transferAmount: 0,
    amount: safety.requestedAmount || pomsNumber_(body.requestedAmount || body.amount),
    companyAdvanceBalance: safety.companyAdvanceBalance || 0,
    alreadyAdvancedThisMonth: safety.alreadyAdvancedThisMonth || 0,
    advanceLimitRate: safety.advanceLimitRate || "",
    maxAdvanceAmount: safety.maxAdvanceAmount || 0,
    safetyCheckResult: safety.safetyCheckResult || "回収不足",
    tag: "blocked",
    note: safety.webMessage || safety.error || "前払い申請ブロック",
    bankName: driver.bankName || "",
    branchName: driver.branchName || "",
    accountNumber: driver.accountNumber || "",
    accountHolder: driver.accountHolder || "",
    createdAt: body.createdAt || now,
    updatedAt: now
  });
}

function calculateAdvance_(params) {
  const driver = getDriverById_(params.driverId) || {};
  const month = normalizeMonthKey_(params.month || params.dateFrom || getBusinessDate_());
  let dateFrom = normalizeDateKey_(params.dateFrom || (month + "-01"));
  let dateTo = normalizeDateKey_(params.dateTo || getMonthEndDate_(month));
  const requestedDates = normalizeAdvanceSelectedDates_(params.selectedDates || params.selectedAvailableDates || params.workedDates || "", dateFrom);
  if (requestedDates.length) {
    dateFrom = requestedDates[0];
    dateTo = requestedDates[requestedDates.length - 1];
  }
  const rangeWorkedDates = getWorkedDates_(params.driverId, dateFrom, dateTo);
  const workedDates = requestedDates.length
    ? requestedDates.filter(function(date) { return rangeWorkedDates.indexOf(date) !== -1; })
    : rangeWorkedDates;
  const appliedDates = getAppliedAdvanceDates_(params.driverId, dateFrom, dateTo);
  const availableDates = workedDates.filter(function(date) { return appliedDates.indexOf(date) === -1; });
  const safety = calculateSafeAdvanceRequest_({
    driverId: params.driverId,
    date: dateFrom,
    dateFrom: dateFrom,
    dateTo: dateTo,
    requestedAmount: params.requestedAmount !== undefined ? params.requestedAmount : params.amount
  }, driver, availableDates, pomsNumber_(driver.unitPrice));
  return {
    ok: true,
    driverId: params.driverId,
    dateFrom: dateFrom,
    dateTo: dateTo,
    workedDays: availableDates.length,
    workedDates: workedDates,
    requestedDates: requestedDates,
    missingDates: requestedDates.filter(function(date) { return rangeWorkedDates.indexOf(date) === -1; }),
    appliedDates: appliedDates,
    availableDates: availableDates,
    unappliedDates: availableDates,
    unsubmittedDates: availableDates,
    unitPrice: pomsNumber_(driver.unitPrice),
    salesAmount: safety.salesAmount || (pomsNumber_(driver.unitPrice) * availableDates.length),
    requestedAmount: safety.requestedAmount || 0,
    fee: safety.fee || 0,
    transferAmount: safety.transferAmount || 0,
    safety: safety,
    hasOverlap: Boolean(findOverlappingAdvance_(params.driverId, dateFrom, dateTo, workedDates)),
    overlap: findOverlappingAdvance_(params.driverId, dateFrom, dateTo, workedDates),
    advances: getDriverAdvances_(params.driverId, month)
  };
}

function getAdvanceCalendar_(params) {
  const month = normalizeMonthKey_(params.month || getMonthKey_(new Date()));
  const driverId = String(params.driverId || "").trim();
  const dateFrom = normalizeDateKey_(params.dateFrom || (month + "-01"));
  const dateTo = normalizeDateKey_(params.dateTo || getMonthEndDate_(month));
  const uniqueWorkedDates = getWorkedDates_(driverId, month + "-01", getMonthEndDate_(month));
  const appliedDates = getAppliedAdvanceDates_(driverId, month + "-01", getMonthEndDate_(month));
  const availableDates = uniqueWorkedDates.filter(function(date) { return appliedDates.indexOf(date) === -1; });
  const selectedWorkedDates = uniqueWorkedDates.filter(function(date) {
    const start = dateFrom <= dateTo ? dateFrom : dateTo;
    const end = dateFrom <= dateTo ? dateTo : dateFrom;
    return date >= start && date <= end;
  });
  const selectedAvailableDates = selectedWorkedDates.filter(function(date) { return appliedDates.indexOf(date) === -1; });
  return {
    ok: true,
    driverId: driverId,
    month: month,
    workedDates: availableDates,
    actualWorkedDates: uniqueWorkedDates,
    appliedDates: appliedDates,
    availableDates: availableDates,
    unappliedDates: availableDates,
    unsubmittedDates: availableDates,
    dateFrom: dateFrom,
    dateTo: dateTo,
    selectedWorkedDates: selectedWorkedDates,
    selectedAvailableDates: selectedAvailableDates,
    selectedWorkedDays: selectedAvailableDates.length,
    advances: getDriverAdvances_(driverId, month)
  };
}

function getWorkedDates_(driverId, dateFrom, dateTo) {
  const start = normalizeDateKey_(dateFrom);
  const end = normalizeDateKey_(dateTo || dateFrom);
  if (!driverId || !start || !end) return [];
  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  const driver = getDriverById_(driverId) || {};
  const map = {};
  getMonthsBetween_(from, to).forEach(function(month) {
    readMonthRows_("Attendance", month).forEach(function(row) {
      const date = normalizeDateKey_(row.date);
      const matches = String(row.driverId || "") === String(driverId) ||
        (driver.name && pomsCompare_(row.driverName) === pomsCompare_(driver.name));
      if (matches && date >= from && date <= to && isAdvanceEligibleAttendanceRow_(row)) map[date] = true;
    });
  });
  return Object.keys(map).sort();
}

function getAppliedAdvanceDates_(driverId, dateFrom, dateTo) {
  const start = normalizeDateKey_(dateFrom);
  const end = normalizeDateKey_(dateTo || dateFrom);
  if (!driverId || !start || !end) return [];
  const from = start <= end ? start : end;
  const to = start <= end ? end : start;
  const driver = getDriverById_(driverId) || {};
  const applied = {};
  getMonthsBetween_(from, to).forEach(function(month) {
    readMonthRows_("Advance", month).forEach(function(row) {
      const matches = String(row.driverId || "") === String(driverId) ||
        (driver.name && pomsCompare_(row.driverName) === pomsCompare_(driver.name));
      if (!matches || !isPomsOperationalPaidAdvanceRow_(row)) return;
      getAdvanceRowWorkedDates_(driverId, row).forEach(function(date) {
        if (date >= from && date <= to) applied[date] = true;
      });
    });
  });
  return Object.keys(applied).sort();
}

function findOverlappingAdvance_(driverId, dateFrom, dateTo, targetWorkedDates) {
  const requestedDates = uniqueDates_(targetWorkedDates || getWorkedDates_(driverId, dateFrom, dateTo));
  if (!requestedDates.length) return null;
  const requestedMap = {};
  requestedDates.forEach(function(date) { requestedMap[date] = true; });
  const rows = [];
  getMonthsBetween_(dateFrom, dateTo).forEach(function(month) {
    rows.push.apply(rows, readMonthRows_("Advance", month));
  });
  return rows.find(function(row) {
    if (String(row.driverId || "") !== String(driverId || "")) return false;
    if (!isPomsOperationalPaidAdvanceRow_(row)) return false;
    const appliedDates = getAdvanceRowWorkedDates_(driverId, row);
    return appliedDates.some(function(date) { return requestedMap[date]; });
  }) || null;
}

function getDriverAdvances_(driverId, month) {
  if (!driverId) return [];
  const targetMonth = normalizeMonthKey_(month || getMonthKey_(new Date()));
  return readMonthRows_("Advance", targetMonth).filter(function(row) {
    return String(row.driverId || "") === String(driverId || "") && isPomsOperationalPaidAdvanceRow_(row);
  }).sort(function(a, b) {
    return String(b.dateFrom || b.date || "").localeCompare(String(a.dateFrom || a.date || ""));
  });
}

function getAlreadyAdvancedThisMonth_(driverId, dateValue) {
  const month = normalizeMonthKey_(dateValue || getBusinessDate_());
  return readMonthRows_("Advance", month).filter(function(row) {
    return String(row.driverId || "") === String(driverId || "") && isPomsOperationalPaidAdvanceRow_(row);
  }).reduce(function(total, row) {
    return total + pomsNumber_(row.requestedAmount || row.amount);
  }, 0);
}

function appendAttendanceDestinationRow_(row) {
  if (!isFinishedStatus_(row.status) && String(row.attendanceStatus || "") !== "退勤済み") {
    return { ok: false, skipped: true, reason: "only checkout is sent" };
  }
  if (!isAttendanceDestinationReadyForDate_(row.date)) {
    return { ok: false, skipped: true, reason: "attendance destination is empty" };
  }
  const sheet = getAttendanceDestinationSheetForDate_(row.date);
  const result = upsertAttendanceDestinationRow_(sheet, row, new Date());
  result.destination = getAttendanceDestinationConfigForDate_(row.date);
  return result;
}

function safeAppendAttendanceDestinationRow_(row) {
  try {
    return appendAttendanceDestinationRow_(row);
  } catch (error) {
    const result = {
      ok: false,
      error: errorMessage_(error),
      date: normalizeDateKey_(row && row.date),
      driverName: row && row.driverName || ""
    };
    try { Logger.log("attendance destination failed: " + JSON.stringify(result)); } catch (logError) {}
    return result;
  }
}

function upsertAttendanceDestinationRow_(sheet, row, now) {
  const timestamp = buildAttendanceDestinationTimestamp_(row, now);
  const targetDate = normalizeDateKey_(row.date);
  const targetDriverName = normalizeDestinationDriverName_(row.driverName || "");
  const targetDriver = pomsCompare_(targetDriverName);
  const targetValues = [
    timestamp,
    targetDriverName,
    formatSlashDateFull_(targetDate),
    formatAttendanceDestinationSiteName_(row.siteName || "")
  ];
  const values = sheet.getDataRange().getValues();
  const matches = [];
  for (let index = 1; index < values.length; index += 1) {
    const sameDriver = pomsCompare_(values[index][1]) === targetDriver;
    const sameDate = normalizeDateKey_(values[index][2]) === targetDate;
    if (sameDriver && sameDate) {
      matches.push(index + 1);
    }
  }
  let rowNumber = matches.length ? chooseAttendanceDestinationKeepRow_(values, matches) : 0;
  const duplicateMatches = Math.max(matches.length - 1, 0);
  if (rowNumber) {
    const current = sheet.getRange(rowNumber, 1, 1, targetValues.length).getValues()[0];
    const same = targetValues.every(function(value, index) {
      if (index === 0) return true;
      return String(current[index] || "") === String(value || "");
    });
    if (same) return { ok: true, skipped: true, reason: "daily report row already up to date", duplicateMatches: duplicateMatches, sheet: sheet.getName(), row: rowNumber };
    sheet.getRange(rowNumber, 1, 1, targetValues.length).setValues([targetValues]);
    return { ok: true, updated: true, duplicateMatches: duplicateMatches, sheet: sheet.getName(), row: rowNumber };
  }
  sheet.appendRow(targetValues);
  return { ok: true, added: true, sheet: sheet.getName(), row: sheet.getLastRow() };
}

function buildAttendanceDestinationTimestamp_(row, now) {
  const date = normalizeDateKey_(row && row.date);
  const time = normalizeTimeValue_(row && (row.endTime || row.startTime) || "") ||
    Utilities.formatDate(now || new Date(), Session.getScriptTimeZone(), "HH:mm");
  if (date) return formatSlashDateFull_(date) + " " + time + ":00";
  return Utilities.formatDate(now || new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
}

function chooseAttendanceDestinationKeepRow_(values, rowNumbers) {
  let keep = rowNumbers[0] || 0;
  let keepTime = attendanceDestinationTimestampMillis_(values[keep - 1] && values[keep - 1][0]);
  let keepExtra = attendanceDestinationExtraCellCount_(values[keep - 1]);
  rowNumbers.forEach(function(rowNumber) {
    const extra = attendanceDestinationExtraCellCount_(values[rowNumber - 1]);
    const time = attendanceDestinationTimestampMillis_(values[rowNumber - 1] && values[rowNumber - 1][0]);
    if (extra > keepExtra || (extra === keepExtra && (time > keepTime || (time === keepTime && rowNumber < keep)))) {
      keep = rowNumber;
      keepTime = time;
      keepExtra = extra;
    }
  });
  return keep;
}

function attendanceDestinationTimestampMillis_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return value.getTime();
  const text = String(value || "").trim();
  if (!text) return 0;
  const parsed = new Date(text.replace(/\//g, "-"));
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function attendanceDestinationExtraCellCount_(row) {
  return (row || []).slice(4).filter(function(value) {
    return value !== "" && value !== null && value !== undefined;
  }).length;
}

function setupPomsAttendanceDestinationSettings() {
  const sheet = getOrCreateSheet_(POMS_SHEETS.Destinations, POMS_HEADERS.Destinations);
  const existing = sheet.getDataRange().getValues().slice(1);
  const months = {};
  existing.forEach(function(row) { if (normalizeMonthKey_(row[0])) months[normalizeMonthKey_(row[0])] = true; });
  const now = new Date().toISOString();
  const rows = [];
  getPomsOperationalDestinationMonths_().forEach(function(month, index) {
    if (months[month]) return;
    rows.push([
      month,
      index === 0 ? getScriptProperty_("ATTENDANCE_DEST_SPREADSHEET_ID", POMS_DEFAULTS.attendanceDestinationSpreadsheetId) : "",
      getScriptProperty_("ATTENDANCE_DEST_SHEET_NAME", POMS_DEFAULTS.attendanceDestinationSheetName),
      true,
      index === 0 ? "現在の送信先。必要ならURLを貼り替え" : "この月の日報URLを貼る",
      now
    ]);
  });
  if (rows.length) {
    const start = Math.max(sheet.getLastRow() + 1, 2);
    ensureSheetCapacity_(sheet, start + rows.length - 1, POMS_HEADERS.Destinations.length);
    sheet.getRange(start, 1, rows.length, POMS_HEADERS.Destinations.length).setValues(rows);
  }
  try { sheet.getRange(2, 4, Math.max(sheet.getMaxRows() - 1, 1), 1).insertCheckboxes(); } catch (error) {}
  formatSheet_(sheet);
  return { ok: true, sheet: sheet.getName(), addedMonths: rows.map(function(row) { return row[0]; }) };
}

function getAttendanceDestinationConfigForDate_(dateValue) {
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  const month = normalizeMonthKey_(date || getBusinessDate_());
  const calendarConfig = getAttendanceDestinationConfigFromCalendar_(month);
  if (calendarConfig) return calendarConfig;
  const fallbackUrl = getScriptProperty_("ATTENDANCE_DEST_SPREADSHEET_ID", POMS_DEFAULTS.attendanceDestinationSpreadsheetId);
  const fallback = {
    month: month,
    url: fallbackUrl,
    spreadsheetId: getSpreadsheetId_(fallbackUrl),
    sheetName: getScriptProperty_("ATTENDANCE_DEST_SHEET_NAME", POMS_DEFAULTS.attendanceDestinationSheetName),
    sheetGid: getSpreadsheetGid_(fallbackUrl),
    source: "script_properties"
  };
  const sheet = getSpreadsheet_().getSheetByName(POMS_SHEETS.Destinations);
  if (!sheet || sheet.getLastRow() < 2) return fallback;
  const rows = sheet.getDataRange().getValues().slice(1);
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (normalizeMonthKey_(row[0]) !== month) continue;
    if (String(row[3]).toLowerCase() === "false") continue;
    const url = String(row[1] || "").trim();
    if (!url) return fallback;
    return {
      month: month,
      url: url,
      spreadsheetId: getSpreadsheetId_(url),
      sheetName: row[2] || fallback.sheetName,
      sheetGid: getSpreadsheetGid_(url),
      source: POMS_SHEETS.Destinations
    };
  }
  return fallback;
}

function getAttendanceDestinationConfigFromCalendar_(month) {
  const ss = getSpreadsheet_();
  const names = [POMS_CALENDAR_PREFIX + month, POMS_CURRENT_CALENDAR_SHEET];
  for (let index = 0; index < names.length; index += 1) {
    const sheet = ss.getSheetByName(names[index]);
    if (!sheet) continue;
    if (normalizeMonthKey_(getPomsCalendarSheetMonth_(sheet)) !== normalizeMonthKey_(month)) continue;
    const label = String(sheet.getRange(2, 1).getValue() || "").trim();
    if (label !== "日報送信先") continue;
    const url = String(sheet.getRange(2, 2).getValue() || "").trim();
    const sheetName = String(sheet.getRange(2, 3).getValue() || "").trim() || POMS_DEFAULTS.attendanceDestinationSheetName;
    if (!url || url === "未設定") continue;
    return {
      month: normalizeMonthKey_(month),
      url: url,
      spreadsheetId: getSpreadsheetId_(url),
      sheetName: sheetName,
      sheetGid: getSpreadsheetGid_(url),
      source: "calendar_top_cells"
    };
  }
  return null;
}

function upsertPomsAttendanceDestinationConfig_(month, url, sheetName, active, note) {
  const sheet = getOrCreateSheet_(POMS_SHEETS.Destinations, POMS_HEADERS.Destinations);
  const targetMonth = normalizeMonthKey_(month || getMonthKey_(new Date()));
  const values = sheet.getDataRange().getValues();
  let rowNumber = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (normalizeMonthKey_(values[index][0]) === targetMonth) {
      rowNumber = index + 1;
      break;
    }
  }
  const row = [
    targetMonth,
    url || "",
    sheetName || POMS_DEFAULTS.attendanceDestinationSheetName,
    active === false ? false : true,
    note || "",
    new Date().toISOString()
  ];
  if (rowNumber) {
    sheet.getRange(rowNumber, 1, 1, POMS_HEADERS.Destinations.length).setValues([row]);
  } else {
    sheet.appendRow(row);
    rowNumber = sheet.getLastRow();
  }
  return {
    ok: true,
    sheet: sheet.getName(),
    row: rowNumber,
    month: targetMonth,
    url: row[1],
    sheetName: row[2],
    spreadsheetId: getSpreadsheetId_(row[1]),
    sheetGid: getSpreadsheetGid_(row[1])
  };
}

function getAttendanceDestinationSheetForDate_(dateValue) {
  const config = getAttendanceDestinationConfigForDate_(dateValue || getBusinessDate_());
  if (!config.spreadsheetId) throw new Error("日報送信先URLが未設定です");
  const ss = SpreadsheetApp.openById(config.spreadsheetId);
  if (config.sheetGid) {
    const byGid = ss.getSheets().find(function(item) {
      return String(item.getSheetId()) === String(config.sheetGid);
    });
    if (byGid) return byGid;
  }
  const sheet = ss.getSheetByName(config.sheetName);
  if (!sheet) throw new Error("送信先シートが見つかりません: " + config.sheetName);
  return sheet;
}

function isAttendanceDestinationReadyForDate_(dateValue) {
  const config = getAttendanceDestinationConfigForDate_(dateValue || getBusinessDate_());
  return Boolean(config.spreadsheetId);
}

function isAttendanceDestinationReady_(dateValue) {
  return isAttendanceDestinationReadyForDate_(dateValue || getBusinessDate_());
}

function analyzePomsAttendanceDestinationDuplicatesNow() {
  return withPomsLock_("analyzePomsAttendanceDestinationDuplicatesNow", function() {
    return analyzeAttendanceDestinationDuplicatesForDate_(getBusinessDate_());
  });
}

function analyzeAttendanceDestinationDuplicatesForDate_(dateValue) {
  try {
    const sheet = getAttendanceDestinationSheetForDate_(dateValue || getBusinessDate_());
    return analyzeAttendanceDestinationDuplicates_(sheet);
  } catch (error) {
    return { ok: false, error: errorMessage_(error) };
  }
}

function analyzeAttendanceDestinationDuplicates_(sheet) {
  const values = sheet.getDataRange().getValues();
  const groups = {};
  for (let index = 1; index < values.length; index += 1) {
    const driverName = normalizeDestinationDriverName_(values[index][1] || "");
    const date = normalizeDateKey_(values[index][2]);
    if (!driverName || !date) continue;
    const key = pomsCompare_(driverName) + "|" + date;
    if (!groups[key]) groups[key] = { driverName: driverName, date: date, rows: [] };
    groups[key].rows.push(index + 1);
  }
  const duplicateGroups = [];
  Object.keys(groups).forEach(function(key) {
    const group = groups[key];
    if (group.rows.length <= 1) return;
    const keepRow = chooseAttendanceDestinationKeepRow_(values, group.rows);
    duplicateGroups.push({ driverName: group.driverName, date: group.date, representativeRow: keepRow, duplicateRows: group.rows.filter(function(rowNumber) { return rowNumber !== keepRow; }) });
  });
  return { ok: true, sheet: sheet.getName(), duplicateGroups: duplicateGroups.length, deletedRows: 0, details: duplicateGroups };
}

function syncPomsOperationalDailyReportThisMonthToToday() {
  return forceSyncPomsCheckoutToDailyReportUnsafe_(getMonthKey_(new Date()), getBusinessDate_());
}

function forceSyncPomsCheckoutToDailyReportNow() {
  return withPomsLock_("forceSyncPomsCheckoutToDailyReportNow", function() {
    return forceSyncPomsCheckoutToDailyReportUnsafe_(getMonthKey_(new Date()), getBusinessDate_());
  });
}

function forceSyncPomsCheckoutToDailyReportMonthNow(monthValue) {
  return withPomsLock_("forceSyncPomsCheckoutToDailyReportMonthNow", function() {
    return forceSyncPomsCheckoutToDailyReportUnsafe_(monthValue || getMonthKey_(new Date()));
  });
}

function forceSyncPomsCheckoutToDailyReportUnsafe_(monthValue, throughDateValue) {
  const month = normalizeMonthKey_(monthValue || getMonthKey_(new Date()));
  const throughDate = getDailyReportSyncThroughDate_(month, throughDateValue);
  const beforeDuplicateCheck = analyzeAttendanceDestinationDuplicatesForDate_(month + "-01");
  const ledger = rebuildPomsWorkLedger_(month);
  const rows = readPomsWorkLedgerRows_(month).filter(function(row) {
    const date = normalizeDateKey_(row.date);
    return date >= month + "-01" && date <= throughDate && String(row.attendanceStatus || "") === "退勤済み" && normalizeTimeValue_(row.endTime || "");
  });
  const stats = { added: 0, updated: 0, skipped: 0, failed: 0 };
  const sentDrivers = [];
  const failures = [];
  rows.forEach(function(row) {
    const result = safeAppendAttendanceDestinationRow_(row);
    if (result.added) stats.added += 1;
    else if (result.updated) stats.updated += 1;
    else if (result.skipped) stats.skipped += 1;
    else {
      stats.failed += 1;
      failures.push({
        date: normalizeDateKey_(row.date),
        driverName: row.driverName || "",
        reason: result.error || result.reason || "unknown error"
      });
    }
    if (result.added || result.updated) sentDrivers.push((row.driverName || "-") + " " + normalizeDateKey_(row.date));
  });
  const afterDuplicateCheck = analyzeAttendanceDestinationDuplicatesForDate_(month + "-01");
  return { ok: stats.failed === 0 && afterDuplicateCheck.ok !== false, month: month, throughDate: throughDate, ledger: ledger, finishedRows: rows.length, sent: stats.added, updated: stats.updated, alreadyPresent: stats.skipped, failed: stats.failed, failures: failures, beforeDuplicateCheck: beforeDuplicateCheck, afterDuplicateCheck: afterDuplicateCheck, sentDrivers: sentDrivers };
}

function getDailyReportSyncThroughDate_(month, throughDateValue) {
  const explicit = normalizeDateKey_(throughDateValue || "");
  if (explicit) return explicit;
  const targetMonth = normalizeMonthKey_(month || getMonthKey_(new Date()));
  return targetMonth === getMonthKey_(new Date()) ? getBusinessDate_() : getMonthEndDate_(targetMonth);
}

function rebuildPomsWorkLedgerThisMonth() {
  return withPomsLock_("rebuildPomsWorkLedgerThisMonth", function() {
    return rebuildPomsWorkLedger_(getMonthKey_(new Date()));
  });
}

function rebuildPomsWorkLedgerPreviousMonth() {
  return withPomsLock_("rebuildPomsWorkLedgerPreviousMonth", function() {
    return rebuildPomsWorkLedger_(getOffsetMonthKey_(-1));
  });
}

function rebuildPomsWorkLedger_(monthValue) {
  const month = normalizeMonthKey_(monthValue || getMonthKey_(new Date()));
  const drivers = getWorkLedgerDrivers_();
  const attendanceRows = readMonthRows_("Attendance", month);
  const advanceRows = readMonthRows_("Advance", month).filter(isPomsOperationalPaidAdvanceRow_);
  const rows = buildPomsWorkLedgerRows_(month, drivers, attendanceRows, advanceRows);
  const write = writePomsWorkLedgerRows_(month, rows);
  return { ok: true, sheet: POMS_SHEETS.WorkLedger, month: month, drivers: drivers.length, attendanceRows: attendanceRows.length, advanceRows: advanceRows.length, ledgerRows: rows.length, wrote: write };
}

function getWorkLedgerDrivers_() {
  return getActiveDrivers_().sort(function(a, b) {
    return String(a.siteName || "").localeCompare(String(b.siteName || ""), "ja") ||
      String(a.name || "").localeCompare(String(b.name || ""), "ja");
  });
}

function buildPomsWorkLedgerRows_(month, drivers, attendanceRows, advanceRows) {
  const dayCount = Number(getMonthEndDate_(month).slice(-2));
  const now = new Date().toISOString();
  const driverById = {};
  const driverByName = {};
  const driverList = [];
  const seenDrivers = {};
  function addDriver(driver) {
    if (!driver) return;
    const id = String(driver.id || driver.driverId || "").trim();
    const name = String(driver.name || driver.driverName || driver.displayName || "").trim();
    const key = id || pomsCompare_(name);
    if (!key || seenDrivers[key]) return;
    seenDrivers[key] = true;
    const normalized = {
      id: id,
      name: name,
      siteId: driver.siteId || "",
      siteName: driver.siteName || "",
      unitPrice: pomsNumber_(driver.unitPrice)
    };
    driverList.push(normalized);
    if (normalized.id) driverById[normalized.id] = normalized;
    if (normalized.name) driverByName[pomsCompare_(normalized.name)] = normalized;
  }
  drivers.forEach(addDriver);
  attendanceRows.forEach(function(row) { addDriver(resolveLedgerDriver_(row, driverById, driverByName)); });
  advanceRows.forEach(function(row) { addDriver(resolveLedgerDriver_(row, driverById, driverByName)); });
  getPomsCalendarOverrideRows_(month).forEach(function(row) { addDriver(resolveLedgerDriver_(row, driverById, driverByName)); });
  driverList.sort(function(a, b) {
    return String(a.siteName || "").localeCompare(String(b.siteName || ""), "ja") ||
      String(a.name || "").localeCompare(String(b.name || ""), "ja");
  });

  const attendanceByKey = {};
  attendanceRows.forEach(function(row) {
    const date = normalizeDateKey_(row.date);
    if (!date || date.indexOf(month + "-") !== 0) return;
    const driver = resolveLedgerDriver_(row, driverById, driverByName);
    const key = driver.id || pomsCompare_(driver.name);
    if (!key) return;
    const mapKey = key + "|" + date;
    attendanceByKey[mapKey] = chooseAttendanceRow_(attendanceByKey[mapKey], row);
  });

  const advanceByKey = {};
  advanceRows.forEach(function(row) {
    const driver = resolveLedgerDriver_(row, driverById, driverByName);
    const key = driver.id || pomsCompare_(driver.name);
    if (!key) return;
    const dates = uniqueDates_(getAdvanceRowWorkedDates_(driver.id || row.driverId, row)).filter(function(date) {
      return date.indexOf(month + "-") === 0;
    });
    if (!dates.length) return;
    const requested = allocateYen_(pomsNumber_(row.requestedAmount || row.amount), dates.length);
    const fee = allocateYen_(pomsNumber_(row.fee), dates.length);
    const transfer = allocateYen_(pomsNumber_(row.transferAmount), dates.length);
    dates.forEach(function(date, index) {
      const mapKey = key + "|" + date;
      if (!advanceByKey[mapKey]) advanceByKey[mapKey] = { ids: [], requestedAmount: 0, fee: 0, transferAmount: 0, ranges: [] };
      advanceByKey[mapKey].ids.push(row.id || "");
      advanceByKey[mapKey].requestedAmount += requested[index] || 0;
      advanceByKey[mapKey].fee += fee[index] || 0;
      advanceByKey[mapKey].transferAmount += transfer[index] || 0;
      advanceByKey[mapKey].ranges.push(formatSlashDate_(row.dateFrom || row.date) + "〜" + formatSlashDate_(row.dateTo || row.dateFrom || row.date));
    });
  });

  const unapplied = getPomsAdvanceUnappliedOverrideMap_(month, driverById, driverByName);
  Object.keys(unapplied).forEach(function(key) { delete advanceByKey[key]; });

  const overrideByKey = {};
  getPomsCalendarOverrideRows_(month).forEach(function(row) {
    const driver = resolveLedgerDriver_(row, driverById, driverByName);
    const key = driver.id || pomsCompare_(driver.name);
    const date = normalizeDateKey_(row.date);
    if (key && date) overrideByKey[key + "|" + date] = row;
  });

  const rows = [];
  for (let day = 1; day <= dayCount; day += 1) {
    const date = month + "-" + String(day).padStart(2, "0");
    driverList.forEach(function(driver) {
      const effectiveDriver = resolveDriverForDate_(driver, date);
      const key = driver.id || pomsCompare_(driver.name);
      const mapKey = key + "|" + date;
      const attendance = attendanceByKey[mapKey] || {};
      const advance = advanceByKey[mapKey] || null;
      const override = overrideByKey[mapKey] || null;
      const hasAttendance = Boolean(attendance.id || attendance.status || attendance.startTime || attendance.endTime);
      const finished = isAdvanceEligibleAttendanceRow_(attendance);
      const missingCheckout = !finished && hasAttendance && !isOffStatus_(attendance.status) &&
        (isWorkingStatus_(attendance.status) || normalizeTimeValue_(attendance.startTime || ""));
      let calendarMark = advance ? "済" : finished ? "未" : missingCheckout ? "退勤なし" : "";
      let attendanceStatus = finished ? "退勤済み" : missingCheckout ? "退勤なし" : hasAttendance && isOffStatus_(attendance.status) ? "休み" : "";
      let advanceStatus = advance ? "済" : finished ? "未" : "";
      let startTime = normalizeTimeValue_(attendance.startTime || "");
      let endTime = normalizeTimeValue_(attendance.endTime || "");
      if (override) {
        calendarMark = normalizePomsCalendarMark_(override.calendarMark);
        if (calendarMark === "済") {
          attendanceStatus = "退勤済み"; advanceStatus = "済"; if (!endTime) endTime = normalizeTimeValue_(override.endTime || "") || "23:59";
        } else if (calendarMark === "未") {
          attendanceStatus = "退勤済み"; advanceStatus = "未"; if (!endTime) endTime = normalizeTimeValue_(override.endTime || "") || "23:59";
        } else if (calendarMark === "退勤なし") {
          attendanceStatus = "退勤なし"; advanceStatus = ""; endTime = "";
        } else if (calendarMark === "休み") {
          attendanceStatus = "休み"; advanceStatus = ""; startTime = ""; endTime = "";
        } else {
          attendanceStatus = ""; advanceStatus = ""; startTime = ""; endTime = "";
        }
      }
      rows.push(normalizeRow_(POMS_HEADERS.WorkLedger, {
        date: date,
        driverId: driver.id || attendance.driverId || "",
        driverName: driver.name || attendance.driverName || "",
        siteId: attendance.siteId || effectiveDriver.siteId || "",
        siteName: attendance.siteName || effectiveDriver.siteName || "",
        unitPrice: pomsNumber_(effectiveDriver.unitPrice || attendance.unitPrice),
        attendanceStatus: attendanceStatus,
        startTime: startTime,
        endTime: endTime,
        calendarMark: calendarMark,
        advanceStatus: advanceStatus,
        advanceIds: advance ? uniqueText_(advance.ids).join(",") : "",
        advanceRequestedAmount: advance ? advance.requestedAmount : 0,
        advanceFee: advance ? advance.fee : 0,
        advanceTransferAmount: advance ? advance.transferAmount : 0,
        advanceDateRange: advance ? uniqueText_(advance.ranges).join(", ") : "",
        dailyReportStatus: attendanceStatus === "退勤済み" ? "送信対象" : "",
        dailyReportSentAt: "",
        source: [hasAttendance ? "退勤管理" : "", advance ? "前払い管理" : "", override ? "管理カレンダー" : ""].filter(Boolean).join(" / "),
        updatedAt: now
      }));
    });
  }
  return rows;
}

function writePomsWorkLedgerRows_(month, rows) {
  const sheet = getOrCreateSheet_(POMS_SHEETS.WorkLedger, POMS_HEADERS.WorkLedger);
  replaceSheetRows_(sheet, POMS_HEADERS.WorkLedger, rows || []);
  if (rows && rows.length) {
    sheet.getRange(2, 13, rows.length, 3).setNumberFormat("¥#,##0");
  }
  return { ok: true, month: month, rows: rows ? rows.length : 0 };
}

function refreshPomsOperationalCalendarThisMonth() {
  return refreshPomsOperationalCalendar_(getMonthKey_(new Date()));
}

function refreshPomsOperationalCalendarPreviousMonth() {
  return refreshPomsOperationalCalendar_(getOffsetMonthKey_(-1));
}

function restorePomsMay2026CalendarNow() {
  return showPomsCalendarForMonthNow_("2026-05");
}

function showPomsPreviousMonthCalendarNow() {
  return showPomsCalendarForMonthNow_(getOffsetMonthKey_(-1));
}

function showPomsCurrentAndPreviousCalendarsNow() {
  return withPomsLock_("showPomsCurrentAndPreviousCalendarsNow", function() {
    const current = refreshPomsOperationalCalendar_(getMonthKey_(new Date()));
    const previous = refreshPomsOperationalCalendar_(getOffsetMonthKey_(-1));
    const visibility = showPomsCalendarSheets_([current.sheet, previous.sheet]);
    return { ok: true, current: current, previous: previous, visibility: visibility };
  });
}

function showPomsCalendarForMonthNow_(monthValue) {
  return withPomsLock_("showPomsCalendarForMonthNow", function() {
    const calendar = refreshPomsOperationalCalendar_(normalizeMonthKey_(monthValue));
    const visibility = showPomsCalendarSheets_([calendar.sheet]);
    return { ok: true, calendar: calendar, visibility: visibility };
  });
}

function refreshPomsOperationalCalendar_(monthValue) {
  const month = normalizeMonthKey_(monthValue || getMonthKey_(new Date()));
  rebuildPomsWorkLedger_(month);
  const ss = getSpreadsheet_();
  preserveCurrentCalendarIfDifferentMonth_(ss, month);
  const sheetName = month === getMonthKey_(new Date()) ? POMS_CURRENT_CALENDAR_SHEET : POMS_CALENDAR_PREFIX + month;
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  const drivers = getWorkLedgerDriversForCalendar_(month);
  const ledgerRows = readPomsWorkLedgerRows_(month);
  const matrix = buildCalendarMatrix_(month, drivers, ledgerRows);
  ensureSheetCapacity_(sheet, matrix.values.length, matrix.values[0].length);
  sheet.clear();
  sheet.getRange(1, 1, matrix.values.length, matrix.values[0].length).setValues(matrix.values);
  sheet.getRange(1, 1, matrix.backgrounds.length, matrix.backgrounds[0].length).setBackgrounds(matrix.backgrounds);
  sheet.getRange(1, 1, matrix.fontColors.length, matrix.fontColors[0].length).setFontColors(matrix.fontColors);
  sheet.getRange(1, 1, matrix.fontWeights.length, matrix.fontWeights[0].length).setFontWeights(matrix.fontWeights);
  sheet.setFrozenRows(5);
  sheet.setFrozenColumns(4);
  sheet.getRange(6, 5, matrix.dayCount, Math.max(drivers.length, 1)).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(["", "済", "未", "退勤なし", "休み"], true).setAllowInvalid(false).build()
  );
  if (matrix.values.length > matrix.totalStartRow) {
    sheet.getRange(matrix.totalStartRow, 3, matrix.values.length - matrix.totalStartRow + 1, Math.max(matrix.values[0].length - 2, 1)).setNumberFormat("¥#,##0");
  }
  [52, 54, 112, 54].forEach(function(width, index) { sheet.setColumnWidth(index + 1, width); });
  for (let column = 5; column <= matrix.values[0].length; column += 1) sheet.setColumnWidth(column, 88);
  return { ok: true, sheet: sheet.getName(), month: month, drivers: drivers.length, rows: matrix.values.length };
}

function preserveCurrentCalendarIfDifferentMonth_(ss, targetMonth) {
  if (targetMonth !== getMonthKey_(new Date())) return { ok: true, skipped: true, reason: "target is not current month" };
  const current = ss.getSheetByName(POMS_CURRENT_CALENDAR_SHEET);
  if (!current) return { ok: true, skipped: true };
  const currentMonth = getPomsCalendarSheetMonth_(current);
  if (!currentMonth || currentMonth === targetMonth) return { ok: true, skipped: true, currentMonth: currentMonth };
  const archiveName = POMS_CALENDAR_PREFIX + currentMonth;
  const existingArchive = ss.getSheetByName(archiveName);
  if (existingArchive) {
    const oldName = makeUniqueSheetName_(ss, archiveName + "_旧");
    existingArchive.setName(oldName);
    try { existingArchive.hideSheet(); } catch (error) {}
  }
  current.setName(archiveName);
  try { current.showSheet(); } catch (error) {}
  return { ok: true, preserved: archiveName, month: currentMonth };
}

function isPomsCalendarDestinationRange_(range) {
  const rowStart = range.getRow();
  const rowEnd = range.getLastRow();
  const columnStart = range.getColumn();
  const columnEnd = range.getLastColumn();
  return rowStart <= 2 && rowEnd >= 2 && columnStart <= 3 && columnEnd >= 2;
}

function handlePomsCalendarDestinationEdit_(sheet) {
  const month = getPomsCalendarSheetMonth_(sheet);
  const url = String(sheet.getRange(2, 2).getValue() || "").trim();
  const sheetName = String(sheet.getRange(2, 3).getValue() || "").trim() || POMS_DEFAULTS.attendanceDestinationSheetName;
  if (!month) return { ok: false, skipped: true, reason: "month is empty" };
  const saved = upsertPomsAttendanceDestinationConfig_(month, url, sheetName, true, "カレンダー上部から更新");
  let dailyReport = { ok: false, skipped: true };
  try {
    dailyReport = forceSyncPomsCheckoutToDailyReportUnsafe_(month);
  } catch (error) {
    dailyReport = { ok: false, error: errorMessage_(error) };
  }
  return { ok: true, month: month, destination: saved, dailyReport: dailyReport };
}

function buildCalendarMatrix_(month, drivers, ledgerRows) {
  const values = [];
  const backgrounds = [];
  const fontColors = [];
  const fontWeights = [];
  const columns = 4 + drivers.length;
  const dayCount = Number(getMonthEndDate_(month).slice(-2));
  const byKey = {};
  ledgerRows.forEach(function(row) {
    byKey[(row.driverId || pomsCompare_(row.driverName)) + "|" + normalizeDateKey_(row.date)] = row;
  });
  pushCalendarRow_(values, backgrounds, fontColors, fontWeights, ["対象月", month, "POMS v2", ""].concat(drivers.map(function() { return ""; })), columns, "#0f766e", "#ffffff", "bold");
  const destination = getAttendanceDestinationConfigForDate_(month + "-01");
  pushCalendarRow_(values, backgrounds, fontColors, fontWeights, ["日報送信先", destination.url || destination.spreadsheetId || "未設定", destination.sheetName || "", "B2にURL / C2にタブ名"].concat(drivers.map(function() { return ""; })), columns, "#ecfeff", "#111827", "normal");
  pushCalendarRow_(values, backgrounds, fontColors, fontWeights, [month.replace("-", "/") + " 出勤・前払い管理", "済=前払い済", "未=退勤済/未申請", "退勤なし=要確認"].concat(drivers.map(function() { return ""; })), columns, "#111827", "#ffffff", "bold");
  pushCalendarRow_(values, backgrounds, fontColors, fontWeights, ["日", "曜日", "退勤済売上", "台数"].concat(drivers.map(function(driver) { return driver.siteName || ""; })), columns, "#fff200", "#111827", "bold");
  pushCalendarRow_(values, backgrounds, fontColors, fontWeights, ["", "", "", ""].concat(drivers.map(function(driver) { return driver.name || ""; })), columns, "#fff2cc", "#111827", "bold");
  for (let day = 1; day <= dayCount; day += 1) {
    const date = month + "-" + String(day).padStart(2, "0");
    const weekday = getWeekday_(date);
    const row = [day, weekday, 0, 0];
    const bg = ["#ffffff", "#ffffff", "#ffffff", "#ffffff"];
    const fc = ["#111827", weekdayColor_(weekday), "#111827", "#111827"];
    const fw = ["normal", "bold", "bold", "bold"];
    let sales = 0;
    let count = 0;
    drivers.forEach(function(driver) {
      const ledger = byKey[(driver.id || pomsCompare_(driver.name)) + "|" + date] || {};
      const mark = String(ledger.calendarMark || "");
      const finished = String(ledger.attendanceStatus || "") === "退勤済み";
      let text = "";
      let cellBg = "#ffffff";
      let cellColor = "#111827";
      if (finished) {
        count += 1;
        sales += pomsNumber_(ledger.unitPrice || driver.unitPrice);
      }
      if (mark === "済") {
        text = "済"; cellBg = "#dcfce7"; cellColor = "#166534";
      } else if (mark === "未") {
        text = "未"; cellBg = "#fef3c7"; cellColor = "#92400e";
      } else if (mark === "退勤なし") {
        text = "退勤なし"; cellBg = "#fee2e2"; cellColor = "#991b1b";
      } else if (mark === "休み") {
        text = "休み"; cellBg = "#e5e7eb"; cellColor = "#374151";
      }
      row.push(text); bg.push(cellBg); fc.push(cellColor); fw.push(text ? "bold" : "normal");
    });
    row[2] = sales;
    row[3] = count;
    const stripe = weekday === "日" ? "#fee2e2" : weekday === "土" ? "#e0f2fe" : (day % 2 ? "#ffffff" : "#f8fafc");
    for (let i = 0; i < 4; i += 1) bg[i] = stripe;
    pushPreparedCalendarRow_(values, backgrounds, fontColors, fontWeights, row, bg, fc, fw, columns);
  }
  const totalStartRow = values.length + 1;
  const totals = buildCalendarTotals_(drivers, ledgerRows);
  pushCalendarRow_(values, backgrounds, fontColors, fontWeights, ["退勤済売上合計", "", sum_(totals.sales), ""].concat(totals.sales), columns, "#dbeafe", "#111827", "bold");
  pushCalendarRow_(values, backgrounds, fontColors, fontWeights, ["前払い希望額合計", "", sum_(totals.requested), ""].concat(totals.requested), columns, "#dcfce7", "#111827", "bold");
  pushCalendarRow_(values, backgrounds, fontColors, fontWeights, ["前払い手数料合計", "", sum_(totals.fee), ""].concat(totals.fee), columns, "#fef9c3", "#111827", "bold");
  pushCalendarRow_(values, backgrounds, fontColors, fontWeights, ["振込予定額合計", "", sum_(totals.transfer), ""].concat(totals.transfer), columns, "#e0f2fe", "#111827", "bold");
  pushCalendarRow_(values, backgrounds, fontColors, fontWeights, ["会社建替残高", "", sum_(totals.companyBalance), ""].concat(totals.companyBalance), columns, "#fee2e2", "#111827", "bold");
  pushCalendarRow_(values, backgrounds, fontColors, fontWeights, ["月末振込見込み", "", sum_(totals.payrollEstimate), ""].concat(totals.payrollEstimate), columns, "#f3e8ff", "#111827", "bold");
  pushCalendarRow_(values, backgrounds, fontColors, fontWeights, ["残り申請可能額", "", sum_(totals.remaining), ""].concat(totals.remaining), columns, "#fef3c7", "#111827", "bold");
  pushCalendarRow_(values, backgrounds, fontColors, fontWeights, ["退勤済日数", "", sum_(totals.worked), ""].concat(totals.worked), columns, "#e5e7eb", "#111827", "bold");
  pushCalendarRow_(values, backgrounds, fontColors, fontWeights, ["前払い未申請日数", "", sum_(totals.notApplied), ""].concat(totals.notApplied), columns, "#fff2cc", "#111827", "bold");
  return { values: values, backgrounds: backgrounds, fontColors: fontColors, fontWeights: fontWeights, dayCount: dayCount, totalStartRow: totalStartRow };
}

function buildCalendarTotals_(drivers, ledgerRows) {
  const byDriver = {};
  drivers.forEach(function(driver) {
    byDriver[driver.id || pomsCompare_(driver.name)] = { sales: 0, requested: 0, fee: 0, transfer: 0, worked: 0, notApplied: 0 };
  });
  ledgerRows.forEach(function(row) {
    const key = row.driverId || pomsCompare_(row.driverName);
    if (!byDriver[key]) return;
    if (String(row.attendanceStatus || "") === "退勤済み") {
      byDriver[key].worked += 1;
      byDriver[key].sales += pomsNumber_(row.unitPrice);
      if (String(row.advanceStatus || "") !== "済") byDriver[key].notApplied += 1;
    }
    byDriver[key].requested += pomsNumber_(row.advanceRequestedAmount);
    byDriver[key].fee += pomsNumber_(row.advanceFee);
    byDriver[key].transfer += pomsNumber_(row.advanceTransferAmount);
  });
  const result = { sales: [], requested: [], fee: [], transfer: [], companyBalance: [], payrollEstimate: [], remaining: [], worked: [], notApplied: [] };
  drivers.forEach(function(driver) {
    const key = driver.id || pomsCompare_(driver.name);
    const item = byDriver[key] || {};
    const companyBalance = pomsNumber_(driver.companyAdvanceBalance);
    const rate = normalizePomsRate_(driver.advanceLimitRate, 50);
    const limitByRate = Math.floor(pomsNumber_(item.sales) * rate / 100);
    const limitByPayroll = Math.max(pomsNumber_(item.sales) - companyBalance, 0);
    const allowed = Math.min(limitByRate, limitByPayroll);
    result.sales.push(pomsNumber_(item.sales));
    result.requested.push(pomsNumber_(item.requested));
    result.fee.push(pomsNumber_(item.fee));
    result.transfer.push(pomsNumber_(item.transfer));
    result.companyBalance.push(companyBalance);
    result.payrollEstimate.push(Math.max(pomsNumber_(item.sales) - pomsNumber_(item.requested) - companyBalance, 0));
    result.remaining.push(Math.max(allowed - pomsNumber_(item.requested), 0));
    result.worked.push(pomsNumber_(item.worked));
    result.notApplied.push(pomsNumber_(item.notApplied));
  });
  return result;
}

function handlePomsOperationalCalendarEdit_(sheet, range) {
  const targets = [];
  for (let row = Math.max(range.getRow(), 6); row <= range.getLastRow(); row += 1) {
    for (let column = Math.max(range.getColumn(), 5); column <= range.getLastColumn(); column += 1) {
      const target = getPomsCalendarEditTarget_(sheet, row, column);
      if (target) targets.push(target);
    }
  }
  if (!targets.length) return { ok: true, skipped: true };
  return withPomsLock_("handlePomsOperationalCalendarEdit", function() {
    const months = {};
    targets.forEach(function(target) {
      recordPomsCalendarOverride_(target);
      months[target.month] = true;
    });
    Object.keys(months).forEach(function(month) {
      rebuildPomsWorkLedger_(month);
      refreshPomsOperationalCalendar_(month);
    });
    const dailyReports = {};
    Object.keys(months).forEach(function(month) {
      try {
        dailyReports[month] = forceSyncPomsCheckoutToDailyReportUnsafe_(month);
      } catch (error) {
        dailyReports[month] = { ok: false, error: errorMessage_(error) };
      }
    });
    return { ok: true, updated: targets.length, months: Object.keys(months), dailyReports: dailyReports };
  });
}

function getPomsCalendarEditTarget_(sheet, row, column) {
  const month = getPomsCalendarSheetMonth_(sheet);
  const day = Number(sheet.getRange(row, 1).getValue());
  const driverName = String(sheet.getRange(5, column).getValue() || "").trim();
  if (!month || !day || !driverName) return null;
  const driver = getActiveDrivers_().find(function(item) {
    return pomsCompare_(item.name) === pomsCompare_(driverName) || pomsCompare_(item.displayName) === pomsCompare_(driverName);
  }) || { id: "", name: driverName, siteId: "", siteName: "", unitPrice: 0 };
  return {
    month: month,
    date: month + "-" + String(day).padStart(2, "0"),
    driverId: driver.id || "",
    driverName: driver.name || driverName,
    siteId: driver.siteId || "",
    siteName: driver.siteName || "",
    unitPrice: pomsNumber_(driver.unitPrice),
    calendarMark: normalizePomsCalendarMark_(sheet.getRange(row, column).getValue()),
    row: row,
    column: column
  };
}

function recordPomsCalendarOverride_(target) {
  const sheet = getOrCreateSheet_(POMS_SHEETS.CalendarOverrides, POMS_HEADERS.CalendarOverrides);
  const mark = normalizePomsCalendarMark_(target.calendarMark);
  const attendanceStatus = mark === "済" || mark === "未" ? "退勤済み" : mark === "退勤なし" ? "退勤なし" : mark === "休み" ? "休み" : "";
  const row = normalizeRow_(POMS_HEADERS.CalendarOverrides, {
    date: normalizeDateKey_(target.date),
    driverId: target.driverId || "",
    driverName: target.driverName || "",
    siteId: target.siteId || "",
    siteName: target.siteName || "",
    unitPrice: pomsNumber_(target.unitPrice),
    calendarMark: mark,
    attendanceStatus: attendanceStatus,
    startTime: "",
    endTime: attendanceStatus === "退勤済み" ? "23:59" : "",
    note: "管理カレンダーで変更",
    updatedAt: new Date().toISOString()
  });
  upsertByKeys_(sheet, POMS_HEADERS.CalendarOverrides, row, ["date", "driverId", "driverName"]);
  return { ok: true, sheet: sheet.getName(), date: row.date, driverName: row.driverName, mark: mark };
}

function getPomsCalendarOverrideRows_(month) {
  const targetMonth = normalizeMonthKey_(month || getMonthKey_(new Date()));
  const sheet = getSpreadsheet_().getSheetByName(POMS_SHEETS.CalendarOverrides);
  if (!sheet || sheet.getLastRow() <= 1) return [];
  return readObjects_(sheet).filter(function(row) {
    return normalizeDateKey_(row.date).indexOf(targetMonth + "-") === 0;
  });
}

function markSelectedCalendarAdvanceAsUnappliedNow() {
  return withPomsLock_("markSelectedCalendarAdvanceAsUnappliedNow", function() {
    const target = getSelectedPomsOperationalCalendarCell_();
    if (target.value !== "済") throw new Error("管理カレンダーで「済」のセルを1つ選択してください。選択値: " + (target.value || "空欄"));
    const driver = findDriverByName_(target.driverName) || { id: "", name: target.driverName };
    recordPomsAdvanceUnappliedOverride_(target.date, driver, "カレンダー済セルから未申請へ戻し");
    rebuildPomsWorkLedger_(target.month);
    const calendar = refreshPomsOperationalCalendar_(target.month);
    return { ok: true, message: target.driverName + " " + target.date + " を未申請に戻しました", target: target, calendar: calendar };
  });
}

function getSelectedPomsOperationalCalendarCell_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  if (!isPomsOperationalCalendarSheet_(sheet.getName())) throw new Error("管理カレンダーのセルを選択してください。現在のシート: " + sheet.getName());
  const cell = sheet.getActiveCell();
  if (cell.getRow() < 6 || cell.getColumn() < 5) throw new Error("日付行とドライバー列が交差するセルを選択してください。");
  const month = getPomsCalendarSheetMonth_(sheet);
  const day = Number(sheet.getRange(cell.getRow(), 1).getValue());
  const driverName = String(sheet.getRange(5, cell.getColumn()).getValue() || "").trim();
  return { sheet: sheet.getName(), month: month, date: month + "-" + String(day).padStart(2, "0"), driverName: driverName, row: cell.getRow(), column: cell.getColumn(), value: String(cell.getValue() || "").trim() };
}

function recordPomsAdvanceUnappliedOverride_(dateValue, driver, reason) {
  const sheet = getOrCreateSheet_(POMS_SHEETS.AdvanceUnapplied, POMS_HEADERS.AdvanceUnapplied);
  const row = normalizeRow_(POMS_HEADERS.AdvanceUnapplied, {
    date: normalizeDateKey_(dateValue),
    driverId: driver.id || driver.driverId || "",
    driverName: driver.name || driver.driverName || "",
    reason: reason || "",
    createdAt: new Date().toISOString()
  });
  upsertByKeys_(sheet, POMS_HEADERS.AdvanceUnapplied, row, ["date", "driverId", "driverName"]);
  return { ok: true, sheet: sheet.getName(), date: row.date, driverName: row.driverName };
}

function getPomsAdvanceUnappliedOverrideMap_(month, driverById, driverByName) {
  const sheet = getSpreadsheet_().getSheetByName(POMS_SHEETS.AdvanceUnapplied);
  const map = {};
  if (!sheet || sheet.getLastRow() <= 1) return map;
  readObjects_(sheet).forEach(function(row) {
    const date = normalizeDateKey_(row.date);
    if (!date || date.indexOf(month + "-") !== 0) return;
    const driver = resolveLedgerDriver_(row, driverById, driverByName);
    const key = driver.id || pomsCompare_(driver.name);
    if (key) map[key + "|" + date] = true;
  });
  return map;
}

function isPomsOperationalCalendarSheet_(sheetName) {
  return String(sheetName || "") === POMS_CURRENT_CALENDAR_SHEET || String(sheetName || "").indexOf(POMS_CALENDAR_PREFIX) === 0;
}

function getPomsCalendarSheetMonth_(sheet) {
  const name = sheet.getName();
  if (name.indexOf(POMS_CALENDAR_PREFIX) === 0) return normalizeMonthKey_(name.replace(POMS_CALENDAR_PREFIX, ""));
  const fromCell = normalizeMonthKey_(sheet.getRange(1, 2).getValue());
  if (fromCell) return fromCell;
  return getMonthKey_(new Date());
}

function normalizePomsCalendarMark_(value) {
  const text = String(value || "").trim();
  return ["済", "未", "退勤なし", "休み"].indexOf(text) !== -1 ? text : "";
}

function applyPomsOperationalManualCorrectionsNow() {
  return withPomsLock_("applyPomsOperationalManualCorrectionsNow", function() {
    [POMS_SHEETS.Attendance, POMS_SHEETS.Advance, POMS_SHEETS.Drivers, POMS_SHEETS.Sites].forEach(function(name) {
      const sheet = getSpreadsheet_().getSheetByName(name);
      if (sheet) normalizeEditedSheet_(sheet);
    });
    refreshPomsMasterDataSheet_(false);
    const ledger = rebuildPomsWorkLedger_(getMonthKey_(new Date()));
    const calendar = refreshPomsOperationalCalendar_(getMonthKey_(new Date()));
    let dailyReport = { ok: false, skipped: true };
    try { dailyReport = syncPomsOperationalDailyReportThisMonthToToday(); } catch (error) { dailyReport = { ok: false, error: errorMessage_(error) }; }
    return { ok: true, message: "手入力の修正を反映しました", ledger: ledger, calendar: calendar, dailyReport: dailyReport };
  });
}

function refreshPomsOperationalOutputsAfterChange_(dateValue) {
  queuePomsOperationalRefresh_(dateValue);
}

function queuePomsOperationalRefresh_(dateValue) {
  const month = normalizeMonthKey_(normalizeDateKey_(dateValue || getBusinessDate_()));
  const properties = PropertiesService.getScriptProperties();
  const months = String(properties.getProperty("POMS_DIRTY_MONTHS") || "").split(",").filter(Boolean);
  if (months.indexOf(month) === -1) months.push(month);
  properties.setProperty("POMS_DIRTY_MONTHS", months.sort().join(","));
  const cache = CacheService.getScriptCache();
  if (cache.get("poms:refresh-trigger-pending")) return { ok: true, queued: months };
  ScriptApp.newTrigger("flushPomsOperationalRefreshQueue").timeBased().after(30000).create();
  cache.put("poms:refresh-trigger-pending", "1", 300);
  return { ok: true, queued: months };
}

function flushPomsOperationalRefreshQueue() {
  return withPomsLock_("flushPomsOperationalRefreshQueue", function() {
    const properties = PropertiesService.getScriptProperties();
    const months = String(properties.getProperty("POMS_DIRTY_MONTHS") || "").split(",").filter(Boolean);
    properties.deleteProperty("POMS_DIRTY_MONTHS");
    CacheService.getScriptCache().remove("poms:refresh-trigger-pending");
    ScriptApp.getProjectTriggers().forEach(function(trigger) {
      if (trigger.getHandlerFunction() === "flushPomsOperationalRefreshQueue") ScriptApp.deleteTrigger(trigger);
    });
    const results = months.map(function(month) {
      return { month: month, ledger: rebuildPomsWorkLedger_(month), calendar: refreshPomsOperationalCalendar_(month) };
    });
    return { ok: true, refreshed: results };
  });
}

function setupPomsMasterDataSheet() {
  const sheet = getOrCreateSheet_(POMS_SHEETS.MasterData, POMS_HEADERS.MasterData);
  refreshPomsMasterDataSheet_(false);
  return { ok: true, sheet: sheet.getName() };
}

function setupPomsAssignmentsSheet() {
  const sheet = getOrCreateSheet_(POMS_SHEETS.Assignments, POMS_HEADERS.Assignments);
  formatSheet_(sheet);
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(3, 160);
  sheet.setColumnWidth(5, 180);
  sheet.setColumnWidth(6, 110);
  sheet.setColumnWidth(7, 110);
  sheet.setColumnWidth(8, 110);
  sheet.setColumnWidth(9, 260);
  try { sheet.showSheet(); sheet.activate(); } catch (error) {}
  return { ok: true, sheet: sheet.getName(), message: "ドライバー名、異動先現場、適用開始日を入力してください" };
}

function setupPomsAdvanceTemplateSheet() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(POMS_SHEETS.AdvanceTemplate);
  if (!sheet) sheet = ss.insertSheet(POMS_SHEETS.AdvanceTemplate);
  const rows = [
    ["POMS 前払いテンプレート", "", "", "", "", "", "", ""],
    ["入力/確認項目", "例", "説明", "", "LINE通知テンプレート", "", "", ""],
    ["ドライバー名", "山田太郎", "前払い申請者", "", "前払い申込", "", "", ""],
    ["現場", "川口領家 Amazon", "所属現場", "", "【表示用】", "", "", ""],
    ["対象開始日", "2026/06/01", "前払い対象の開始日", "", "加盟店名: 株式会社パシフィックワンマイルサポート", "", "", ""],
    ["対象終了日", "2026/06/05", "前払い対象の終了日", "", "ドライバー名: {ドライバー名}", "", "", ""],
    ["選択稼働日", "2026-06-01,2026-06-03,2026-06-05", "退勤済みの日だけ申請可", "", "振込金額: ¥{振込予定額}", "", "", ""],
    ["実働日数", "3", "選択稼働日の数", "", "前払い希望額: ¥{前払い希望額}", "", "", ""],
    ["日当単価", "22000", "マスターデータから取得", "", "前払い手数料: ¥{手数料}", "", "", ""],
    ["売上金額", "66000", "日当単価 × 実働日数", "", "期間: {対象開始日}〜{対象終了日} {実働日数}日稼働分", "", "", ""],
    ["前払い上限率", "50%", "通常50%", "", "対象売上: ¥{売上金額}", "", "", ""],
    ["会社建替残高", "0", "マスターデータから取得", "", "", "", "", ""],
    ["当月前払い済み", "0", "同月の前払い済み合計", "", "【振込用】", "", "", ""],
    ["前払い可能額", "33000", "売上×上限率、会社建替残高、当月前払い済みから算出", "", "加盟店=ｶ)ﾊﾟｼﾌｨｯｸﾜﾝﾏｲﾙｻﾎﾟｰﾄ", "", "", ""],
    ["前払い希望額", "30000", "ドライバーの希望額。可能額を超えるとブロック", "", "氏名={スペースなし氏名}", "", "", ""],
    ["手数料率", "8%", "現場設定。平和島は初期10%", "", "振込金額={振込予定額}", "", "", ""],
    ["振込手数料", "260", "現場設定", "", "銀行={銀行名}", "", "", ""],
    ["前払い手数料", "2660", "希望額×手数料率＋振込手数料", "", "支店={支店名}", "", "", ""],
    ["振込予定額", "27340", "前払い希望額−前払い手数料", "", "口座種別=普通", "", "", ""],
    ["判定", "OK / 建替注意 / 回収不足", "回収不足は申請を保存せずブロック行として記録", "", "口座番号={口座番号}", "", "", ""],
    ["", "", "", "", "口座名義={口座名義}", "", "", ""]
  ];
  ensureSheetCapacity_(sheet, rows.length, 8);
  sheet.clear();
  sheet.getRange(1, 1, rows.length, 8).setValues(rows);
  sheet.getRange(1, 1, 1, 8).setBackground("#111827").setFontColor("#ffffff").setFontWeight("bold");
  sheet.getRange(2, 1, 1, 3).setBackground("#dbeafe").setFontWeight("bold");
  sheet.getRange(2, 5, 1, 3).setBackground("#dcfce7").setFontWeight("bold");
  sheet.setFrozenRows(2);
  [150, 210, 360, 24, 420, 80, 80, 80].forEach(function(width, index) {
    sheet.setColumnWidth(index + 1, width);
  });
  sheet.getRange(1, 1, rows.length, 8).setWrap(true).setVerticalAlignment("middle");
  try { sheet.showSheet(); } catch (error) {}
  return { ok: true, sheet: sheet.getName() };
}

function refreshPomsMasterDataSheet() {
  return refreshPomsMasterDataSheet_(true);
}

function refreshPomsMasterDataSheet_(syncBeforeRefresh) {
  const sheet = getOrCreateSheet_(POMS_SHEETS.MasterData, POMS_HEADERS.MasterData);
  if (syncBeforeRefresh && sheet.getLastRow() > 1) {
    syncPomsMasterDataRowsToSourceSheets_(sheet.getRange(2, 1, sheet.getLastRow() - 1, POMS_HEADERS.MasterData.length).getValues());
  }
  const drivers = readObjects_(getOrCreateSheet_(POMS_SHEETS.Drivers, POMS_HEADERS.Drivers));
  const rows = drivers.map(function(driver) {
    const fee = getPomsOperationalAdvanceFeeConfig_(driver.siteId || driver.siteName);
    return [
      driver.id || "",
      driver.name || "",
      driver.siteName || "",
      pomsNumber_(driver.unitPrice),
      pomsNumber_(driver.companyAdvanceBalance),
      pomsBoolean_(driver.advanceStopped, false),
      normalizePomsRate_(driver.advanceLimitRate, 50),
      fee.percent,
      fee.fixed,
      normalizePin_(driver.pin),
      sanitizeLineUserId_(driver.lineUserId),
      driver.bankName || "",
      driver.branchName || "",
      driver.accountNumber || "",
      driver.accountHolder || "",
      driver.lifecycle || "active",
      driver.note || ""
    ];
  });
  replaceSheetRows_(sheet, POMS_HEADERS.MasterData, rows, true);
  try { sheet.getRange(2, 6, Math.max(sheet.getMaxRows() - 1, 1), 1).insertCheckboxes(); } catch (error) {}
  return { ok: true, sheet: sheet.getName(), rows: rows.length };
}

function handlePomsMasterDataEdit_(e) {
  return withPomsLock_("handlePomsMasterDataEdit", function() {
    const sheet = e.range.getSheet();
    const rows = [];
    for (let row = Math.max(e.range.getRow(), 2); row <= e.range.getLastRow(); row += 1) {
      rows.push(sheet.getRange(row, 1, 1, POMS_HEADERS.MasterData.length).getValues()[0]);
    }
    syncPomsMasterDataRowsToSourceSheets_(rows);
    refreshPomsMasterDataSheet_(false);
    queuePomsOperationalRefresh_(getBusinessDate_());
    return { ok: true, rows: rows.length };
  });
}

function syncPomsMasterDataRowsToSourceSheets_(rows) {
  let updated = 0;
  (rows || []).forEach(function(row) {
    if (!String(row[0] || row[1] || "").trim()) return;
    syncPomsMasterRowToSources_(row);
    updated += 1;
  });
  return { ok: true, updated: updated };
}

function syncPomsMasterRowToSources_(row) {
  const driverId = String(row[0] || "").trim();
  const driverName = String(row[1] || "").trim();
  const siteName = String(row[2] || "").trim();
  if (!driverName) return null;
  const site = ensureSiteByName_(siteName, { advanceFeePercent: row[7], advanceFeeFixed: row[8] });
  const pin = normalizePin_(row[9]);
  if (String(row[9] || "").trim() && !pin) throw new Error("PINは4桁数字のみです: " + driverName);
  const lineUserId = sanitizeLineUserId_(row[10]);
  if (String(row[10] || "").trim() && !lineUserId) throw new Error("LINEユーザーIDはUから始まる文字列のみです: " + driverName);
  const existing = driverId ? getDriverById_(driverId) : findDriverByName_(driverName);
  return upsertDriver_(Object.assign({}, existing || {}, {
    id: driverId || (existing && existing.id),
    name: driverName,
    siteId: site.id,
    siteName: site.name,
    unitPrice: pomsNumber_(row[3]),
    companyAdvanceBalance: pomsNumber_(row[4]),
    advanceStopped: pomsBoolean_(row[5], false),
    advanceLimitRate: normalizePomsRate_(row[6], 50),
    pin: pin || (existing && existing.pin) || "",
    lineUserId: lineUserId,
    bankName: row[11] || "",
    branchName: row[12] || "",
    accountNumber: String(row[13] || "").replace(/[^\d]/g, ""),
    accountHolder: row[14] || "",
    lifecycle: row[15] || "active",
    note: row[16] || ""
  }, { skipRefresh: true }));
}

function upsertDriver_(body) {
  const sheet = getOrCreateSheet_(POMS_SHEETS.Drivers, POMS_HEADERS.Drivers);
  const existingRows = readObjects_(sheet);
  const existing = existingRows.find(function(row) {
    return (body.id && String(row.id || "") === String(body.id)) ||
      (body.name && pomsCompare_(row.name) === pomsCompare_(body.name));
  }) || {};
  const now = new Date().toISOString();
  const row = normalizeRow_(POMS_HEADERS.Drivers, Object.assign({}, existing, {
    id: body.id || existing.id || makeId_("drv"),
    name: body.name || existing.name || "",
    siteId: body.siteId !== undefined ? body.siteId : existing.siteId || "",
    siteName: body.siteName !== undefined ? body.siteName : existing.siteName || "",
    contractType: body.contractType !== undefined ? body.contractType : existing.contractType || "",
    lifecycle: body.lifecycle !== undefined ? normalizeLifecycle_(body.lifecycle) : existing.lifecycle || "active",
    unitPrice: body.unitPrice !== undefined ? pomsNumber_(body.unitPrice) : pomsNumber_(existing.unitPrice),
    advanceFee: body.advanceFee !== undefined ? pomsNumber_(body.advanceFee) : pomsNumber_(existing.advanceFee),
    bankName: body.bankName !== undefined ? body.bankName : existing.bankName || "",
    branchName: body.branchName !== undefined ? body.branchName : existing.branchName || "",
    accountNumber: body.accountNumber !== undefined ? String(body.accountNumber || "").replace(/[^\d]/g, "") : existing.accountNumber || "",
    accountHolder: body.accountHolder !== undefined ? body.accountHolder : existing.accountHolder || "",
    lineUserId: body.lineUserId !== undefined ? sanitizeLineUserId_(body.lineUserId) : existing.lineUserId || "",
    displayName: body.displayName !== undefined ? body.displayName : existing.displayName || body.name || "",
    note: body.note !== undefined ? body.note : existing.note || "",
    createdAt: existing.createdAt || body.createdAt || now,
    updatedAt: now,
    pin: body.pin !== undefined && String(body.pin || "").trim() ? normalizePin_(body.pin) : existing.pin || "",
    companyAdvanceBalance: body.companyAdvanceBalance !== undefined ? pomsNumber_(body.companyAdvanceBalance) : pomsNumber_(existing.companyAdvanceBalance),
    advanceStopped: body.advanceStopped !== undefined ? pomsBoolean_(body.advanceStopped, false) : pomsBoolean_(existing.advanceStopped, false),
    advanceLimitRate: body.advanceLimitRate !== undefined ? normalizePomsRate_(body.advanceLimitRate, 50) : normalizePomsRate_(existing.advanceLimitRate, 50)
  }));
  if (!row.name) throw new Error("driver name is required");
  upsertByKeys_(sheet, POMS_HEADERS.Drivers, row, ["id"]);
  if (!body.skipRefresh) {
    try { refreshPomsMasterDataSheet_(false); } catch (error) {}
    refreshPomsOperationalOutputsAfterChange_(getBusinessDate_());
  }
  return { ok: true, saved: "driver", driverId: row.id, updatedAt: now };
}

function upsertSite_(body) {
  const row = ensureSiteByName_(body.name, body);
  try { refreshPomsMasterDataSheet_(false); } catch (error) {}
  refreshPomsOperationalOutputsAfterChange_(getBusinessDate_());
  return { ok: true, saved: "site", siteId: row.id, updatedAt: row.updatedAt };
}

function ensureSiteByName_(siteName, body) {
  body = body || {};
  const sheet = getOrCreateSheet_(POMS_SHEETS.Sites, POMS_HEADERS.Sites);
  const sites = readObjects_(sheet);
  const existing = sites.find(function(site) {
    return (body.id && String(site.id || "") === String(body.id)) || pomsCompare_(site.name) === pomsCompare_(siteName);
  }) || {};
  const name = siteName || existing.name || "";
  const defaults = getDefaultFee_(name);
  const now = new Date().toISOString();
  const row = normalizeRow_(POMS_HEADERS.Sites, Object.assign({}, existing, {
    id: body.id || existing.id || makeId_("site"),
    name: name,
    sort: body.sort !== undefined ? Number(body.sort || 1) : Number(existing.sort || 1),
    active: body.active !== undefined ? pomsBoolean_(body.active, true) : pomsBoolean_(existing.active, true),
    updatedAt: now,
    advanceFeePercent: body.advanceFeePercent !== undefined ? normalizePomsRate_(body.advanceFeePercent, defaults.percent) : normalizePomsRate_(existing.advanceFeePercent, defaults.percent),
    advanceFeeFixed: body.advanceFeeFixed !== undefined ? pomsNumber_(body.advanceFeeFixed) : pomsNumber_(existing.advanceFeeFixed || defaults.fixed),
    advanceFeeEnabled: body.advanceFeeEnabled !== undefined ? pomsBoolean_(body.advanceFeeEnabled, true) : pomsBoolean_(existing.advanceFeeEnabled, defaults.enabled),
    advanceFeeMemo: body.advanceFeeMemo !== undefined ? body.advanceFeeMemo : existing.advanceFeeMemo || "",
    advanceFeeRate: body.advanceFeeRate !== undefined ? normalizePomsRate_(body.advanceFeeRate, defaults.percent) : normalizePomsRate_(existing.advanceFeeRate || existing.advanceFeePercent, defaults.percent),
    transferFee: body.transferFee !== undefined ? pomsNumber_(body.transferFee) : pomsNumber_(existing.transferFee || existing.advanceFeeFixed || defaults.fixed)
  }));
  if (!row.name) return row;
  upsertByKeys_(sheet, POMS_HEADERS.Sites, row, ["id"]);
  syncDriverSiteName_(row.id, row.name);
  return row;
}

function syncDriverSiteName_(siteId, siteName) {
  if (!siteId) return;
  const sheet = getOrCreateSheet_(POMS_SHEETS.Drivers, POMS_HEADERS.Drivers);
  const rows = readObjects_(sheet);
  rows.forEach(function(row, index) {
    if (String(row.siteId || "") === String(siteId)) {
      setCellByHeader_(sheet, index + 2, "siteName", siteName);
      setCellByHeader_(sheet, index + 2, "updatedAt", new Date().toISOString());
    }
  });
}

function switchDriverLifecycle_(body) {
  if (!body.id) throw new Error("driver id is required");
  const driver = getDriverById_(body.id);
  if (!driver) throw new Error("driver not found: " + body.id);
  return upsertDriver_(Object.assign({}, driver, { lifecycle: body.lifecycle || "inactive" }));
}

function saveHoliday_(body) {
  const month = normalizeMonthKey_(body.targetYearMonth || getHolidayTargetMonth_());
  const sheet = getOrCreateSheet_(POMS_SHEETS.Holiday, POMS_HEADERS.Holiday);
  const row = normalizeRow_(POMS_HEADERS.Holiday, {
    id: body.id || makeId_("hol"),
    driverId: body.driverId,
    driverName: body.driverName,
    siteId: body.siteId,
    siteName: body.siteName,
    days: Array.isArray(body.days) ? body.days.join(",") : String(body.days || ""),
    note: body.note || "",
    updatedAt: new Date().toISOString(),
    targetYearMonth: month
  });
  upsertByKeys_(sheet, POMS_HEADERS.Holiday, row, ["driverId", "targetYearMonth"]);
  return { ok: true, saved: "holiday", sheet: sheet.getName(), updatedAt: row.updatedAt };
}

function saveFixedShift_(body) {
  const month = normalizeMonthKey_(body.targetYearMonth || getMonthKey_(new Date()));
  const sheet = getOrCreateSheet_(POMS_SHEETS.FixedShift, POMS_HEADERS.FixedShift);
  const row = normalizeRow_(POMS_HEADERS.FixedShift, {
    id: body.id || makeId_("fix"),
    driverId: body.driverId,
    driverName: body.driverName,
    siteId: body.siteId,
    siteName: body.siteName,
    days: Array.isArray(body.days) ? body.days.join(",") : String(body.days || ""),
    updatedAt: new Date().toISOString(),
    targetYearMonth: month
  });
  upsertByKeys_(sheet, POMS_HEADERS.FixedShift, row, ["driverId", "targetYearMonth"]);
  refreshPomsOperationalOutputsAfterChange_(month + "-01");
  return { ok: true, saved: "fixed_shift", sheet: sheet.getName(), updatedAt: row.updatedAt };
}

function loadHoliday_(params) {
  const month = normalizeMonthKey_(params.targetYearMonth || getHolidayTargetMonth_());
  const driverId = params.driverId || "";
  const driver = driverId ? { id: driverId } : getDriverByLinePublic_(params.userId || params.lineUserId).driver;
  if (!driver || !driver.id) return { ok: true, found: false };
  const row = readMonthRows_("Holiday", month).find(function(item) { return item.driverId === driver.id; });
  if (!row) return { ok: true, found: false };
  return { ok: true, found: true, dates: normalizeDateListForMonth_(row.days || "", month), note: row.note || "", updatedAt: row.updatedAt || "" };
}

function getDashboard_(month) {
  month = normalizeMonthKey_(month || getMonthKey_(new Date()));
  return {
    businessDate: getBusinessDate_(),
    generatedAt: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"),
    drivers: readObjects_(getOrCreateSheet_(POMS_SHEETS.Drivers, POMS_HEADERS.Drivers)).map(privateDriver_),
    sites: readObjects_(getOrCreateSheet_(POMS_SHEETS.Sites, POMS_HEADERS.Sites)),
    attendance: readMonthRows_("Attendance", month),
    advance: readMonthRows_("Advance", month),
    workLedger: readPomsWorkLedgerRows_(month),
    holiday: readMonthRows_("Holiday", month),
    fixedShift: readMonthRows_("FixedShift", month),
    adminLogins: readObjects_(getOrCreateSheet_(POMS_SHEETS.AdminLogins, POMS_HEADERS.AdminLogins)).slice(0, 80)
  };
}

function getDriverAttendance_(driverId, dateValue) {
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  const row = readMonthRows_("Attendance", normalizeMonthKey_(date)).find(function(item) {
    return String(item.driverId || "") === String(driverId || "") && normalizeDateKey_(item.date) === date;
  });
  return { ok: true, found: Boolean(row), row: row || null };
}

function queuePomsLineNotification_(kind, payload) {
  const sheet = getOrCreateSheet_(POMS_SHEETS.NotificationQueue, POMS_HEADERS.NotificationQueue);
  appendRow_(sheet, normalizeRow_(POMS_HEADERS.NotificationQueue, {
    id: makeId_("notice"),
    kind: kind,
    payload: JSON.stringify(payload || {}),
    status: "pending",
    createdAt: new Date().toISOString(),
    sentAt: "",
    error: ""
  }));
  const cache = CacheService.getScriptCache();
  if (!cache.get("poms:line-trigger-pending")) {
    ScriptApp.newTrigger("flushPomsLineNotificationQueue").timeBased().after(1000).create();
    cache.put("poms:line-trigger-pending", "1", 300);
  }
  return { ok: true, queued: true };
}

function flushPomsLineNotificationQueue() {
  return withPomsLock_("flushPomsLineNotificationQueue", function() {
    const sheet = getOrCreateSheet_(POMS_SHEETS.NotificationQueue, POMS_HEADERS.NotificationQueue);
    const rows = readObjects_(sheet);
    let sent = 0;
    rows.forEach(function(item, index) {
      if (String(item.status || "") !== "pending") return;
      let result;
      let error = "";
      try {
        const payload = JSON.parse(String(item.payload || "{}"));
        const parts = String(item.kind || "").split(":");
        result = parts[0] === "driver" ? notifyDriverLine_(parts.slice(1).join(":"), payload) : notifyAdminLine_(parts.slice(1).join(":"), payload);
        if (result && result.ok === false && !result.skipped) error = result.error || result.reason || "LINE送信失敗";
      } catch (sendError) {
        error = errorMessage_(sendError);
      }
      setCellByHeader_(sheet, index + 2, "status", error ? "error" : "sent");
      setCellByHeader_(sheet, index + 2, "sentAt", new Date().toISOString());
      setCellByHeader_(sheet, index + 2, "error", error);
      if (!error) sent += 1;
    });
    CacheService.getScriptCache().remove("poms:line-trigger-pending");
    ScriptApp.getProjectTriggers().forEach(function(trigger) {
      if (trigger.getHandlerFunction() === "flushPomsLineNotificationQueue") ScriptApp.deleteTrigger(trigger);
    });
    return { ok: true, sent: sent };
  });
}

function notifyAdminLine_(kind, row) {
  if (!isLineReady_()) return { ok: false, skipped: true, reason: "LINE settings are empty" };
  let text = "";
  if (kind === "attendance") {
    const actionText = isFinishedStatus_(row.status) ? "退勤" : isWorkingStatus_(row.status) ? "出勤" : "勤務報告";
    text = ["【POMS 勤怠通知】", (row.driverName || "-") + "さんが" + actionText + "しました", "現場: " + (row.siteName || "-"), "勤務日: " + (row.date || "-"), "時刻: " + (isFinishedStatus_(row.status) ? row.endTime : row.startTime || "-")].join("\n");
  } else if (kind === "advance") {
    text = buildAdvanceTransferMessage_(row);
  } else if (kind === "advance_blocked") {
    text = buildAdvanceSafetyBlockedMessage_(row);
  }
  if (!text) return { ok: false, skipped: true, reason: "message is empty" };
  return pushLineText_(text);
}

function notifyDriverLine_(kind, row) {
  if (!isLineTokenReady_()) return { ok: false, skipped: true, reason: "LINE settings are empty" };
  const driver = getDriverById_(row.driverId) || {};
  if (!driver.lineUserId) return { ok: false, skipped: true, reason: "driver lineUserId is empty" };
  if (kind !== "advance_submitted") return { ok: false, skipped: true };
  const text = ["【POMS 前払い申請】", "前払い申請が提出されました。", "ドライバー: " + (row.driverName || "-"), "対象期間: " + formatSlashDate_(row.dateFrom || row.date) + "〜" + formatSlashDate_(row.dateTo || row.dateFrom || row.date), "実働日数: " + (row.workedDays || 0) + "日", "振込予定: ¥" + formatYen_(row.transferAmount), "", "管理者確認後に処理されます。"].join("\n");
  return pushLineTextTo_(driver.lineUserId, text);
}

function buildAdvanceTransferMessage_(row) {
  const transferDriverName = String(row.driverName || "").replace(/[\s　]+/g, "");
  return [
    "前払い申込",
    "",
    "【表示用】",
    "加盟店名: 株式会社パシフィックワンマイルサポート",
    "ドライバー名: " + (row.driverName || ""),
    "振込金額: ¥" + formatYen_(row.transferAmount),
    "前払い希望額: ¥" + formatYen_(row.requestedAmount || row.amount),
    "前払い手数料: ¥" + formatYen_(row.fee),
    "期間: " + formatSlashDate_(row.dateFrom || row.date) + "〜" + formatSlashDate_(row.dateTo || row.dateFrom || row.date) + " " + (row.workedDays || 0) + "日稼働分",
    "対象売上: ¥" + formatYen_(row.salesAmount),
    "",
    "【振込用】",
    "加盟店=ｶ)ﾊﾟｼﾌｨｯｸﾜﾝﾏｲﾙｻﾎﾟｰﾄ",
    "氏名=" + transferDriverName,
    "振込金額=" + String(pomsNumber_(row.transferAmount)),
    "銀行=" + (row.bankName || ""),
    "支店=" + (row.branchName || ""),
    "口座種別=普通",
    "口座番号=" + normalizeTransferAccountNumber_(row.bankName, row.accountNumber),
    "口座名義=" + String(row.accountHolder || "").replace(/[\s　]+/g, "")
  ].join("\n");
}

function buildAdvanceSafetyBlockedMessage_(row) {
  return ["【前払い申請ブロック】", "ドライバー: " + (row.driverName || "-"), "対象日: " + formatSlashDate_(row.dateFrom || row.date) + "〜" + formatSlashDate_(row.dateTo || row.dateFrom || row.date), "売上金額: ¥" + formatYen_(row.salesAmount), "前払い希望額: ¥" + formatYen_(row.requestedAmount || row.amount), "判定: " + (row.safetyCheckResult || "回収不足"), "", row.note || "前払い後の回収が不足するため申請できません。"].join("\n");
}

function notifyAdminAllClockedOutSummary_(dateValue) {
  if (!isLineReady_()) return { ok: false, skipped: true };
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  const rows = readMonthRows_("Attendance", normalizeMonthKey_(date)).filter(function(row) {
    return normalizeDateKey_(row.date) === date && !isOffStatus_(row.status);
  });
  if (!rows.length) return { ok: false, skipped: true, reason: "no attendance" };
  if (rows.some(function(row) { return isWorkingStatus_(row.status); })) return { ok: false, skipped: true, reason: "still working" };
  return pushLineText_(["【POMS 本日全員退勤】", "出勤中の全員が退勤しました。", "勤務日: " + date, "出勤人数: " + rows.length + "名"].join("\n"));
}

function sendMorningAdminAttendanceSummary() {
  return sendAdminAttendanceDigest_("morning", getBusinessDate_());
}

function sendNightAdminCheckoutSummary() {
  return sendAdminAttendanceDigest_("night", getBusinessDate_());
}

function sendAdminAttendanceDigest_(kind, dateValue) {
  if (!isLineReady_()) return { ok: false, skipped: true, reason: "LINE settings are empty" };
  if (kind === "morning" && !POMS_LINE_POLICY.adminMorningSummary) return { ok: false, skipped: true };
  if (kind === "night" && !POMS_LINE_POLICY.adminNightSummary) return { ok: false, skipped: true };
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  const scheduled = getScheduledDriversForAttendanceDate_(date);
  const rows = readMonthRows_("Attendance", normalizeMonthKey_(date)).filter(function(row) { return normalizeDateKey_(row.date) === date; });
  const byDriver = {};
  rows.forEach(function(row) { byDriver[row.driverId] = row; });
  const finished = [];
  const notFinished = [];
  const noRecord = [];
  scheduled.forEach(function(driver) {
    const row = byDriver[driver.id];
    if (!row || isOffStatus_(row.status)) noRecord.push(driver);
    else if (isFinishedStatus_(row.status)) finished.push({ driver: driver, row: row });
    else notFinished.push({ driver: driver, row: row });
  });
  const lines = kind === "morning"
    ? ["【POMS 9:30 出勤集計】", "勤務日: " + date, "対象人数: " + scheduled.length + "名", "出勤報告済み: " + (finished.length + notFinished.length) + "名", "未出勤: " + noRecord.length + "名"]
    : ["【POMS 23:30 退勤集計】", "勤務日: " + date, "対象人数: " + scheduled.length + "名", "退勤済み: " + finished.length + "名", "未退勤: " + notFinished.length + "名", "記録なし: " + noRecord.length + "名"];
  appendDigestGroup_(lines, "退勤済み", finished);
  appendDigestGroup_(lines, "未退勤", notFinished);
  appendDriverDigestGroup_(lines, "記録なし", noRecord);
  return pushLineText_(lines.join("\n"));
}

function appendDigestGroup_(lines, title, entries) {
  if (!entries.length) return;
  lines.push("");
  lines.push("[" + title + "]");
  entries.sort(function(a, b) { return String(a.driver.siteName || "").localeCompare(String(b.driver.siteName || ""), "ja") || String(a.driver.name || "").localeCompare(String(b.driver.name || ""), "ja"); });
  entries.forEach(function(entry) {
    const row = entry.row || {};
    lines.push("・" + (entry.driver.name || "-") + " " + (row.startTime || "-") + "→" + (row.endTime || "未退勤"));
  });
}

function appendDriverDigestGroup_(lines, title, drivers) {
  if (!drivers.length) return;
  lines.push("");
  lines.push("[" + title + "]");
  drivers.forEach(function(driver) { lines.push("・" + (driver.name || "-")); });
}

function setupPomsLineTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    const fn = trigger.getHandlerFunction();
    if (["sendMorningAdminAttendanceSummary", "sendNightAdminCheckoutSummary", "autoFinishUnclosedAttendanceDaily", "runPomsMonthlyRollover"].indexOf(fn) !== -1) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("sendMorningAdminAttendanceSummary").timeBased().everyDays(1).atHour(9).nearMinute(30).create();
  ScriptApp.newTrigger("sendNightAdminCheckoutSummary").timeBased().everyDays(1).atHour(23).nearMinute(30).create();
  ScriptApp.newTrigger("autoFinishUnclosedAttendanceDaily").timeBased().everyDays(1).atHour(23).nearMinute(55).create();
  ScriptApp.newTrigger("runPomsMonthlyRollover").timeBased().onMonthDay(1).atHour(3).create();
  return { ok: true, message: "POMS triggers created" };
}

function setupPomsAutoCheckoutTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "autoFinishUnclosedAttendanceDaily") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("autoFinishUnclosedAttendanceDaily").timeBased().everyDays(1).atHour(23).nearMinute(55).create();
  return { ok: true };
}

function autoFinishUnclosedAttendanceDaily() {
  return autoFinishUnclosedAttendanceForDate_(getBusinessDate_());
}

function autoFinishUnclosedAttendanceTodayNow() {
  return autoFinishUnclosedAttendanceForDate_(getBusinessDate_());
}

function autoFinishUnclosedAttendanceForDate_(dateValue) {
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  const rows = readMonthRows_("Attendance", normalizeMonthKey_(date));
  const fixed = [];
  rows.forEach(function(row) {
    if (normalizeDateKey_(row.date) !== date || !isWorkingStatus_(row.status) || !row.startTime || row.endTime) return;
    saveAttendance_({
      action: "admin_fix",
      id: row.id,
      date: date,
      driverId: row.driverId,
      driverName: row.driverName,
      siteId: row.siteId,
      siteName: row.siteName,
      status: "finished",
      startTime: row.startTime,
      endTime: "23:59",
      note: [row.note || "", "自動退勤補正"].filter(Boolean).join(" / "),
      createdAt: row.createdAt,
      workType: row.workType || "normal"
    });
    fixed.push(row.driverName || row.driverId);
  });
  try { syncPomsOperationalDailyReportThisMonthToToday(); } catch (error) {}
  return { ok: true, date: date, fixed: fixed.length, fixedDrivers: fixed };
}

function runPomsMonthlyRollover() {
  return withPomsLock_("runPomsMonthlyRollover", function() {
    const destinations = setupPomsAttendanceDestinationSettings();
    const currentFixedShift = prepareFixedShiftRows_(getMonthKey_(new Date()));
    const nextFixedShift = prepareFixedShiftRows_(getOffsetMonthKey_(1));
    const currentCalendar = refreshPomsOperationalCalendar_(getMonthKey_(new Date()));
    const previousCalendar = refreshPomsOperationalCalendar_(getOffsetMonthKey_(-1));
    const visibility = showPomsCalendarSheets_([currentCalendar.sheet, previousCalendar.sheet]);
    return {
      ok: true,
      message: "月替わり処理が完了しました。新しい月のカレンダーを追加し、前月カレンダーも表示しています。",
      destinations: destinations,
      currentFixedShift: currentFixedShift,
      nextFixedShift: nextFixedShift,
      currentCalendar: currentCalendar,
      previousCalendar: previousCalendar,
      visibility: visibility
    };
  });
}

function prepareFixedShiftRowsThisMonth() {
  return prepareFixedShiftRows_(getMonthKey_(new Date()));
}

function preparePomsFixedShiftRowsThisMonth() {
  return prepareFixedShiftRows_(getMonthKey_(new Date()));
}

function preparePomsFixedShiftRowsNextMonth() {
  return prepareFixedShiftRows_(getOffsetMonthKey_(1));
}

function prepareFixedShiftRows_(month) {
  const targetMonth = normalizeMonthKey_(month || getMonthKey_(new Date()));
  const sheet = getOrCreateSheet_(POMS_SHEETS.FixedShift, POMS_HEADERS.FixedShift);
  const rows = readObjects_(sheet);
  let created = 0;
  getActiveDrivers_().forEach(function(driver) {
    const exists = rows.some(function(row) {
      return String(row.driverId || "") === String(driver.id || "") && normalizeMonthKey_(row.targetYearMonth || "") === targetMonth;
    });
    if (exists) return;
    appendRow_(sheet, normalizeRow_(POMS_HEADERS.FixedShift, {
      id: makeId_("fix"),
      driverId: driver.id,
      driverName: driver.name,
      siteId: driver.siteId,
      siteName: driver.siteName,
      days: "",
      updatedAt: new Date().toISOString(),
      targetYearMonth: targetMonth
    }));
    created += 1;
  });
  return { ok: true, sheet: sheet.getName(), month: targetMonth, created: created };
}

function shouldSendLineAttendanceNotice(driverId, dateValue) {
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  const month = normalizeMonthKey_(date);
  const row = readMonthRows_("FixedShift", month).find(function(item) {
    return item.driverId === driverId && normalizeMonthKey_(item.targetYearMonth || "") === month;
  });
  if (!row) return true;
  return normalizeDateListForMonth_(row.days, month).indexOf(date) === -1;
}

function getScheduledDriversForAttendanceDate_(dateValue) {
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  return getActiveDrivers_().filter(function(driver) {
    return shouldSendLineAttendanceNotice(driver.id, date);
  });
}

function handleLineWebhook_(body) {
  const sheet = getOrCreateSheet_(POMS_SHEETS.LineSources, POMS_HEADERS.LineSources);
  let saved = 0;
  (body.events || []).forEach(function(event) {
    const source = event.source || {};
    appendRow_(sheet, normalizeRow_(POMS_HEADERS.LineSources, {
      id: makeId_("line"),
      sourceType: source.type || "",
      sourceId: source.groupId || source.roomId || source.userId || "",
      userId: source.userId || "",
      groupId: source.groupId || "",
      roomId: source.roomId || "",
      replyToken: event.replyToken || "",
      messageText: event.message && event.message.text ? event.message.text : "",
      timestamp: event.timestamp || "",
      createdAt: new Date().toISOString()
    }));
    saved += 1;
  });
  return { ok: true, saved: saved };
}

function isLineWebhookVerify_(body) {
  const events = body && Array.isArray(body.events) ? body.events : [];
  if (!events.length) return true;
  return events.every(function(event) { return /^0+$/.test(String(event.replyToken || "")); });
}

function pushLineText_(text) {
  const targets = getLineAdminTargets_();
  if (!targets.length) return { ok: false, skipped: true, reason: "LINE_ADMIN_TO is empty" };
  const results = targets.map(function(target) { return pushLineTextTo_(target, text); });
  return { ok: true, sent: results.length, results: results };
}

function pushLineTextTo_(to, text) {
  const token = getLineChannelAccessToken_();
  if (!token) return { ok: false, skipped: true, reason: "LINE token is empty" };
  const response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/push", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + token },
    payload: JSON.stringify({ to: to, messages: [{ type: "text", text: text }] }),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error("LINE通知に失敗しました: " + code + " " + response.getContentText());
  return { ok: true };
}

function getLineAdminTargets_() {
  return String(getScriptProperty_("LINE_ADMIN_TO", POMS_DEFAULTS.lineAdminTo) || "")
    .split(/[,\n]/)
    .map(function(value) { return value.trim(); })
    .filter(Boolean);
}

function isLineReady_() {
  return isLineTokenReady_() && getLineAdminTargets_().length > 0;
}

function isLineTokenReady_() {
  return Boolean(getLineChannelAccessToken_());
}

function getLineChannelAccessToken_() {
  return getScriptProperty_("LINE_CHANNEL_ACCESS_TOKEN", POMS_DEFAULTS.lineChannelAccessToken);
}

function testPomsAdminLine() {
  return pushLineText_("【POMS テスト通知】\n管理者LINE通知の接続に成功しました。");
}

function testPomsAllClockedOutSummary() {
  return notifyAdminAllClockedOutSummary_(getBusinessDate_());
}

function testPomsMorningAdminSummary() {
  return sendMorningAdminAttendanceSummary();
}

function testPomsNightAdminSummary() {
  return sendNightAdminCheckoutSummary();
}

function sendMorningDriverAttendanceNotices() {
  return sendDriverScheduledAttendanceNotices_("morning", getBusinessDate_());
}

function sendNightDriverCheckoutNotices() {
  return sendDriverScheduledAttendanceNotices_("night", getBusinessDate_());
}

function sendDriverScheduledAttendanceNotices_(kind, dateValue) {
  if (!POMS_LINE_POLICY.driverScheduledAttendance) return { ok: false, skipped: true, reason: "driver notices are disabled" };
  if (!isLineTokenReady_()) return { ok: false, skipped: true, reason: "LINE settings are empty" };
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  const sent = [];
  getScheduledDriversForAttendanceDate_(date).forEach(function(driver) {
    if (!driver.lineUserId) return;
    const attendanceUrl = getScriptProperty_("DRIVER_ATTENDANCE_URL", POMS_DEFAULTS.driverAttendanceUrl);
    const row = getDriverAttendance_(driver.id, date).row;
    const text = kind === "morning"
      ? ["【POMS 出勤確認】", driver.name + "さん、本日は出勤日です。", attendanceUrl].filter(Boolean).join("\n")
      : row && isFinishedStatus_(row.status)
        ? ["【POMS 退勤確認】", driver.name + "さん、本日の退勤報告は完了しています。", "退勤時刻: " + (row.endTime || "-")].join("\n")
        : ["【POMS 退勤確認】", driver.name + "さん、退勤報告の確認時間です。", attendanceUrl].filter(Boolean).join("\n");
    pushLineTextTo_(driver.lineUserId, text);
    sent.push(driver.id);
  });
  return { ok: true, kind: kind, date: date, sent: sent.length };
}

function migratePomsMonthlySheetsToUnified() {
  return migrateLegacyMonthlySheets_();
}

function setupPomsAttendanceDestinationSheet() {
  return setupPomsAttendanceDestinationSettings();
}

function preparePomsMonthlySheets() {
  return runPomsMonthlyRollover();
}

function preparePomsCalendarsUntilDecember() {
  const results = [];
  getPomsOperationalDestinationMonths_().forEach(function(month) {
    prepareFixedShiftRows_(month);
    results.push(refreshPomsOperationalCalendar_(month));
  });
  return { ok: true, months: results.map(function(item) { return item.month; }) };
}

function setupPomsMonthlyRolloverTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === "runPomsMonthlyRollover") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("runPomsMonthlyRollover").timeBased().onMonthDay(1).atHour(3).create();
  return { ok: true };
}

function cleanupPomsBlankRows() {
  const ss = getSpreadsheet_();
  let touched = 0;
  ss.getSheets().forEach(function(sheet) {
    if (getSheetKind_(sheet.getName())) {
      normalizeEditedSheet_(sheet);
      touched += 1;
    }
  });
  return { ok: true, touchedSheets: touched };
}

function fixPomsAttendanceTimeDisplay() {
  const sheet = getOrCreateSheet_(POMS_SHEETS.Attendance, POMS_HEADERS.Attendance);
  formatSheet_(sheet);
  return { ok: true, sheet: sheet.getName() };
}

function cleanupPomsFixedShiftDuplicates() {
  prepareFixedShiftRows_(getMonthKey_(new Date()));
  prepareFixedShiftRows_(getOffsetMonthKey_(1));
  return { ok: true };
}

function sortPomsSheetsNewestFirst() {
  return cleanupPomsBlankRows();
}

function organizePomsAdminVisibleSheetsNow() {
  const calendar = refreshPomsOperationalCalendarThisMonth();
  refreshPomsMasterDataSheet_(false);
  return cleanupPomsDuplicateCalendarSheets_(calendar.sheet);
}

function cleanupPomsDuplicateCalendarsNow() {
  return withPomsLock_("cleanupPomsDuplicateCalendarsNow", function() {
    const calendar = refreshPomsOperationalCalendarThisMonth();
    return cleanupPomsDuplicateCalendarSheets_(calendar.sheet);
  });
}

function cleanupPomsDuplicateCalendarSheets_(keepSheetName) {
  const ss = getSpreadsheet_();
  const keepName = keepSheetName || POMS_CURRENT_CALENDAR_SHEET;
  const keepNames = {};
  keepNames[keepName] = true;
  keepNames[POMS_CURRENT_CALENDAR_SHEET] = true;
  keepNames[POMS_CALENDAR_PREFIX + getOffsetMonthKey_(-1)] = true;
  const hidden = [];
  const shown = [];
  ss.getSheets().forEach(function(sheet) {
    const name = sheet.getName();
    const isCalendar = isPomsCalendarLikeSheetName_(name);
    if (!isCalendar) return;
    if (keepNames[name]) {
      try {
        sheet.showSheet();
        shown.push(name);
      } catch (error) {}
      return;
    }
    if (ss.getSheets().length <= 1) return;
    try {
      sheet.hideSheet();
      hidden.push(name);
    } catch (error) {
      Logger.log("calendar hide skipped: " + name + " " + error);
    }
  });
  return {
    ok: true,
    message: "表示するカレンダーを今月と前月に整理しました",
    shown: shown,
    hidden: hidden
  };
}

function showPomsCalendarSheets_(sheetNames) {
  const ss = getSpreadsheet_();
  const wanted = {};
  (sheetNames || []).forEach(function(name) {
    if (name) wanted[name] = true;
  });
  const shown = [];
  ss.getSheets().forEach(function(sheet) {
    const name = sheet.getName();
    if (!wanted[name]) return;
    try {
      sheet.showSheet();
      shown.push(name);
    } catch (error) {
      Logger.log("calendar show skipped: " + name + " " + error);
    }
  });
  return { ok: true, shown: shown };
}

function isPomsCalendarLikeSheetName_(name) {
  const text = String(name || "");
  if (text === POMS_CURRENT_CALENDAR_SHEET) return true;
  if (text.indexOf(POMS_CALENDAR_PREFIX) === 0) return true;
  if (/前払いカレンダー|管理カレンダー|出勤・前払い管理/.test(text)) return true;
  return false;
}

function checkPomsOperationalMonthDataThisMonth() {
  const month = getMonthKey_(new Date());
  const ledger = rebuildPomsWorkLedger_(month);
  return {
    ok: true,
    month: month,
    attendanceRowsInMonth: readMonthRows_("Attendance", month).length,
    checkoutRowsInMonth: readMonthRows_("Attendance", month).filter(isAdvanceEligibleAttendanceRow_).length,
    advanceRowsInMonth: readMonthRows_("Advance", month).length,
    ledgerRowsInMonth: ledger.ledgerRows
  };
}

function fixPomsAttendanceDestinationAndResendNow() {
  const destinations = setupPomsAttendanceDestinationSettings();
  const beforeDuplicateCheck = analyzePomsAttendanceDestinationDuplicatesNow();
  const sync = forceSyncPomsCheckoutToDailyReportNow();
  const afterDuplicateCheck = analyzePomsAttendanceDestinationDuplicatesNow();
  return { ok: sync.ok !== false, destinations: destinations, beforeDuplicateCheck: beforeDuplicateCheck, sync: sync, afterDuplicateCheck: afterDuplicateCheck };
}

function calculateAdvanceFee_(requestedAmount, siteIdOrName) {
  const amount = pomsNumber_(requestedAmount);
  const config = getPomsOperationalAdvanceFeeConfig_(siteIdOrName);
  if (!config.enabled) return 0;
  return Math.ceil(amount * config.percent / 100 + config.fixed);
}

function calculateAdvanceFee(siteId, requestedAmount) {
  const config = getPomsOperationalAdvanceFeeConfig_(siteId);
  const amount = pomsNumber_(requestedAmount);
  const feeAmount = calculateAdvanceFee_(amount, siteId);
  return { feePercent: config.percent, feeFixed: config.fixed, feeAmount: feeAmount, transferAmount: Math.max(amount - feeAmount, 0), formula: amount + " × " + config.percent + "% + " + config.fixed };
}

function getPomsOperationalAdvanceFeeConfig_(siteIdOrName) {
  const fallback = getDefaultFee_(siteIdOrName);
  const key = pomsCompare_(siteIdOrName);
  if (!key) return fallback;
  const site = readObjects_(getOrCreateSheet_(POMS_SHEETS.Sites, POMS_HEADERS.Sites)).find(function(row) {
    return pomsCompare_(row.id) === key || pomsCompare_(row.name) === key;
  });
  if (!site) return fallback;
  if (!pomsBoolean_(site.advanceFeeEnabled, true)) return { percent: 0, fixed: 0, enabled: false };
  return {
    percent: normalizePomsRate_(site.advanceFeeRate || site.advanceFeePercent, fallback.percent),
    fixed: pomsNumber_(site.transferFee || site.advanceFeeFixed || fallback.fixed),
    enabled: true
  };
}

function getDefaultFee_(siteName) {
  return { percent: /平和島/.test(String(siteName || "")) ? 10 : 8, fixed: 260, enabled: true };
}

function isAdvanceBlockedSafety_(safety) {
  const result = String(safety && safety.safetyCheckResult || "").trim();
  return ["建替不足", "回収不足", "前払い超過", "上限超過"].indexOf(result) !== -1;
}

function isPomsOperationalPaidAdvanceRow_(row) {
  if (!row) return false;
  if (isAdvanceBlockedSafety_(row) || String(row.tag || "") === "blocked") return false;
  return pomsNumber_(row.requestedAmount || row.amount) > 0 || pomsNumber_(row.transferAmount) > 0 || pomsNumber_(row.fee) > 0;
}

function getAdvanceRowWorkedDates_(driverId, row) {
  const explicit = normalizeAdvanceSelectedDates_(row.selectedDates || "", row.dateFrom || row.date);
  if (explicit.length) return explicit;
  const from = normalizeDateKey_(row.dateFrom || row.date);
  const to = normalizeDateKey_(row.dateTo || row.dateFrom || row.date);
  return isPomsOperationalPaidAdvanceRow_(row) ? expandDateRange_(from, to) : [];
}

function getDriverByLinePublic_(lineUserId) {
  const lineId = String(lineUserId || "").trim();
  const driver = readObjects_(getOrCreateSheet_(POMS_SHEETS.Drivers, POMS_HEADERS.Drivers)).find(function(row) {
    return lineId && String(row.lineUserId || "").trim() === lineId;
  });
  return { ok: true, found: Boolean(driver), driver: driver ? publicDriver_(driver) : null };
}

function getDriverByIdPublic_(driverId) {
  const driver = getDriverById_(driverId);
  return { ok: true, found: Boolean(driver), driver: driver ? publicDriver_(driver) : null };
}

function getDriverById_(driverId) {
  if (!driverId) return null;
  return readObjects_(getOrCreateSheet_(POMS_SHEETS.Drivers, POMS_HEADERS.Drivers)).find(function(row) {
    return String(row.id || "") === String(driverId || "");
  }) || null;
}

function getPomsAssignments_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("poms:assignments");
  if (cached) {
    try { return JSON.parse(cached); } catch (error) {}
  }
  const rows = readObjects_(getOrCreateSheet_(POMS_SHEETS.Assignments, POMS_HEADERS.Assignments));
  try { cache.put("poms:assignments", JSON.stringify(rows), 300); } catch (error) {}
  return rows;
}

function resolveDriverForDate_(driver, dateValue) {
  if (!driver) return {};
  const date = normalizeDateKey_(dateValue || getBusinessDate_());
  const driverId = String(driver.id || driver.driverId || "");
  const driverName = pomsCompare_(driver.name || driver.driverName || "");
  const assignment = getPomsAssignments_().filter(function(row) {
    const sameDriver = driverId ? String(row.driverId || "") === driverId : pomsCompare_(row.driverName) === driverName;
    const from = normalizeDateKey_(row.effectiveFrom || "");
    const to = normalizeDateKey_(row.effectiveTo || "");
    return sameDriver && from && from <= date && (!to || date <= to);
  }).sort(function(a, b) {
    return normalizeDateKey_(b.effectiveFrom || "").localeCompare(normalizeDateKey_(a.effectiveFrom || ""));
  })[0];
  if (!assignment) return Object.assign({}, driver);
  return Object.assign({}, driver, {
    siteId: assignment.siteId || driver.siteId || "",
    siteName: assignment.siteName || driver.siteName || "",
    unitPrice: pomsNumber_(assignment.unitPrice || driver.unitPrice),
    assignmentEffectiveFrom: assignment.effectiveFrom || "",
    assignmentEffectiveTo: assignment.effectiveTo || ""
  });
}

function findDriverByName_(name) {
  const key = pomsCompare_(name);
  if (!key) return null;
  return readObjects_(getOrCreateSheet_(POMS_SHEETS.Drivers, POMS_HEADERS.Drivers)).find(function(row) {
    return pomsCompare_(row.name) === key || pomsCompare_(row.displayName) === key;
  }) || null;
}

function getActiveDrivers_() {
  return readObjects_(getOrCreateSheet_(POMS_SHEETS.Drivers, POMS_HEADERS.Drivers)).filter(function(driver) {
    return String(driver.lifecycle || "active") !== "inactive";
  });
}

function privateDriver_(driver) {
  driver = resolveDriverForDate_(driver, getBusinessDate_());
  const copy = {};
  Object.keys(driver || {}).forEach(function(key) {
    if (key !== "pin") copy[key] = driver[key];
  });
  return copy;
}

function publicDriver_(driver) {
  return {
    id: driver.id || "",
    name: driver.name || "",
    displayName: driver.displayName || driver.name || "",
    siteId: driver.siteId || "",
    siteName: driver.siteName || "",
    lifecycle: driver.lifecycle || "active"
  };
}

function ensureBaseSheetsReady_() {
  const cache = CacheService.getScriptCache();
  if (cache.get("poms:v2:base-ready")) return;
  ensureBaseSheets_();
  cache.put("poms:v2:base-ready", "1", 21600);
}

function ensureBaseSheets_() {
  Object.keys(POMS_SHEETS).forEach(function(kind) {
    if (POMS_HEADERS[kind]) getOrCreateSheet_(POMS_SHEETS[kind], POMS_HEADERS[kind]);
  });
  ensureAdminUser_();
  ensureInitialSite_();
}

function ensureAdminUser_() {
  const sheet = getOrCreateSheet_(POMS_SHEETS.AdminUsers, POMS_HEADERS.AdminUsers);
  if (sheet.getLastRow() >= 2) return;
  const now = new Date().toISOString();
  const pin = normalizePin_(getScriptProperty_("ADMIN_PASSWORD", getScriptProperty_("ADMIN_BOOTSTRAP_PIN", POMS_DEFAULTS.adminPassword)));
  if (!/^\d{4}$/.test(pin)) return;
  appendRow_(sheet, normalizeRow_(POMS_HEADERS.AdminUsers, {
    id: "admin_default",
    username: getScriptProperty_("ADMIN_USERNAME", POMS_DEFAULTS.adminUsername),
    pin: pin,
    displayName: "管理者",
    role: "owner",
    active: true,
    createdAt: now,
    updatedAt: now
  }));
}

function ensureInitialSite_() {
  const sheet = getOrCreateSheet_(POMS_SHEETS.Sites, POMS_HEADERS.Sites);
  if (sheet.getLastRow() >= 2) return;
  ensureSiteByName_("川口領家 Amazon", { sort: 1 });
}

function migrateLegacyMonthlySheets_() {
  const ss = getSpreadsheet_();
  let migrated = 0;
  ss.getSheets().forEach(function(sheet) {
    const info = getLegacyMonthlySheetInfo_(sheet.getName());
    if (!info) return;
    readObjects_(sheet).forEach(function(row) {
      if ((info.kind === "Holiday" || info.kind === "FixedShift") && !row.targetYearMonth) row.targetYearMonth = info.month;
      upsertUnifiedDataRow_(info.kind, row);
      migrated += 1;
    });
    try { sheet.hideSheet(); } catch (error) {}
  });
  return { ok: true, migrated: migrated };
}

function getLegacyMonthlySheetInfo_(name) {
  let match = String(name || "").match(/^(Attendance|Advance|Holiday|FixedShift)_(\d{4})_(\d{2})$/);
  if (match) return { kind: match[1], month: match[2] + "-" + match[3] };
  match = String(name || "").match(/^(出勤|前払い|休み希望|確定シフト)_(\d{4})_(\d{2})$/);
  const map = { "出勤": "Attendance", "前払い": "Advance", "休み希望": "Holiday", "確定シフト": "FixedShift" };
  if (match) return { kind: map[match[1]], month: match[2] + "-" + match[3] };
  return null;
}

function upsertUnifiedDataRow_(kind, row) {
  const sheet = getOrCreateSheet_(POMS_SHEETS[kind], POMS_HEADERS[kind]);
  const normalized = normalizeRow_(POMS_HEADERS[kind], row || {});
  if (kind === "Attendance" && normalized.driverId && normalized.date) upsertByKeys_(sheet, POMS_HEADERS[kind], normalized, ["driverId", "date"]);
  if (kind === "Advance" && (normalized.id || normalized.driverId)) upsertByKeys_(sheet, POMS_HEADERS[kind], normalized, normalized.id ? ["id"] : ["driverId", "dateFrom", "dateTo"]);
  if ((kind === "Holiday" || kind === "FixedShift") && normalized.driverId && normalized.targetYearMonth) upsertByKeys_(sheet, POMS_HEADERS[kind], normalized, ["driverId", "targetYearMonth"]);
}

function getSpreadsheet_() {
  const spreadsheetId = getSpreadsheetId_(getScriptProperty_("SPREADSHEET_ID", POMS_DEFAULTS.spreadsheetId));
  if (!spreadsheetId) throw new Error("Script Properties に SPREADSHEET_ID を設定してください");
  return SpreadsheetApp.openById(spreadsheetId);
}

function getOrCreateSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sheet = findSheetByNameOrAlias_(ss, name);
  if (!sheet) sheet = ss.insertSheet(name);
  ensureSheetCapacity_(sheet, 1, headers.length);
  const kind = getSheetKind_(name);
  const display = displayHeaders_(kind, headers);
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const canonical = current.map(function(value) { return canonicalHeader_(kind, value); });
  if (current.join("") === "" || canonical[0] !== headers[0]) {
    sheet.getRange(1, 1, 1, headers.length).setValues([display]);
  } else {
    const needs = headers.some(function(header, index) { return canonical[index] !== header; });
    if (needs) sheet.getRange(1, 1, 1, headers.length).setValues([display]);
  }
  return sheet;
}

function findSheetByNameOrAlias_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  const aliases = POMS_SHEET_ALIASES[name] || [];
  for (let i = 0; i < aliases.length; i += 1) {
    sheet = ss.getSheetByName(aliases[i]);
    if (sheet) {
      try { sheet.setName(name); } catch (error) {}
      return ss.getSheetByName(name) || sheet;
    }
  }
  return null;
}

function readObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const kind = getSheetKind_(sheet.getName());
  const headers = values[0].map(function(value) { return canonicalHeader_(kind, value); });
  return values.slice(1).filter(function(row) {
    return row.some(function(cell) { return String(cell || "").trim() !== ""; });
  }).map(function(row) {
    const obj = {};
    headers.forEach(function(header, index) {
      if (header) obj[header] = normalizeCell_(header, row[index]);
    });
    return obj;
  });
}

function appendRow_(sheet, rowObj) {
  const kind = getSheetKind_(sheet.getName());
  const headers = POMS_HEADERS[kind] || sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(value) { return canonicalHeader_(kind, value); });
  sheet.appendRow(headers.map(function(header) { return rowObj[header] === undefined ? "" : rowObj[header]; }));
}

function upsertByKeys_(sheet, headers, rowObj, keys) {
  const rows = readObjects_(sheet);
  const index = rows.findIndex(function(row) {
    return keys.every(function(key) { return valuesMatchForKey_(key, row[key], rowObj[key]); });
  });
  if (index >= 0) writeRowByHeaders_(sheet, index + 2, headers, rowObj);
  else appendRow_(sheet, rowObj);
}

function writeRowByHeaders_(sheet, rowNumber, headers, rowObj) {
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([headers.map(function(header) {
    return rowObj[header] === undefined ? "" : rowObj[header];
  })]);
}

function replaceSheetRows_(sheet, headers, rows, rawRows) {
  ensureSheetCapacity_(sheet, Math.max((rows || []).length + 1, 2), headers.length);
  sheet.clear();
  const kind = getSheetKind_(sheet.getName());
  sheet.getRange(1, 1, 1, headers.length).setValues([rawRows ? headers : displayHeaders_(kind, headers)]);
  if (rows && rows.length) {
    const values = rawRows ? rows : rows.map(function(row) {
      return headers.map(function(header) { return row[header] === undefined ? "" : row[header]; });
    });
    sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  }
  formatSheet_(sheet);
}

function setCellByHeader_(sheet, rowNumber, header, value) {
  const kind = getSheetKind_(sheet.getName());
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0].map(function(item) {
    return canonicalHeader_(kind, item);
  });
  const column = headers.indexOf(header) + 1;
  if (column > 0) sheet.getRange(rowNumber, column).setValue(value);
}

function findAttendanceRow_(sheet, dateValue, driverId) {
  const date = normalizeDateKey_(dateValue);
  const rows = readObjects_(sheet);
  for (let index = 0; index < rows.length; index += 1) {
    if (normalizeDateKey_(rows[index].date) === date && String(rows[index].driverId || "") === String(driverId || "")) {
      return { row: rows[index], rowNumber: index + 2 };
    }
  }
  return null;
}

function readMonthRows_(kind, month) {
  const targetMonth = normalizeMonthKey_(month || getMonthKey_(new Date()));
  return readObjects_(getOrCreateSheet_(POMS_SHEETS[kind], POMS_HEADERS[kind])).filter(function(row) {
    return rowBelongsToMonth_(kind, row, targetMonth);
  });
}

function rowBelongsToMonth_(kind, row, month) {
  if (kind === "Attendance" || kind === "WorkLedger") return normalizeDateKey_(row.date).indexOf(month) === 0;
  if (kind === "Advance") {
    const date = normalizeDateKey_(row.date || row.dateFrom || row.createdAt);
    const from = normalizeDateKey_(row.dateFrom || date);
    const to = normalizeDateKey_(row.dateTo || from);
    return date.indexOf(month) === 0 || from.indexOf(month) === 0 || to.indexOf(month) === 0 || rangesOverlap_(month + "-01", getMonthEndDate_(month), from, to);
  }
  if (kind === "Holiday" || kind === "FixedShift") return normalizeMonthKey_(row.targetYearMonth || "") === month;
  return true;
}

function readPomsWorkLedgerRows_(month) {
  return readMonthRows_("WorkLedger", month);
}

function getSheetKind_(sheetName) {
  const name = String(sheetName || "");
  const byName = {};
  byName[POMS_SHEETS.Drivers] = "Drivers";
  byName[POMS_SHEETS.Sites] = "Sites";
  byName[POMS_SHEETS.Attendance] = "Attendance";
  byName["出勤管理"] = "Attendance";
  byName[POMS_SHEETS.Advance] = "Advance";
  byName[POMS_SHEETS.Holiday] = "Holiday";
  byName[POMS_SHEETS.FixedShift] = "FixedShift";
  byName[POMS_SHEETS.WorkLedger] = "WorkLedger";
  byName[POMS_SHEETS.MasterData] = "MasterData";
  byName[POMS_SHEETS.CalendarOverrides] = "CalendarOverrides";
  byName[POMS_SHEETS.AdvanceUnapplied] = "AdvanceUnapplied";
  byName[POMS_SHEETS.Destinations] = "Destinations";
  byName[POMS_SHEETS.AdminUsers] = "AdminUsers";
  byName[POMS_SHEETS.AdminLogins] = "AdminLogins";
  byName[POMS_SHEETS.DriverSessions] = "DriverSessions";
  byName[POMS_SHEETS.LineSources] = "LineSources";
  byName[POMS_SHEETS.Assignments] = "Assignments";
  if (byName[name]) return byName[name];
  if (POMS_HEADERS[name]) return name;
  const legacy = name.match(/^(Attendance|Advance|Holiday|FixedShift)_\d{4}_\d{2}$/);
  if (legacy) return legacy[1];
  return "";
}

function canonicalHeader_(kind, value) {
  const header = String(value || "").trim();
  if (!kind) return header;
  if ((POMS_HEADERS[kind] || []).indexOf(header) !== -1) return header;
  const labels = POMS_LABELS[kind] || {};
  const found = Object.keys(labels).find(function(key) { return String(labels[key]) === header; });
  return found || header;
}

function displayHeaders_(kind, headers) {
  const labels = POMS_LABELS[kind] || {};
  return (headers || []).map(function(header) { return labels[header] || header; });
}

function normalizeCell_(header, value) {
  if (value === undefined || value === null || value === "") return "";
  if (["date", "dateFrom", "dateTo"].indexOf(header) !== -1) return normalizeDateKey_(value);
  if (["createdAt", "updatedAt", "loggedAt", "lastUsedAt", "expiresAt"].indexOf(header) !== -1) return normalizeDateTime_(value);
  if (["startTime", "endTime"].indexOf(header) !== -1) return normalizeTimeValue_(value);
  if (header === "targetYearMonth") return normalizeMonthKey_(value);
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  return value;
}

function normalizeEditedSheet_(sheet) {
  formatSheet_(sheet);
  return { ok: true };
}

function formatAllCoreSheets_() {
  const ss = getSpreadsheet_();
  ss.getSheets().forEach(function(sheet) { formatSheet_(sheet); });
}

function formatSheet_(sheet) {
  const kind = getSheetKind_(sheet.getName());
  if (!kind || !POMS_HEADERS[kind]) return;
  const headers = POMS_HEADERS[kind];
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setBackground("#111827").setFontColor("#ffffff").setFontWeight("bold");
  try {
    sheet.showColumns(1, Math.max(sheet.getMaxColumns(), headers.length));
    (POMS_HIDDEN_COLUMNS[kind] || []).forEach(function(header) {
      const column = headers.indexOf(header) + 1;
      if (column > 0) sheet.hideColumns(column);
    });
  } catch (error) {}
  if (kind === "Attendance") {
    const start = headers.indexOf("startTime") + 1;
    const end = headers.indexOf("endTime") + 1;
    if (start > 0) sheet.getRange(2, start, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("@");
    if (end > 0) sheet.getRange(2, end, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat("@");
  }
}

function ensureSheetCapacity_(sheet, minRows, minColumns) {
  const rows = Math.max(Number(minRows || 1), 1);
  const columns = Math.max(Number(minColumns || 1), 1);
  if (sheet.getMaxRows() < rows) sheet.insertRowsAfter(sheet.getMaxRows(), rows - sheet.getMaxRows());
  if (sheet.getMaxColumns() < columns) sheet.insertColumnsAfter(sheet.getMaxColumns(), columns - sheet.getMaxColumns());
}

function getEditedMonths_(sheet, range, kind) {
  const values = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  const headers = values.map(function(value) { return canonicalHeader_(kind, value); });
  const candidates = kind === "Advance" ? ["dateFrom", "date", "dateTo"] : kind === "FixedShift" || kind === "Holiday" ? ["targetYearMonth"] : ["date"];
  const columns = candidates.map(function(header) { return headers.indexOf(header) + 1; }).filter(function(column) { return column > 0; });
  const months = {};
  if (kind === "Drivers" || kind === "Sites") months[getMonthKey_(new Date())] = true;
  for (let row = Math.max(range.getRow(), 2); row <= range.getLastRow(); row += 1) {
    columns.forEach(function(column) {
      const month = normalizeMonthKey_(sheet.getRange(row, column).getValue());
      if (month) months[month] = true;
    });
  }
  const result = Object.keys(months).sort();
  return result.length ? result : [getMonthKey_(new Date())];
}

function getWorkLedgerDriversForCalendar_(month) {
  const drivers = getWorkLedgerDrivers_();
  const present = {};
  drivers.forEach(function(driver) { present[driver.id || pomsCompare_(driver.name)] = true; });
  readPomsWorkLedgerRows_(month).forEach(function(row) {
    const key = row.driverId || pomsCompare_(row.driverName);
    if (!key || present[key]) return;
    present[key] = true;
    drivers.push({ id: row.driverId || "", name: row.driverName || "", siteId: row.siteId || "", siteName: row.siteName || "", unitPrice: pomsNumber_(row.unitPrice) });
  });
  return drivers;
}

function resolveLedgerDriver_(row, driverById, driverByName) {
  const id = String(row.driverId || row.id || "").trim();
  const name = String(row.driverName || row.name || row.displayName || "").trim();
  if (id && driverById[id]) return driverById[id];
  if (name && driverByName[pomsCompare_(name)]) return driverByName[pomsCompare_(name)];
  return { id: id, name: name, siteId: row.siteId || "", siteName: row.siteName || "", unitPrice: pomsNumber_(row.unitPrice) };
}

function chooseAttendanceRow_(current, incoming) {
  if (!current) return incoming;
  if (isAdvanceEligibleAttendanceRow_(incoming) && !isAdvanceEligibleAttendanceRow_(current)) return incoming;
  return rowTime_(incoming) >= rowTime_(current) ? incoming : current;
}

function rowTime_(row) {
  const values = [row && row.updatedAt, row && row.createdAt, row && row.date];
  for (let i = 0; i < values.length; i += 1) {
    if (!values[i]) continue;
    const parsed = new Date(String(values[i]));
    if (!isNaN(parsed.getTime())) return parsed.getTime();
  }
  return 0;
}

function valuesMatchForKey_(key, left, right) {
  if (["date", "dateFrom", "dateTo"].indexOf(key) !== -1) return normalizeDateKey_(left) === normalizeDateKey_(right);
  if (key === "targetYearMonth") return normalizeMonthKey_(left) === normalizeMonthKey_(right);
  return String(left || "") === String(right || "");
}

function normalizeRow_(headers, obj) {
  const row = {};
  (headers || []).forEach(function(header) { row[header] = obj && obj[header] !== undefined ? obj[header] : ""; });
  return row;
}

function normalizeDateKey_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const text = String(value).trim();
  const direct = text.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (direct) return direct[1] + "-" + String(direct[2]).padStart(2, "0") + "-" + String(direct[3]).padStart(2, "0");
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return text;
}

function normalizeMonthKey_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM");
  const text = String(value).trim();
  const direct = text.match(/^(\d{4})[-\/](\d{1,2})(?:[-\/]\d{1,2}.*)?$/);
  if (direct) return direct[1] + "-" + String(direct[2]).padStart(2, "0");
  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM");
  return text;
}

function normalizeDateTime_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  const parsed = new Date(String(value));
  if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  return String(value || "");
}

function normalizeTimeValue_(value) {
  if (value === undefined || value === null || value === "" || value === true || value === false) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return Utilities.formatDate(value, Session.getScriptTimeZone(), "HH:mm");
  const text = String(value).trim();
  const match = text.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (match) return match[1].padStart(2, "0") + ":" + match[2];
  const jp = text.match(/(\d{1,2})時\s*(\d{1,2})?/);
  if (jp) return jp[1].padStart(2, "0") + ":" + String(jp[2] || "00").padStart(2, "0");
  return text;
}

function normalizeStatus_(status) {
  const value = String(status || "").trim();
  if (["working", "稼働中", "出勤中", "出勤"].indexOf(value) !== -1) return "working";
  if (["finished", "退勤済み", "退勤完了", "退勤"].indexOf(value) !== -1) return "finished";
  if (["off", "休み", "休", "未出勤"].indexOf(value) !== -1) return "off";
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

function isAdvanceEligibleAttendanceRow_(row) {
  const endTime = normalizeTimeValue_(row && row.endTime || "");
  if (!endTime) return false;
  const rawStatus = String(row && row.status || "").trim();
  if (rawStatus && isOffStatus_(rawStatus)) return false;
  return isFinishedStatus_(rawStatus) || Boolean(endTime);
}

function normalizePin_(value) {
  const digits = String(value === undefined || value === null ? "" : value).replace(/\D/g, "");
  return digits ? digits.slice(-4).padStart(4, "0") : "";
}

function sanitizeLineUserId_(value) {
  const text = String(value || "").trim();
  return /^U[A-Za-z0-9]{20,}$/.test(text) ? text : "";
}

function normalizeLifecycle_(value) {
  const text = String(value || "").trim();
  return ["inactive", "停止", "退職", "false"].indexOf(text) !== -1 ? "inactive" : "active";
}

function pomsNumber_(value) {
  if (typeof value === "number") return isNaN(value) ? 0 : value;
  const parsed = Number(String(value || "").replace(/[^\d.-]/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

function pomsBoolean_(value, fallback) {
  if (value === "" || value === undefined || value === null) return fallback;
  if (value === true || value === false) return value;
  return String(value).toLowerCase() !== "false" && String(value).trim() !== "停止";
}

function normalizePomsRate_(value, fallbackPercent) {
  if (value === "" || value === undefined || value === null) return pomsNumber_(fallbackPercent || 50);
  const number = pomsNumber_(value);
  if (number <= 0) return pomsNumber_(fallbackPercent || 50);
  const percent = number <= 1 ? number * 100 : number;
  return percent > 100 ? pomsNumber_(fallbackPercent || 50) : percent;
}

function pomsCompare_(value) {
  return String(value || "").replace(/[\s　]+/g, "").trim();
}

function normalizeDestinationDriverName_(value) {
  return String(value || "").replace(/[\s　]+/g, "").trim();
}

function normalizeTransferAccountNumber_(bankName, accountNumber) {
  const digits = String(accountNumber || "").replace(/[^\d]/g, "");
  if (/ゆうちょ/.test(String(bankName || "")) && digits.length === 8) return digits.slice(0, 7);
  return digits;
}

function normalizeDateListForMonth_(value, month) {
  month = normalizeMonthKey_(month);
  const list = Array.isArray(value) ? value : String(value || "").split(/[\n,、，]+/);
  return uniqueDates_(list.map(function(item) {
    const text = String(item || "").trim();
    if (!text) return "";
    if (/^\d{1,2}$/.test(text) && month) return month + "-" + text.padStart(2, "0");
    return normalizeDateKey_(text);
  }));
}

function normalizeAdvanceSelectedDates_(value, baseDate) {
  const list = Array.isArray(value) ? value : String(value || "").split(/[\n,、，]+/);
  const base = normalizeDateKey_(baseDate || getBusinessDate_());
  const baseYear = base ? base.slice(0, 4) : String(new Date().getFullYear());
  const baseMonth = base ? base.slice(5, 7) : String(new Date().getMonth() + 1).padStart(2, "0");
  return uniqueDates_(list.map(function(item) {
    const text = String(item || "").trim();
    if (!text) return "";
    let match = text.match(/^(\d{1,2})[\/-](\d{1,2})$/);
    if (match) return baseYear + "-" + String(match[1]).padStart(2, "0") + "-" + String(match[2]).padStart(2, "0");
    match = text.match(/^(\d{1,2})$/);
    if (match) return baseYear + "-" + baseMonth + "-" + String(match[1]).padStart(2, "0");
    return normalizeDateKey_(text);
  }));
}

function expandDateRange_(dateFrom, dateTo) {
  const from = normalizeDateKey_(dateFrom);
  const to = normalizeDateKey_(dateTo || dateFrom);
  if (!from || !to) return [];
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const cursor = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  const dates = [];
  let guard = 0;
  while (cursor <= endDate && guard < 62) {
    dates.push(Utilities.formatDate(cursor, Session.getScriptTimeZone(), "yyyy-MM-dd"));
    cursor.setDate(cursor.getDate() + 1);
    guard += 1;
  }
  return dates;
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

function uniqueDates_(dates) {
  const seen = {};
  return (dates || []).map(normalizeDateKey_).filter(function(date) {
    if (!date || seen[date]) return false;
    seen[date] = true;
    return true;
  }).sort();
}

function uniqueText_(values) {
  const seen = {};
  return (values || []).map(function(value) { return String(value || "").trim(); }).filter(function(value) {
    if (!value || seen[value]) return false;
    seen[value] = true;
    return true;
  });
}

function allocateYen_(total, count) {
  const safeCount = Math.max(Number(count || 0), 0);
  const values = [];
  let used = 0;
  for (let index = 0; index < safeCount; index += 1) {
    const value = index === safeCount - 1 ? pomsNumber_(total) - used : Math.round(pomsNumber_(total) / safeCount);
    values.push(value);
    used += value;
  }
  return values;
}

function sum_(values) {
  return (values || []).reduce(function(total, value) { return total + pomsNumber_(value); }, 0);
}

function pushCalendarRow_(values, backgrounds, fontColors, fontWeights, row, columns, background, fontColor, fontWeight) {
  const bg = [];
  const fc = [];
  const fw = [];
  for (let i = 0; i < columns; i += 1) {
    bg.push(background);
    fc.push(fontColor);
    fw.push(fontWeight);
  }
  pushPreparedCalendarRow_(values, backgrounds, fontColors, fontWeights, row, bg, fc, fw, columns);
}

function pushPreparedCalendarRow_(values, backgrounds, fontColors, fontWeights, row, bg, fc, fw, columns) {
  while (row.length < columns) row.push("");
  while (bg.length < columns) bg.push("#ffffff");
  while (fc.length < columns) fc.push("#111827");
  while (fw.length < columns) fw.push("normal");
  values.push(row.slice(0, columns));
  backgrounds.push(bg.slice(0, columns));
  fontColors.push(fc.slice(0, columns));
  fontWeights.push(fw.slice(0, columns));
}

function getWeekday_(dateKey) {
  const date = new Date(normalizeDateKey_(dateKey) + "T00:00:00");
  return ["日", "月", "火", "水", "木", "金", "土"][date.getDay()];
}

function weekdayColor_(weekday) {
  if (weekday === "日") return "#dc2626";
  if (weekday === "土") return "#2563eb";
  return "#111827";
}

function formatYen_(value) {
  return pomsNumber_(value).toLocaleString("ja-JP");
}

function formatSlashDateFull_(value) {
  if (!value) return "";
  const date = new Date(normalizeDateKey_(value) + "T00:00:00");
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy/MM/dd");
}

function formatSlashDate_(value) {
  if (!value) return "";
  const date = new Date(normalizeDateKey_(value) + "T00:00:00");
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "M/d");
}

function formatAttendanceDestinationSiteName_(siteName) {
  const text = String(siteName || "").trim();
  if (!text) return "";
  if (POMS_SITE_DAILY_REPORT_NAMES[text]) return POMS_SITE_DAILY_REPORT_NAMES[text];
  if (/Amazon/i.test(text)) return "Amazon " + text.replace(/\s*Amazon\s*/i, "").trim();
  return text;
}

function getBusinessDate_() {
  const now = new Date();
  const target = isBeforePomsBusinessDateCutoff_() ? new Date(now.getTime() - 24 * 60 * 60 * 1000) : now;
  return Utilities.formatDate(target, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function isBeforePomsBusinessDateCutoff_() {
  return Number(Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "H")) < 3;
}

function getMonthKey_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM");
}

function getOffsetMonthKey_(offset) {
  const now = new Date();
  return getMonthKey_(new Date(now.getFullYear(), now.getMonth() + Number(offset || 0), 1));
}

function getMonthEndDate_(month) {
  const parts = String(month || getMonthKey_(new Date())).split("-");
  return Utilities.formatDate(new Date(Number(parts[0]), Number(parts[1]), 0), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function getHolidayTargetMonth_() {
  const now = new Date();
  const add = now.getDate() <= 13 ? 1 : 2;
  return getMonthKey_(new Date(now.getFullYear(), now.getMonth() + add, 1));
}

function getPomsOperationalDestinationMonths_() {
  const now = new Date();
  const months = [];
  for (let monthIndex = now.getMonth(); monthIndex <= 11; monthIndex += 1) {
    months.push(getMonthKey_(new Date(now.getFullYear(), monthIndex, 1)));
  }
  return months.length ? months : [getMonthKey_(now)];
}

function getSpreadsheetId_(value) {
  const text = String(value || "").trim();
  const match = text.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : text;
}

function getSpreadsheetGid_(value) {
  const text = String(value || "").trim();
  const match = text.match(/[?#&]gid=(\d+)/);
  return match ? match[1] : "";
}

function getScriptProperty_(key, fallback) {
  try {
    const value = PropertiesService.getScriptProperties().getProperty(key);
    if (value !== null && value !== undefined && value !== "") return value;
  } catch (error) {}
  return fallback || "";
}

function setScriptProperty_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

function getSetupWarnings_() {
  const warnings = [];
  if (!getScriptProperty_("SPREADSHEET_ID", "")) warnings.push("SPREADSHEET_ID が未設定です");
  if (!getScriptProperty_("ADMIN_PASSWORD", "")) warnings.push("ADMIN_PASSWORD が未設定です。初回管理者を作成できません");
  if (!getScriptProperty_("LINE_CHANNEL_ACCESS_TOKEN", "")) warnings.push("LINE_CHANNEL_ACCESS_TOKEN が未設定です。LINE通知はスキップされます");
  return warnings;
}

function refreshPomsOperationsGuideNow() {
  const sheet = getOrCreateSheet_(POMS_SHEETS.Guide, POMS_HEADERS.Guide);
  const warnings = getSetupWarnings_();
  const status = function(ok) { return ok ? "OK" : "要設定"; };
  const rows = [
    ["最初に行うこと", warnings.length ? "要確認" : "準備完了", warnings.length ? warnings.join(" / ") : "基本設定は完了しています"],
    ["SPREADSHEET_ID", status(Boolean(getScriptProperty_("SPREADSHEET_ID", ""))), "Apps Scriptのプロジェクト設定 > スクリプト プロパティに設定"],
    ["管理者PIN", status(Boolean(getScriptProperty_("ADMIN_PASSWORD", ""))), "初回セットアップ用。管理者管理シート作成後は同シートで変更"],
    ["LINE通知", status(Boolean(getScriptProperty_("LINE_CHANNEL_ACCESS_TOKEN", ""))), "トークンはシートやソースコードへ記入しない"],
    ["LINE通知先", status(Boolean(getScriptProperty_("LINE_ADMIN_TO", ""))), "管理者のuserId/groupIdをScript Propertiesへ設定"],
    ["日報送信先", "シートで管理", "日報送信先設定シートのURL・タブ名・使用中を編集"],
    ["ドライバー情報", "シートで管理", "マスターデータシートを編集。編集後はPOMS管理 > 修正を反映"],
    ["現場異動", "予約可能", "現場異動予約シートへドライバー名・異動先現場・適用開始日・単価を入力"],
    ["通常作業", "自動", "勤怠・前払い・休み希望はWeb画面から登録"],
    ["困ったとき", "実行", "POMS管理 > 初期設定 / 修復。元データを消さずに台帳とカレンダーを再作成"],
    ["更新日時", "情報", Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss")]
  ];
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 3).setValues([POMS_HEADERS.Guide]);
  sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, 3).setBackground("#0f172a").setFontColor("#ffffff").setFontWeight("bold");
  sheet.getRange(2, 2, rows.length, 1).setFontWeight("bold");
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 110);
  sheet.setColumnWidth(3, 560);
  sheet.setTabColor(warnings.length ? "#f59e0b" : "#22c55e");
  sheet.activate();
  return { ok: true, warnings: warnings, sheet: sheet.getName() };
}

function withPomsLock_(name, fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return fn();
  } catch (error) {
    Logger.log(name + " failed: " + errorMessage_(error));
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function makeId_(prefix) {
  return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
}

function makeUniqueSheetName_(ss, base) {
  const safeBase = String(base || "シート").slice(0, 90);
  let name = safeBase;
  let count = 1;
  while (ss.getSheetByName(name)) {
    name = safeBase.slice(0, 90 - String(count).length - 1) + "_" + count;
    count += 1;
  }
  return name;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function errorMessage_(error) {
  return String(error && error.message ? error.message : error);
}

function applyPomsAdvanceSafetyFormatting_(sheet) {
  if (!sheet || getSheetKind_(sheet.getName()) !== "Advance") return { ok: false, skipped: true };
  const rows = readObjects_(sheet);
  const column = POMS_HEADERS.Advance.indexOf("safetyCheckResult") + 1;
  rows.forEach(function(row, index) {
    const status = String(row.safetyCheckResult || "").trim();
    if (status === "建替注意") sheet.getRange(index + 2, 1, 1, POMS_HEADERS.Advance.length).setBackground("#fef3c7");
    else if (isAdvanceBlockedSafety_(row)) sheet.getRange(index + 2, 1, 1, POMS_HEADERS.Advance.length).setBackground("#fee2e2");
  });
  return { ok: true, rows: rows.length, column: column };
}
