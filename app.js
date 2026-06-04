(function () {
  "use strict";

  const config = window.POMS_CONFIG || {};
  const page = document.body.dataset.page;
  const isLocalPreview = location.protocol === "file:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (isLocalPreview) {
    config.API_BASE_URL = "";
  }
  const $ = (id) => document.getElementById(id);
  const storageKey = (name) => `poms:${name}`;
  const pad = (num) => String(num).padStart(2, "0");
  const DEMO_SEED_VERSION = "poms-mobile-first-120-2026-06-03";
  const adminTokenKey = storageKey("adminToken");
  const driverTokenKey = storageKey("driverToken");
  const driverSessionKey = storageKey("driverSession");
  const lineProfileCacheKey = storageKey("lineProfile");
  let lineProfilePromise = null;
  let lineProfileRefreshPromise = null;
  let driverSessionWarmupPromise = null;

  const defaultDrivers = [
    {
      id: "drv_demo_001",
      lineUserId: "LINE_USER_ID_ISHIZUKA",
      name: "石塚 歩汰",
      siteId: "site_kawaguchi",
      siteName: "川口領家 Amazon",
      contractType: "日当",
      lifecycle: "active",
      unitPrice: 22000,
      advanceFee: 0,
      bankName: "三井住友銀行",
      branchName: "川口支店",
      accountNumber: "1234567",
      accountHolder: "イシヅカ アユタ",
      pin: "1234",
      demo: true
    },
    {
      id: "drv_demo_002",
      lineUserId: "LINE_USER_ID_TANAKA",
      name: "田中 一樹",
      siteId: "site_kawaguchi",
      siteName: "川口領家 Amazon",
      contractType: "日当",
      lifecycle: "active",
      unitPrice: 21000,
      advanceFee: 0,
      bankName: "みずほ銀行",
      branchName: "新宿支店",
      accountNumber: "7654321",
      accountHolder: "タナカ カズキ",
      pin: "2345",
      demo: true
    },
    {
      id: "drv_demo_003",
      lineUserId: "LINE_USER_ID_SATO",
      name: "佐藤 竜己",
      siteId: "site_shinjuku",
      siteName: "新宿上落合 Amazon",
      contractType: "日当",
      lifecycle: "active",
      unitPrice: 23246,
      advanceFee: 0,
      bankName: "ゆうちょ銀行",
      branchName: "818",
      accountNumber: "3911266",
      accountHolder: "サトウタツキ",
      pin: "3456",
      demo: true
    },
    {
      id: "drv_demo_004",
      lineUserId: "LINE_USER_ID_SUZUKI",
      name: "鈴木 真央",
      siteId: "site_shinjuku",
      siteName: "新宿上落合 Amazon",
      contractType: "日当",
      lifecycle: "active",
      unitPrice: 24000,
      advanceFee: 0,
      bankName: "楽天銀行",
      branchName: "第一営業支店",
      accountNumber: "2468135",
      accountHolder: "スズキ マオ",
      pin: "4567",
      demo: true
    },
    {
      id: "drv_demo_005",
      lineUserId: "LINE_USER_ID_TAKAHASHI",
      name: "高橋 蓮",
      siteId: "site_kawaguchi",
      siteName: "川口領家 Amazon",
      contractType: "日当",
      lifecycle: "inactive",
      unitPrice: 20000,
      advanceFee: 0,
      bankName: "りそな銀行",
      branchName: "池袋支店",
      accountNumber: "1122334",
      accountHolder: "タカハシ レン",
      pin: "5678",
      demo: true
    }
  ].filter(Boolean);

  function readStore(name, fallback) {
    try {
      const raw = localStorage.getItem(storageKey(name));
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeStore(name, value) {
    localStorage.setItem(storageKey(name), JSON.stringify(value));
  }

  function getAdminToken() {
    return localStorage.getItem(adminTokenKey) || "";
  }

  function setAdminToken(token) {
    if (token) localStorage.setItem(adminTokenKey, token);
    else localStorage.removeItem(adminTokenKey);
  }

  function getDriverToken() {
    return localStorage.getItem(driverTokenKey) || "";
  }

  function setDriverToken(token) {
    if (token) localStorage.setItem(driverTokenKey, token);
    else localStorage.removeItem(driverTokenKey);
  }

  function getPageLiffId() {
    const ids = config.LINE && config.LINE.LIFF_IDS ? config.LINE.LIFF_IDS : {};
    return ids[page] || (config.LINE && config.LINE.LIFF_ID) || "";
  }

  function loadExternalScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        if (window.liff) resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function readLineProfileCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(lineProfileCacheKey) || "null");
      return cached && cached.userId ? cached : null;
    } catch (error) {
      return null;
    }
  }

  function writeLineProfileCache(profile) {
    if (!profile || !profile.userId) return;
    localStorage.setItem(lineProfileCacheKey, JSON.stringify({
      ...profile,
      savedAt: new Date().toISOString()
    }));
  }

  async function fetchLiveLineProfile_() {
    const liffId = getPageLiffId();
    if (!liffId) return null;
    await loadExternalScript("https://static.line-scdn.net/liff/edge/2/sdk.js");
    if (!window.liff) return null;
    await window.liff.init({ liffId });
    if (!window.liff.isLoggedIn()) {
      window.liff.login({ redirectUri: location.href });
      return new Promise(() => {});
    }
    const profile = await window.liff.getProfile();
    const normalized = {
      userId: profile.userId || "",
      displayName: profile.displayName || "",
      pictureUrl: profile.pictureUrl || ""
    };
    writeLineProfileCache(normalized);
    return normalized;
  }

  async function getLineProfile(options = {}) {
    const { preferCached = true, refreshInBackground = true } = options;
    const cached = preferCached ? readLineProfileCache() : null;
    if (cached) {
      if (refreshInBackground && !lineProfileRefreshPromise) {
        lineProfileRefreshPromise = fetchLiveLineProfile_()
          .catch(() => cached)
          .finally(() => {
            lineProfileRefreshPromise = null;
          });
      }
      return cached;
    }
    if (!lineProfilePromise) {
      lineProfilePromise = fetchLiveLineProfile_().catch(() => readLineProfileCache() || null);
    }
    return lineProfilePromise;
  }

  function seedDemoData(force = false) {
    if (!force && localStorage.getItem(storageKey("demoSeedVersion")) === DEMO_SEED_VERSION) return;
    const base = businessDate();
    const year = base.getFullYear();
    const month = base.getMonth();
    const today = base.getDate();
    const dateInMonth = (day) => `${year}-${pad(month + 1)}-${pad(Math.min(day, today))}`;
    const activeDemoDrivers = defaultDrivers;

    const mergeRows = (name, demoRows) => {
      const existing = readStore(name, []);
      writeStore(name, [...existing.filter((row) => !row.demo), ...demoRows]);
    };

    const existingDrivers = readStore("drivers", []);
    const nonDemoDrivers = existingDrivers.filter((driver) => !String(driver.id || "").startsWith("drv_demo_"));
    writeStore("drivers", [...nonDemoDrivers, ...activeDemoDrivers]);
    const demoSites = [
      { id: "site_kawaguchi", name: "川口領家 Amazon", sort: 1, active: true, demo: true },
      { id: "site_shinjuku", name: "新宿上落合 Amazon", sort: 2, active: true, demo: true }
    ];
    const existingSites = readStore("sites", []);
    const nonDemoSites = existingSites.filter((site) => !site.demo && !demoSites.some((demoSite) => demoSite.id === site.id));
    writeStore("sites", [...nonDemoSites, ...demoSites]);

    const attendancePlan = [
      ["drv_demo_001", [1, 2, 3, 4, 8, 9, 10], "finished", "normal"],
      ["drv_demo_001", [today], "working", "normal"],
      ["drv_demo_002", [1, 3, 4, 7, 8, 12, today], "finished", "normal"],
      ["drv_demo_002", [11], "finished", "substitute"],
      ["drv_demo_003", [4, 5, 9, 13], "finished", "normal"],
      ["drv_demo_003", [12], "finished", "substitute"],
      ["drv_demo_004", [2, 3, 6, 7, 10], "finished", "normal"],
      ["drv_demo_004", [today], "working", "normal"]
    ];
    const attendanceRows = [];
    attendancePlan.forEach(([driverId, days, status, workType]) => {
      const driver = activeDemoDrivers.find((item) => item.id === driverId);
      Array.from(new Set(days.filter((day) => day >= 1 && day <= today))).forEach((day, index) => {
        attendanceRows.push({
          id: `demo_att_${driverId}_${day}`,
          date: dateInMonth(day),
          driverId,
          driverName: driver.name,
          siteId: driver.siteId,
          siteName: driver.siteName,
          status,
          workType,
          startTime: index % 2 ? "08:15" : "08:00",
          endTime: status === "working" ? "" : (index % 2 ? "18:20" : "18:00"),
          note: workType === "substitute" ? "デモ: 代走" : status === "working" ? "デモ: 稼働中" : "デモ: 通常稼働",
          monthKey: sheetMonthKey(dateInMonth(day)),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          demo: true
        });
      });
    });
    mergeRows("attendance", attendanceRows);

    const makeAdvance = (driverId, fromDay, toDay) => {
      const driver = activeDemoDrivers.find((item) => item.id === driverId);
      const dateFrom = dateInMonth(fromDay);
      const dateTo = dateInMonth(toDay);
      const workedDays = attendanceRows.filter((row) => row.driverId === driverId && row.date >= dateFrom && row.date <= dateTo && isFinishedStatus(row.status) && row.endTime).length;
      const salesAmount = Number(driver.unitPrice || 0) * workedDays;
      const requestedAmount = Math.round(salesAmount * 0.5);
      const fee = calculateAdvanceFee(requestedAmount);
      const transferAmount = Math.max(requestedAmount - fee, 0);
      return {
        id: `demo_adv_${driverId}_${fromDay}_${toDay}`,
        date: dateFrom,
        dateFrom,
        dateTo,
        driverId,
        driverName: driver.name,
        siteId: driver.siteId,
        siteName: driver.siteName,
        count: 1,
        workedDays,
        unitPrice: driver.unitPrice,
        salesAmount,
        requestedAmount,
        fee,
        transferAmount,
        amount: requestedAmount,
        tag: "通常",
        note: "デモ申請",
        bankName: driver.bankName,
        branchName: driver.branchName,
        accountNumber: driver.accountNumber,
        accountHolder: driver.accountHolder,
        createdAt: new Date(year, month, Math.min(toDay, today), 12, 0).toISOString(),
        updatedAt: new Date().toISOString(),
        demo: true
      };
    };
    mergeRows("advance", [
      makeAdvance("drv_demo_001", 1, 3),
      makeAdvance("drv_demo_002", 7, 8),
      makeAdvance("drv_demo_003", 12, 13)
    ].filter((row) => row.workedDays > 0));

    const holidayMonth = holidayTarget(base).yearMonth;
    mergeRows("holiday", [
      { id: "demo_hol_001", driverId: "drv_demo_001", driverName: "石塚 歩汰", siteId: "site_kawaguchi", siteName: "川口領家 Amazon", targetYearMonth: holidayMonth, days: [addDaysISO(todayISO(), 8), addDaysISO(todayISO(), 13)], note: "デモ休み希望", updatedAt: new Date().toISOString(), demo: true },
      { id: "demo_hol_003", driverId: "drv_demo_003", driverName: "佐藤 竜己", siteId: "site_shinjuku", siteName: "新宿上落合 Amazon", targetYearMonth: holidayMonth, days: [addDaysISO(todayISO(), 6)], note: "デモ休み希望", updatedAt: new Date().toISOString(), demo: true }
    ]);

    mergeRows("fixedShift", [
      {
        id: "demo_fix_003",
        driverId: "drv_demo_003",
        driverName: "佐藤 竜己",
        siteId: "site_shinjuku",
        siteName: "新宿上落合 Amazon",
        days: [addDaysISO(todayISO(), 6)],
        targetYearMonth: monthKey(new Date()),
        updatedAt: new Date().toISOString(),
        demo: true
      }
    ]);

    const existingLogins = readStore("adminLogins", []);
    if (!existingLogins.some((row) => row.demo)) {
      writeStore("adminLogins", [
        { id: "demo_login_001", username: "admin", success: true, loggedAt: new Date().toISOString(), client: { timeZone: "Asia/Tokyo" }, demo: true },
        ...existingLogins
      ]);
    }

    if (!localStorage.getItem(storageKey("currentDriverId"))) {
      localStorage.setItem(storageKey("currentDriverId"), "drv_demo_001");
    }
    localStorage.setItem(storageKey("demoSeedVersion"), DEMO_SEED_VERSION);
  }

  function ensureSeed() {
    if (!readStore("drivers", null)) writeStore("drivers", defaultDrivers);
    if (!readStore("sites", null)) writeStore("sites", config.SITES || []);
    if (!readStore("attendance", null)) writeStore("attendance", []);
    if (!readStore("advance", null)) writeStore("advance", []);
    if (!readStore("holiday", null)) writeStore("holiday", []);
    if (!readStore("adminLogins", null)) writeStore("adminLogins", []);
    if (!readStore("fixedShift", null)) writeStore("fixedShift", []);
    const drivers = readStore("drivers", []);
    writeStore("drivers", drivers.map((driver) => ({
      unitPrice: 22000,
      advanceFee: 500,
      bankName: "",
      branchName: "",
      accountNumber: "",
      accountHolder: "",
      ...driver
    })));
    seedDemoData();
  }

  function cryptoId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function businessDate(base = new Date()) {
    const date = new Date(base);
    if (date.getHours() < 3) date.setDate(date.getDate() - 1);
    return date;
  }

  function todayISO() {
    const date = businessDate();
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function monthKey(dateOrString = new Date()) {
    if (typeof dateOrString === "string") {
      const month = dateOrString.match(/^(\d{4})[-\/](\d{1,2})$/);
      if (month) return `${month[1]}-${pad(month[2])}`;
      const key = normalizeDateKey(dateOrString);
      if (key) return key.slice(0, 7);
    }
    const date = dateOrString instanceof Date ? dateOrString : new Date();
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  function sheetMonthKey(value) {
    return monthKeyFromValue(value).replace("-", "_");
  }

  function formatDateJP(value) {
    const key = normalizeDateKey(value);
    if (!key) return "-";
    const date = new Date(`${key}T00:00:00`);
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(date);
  }

  function formatDateTimeJP(value) {
    if (!value) return "-";
    const text = String(value).trim();
    let date = null;
    const local = text.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (local) {
      date = new Date(Number(local[1]), Number(local[2]) - 1, Number(local[3]), Number(local[4]), Number(local[5]), Number(local[6] || 0));
    } else {
      const parsed = new Date(text);
      if (!Number.isNaN(parsed.getTime())) date = parsed;
    }
    if (!date || Number.isNaN(date.getTime())) return text;
    return new Intl.DateTimeFormat("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }

  function normalizeDateKey(value) {
    if (!value) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }
    const text = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
      const parsed = new Date(text);
      if (!Number.isNaN(parsed.getTime())) {
        return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
      }
    }
    const direct = text.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (direct) return `${direct[1]}-${pad(direct[2])}-${pad(direct[3])}`;
    const jp = text.match(/^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
    if (jp) return `${jp[1]}-${pad(jp[2])}-${pad(jp[3])}`;
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
    }
    return "";
  }

  function monthKeyFromValue(value) {
    const key = normalizeDateKey(value);
    if (key) return key.slice(0, 7);
    const month = String(value || "").match(/^(\d{4})[-\/](\d{1,2})/);
    return month ? `${month[1]}-${pad(month[2])}` : "";
  }

  function sameDate(value, date) {
    return normalizeDateKey(value) === normalizeDateKey(date);
  }

  function inMonth(value, month) {
    return monthKeyFromValue(value) === String(month || "");
  }

  function normalizeStatus(value) {
    const status = String(value || "").trim();
    if (["working", "稼働中", "出勤中", "出勤"].includes(status)) return "working";
    if (["finished", "退勤済み", "退勤完了", "退勤"].includes(status)) return "finished";
    if (["off", "休み", "休", "未出勤"].includes(status)) return "off";
    return status || "off";
  }

  function isWorkingStatus(value) {
    return normalizeStatus(value) === "working";
  }

  function isFinishedStatus(value) {
    return normalizeStatus(value) === "finished";
  }

  function isOffStatus(value) {
    return normalizeStatus(value) === "off";
  }

  function normalizeAttendanceRow(row) {
    if (!row) return row;
    return {
      ...row,
      date: normalizeDateKey(row.date),
      status: normalizeStatus(row.status),
      workType: row.workType || "normal"
    };
  }

  function normalizeAdvanceRow(row) {
    if (!row) return row;
    const date = normalizeDateKey(row.date || row.dateFrom || row.createdAt);
    return {
      ...row,
      date,
      dateFrom: normalizeDateKey(row.dateFrom || row.date || date),
      dateTo: normalizeDateKey(row.dateTo || row.dateFrom || row.date || date)
    };
  }

  function normalizeNameKey(value) {
    return String(value || "").replace(/[\s　]+/g, "").trim();
  }

  function findDriverForRow(row, drivers) {
    const driverId = String(row.driverId || "").trim();
    const nameKey = normalizeNameKey(row.driverName || row.name);
    return (drivers || []).find((driver) => {
      if (driverId && String(driver.id || "") === driverId) return true;
      if (!nameKey) return false;
      return normalizeNameKey(driver.name) === nameKey || normalizeNameKey(driver.displayName) === nameKey;
    }) || null;
  }

  function findSiteForRow(row, sites) {
    const siteId = String(row.siteId || "").trim();
    const siteName = normalizeNameKey(row.siteName || row.name);
    return (sites || []).find((site) => {
      if (siteId && String(site.id || "") === siteId) return true;
      return siteName && normalizeNameKey(site.name) === siteName;
    }) || null;
  }

  function enrichAttendanceRows(rows, drivers, sites) {
    return (rows || []).map((row) => {
      const normalized = normalizeAttendanceRow(row);
      const driver = findDriverForRow(normalized, drivers);
      const site = findSiteForRow(normalized, sites) || (driver ? findSiteForRow({ siteId: driver.siteId, siteName: driver.siteName }, sites) : null);
      return {
        ...normalized,
        driverId: normalized.driverId || (driver && driver.id) || "",
        driverName: normalized.driverName || (driver && driver.name) || "",
        siteId: normalized.siteId || (driver && driver.siteId) || (site && site.id) || "",
        siteName: normalized.siteName || (driver && driver.siteName) || (site && site.name) || ""
      };
    });
  }

  function enrichAdvanceRows(rows, drivers, sites) {
    return (rows || []).map((row) => {
      const normalized = normalizeAdvanceRow(row);
      const driver = findDriverForRow(normalized, drivers);
      const site = findSiteForRow(normalized, sites) || (driver ? findSiteForRow({ siteId: driver.siteId, siteName: driver.siteName }, sites) : null);
      return {
        ...normalized,
        driverId: normalized.driverId || (driver && driver.id) || "",
        driverName: normalized.driverName || (driver && driver.name) || "",
        siteId: normalized.siteId || (driver && driver.siteId) || (site && site.id) || "",
        siteName: normalized.siteName || (driver && driver.siteName) || (site && site.name) || ""
      };
    });
  }

  function driverKeyForRow(row) {
    return String(row.driverId || "").trim() || normalizeNameKey(row.driverName || row.name);
  }

  function rowSortTime(row) {
    const value = row.updatedAt || row.createdAt || row.loggedAt || row.date || "";
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
    const dateKey = normalizeDateKey(value);
    if (dateKey) return new Date(`${dateKey}T00:00:00`).getTime();
    return 0;
  }

  function uniqueLatestAttendanceRows(rows) {
    const map = {};
    (rows || []).forEach((row) => {
      const key = driverKeyForRow(row);
      if (!key) return;
      const current = map[key];
      if (!current || rowSortTime(row) >= rowSortTime(current)) {
        map[key] = row;
      }
    });
    return Object.values(map).sort((a, b) => {
      const aRank = isWorkingStatus(a.status) ? 0 : isFinishedStatus(a.status) ? 1 : 2;
      const bRank = isWorkingStatus(b.status) ? 0 : isFinishedStatus(b.status) ? 1 : 2;
      return aRank - bRank || String(a.siteName || "").localeCompare(String(b.siteName || ""), "ja") || String(a.driverName || "").localeCompare(String(b.driverName || ""), "ja");
    });
  }

  function formatMoney(value) {
    return `¥${Number(value || 0).toLocaleString("ja-JP")}`;
  }

  function formatShortDate(value) {
    const key = normalizeDateKey(value);
    if (!key) return "-";
    const date = new Date(`${key}T00:00:00`);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function addDaysISO(value, days) {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function calculateAdvanceFee(requestedAmount) {
    return Math.ceil(Number(requestedAmount || 0) * 0.08 + 260);
  }

  function rangesOverlap(startA, endA, startB, endB) {
    startA = normalizeDateKey(startA);
    endA = normalizeDateKey(endA);
    startB = normalizeDateKey(startB);
    endB = normalizeDateKey(endB);
    if (!startA || !endA || !startB || !endB) return false;
    const aStart = startA <= endA ? startA : endA;
    const aEnd = startA <= endA ? endA : startA;
    const bStart = startB <= endB ? startB : endB;
    const bEnd = startB <= endB ? endB : startB;
    return aStart <= bEnd && bStart <= aEnd;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showToast(message) {
    const toast = $("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 2100);
  }

  function setLoading(active, text) {
    const loading = $("loading");
    if (!loading) return;
    loading.firstElementChild.textContent = text || "処理中...";
    loading.classList.toggle("show", Boolean(active));
  }

  function setSwipeConfirmEnabled(id, enabled, detail) {
    const swipe = $(id);
    if (!swipe) return;
    swipe.classList.toggle("disabled", !enabled);
    swipe.setAttribute("aria-disabled", enabled ? "false" : "true");
    const detailNode = swipe.querySelector("[data-swipe-detail]");
    if (detailNode && detail) detailNode.textContent = detail;
  }

  function resetSwipeConfirm(swipe) {
    if (!swipe) return;
    swipe.style.setProperty("--swipe-x", "0px");
    swipe.style.setProperty("--swipe-progress", "0%");
    swipe.classList.remove("dragging", "complete");
  }

  function bindSwipeConfirm(id, onConfirm) {
    const swipe = $(id);
    if (!swipe) return;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let maxX = 1;
    let dragging = false;
    let horizontalIntent = false;
    let pointerId = null;

    const releasePointer = () => {
      if (pointerId == null) return;
      try {
        if (swipe.hasPointerCapture(pointerId)) swipe.releasePointerCapture(pointerId);
      } catch (error) {
        // Older mobile browsers can throw after pointer cancellation.
      }
      pointerId = null;
    };

    const cancelDrag = () => {
      dragging = false;
      horizontalIntent = false;
      releasePointer();
      resetSwipeConfirm(swipe);
    };

    const confirm = () => {
      if (swipe.dataset.busy === "1" || swipe.classList.contains("disabled")) return;
      dragging = false;
      horizontalIntent = false;
      releasePointer();
      swipe.dataset.busy = "1";
      swipe.classList.add("complete");
      swipe.style.setProperty("--swipe-x", `${maxX}px`);
      swipe.style.setProperty("--swipe-progress", "100%");
      if (navigator.vibrate) navigator.vibrate([18, 32, 18]);
      window.setTimeout(() => {
        onConfirm();
        window.setTimeout(() => {
          swipe.dataset.busy = "0";
          resetSwipeConfirm(swipe);
        }, 420);
      }, 120);
    };

    const moveTo = (clientX) => {
      const dx = Math.max(0, Math.min(clientX - startX, maxX));
      currentX = dx;
      const progress = Math.round((dx / maxX) * 100);
      swipe.style.setProperty("--swipe-x", `${dx}px`);
      swipe.style.setProperty("--swipe-progress", `${progress}%`);
    };

    swipe.addEventListener("pointerdown", (event) => {
      if (swipe.classList.contains("disabled") || swipe.dataset.busy === "1") return;
      if (event.button != null && event.button !== 0) return;
      dragging = true;
      horizontalIntent = false;
      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      currentX = 0;
      maxX = Math.max(1, swipe.clientWidth - 64);
      swipe.classList.add("dragging");
      swipe.setPointerCapture(event.pointerId);
    });
    swipe.addEventListener("pointermove", (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (!horizontalIntent) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          cancelDrag();
          return;
        }
        horizontalIntent = true;
      }
      if (event.cancelable) event.preventDefault();
      moveTo(event.clientX);
    });
    swipe.addEventListener("pointerup", (event) => {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      horizontalIntent = false;
      releasePointer();
      swipe.classList.remove("dragging");
      if (currentX / maxX >= .82) confirm();
      else resetSwipeConfirm(swipe);
    });
    swipe.addEventListener("pointercancel", cancelDrag);
    swipe.addEventListener("lostpointercapture", () => {
      if (dragging) cancelDrag();
    });
    swipe.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      maxX = Math.max(1, swipe.clientWidth - 64);
      confirm();
    });
  }

  function playCompletionCelebration(title, detail, tone = "green") {
    const existing = document.querySelector(".completion-celebration");
    if (existing) existing.remove();
    const celebration = document.createElement("div");
    celebration.className = `completion-celebration ${tone}`;
    celebration.setAttribute("role", "status");
    celebration.innerHTML = `
      <div class="completion-burst" aria-hidden="true">
        ${Array.from({ length: 18 }).map((_, index) => `<i style="--i:${index};"></i>`).join("")}
      </div>
      <div class="completion-card">
        <span class="completion-ring"></span>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(detail || "")}</small>
      </div>
    `;
    document.body.appendChild(celebration);
    if (navigator.vibrate) navigator.vibrate([24, 36, 24]);
    window.setTimeout(() => celebration.classList.add("leaving"), 1350);
    window.setTimeout(() => celebration.remove(), 1850);
  }

  function applyDemoModeVisibility() {
    document.querySelectorAll(".demo-only").forEach((node) => {
      node.classList.toggle("hidden", Boolean(config.API_BASE_URL));
    });
  }

  function getCurrentDriver() {
    const params = new URLSearchParams(location.search);
    const requested = params.get("driverId") || localStorage.getItem(storageKey("currentDriverId"));
    const drivers = readStore("drivers", defaultDrivers);
    const driver = drivers.find((item) => item.id === requested) || drivers.find((item) => item.lifecycle !== "inactive") || defaultDrivers[0];
    localStorage.setItem(storageKey("currentDriverId"), driver.id);
    return driver;
  }

  async function resolveCurrentDriver() {
    const params = new URLSearchParams(location.search);
    const requested = params.get("driverId") || "";
    if (config.API_BASE_URL) return requireDriverLogin(requested);
    return getCurrentDriver();
  }

  function readDriverSession() {
    try {
      return JSON.parse(localStorage.getItem(driverSessionKey) || "null");
    } catch (error) {
      return null;
    }
  }

  function writeDriverSession(driver, token) {
    localStorage.setItem(driverSessionKey, JSON.stringify({ driver, token, savedAt: new Date().toISOString() }));
    setDriverToken(token);
  }

  function clearDriverSession() {
    localStorage.removeItem(driverSessionKey);
    setDriverToken("");
  }

  function warmDriverSession(session) {
    if (!config.API_BASE_URL || !session || !session.driver || !session.token) return;
    if (driverSessionWarmupPromise) return;
    driverSessionWarmupPromise = (async () => {
      try {
        const profile = await getLineProfile({ preferCached: true, refreshInBackground: true });
        const checked = await apiPost({
          type: "driver_session_check",
          driverToken: session.token,
          driverId: session.driver.id,
          lineUserId: profile && profile.userId ? profile.userId : "",
          lineDisplayName: profile && profile.displayName ? profile.displayName : ""
        }, { skipAdminToken: true });
        if (checked && checked.driver) {
          writeDriverSession(checked.driver, session.token);
          upsertLocal("drivers", checked.driver, (driver) => driver.id === checked.driver.id);
          localStorage.setItem(storageKey("currentDriverId"), checked.driver.id);
          return;
        }
        throw new Error("ログイン状態を更新できませんでした");
      } catch (error) {
        clearDriverSession();
        localStorage.removeItem(storageKey("currentDriverId"));
        showToast("ログイン状態が切れていたため、再読み込みします");
        window.setTimeout(() => location.reload(), 400);
      } finally {
        driverSessionWarmupPromise = null;
      }
    })();
  }

  async function tryDriverAutoLoginByLine(requestedDriverId = "") {
    if (!config.API_BASE_URL) return null;
    const profile = await getLineProfile({ preferCached: true, refreshInBackground: true });
    if (!profile || !profile.userId) return null;
    const result = await apiPost({
      type: "driver_line_auto_login",
      lineUserId: profile.userId,
      lineDisplayName: profile.displayName || "",
      driverId: requestedDriverId || ""
    }, { skipAdminToken: true });
    if (!result || !result.found || !result.driver || !result.token) return null;
    writeDriverSession(result.driver, result.token);
    upsertLocal("drivers", result.driver, (driver) => driver.id === result.driver.id);
    localStorage.setItem(storageKey("currentDriverId"), result.driver.id);
    return result.driver;
  }

  function clearDriverAttendanceCache(driverId, date) {
    writeStore("attendance", readStore("attendance", []).filter((row) => !(row.driverId === driverId && sameDate(row.date, date))));
  }

  async function requireDriverLogin(requestedDriverId) {
    const main = document.querySelector("main.narrow");
    const session = readDriverSession();
    const cachedProfile = readLineProfileCache();
    const cachedLineUserId = cachedProfile && cachedProfile.userId ? String(cachedProfile.userId) : "";
    const canReuseSession = session && session.driver && session.token && (!requestedDriverId || session.driver.id === requestedDriverId);

    if (canReuseSession) {
      const sessionLineUserId = String(session.driver.lineUserId || "");
      if (cachedLineUserId && sessionLineUserId && cachedLineUserId !== sessionLineUserId) {
        clearDriverSession();
        localStorage.removeItem(storageKey("currentDriverId"));
      } else {
        setDriverToken(session.token);
        localStorage.setItem(storageKey("currentDriverId"), session.driver.id);
        warmDriverSession(session);
        return session.driver;
      }
    }

    if (config.API_BASE_URL) {
      setLoading(true, "LINEのドライバー情報を確認中...");
      try {
        const autoDriver = await tryDriverAutoLoginByLine(requestedDriverId);
        if (autoDriver) {
          if (main) main.classList.remove("hidden");
          return autoDriver;
        }
      } catch (error) {
        // Fall back to manual login below.
      } finally {
        setLoading(false);
      }
    }

    clearDriverSession();
    localStorage.removeItem(storageKey("currentDriverId"));
    if (main) main.classList.add("hidden");
    return new Promise((resolve) => {
      const stage = document.createElement("section");
      stage.className = "login-stage driver-login-stage";
      stage.id = "driverLoginStage";
      stage.innerHTML = `
        <div class="login-card">
          <span class="eyebrow">Driver Gate</span>
          <h1>ドライバーログイン</h1>
          <p>スプレッドシートに登録された名前と4桁PINで確認します。</p>
          <label class="field">
            <span>名前</span>
            <input id="driverLoginName" autocomplete="username" placeholder="例: 石塚 歩汰">
          </label>
          <label class="field">
            <span>4桁PIN</span>
            <input id="driverLoginPin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" placeholder="1234">
          </label>
          <button class="button primary" id="driverLoginBtn">ログインする</button>
        </div>
      `;
      document.body.prepend(stage);
      const login = async () => {
        const name = $("driverLoginName").value.trim();
        const pin = $("driverLoginPin").value.trim();
        if (!name || !/^\d{4}$/.test(pin)) {
          showToast("名前と4桁PINを入力してください");
          return;
        }
        setLoading(true, "ドライバー情報を確認中...");
        try {
          const profile = await getLineProfile({ preferCached: true, refreshInBackground: true });
          const result = await apiPost({
            type: "driver_auth",
            name,
            pin,
            driverId: requestedDriverId || "",
            lineUserId: profile && profile.userId ? profile.userId : "",
            lineDisplayName: profile && profile.displayName ? profile.displayName : ""
          }, { skipAdminToken: true });
          if (!result || !result.driver || !result.token) throw new Error("ドライバーログインに失敗しました");
          writeDriverSession(result.driver, result.token);
          upsertLocal("drivers", result.driver, (driver) => driver.id === result.driver.id);
          localStorage.setItem(storageKey("currentDriverId"), result.driver.id);
          stage.remove();
          if (main) main.classList.remove("hidden");
          showToast("ログインしました");
          resolve(result.driver);
        } catch (error) {
          clearDriverSession();
          showToast(error.message);
        } finally {
          setLoading(false);
        }
      };
      $("driverLoginBtn").addEventListener("click", login);
      $("driverLoginPin").addEventListener("keydown", (event) => {
        if (event.key === "Enter") login();
      });
      $("driverLoginName").focus();
    });
  }

  function renderDriver(driver) {
    const initial = $("driverInitial");
    const name = $("driverName");
    const site = $("driverSite");
    const driverName = String(driver && driver.name ? driver.name : "未登録").trim();
    const siteName = String(driver && driver.siteName ? driver.siteName : "未登録").trim();
    const contractType = String(driver && driver.contractType ? driver.contractType : "契約").trim();
    if (initial) initial.textContent = driverName.slice(0, 1) || "P";
    if (name) name.textContent = driverName;
    if (site) site.textContent = `${siteName} ・ ${contractType}`;
    if ($("advanceUnitPriceLabel")) $("advanceUnitPriceLabel").textContent = formatMoney((driver && driver.unitPrice) || 0);
    const card = name ? name.closest(".person-card") : null;
    if (card && config.API_BASE_URL && !$("driverLogoutBtn")) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "button ghost mini";
      button.id = "driverLogoutBtn";
      button.textContent = "変更";
      button.addEventListener("click", () => {
        clearDriverSession();
        localStorage.removeItem(storageKey("currentDriverId"));
        location.reload();
      });
      card.appendChild(button);
    }
  }

  function withAdminToken(payload) {
    const token = getAdminToken();
    return token ? { ...payload, adminToken: token } : payload;
  }

  async function apiPost(payload, options = {}) {
    if (!config.API_BASE_URL) {
      await new Promise((resolve) => setTimeout(resolve, 360));
      return { ok: true, local: true, updatedAt: new Date().toISOString() };
    }
    const bodyPayload = options.skipAdminToken ? payload : withAdminToken(payload);
    const fetchOptions = {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(bodyPayload)
    };
    if (options.keepalive) fetchOptions.keepalive = true;
    const response = await fetch(config.API_BASE_URL, fetchOptions);
    if (!response.ok) throw new Error("GASへの送信に失敗しました");
    const result = await response.json().catch(() => ({ ok: true }));
    if (result && result.ok === false) {
      const message = result.error || "GAS処理に失敗しました";
      if (/ドライバーログイン/.test(message)) clearDriverSession();
      throw new Error(message);
    }
    return result;
  }

  async function apiGet(params) {
    if (!config.API_BASE_URL) return null;
    const requestParams = getAdminToken()
      ? { ...params, adminToken: getAdminToken(), _: Date.now() }
      : { ...params, _: Date.now() };
    const url = `${config.API_BASE_URL}?${new URLSearchParams(requestParams).toString()}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("GASからの取得に失敗しました");
    return response.json();
  }

  async function apiGetDriver(params) {
    if (!config.API_BASE_URL) return null;
    const requestParams = { ...params, driverToken: getDriverToken(), _: Date.now() };
    const url = `${config.API_BASE_URL}?${new URLSearchParams(requestParams).toString()}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("GASからの取得に失敗しました");
    const result = await response.json();
    if (result && result.ok === false) {
      const message = result.error || "GAS処理に失敗しました";
      if (/ドライバーログイン/.test(message)) clearDriverSession();
      throw new Error(message);
    }
    return result;
  }

  function upsertLocal(listName, row, matcher) {
    const rows = readStore(listName, []);
    const normalizedRow = listName === "attendance"
      ? normalizeAttendanceRow(row)
      : listName === "advance"
        ? normalizeAdvanceRow(row)
        : row;
    const index = rows.findIndex(matcher);
    if (index >= 0) rows[index] = { ...rows[index], ...normalizedRow };
    else rows.push(normalizedRow);
    writeStore(listName, rows);
    return normalizedRow;
  }

  function replaceMonthRows(listName, month, remoteRows, monthSelector) {
    const rows = readStore(listName, []);
    const kept = rows.filter((row) => monthSelector(row) !== month);
    const normalizedRows = (remoteRows || []).map((row) => {
      if (listName === "attendance") return normalizeAttendanceRow(row);
      if (listName === "advance") return normalizeAdvanceRow(row);
      return row;
    });
    writeStore(listName, [...kept, ...normalizedRows]);
  }

  function normalizeShiftRows(rows, month) {
    return (rows || []).map((row) => ({
      ...row,
      targetYearMonth: row.targetYearMonth || month,
      days: Array.isArray(row.days) ? row.days : String(row.days || "").split(",").map((day) => day.trim()).filter(Boolean)
    }));
  }

  const CLOCK_IN_MESSAGES = [
    "今日もいい一日にしていきましょう。",
    "今日の一歩が、しっかり未来につながります。",
    "安全第一で、今日も気持ちよくスタートしましょう。",
    "今日もあなたの稼働が現場を支えています。",
    "焦らず、確実に。今日も良い仕事をしていきましょう。",
    "今日も前向きに、ひとつずつ進めていきましょう。",
    "出勤確認できました。今日も頼りにしています。",
    "今日の積み重ねが、明日の結果につながります。",
    "無理せず、でもしっかり。今日もいきましょう。",
    "今日も安全に、そして自分らしく頑張りましょう。",
    "いいスタートです。今日も一日よろしくお願いします。",
    "今日も現場にとって大事な一日です。",
    "落ち着いていけば大丈夫です。今日もよろしくお願いします。",
    "あなたの一件一件が、誰かの助けになっています。",
    "今日も丁寧な仕事でいきましょう。",
    "出勤ありがとうございます。今日も良い流れを作っていきましょう。",
    "今日も事故なく、気持ちよく終われる一日にしましょう。",
    "朝の一歩、しっかり確認しました。",
    "今日も自分のペースを大事にしていきましょう。",
    "安全に終えることが、今日一番の成果です。",
    "今日も積み重ねていきましょう。必ず力になります。",
    "いつも通りで大丈夫です。落ち着いていきましょう。",
    "今日も前向きなスタート、ありがとうございます。",
    "あなたの仕事が、会社と現場を支えています。",
    "今日もいい稼働にしていきましょう。",
    "一件ずつ、確実に。今日も良い仕事をお願いします。",
    "今日もここからスタートです。気持ちよくいきましょう。",
    "安全運転で、最後までいい一日にしましょう。",
    "今日もチャンスの一日です。前向きにいきましょう。",
    "出勤完了です。今日もいい仕事を積み上げましょう。",
    "今日も頼れる稼働、期待しています。",
    "一日の始まりを確認しました。今日もよろしくお願いします。",
    "今日もあなたの力が必要です。",
    "落ち着いた判断が、一番かっこいい仕事です。",
    "今日も真面目な一歩をありがとうございます。",
    "今日の頑張りは、ちゃんと積み上がります。",
    "無事故で帰ってくることが一番大事です。",
    "今日も前を向いて、いい一日にしましょう。",
    "あなたの稼働が、今日の現場を動かします。",
    "今日も配送のプロとして、丁寧にいきましょう。",
    "いい仕事は、落ち着いたスタートから始まります。",
    "今日も気持ちよくスタートしましょう。",
    "一件一件の積み重ねが信頼になります。",
    "今日も安全に、確実に、前向きに。",
    "出勤ありがとうございます。今日も良い結果につなげましょう。",
    "今日の頑張りが、次の自信になります。",
    "今日も現場に安心を届けていきましょう。",
    "無理なく、でも確実に。今日も進めていきましょう。",
    "今日もあなたらしく、いい仕事をしましょう。",
    "本日のスタート確認完了です。最高の一日にしましょう。"
  ];

  const CLOCK_OUT_MESSAGES = [
    "本日も本当にお疲れ様でした。",
    "今日の頑張り、しっかり積み上がっています。",
    "無事に終えられたことが一番の成果です。",
    "今日も現場を支えてくれてありがとうございました。",
    "一日走り切った自分を、ちゃんと褒めてください。",
    "今日の稼働、本当に助かりました。",
    "最後までやり切ってくれてありがとうございます。",
    "今日も確かな一日を積み上げました。",
    "退勤確認しました。しっかり休んでください。",
    "今日の頑張りは、必ず次につながります。",
    "本日の勤務完了です。お疲れ様でした。",
    "今日も責任ある稼働をありがとうございました。",
    "一件一件の積み重ね、お疲れ様でした。",
    "今日もよく走り切りました。",
    "あなたの稼働が、今日の現場を支えていました。",
    "お疲れ様でした。帰り道も安全運転でお願いします。",
    "今日も大事な仕事をやり切りました。",
    "本日もありがとうございました。しっかり休みましょう。",
    "今日の努力は、ちゃんと形になっています。",
    "退勤完了です。今日もナイス稼働でした。",
    "一日やり切った達成感を大事にしてください。",
    "今日も前に進んだ一日でした。",
    "最後まで丁寧な対応ありがとうございました。",
    "今日の積み重ねが、明日の力になります。",
    "お疲れ様でした。今日はしっかり体を休めてください。",
    "無事完了です。今日もいい仕事でした。",
    "本日の稼働を確認しました。ありがとうございました。",
    "今日も現場に安心を届けてくれました。",
    "走り切った一日は、ちゃんと価値があります。",
    "今日も自分の仕事をやり切りましたね。",
    "退勤確認できました。胸を張って休んでください。",
    "今日も一日、本当にありがとうございました。",
    "あなたの頑張りが、会社の力になっています。",
    "お疲れ様でした。明日への準備は休むことからです。",
    "今日も確実な稼働、ありがとうございました。",
    "最後まで責任を持ってくれてありがとうございます。",
    "今日も良い一日を積み上げました。",
    "退勤完了です。ゆっくりリセットしてください。",
    "今日の頑張りは、ちゃんと見えています。",
    "本日もナイスワークでした。",
    "一日をやり切った自分に、お疲れ様を言ってあげてください。",
    "今日も大切な荷物を届けてくれてありがとうございました。",
    "無事に終われたことが何よりです。",
    "今日も本当に助かりました。",
    "お疲れ様でした。次の稼働にもつながる一日です。",
    "今日も信頼を積み上げる仕事でした。",
    "勤務完了です。しっかり休んでまた整えましょう。",
    "今日の一日は、ちゃんと意味のある一日です。",
    "最後まで走り切ってくれてありがとうございました。",
    "本日も最高の稼働、お疲れ様でした。"
  ];

  function pickClockMessage(action) {
    const messages = action === "start" ? CLOCK_IN_MESSAGES : CLOCK_OUT_MESSAGES;
    return messages[Math.floor(Math.random() * messages.length)] || "";
  }

  async function initAttendance() {
    const driver = await resolveCurrentDriver();
    renderDriver(driver);
    const workDate = todayISO();
    $("workDateText").textContent = formatDateJP(workDate);
    const rows = readStore("attendance", []);
    let existing = config.API_BASE_URL ? null : rows.map(normalizeAttendanceRow).find((row) => row.driverId === driver.id && sameDate(row.date, workDate));
    const state = {
      status: existing ? existing.status : "off",
      startTime: existing ? existing.startTime : "",
      endTime: existing ? existing.endTime : ""
    };
    let attendanceResolved = !config.API_BASE_URL;
    let saving = false;
    let actionLockedUntil = 0;
    let lastSavedAction = "";
    let lastClockMessage = "";

    const note = $("attendanceNote");
    if (existing && existing.note) note.value = existing.note;

    const setText = (id, value, fallback = "未登録") => {
      const node = $(id);
      if (!node) return;
      const text = String(value == null ? "" : value).trim();
      node.textContent = text && text !== "undefined" && text !== "null" && text !== "NaN" && text !== "Invalid Date"
        ? text
        : fallback;
    };

    const timeText = (value) => {
      const text = String(value == null ? "" : value).trim();
      return text && text !== "undefined" && text !== "null" ? text : "未記録";
    };

    const setDoneMessage = (action, finished) => {
      const title = $("attendanceDone") ? $("attendanceDone").querySelector("h2") : null;
      if (!title) return;
      if (action === "start" && !finished) {
        title.textContent = "出勤を保存しました";
        if (!lastClockMessage) lastClockMessage = pickClockMessage("start");
        setText("doneAttendanceText", `出勤時刻 ${timeText(state.startTime)} / ${lastClockMessage}`, "保存しました");
        return;
      }
      title.textContent = action === "end" ? "退勤を保存しました" : "本日の勤務は完了しています";
      if (!lastClockMessage) lastClockMessage = pickClockMessage("end");
      setText("doneAttendanceText", `出勤 ${timeText(state.startTime)} / 退勤 ${timeText(state.endTime)} / ${lastClockMessage}`, "保存しました");
    };

    function render() {
      if (!attendanceResolved) {
        document.body.dataset.attendanceState = "loading";
        setText("attendanceLead", "ドライバー情報と本日の勤務状況を確認しています。", "読込中");
        setText("attendanceStatus", "確認中", "確認中");
        setText("attendanceStartTime", "読込中", "読込中");
        setText("attendanceEndTime", "読込中", "読込中");
        setText("attendanceNextActionLabel", "確認中", "確認中");
        setText("attendanceActionHint", "少しお待ちください", "少しお待ちください");
        $("startWorkBtn").classList.add("hidden");
        $("endWorkBtn").classList.add("hidden");
        $("startWorkSwipe").classList.add("hidden");
        $("endWorkSwipe").classList.add("hidden");
        $("attendanceDone").classList.add("hidden");
        $("attendanceLiveCard").classList.remove("working", "finished", "ready");
        setText("attendanceActionTitle", "勤務状況を確認しています", "読込中");
        setText("attendanceActionText", "すぐに表示されます。少しだけお待ちください。", "読込中");
        return;
      }
      const working = isWorkingStatus(state.status);
      const finished = isFinishedStatus(state.status);
      const stateKey = finished ? "finished" : working ? "working" : "off";
      document.body.dataset.attendanceState = stateKey;
      setText("attendanceLead", "3:00切替の業務日で保存します。", "勤務報告");
      setText("attendanceStatus", working ? "稼働中" : finished ? "退勤済み" : "未出勤", "未出勤");
      setText("attendanceStartTime", timeText(state.startTime), "未記録");
      setText("attendanceEndTime", timeText(state.endTime), "未記録");
      $("startWorkBtn").classList.toggle("hidden", working || finished);
      $("endWorkBtn").classList.toggle("hidden", !working);
      const actionBusy = saving || Date.now() < actionLockedUntil;
      $("startWorkBtn").disabled = actionBusy;
      $("endWorkBtn").disabled = actionBusy;
      $("startWorkSwipe").classList.toggle("hidden", working || finished);
      $("endWorkSwipe").classList.toggle("hidden", !working);
      setSwipeConfirmEnabled("startWorkSwipe", !actionBusy && !working && !finished, actionBusy ? "記録中..." : "右へスワイプして出勤");
      setSwipeConfirmEnabled("endWorkSwipe", !actionBusy && working, actionBusy ? "記録中..." : "右へスワイプして退勤");
      setText("attendanceNextActionLabel", finished ? "本日の報告" : "次の操作", "次の操作");
      setText("attendanceActionHint", actionBusy ? "記録中" : finished ? "完了済み" : working ? "退勤を記録" : "出勤を記録", "右へスワイプ");
      $("attendanceDone").classList.toggle("hidden", !(finished || lastSavedAction));
      $("attendanceLiveCard").classList.toggle("ready", !working && !finished);
      $("attendanceLiveCard").classList.toggle("working", working);
      $("attendanceLiveCard").classList.toggle("finished", finished);
      setText(
        "attendanceActionTitle",
        working ? "現在稼働中です" : finished ? "本日の勤務は完了しています" : "本日の出勤を記録してください",
        "本日の勤務情報はまだありません"
      );
      setText(
        "attendanceActionText",
        working
          ? `出勤時刻 ${timeText(state.startTime)}。業務終了後に退勤を記録してください。`
          : finished
            ? "お疲れ様でした。前払い対象日として反映されます。"
            : "連絡事項がなければ、そのまま右へスワイプしてください。",
        "本日の勤務情報はまだありません"
      );
      if (finished || lastSavedAction) setDoneMessage(lastSavedAction, finished);
    }

    render();
    if (config.API_BASE_URL) {
      try {
        const remote = await apiGetDriver({ type: "driver_attendance", driverId: driver.id, date: workDate });
        if (remote && remote.found && remote.row) {
          existing = normalizeAttendanceRow(remote.row);
          upsertLocal("attendance", existing, (row) => row.driverId === driver.id && sameDate(row.date, workDate));
        } else {
          existing = null;
          clearDriverAttendanceCache(driver.id, workDate);
        }
      } catch (error) {
        existing = null;
        clearDriverAttendanceCache(driver.id, workDate);
        showToast("本日の勤務情報を取得できませんでした。通信状況を確認してください");
      } finally {
        attendanceResolved = true;
        state.status = existing ? existing.status : "off";
        state.startTime = existing ? existing.startTime : "";
        state.endTime = existing ? existing.endTime : "";
        if (existing && existing.note) note.value = existing.note;
        render();
      }
    }

    async function save(action) {
      if (saving || !attendanceResolved || Date.now() < actionLockedUntil) return;
      if (action === "start" && isWorkingStatus(state.status)) {
        showToast("すでに出勤済みです");
        return;
      }
      if (action === "start" && isFinishedStatus(state.status)) {
        showToast("すでに退勤済みです");
        return;
      }
      if (action === "end" && !isWorkingStatus(state.status)) {
        showToast(isFinishedStatus(state.status) ? "すでに退勤済みです" : "先に出勤を記録してください");
        return;
      }
      saving = true;
      actionLockedUntil = Date.now() + 900;
      render();
      const previousExisting = existing ? { ...existing } : null;
      const previousState = { ...state };
      const now = new Date();
      const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const payload = {
        type: "attendance",
        action,
        driverToken: getDriverToken(),
        id: existing && existing.id ? existing.id : cryptoId("att"),
        date: workDate,
        driverId: driver.id,
        driverName: driver.name,
        siteId: driver.siteId,
        siteName: driver.siteName,
        status: action === "start" ? "working" : "finished",
        workType: "normal",
        startTime: action === "start" ? time : state.startTime,
        endTime: action === "end" ? time : "",
        note: note.value.trim(),
        monthKey: sheetMonthKey(workDate),
        updatedAt: new Date().toISOString()
      };
      setLoading(false);
      upsertLocal("attendance", payload, (row) => row.driverId === driver.id && sameDate(row.date, workDate));
      existing = payload;
      state.status = payload.status;
      state.startTime = payload.startTime;
      state.endTime = payload.endTime;
      lastSavedAction = action;
      lastClockMessage = pickClockMessage(action);
      actionLockedUntil = Date.now() + 1400;
      render();
      window.setTimeout(render, 1450);
      playCompletionCelebration(
        action === "start" ? "出勤完了" : "退勤完了",
        action === "start" ? `${time} に出勤を記録しました。${lastClockMessage}` : `${time} に退勤を記録しました。${lastClockMessage}`,
        action === "start" ? "blue" : "green"
      );
      showToast(action === "start" ? "出勤を記録しています" : "退勤を記録しています");
      try {
        await apiPost(payload, { keepalive: true });
        showToast(action === "start" ? "出勤を保存しました" : "退勤を保存しました");
      } catch (error) {
        existing = previousExisting;
        state.status = previousState.status;
        state.startTime = previousState.startTime;
        state.endTime = previousState.endTime;
        lastSavedAction = "";
        lastClockMessage = "";
        if (previousExisting) {
          upsertLocal("attendance", previousExisting, (row) => row.driverId === driver.id && sameDate(row.date, workDate));
        } else {
          writeStore("attendance", readStore("attendance", []).filter((row) => !(row.driverId === driver.id && sameDate(row.date, workDate))));
        }
        showToast(`${action === "start" ? "出勤" : "退勤"}を保存できませんでした。通信状況を確認して再度お試しください`);
      } finally {
        saving = false;
        setLoading(false);
        render();
      }
    }

    $("startWorkBtn").addEventListener("click", () => save("start"));
    $("endWorkBtn").addEventListener("click", () => save("end"));
    bindSwipeConfirm("startWorkSwipe", () => $("startWorkBtn").click());
    bindSwipeConfirm("endWorkSwipe", () => $("endWorkBtn").click());
    $("resetDemoBtn").addEventListener("click", () => {
      const filtered = readStore("attendance", []).filter((row) => !(row.driverId === driver.id && sameDate(row.date, workDate)));
      writeStore("attendance", filtered);
      location.reload();
    });
    render();
  }

  async function initAdvance() {
    const driver = await resolveCurrentDriver();
    renderDriver(driver);
    $("advanceDateFrom").value = "";
    $("advanceDateTo").value = "";
    let hasOverlap = false;
    let displayedTransferAmount = 0;
    let moneyAnimFrame = null;
    let calendarCursor = new Date(`${todayISO()}T00:00:00`);
    let calendarWorkedDates = new Set();
    let calendarAppliedDates = new Set();
    let selectedAvailableDates = [];

    function playMoneyBurst() {
      const card = document.querySelector(".money-focus, .advance-v2-transfer, .advance-preview-transfer-row");
      const burst = $("coinBurst");
      if (!card || !burst) return;
      card.classList.remove("bump");
      burst.classList.remove("play");
      void card.offsetWidth;
      card.classList.add("bump");
      burst.classList.add("play");
    }

    function animateTransferAmount(nextAmount) {
      const target = $("advanceTransferAmount");
      const from = displayedTransferAmount;
      const to = Number(nextAmount || 0);
      if (moneyAnimFrame) cancelAnimationFrame(moneyAnimFrame);
      if (from === to) {
        target.textContent = formatMoney(to);
        return;
      }
      playMoneyBurst();
      const startedAt = performance.now();
      const duration = 720;
      const easeOut = (t) => 1 - Math.pow(1 - t, 3);
      function tick(now) {
        const progress = Math.min(1, (now - startedAt) / duration);
        const value = Math.round(from + (to - from) * easeOut(progress));
        target.textContent = formatMoney(value);
        if (progress < 1) {
          moneyAnimFrame = requestAnimationFrame(tick);
        } else {
          displayedTransferAmount = to;
          target.textContent = formatMoney(to);
        }
      }
      moneyAnimFrame = requestAnimationFrame(tick);
    }

    function setQuickPeriodActive(days) {
      document.querySelectorAll("[data-period-days]").forEach((button) => {
        button.classList.toggle("active", Number(button.dataset.periodDays) === Number(days));
      });
    }

    function selectedDateRange() {
      const sorted = selectedAvailableDates.slice().sort();
      return {
        dateFrom: sorted[0] || "",
        dateTo: sorted[sorted.length - 1] || ""
      };
    }

    function syncSelectedDateRange() {
      const range = selectedDateRange();
      $("advanceDateFrom").value = range.dateFrom;
      $("advanceDateTo").value = range.dateTo;
      if ($("advanceRangeLabel")) {
        $("advanceRangeLabel").textContent = range.dateFrom && range.dateTo
          ? `${formatShortDate(range.dateFrom)}〜${formatShortDate(range.dateTo)}`
          : "稼働日を選択";
      }
      setQuickPeriodActive(0);
      return range;
    }

    function syncRangeLabel() {
      syncSelectedDateRange();
      renderAdvanceCalendar();
    }

    function currentDriverAdvances() {
      return readStore("advance", [])
        .map(normalizeAdvanceRow)
        .filter((row) => row.driverId === driver.id)
        .sort((a, b) => String(b.dateFrom || b.date || "").localeCompare(String(a.dateFrom || a.date || "")));
    }

    function currentMonthKey() {
      return `${calendarCursor.getFullYear()}-${pad(calendarCursor.getMonth() + 1)}`;
    }

    function dayOfWeekLabel(date) {
      const parsed = new Date(`${date}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return "";
      return ["日", "月", "火", "水", "木", "金", "土"][parsed.getDay()];
    }

    function normalizeSelectedDateList(value) {
      const list = Array.isArray(value) ? value : String(value || "").split(/[\n,、，]+/);
      return list
        .map((item) => normalizeDateKey(String(item || "").trim()))
        .filter(Boolean)
        .filter((item, index, values) => values.indexOf(item) === index)
        .sort();
    }

    function advanceRowSelectedDates(row) {
      return normalizeSelectedDateList(row && row.selectedDates);
    }

    function localWorkedDatesForMonth(month) {
      return new Set(readStore("attendance", [])
        .map(normalizeAttendanceRow)
        .filter((row) => row.driverId === driver.id && inMonth(row.date, month) && isFinishedStatus(row.status) && row.endTime)
        .map((row) => row.date));
    }

    async function loadAdvanceCalendarMonth() {
      const month = currentMonthKey();
      calendarWorkedDates = localWorkedDatesForMonth(month);
      if (config.API_BASE_URL) {
        try {
          const remote = await apiGetDriver({ type: "advance_calendar", driverId: driver.id, month });
          if (remote && remote.ok) {
            calendarWorkedDates = new Set(remote.workedDates || []);
            calendarAppliedDates = new Set(remote.appliedDates || []);
            if (Array.isArray(remote.advances)) {
              const allAdvances = readStore("advance", []);
              const others = allAdvances.filter((row) => row.driverId !== driver.id);
              writeStore("advance", [...others, ...remote.advances.map(normalizeAdvanceRow)]);
            }
          }
        } catch (error) {
          showToast("カレンダーはローカルデータで表示しました");
        }
      }
      renderAppliedPeriods();
      renderAdvanceCalendar();
    }

    function isDateSelected(date) {
      return selectedAvailableDates.indexOf(date) !== -1;
    }

    function isDateApplied(date) {
      return calendarAppliedDates.has(date) || currentDriverAdvances().some((row) => {
        const explicitDates = advanceRowSelectedDates(row);
        if (explicitDates.length) return explicitDates.indexOf(date) !== -1;
        return rangesOverlap(date, date, row.dateFrom || row.date, row.dateTo || row.date);
      });
    }

    function chooseCalendarDate(date) {
      if (!calendarWorkedDates.has(date)) {
        showToast("申請できる稼働日を選択してください");
        return;
      }
      if (isDateApplied(date)) {
        showToast("この日は申請済みです");
        return;
      }
      if (selectedAvailableDates.indexOf(date) !== -1) {
        selectedAvailableDates = selectedAvailableDates.filter((item) => item !== date);
      } else {
        selectedAvailableDates = selectedAvailableDates.concat(date);
      }
      selectedAvailableDates = selectedAvailableDates
        .filter((item, index, list) => list.indexOf(item) === index)
        .sort();
      syncSelectedDateRange();
      syncRangeLabel();
      renderAdvanceCalendar();
      calculateAdvance();
    }

    function renderAdvanceCalendar() {
      const grid = $("advanceCalendarGrid");
      const availableBox = $("availableDays");
      const appliedBox = $("appliedDays");
      if (!grid && !availableBox) return;
      const year = calendarCursor.getFullYear();
      const month = calendarCursor.getMonth();
      const title = $("advanceCalendarTitle");
      if (title) title.textContent = `${year}年${month + 1}月`;
      const first = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0).getDate();
      if (availableBox) {
        availableBox.innerHTML = "";
        if (appliedBox) appliedBox.innerHTML = "";
        let availableCount = 0;
        let appliedCount = 0;
        for (let day = 1; day <= lastDay; day += 1) {
          const date = `${year}-${pad(month + 1)}-${pad(day)}`;
          const worked = calendarWorkedDates.has(date);
          const applied = isDateApplied(date);
          if (!worked && !applied) continue;
          const button = document.createElement("button");
          button.type = "button";
          const selected = isDateSelected(date);
          button.className = [
            "advance-preview-day",
            applied ? "applied" : "",
            selected && !applied ? "selected" : ""
          ].filter(Boolean).join(" ");
          button.innerHTML = `<strong>${formatShortDate(date)}</strong><span>${applied ? "申請済み" : dayOfWeekLabel(date)}</span>`;
          if (applied) {
            button.disabled = true;
            if (appliedBox) appliedBox.appendChild(button);
            appliedCount += 1;
          } else {
            button.dataset.date = date;
            button.addEventListener("click", () => chooseCalendarDate(date));
            availableBox.appendChild(button);
            availableCount += 1;
          }
        }
        if (!availableCount) {
          availableBox.innerHTML = `<div class="advance-preview-empty">この月に申請できる稼働日はありません</div>`;
        }
        if (appliedBox && !appliedCount) {
          appliedBox.innerHTML = `<div class="advance-preview-empty">まだ申請済みの日はありません</div>`;
        }
        if ($("availableCount")) $("availableCount").textContent = `${availableCount}日`;
        return;
      }

      grid.innerHTML = "";
      for (let i = 0; i < first.getDay(); i += 1) {
        const empty = document.createElement("div");
        empty.className = "advance-empty";
        grid.appendChild(empty);
      }
      for (let day = 1; day <= lastDay; day += 1) {
        const date = `${year}-${pad(month + 1)}-${pad(day)}`;
        const button = document.createElement("button");
        button.type = "button";
        const selected = isDateSelected(date);
        const from = $("advanceDateFrom").value;
        const to = $("advanceDateTo").value;
        const worked = calendarWorkedDates.has(date);
        const applied = isDateApplied(date);
        button.className = [
          "advance-day",
          worked ? "worked" : "",
          applied ? "applied" : "",
          !worked ? "disabled" : "",
          selected ? "selected" : "",
          selected && (date === from || date === to) ? "range-edge" : ""
        ].filter(Boolean).join(" ");
        button.innerHTML = `<strong>${day}</strong><small>${applied ? "申請済" : worked ? "申請可" : "対象外"}</small>`;
        button.disabled = !worked || applied;
        button.addEventListener("click", () => {
          button.classList.add("pop");
          chooseCalendarDate(date);
        });
        grid.appendChild(button);
      }
    }

    function renderAppliedPeriods() {
      const rows = currentDriverAdvances();
      const box = $("advanceAppliedList");
      if (!rows.length) {
        box.textContent = "まだ申請済み期間はありません";
        return;
      }
      box.innerHTML = `<div class="period-list">${rows.slice(0, 8).map((row) => `
        <div class="period-chip">
          <span>${formatDateJP(row.dateFrom || row.date)} 〜 ${formatDateJP(row.dateTo || row.date)}</span>
          <small>${row.workedDays || 0}日 / ${formatMoney(row.transferAmount || 0)}</small>
        </div>
      `).join("")}</div>`;
    }

    function findOverlap(dateFrom, dateTo) {
      if (!selectedAvailableDates.length) return null;
      return currentDriverAdvances().find((row) => {
        const explicitDates = advanceRowSelectedDates(row);
        return selectedAvailableDates.some((date) => {
          if (explicitDates.length) return explicitDates.indexOf(date) !== -1;
          return rangesOverlap(date, date, row.dateFrom || row.date, row.dateTo || row.date);
        });
      });
    }

    function renderOverlap(dateFrom, dateTo) {
      const overlap = findOverlap(dateFrom, dateTo);
      hasOverlap = Boolean(overlap);
      const text = $("advanceOverlapText");
      const button = $("submitAdvanceBtn");
      if (!selectedAvailableDates.length) {
        text.textContent = "申請できる稼働日を選択してください";
        syncSubmitReady();
        return;
      }
      if (overlap) {
        text.textContent = `申請済みの稼働日が含まれています: ${formatDateJP(overlap.dateFrom || overlap.date)} 〜 ${formatDateJP(overlap.dateTo || overlap.date)}`;
        syncSubmitReady();
        return;
      }
      text.textContent = selectedAvailableDates.length ? "この稼働日は申請できます" : "この期間に申請できる稼働日がありません";
      syncSubmitReady();
    }

    function syncSubmitReady() {
      const workedDays = Number($("advanceWorkedDays").value || 0);
      const amount = Number($("advanceAmount").value || 0);
      const ready = Boolean(selectedAvailableDates.length && workedDays && amount && !hasOverlap);
      $("submitAdvanceBtn").disabled = !ready;
      $("advanceFlowCalc").classList.toggle("active", workedDays > 0);
      $("advanceFlowSubmit").classList.toggle("active", ready);
      const detail = ready
        ? `${workedDays}日分 ${formatMoney(Math.max(amount - calculateAdvanceFee(amount), 0))} を申請`
        : hasOverlap
          ? "申請済みの稼働日が含まれています"
          : workedDays
            ? "計算完了。内容を確認してください"
            : "申請できる稼働日を選んでください";
      setSwipeConfirmEnabled("submitAdvanceSwipe", ready, detail);
    }

    function availableDatesLocal() {
      return selectedAvailableDates
        .filter((date) => calendarWorkedDates.has(date) && !isDateApplied(date))
        .filter((item, index, list) => list.indexOf(item) === index)
        .sort();
    }

    function renderSelectedDates() {
      const box = $("advanceSelectedDateList");
      const count = $("advanceSelectedCount");
      const selectedDatesLabel = $("selectedDates");
      const hint = $("hint");
      const selectedText = $("selectedText");
      const selectedCount = $("selectedCount");
      const labels = selectedAvailableDates.map((date) => `${formatShortDate(date)}(${dayOfWeekLabel(date)})`);
      if (count) count.textContent = `${selectedAvailableDates.length}日分`;
      if (selectedDatesLabel) selectedDatesLabel.textContent = labels.length ? labels.join("、") : "まだ選択されていません";
      if (hint) hint.style.display = labels.length ? "none" : "";
      if (selectedText) selectedText.textContent = labels.length ? `${labels.length}日分を申請` : "0日分";
      if (selectedCount) selectedCount.textContent = `${labels.length}日`;
      if (!box) return;
      if (!selectedAvailableDates.length) {
        box.textContent = "申請できる稼働日がありません";
        return;
      }
      box.innerHTML = selectedAvailableDates.map((date) => `<span>${formatShortDate(date)}</span>`).join("");
    }

    async function calculateAdvance() {
      selectedAvailableDates = availableDatesLocal();
      const range = syncSelectedDateRange();
      const dateFrom = range.dateFrom;
      const dateTo = range.dateTo;
      const workedDays = selectedAvailableDates.length;
      const salesAmount = Number(driver.unitPrice || 0) * workedDays;
      const requestedAmount = Math.round(salesAmount * 0.5);
      $("advanceWorkedDays").value = workedDays;
      $("advanceAmount").value = requestedAmount || "";
      renderAppliedPeriods();
      renderSelectedDates();
      renderOverlap(dateFrom, dateTo);
      renderAdvanceCalendar();
      updateSummary();
    }

    function updateSummary() {
      const workedDays = Number($("advanceWorkedDays").value || 0);
      const amount = Number($("advanceAmount").value || 0);
      const salesAmount = Number(driver.unitPrice || 0) * workedDays;
      const percentFee = amount ? Math.ceil(amount * 0.08) : 0;
      const bankFee = amount ? 260 : 0;
      const fee = amount ? percentFee + bankFee : 0;
      const transferAmount = Math.max(amount - fee, 0);
      const meterPercent = Math.min(100, Math.max(0, workedDays * 10));
      animateTransferAmount(transferAmount);
      $("advanceTransferMeta").textContent = workedDays ? `${workedDays}日分で計算しています。申請後に管理者LINEへ送信します。` : "稼働日を選ぶと自動計算します";
      $("advanceWorkdayBadge").textContent = `${workedDays}日`;
      $("advanceMeterFill").style.width = `${meterPercent}%`;
      $("advanceSalesText").textContent = formatMoney(salesAmount);
      if ($("advanceRequestText")) $("advanceRequestText").textContent = formatMoney(amount);
      $("advanceFeeText").textContent = `手数料合計 ${formatMoney(fee)}`;
      if ($("advancePercentFeeText")) $("advancePercentFeeText").textContent = formatMoney(percentFee);
      if ($("advanceBankFeeText")) $("advanceBankFeeText").textContent = formatMoney(bankFee);
      if ($("advanceTotalFeeText")) $("advanceTotalFeeText").textContent = formatMoney(fee);
      $("advanceSummary").textContent = `${workedDays || 0}日分 / 売上 ${formatMoney(salesAmount)} / 希望 ${formatMoney(amount)} / 振込 ${formatMoney(transferAmount)}`;
      syncSubmitReady();
    }

    async function submit() {
      const range = syncSelectedDateRange();
      const dateFrom = range.dateFrom;
      const dateTo = range.dateTo;
      const workedDays = Number($("advanceWorkedDays").value || 0);
      const amount = Number($("advanceAmount").value || 0);
      if (!selectedAvailableDates.length || !dateFrom || !dateTo) {
        showToast("申請できる稼働日を選択してください");
        return;
      }
      if (hasOverlap || findOverlap(dateFrom, dateTo)) {
        showToast("申請済み期間と重複しています");
        renderOverlap(dateFrom, dateTo);
        return;
      }
      if (!workedDays || !amount) {
        showToast("申請できる稼働日がありません");
        return;
      }
      const salesAmount = Number(driver.unitPrice || 0) * workedDays;
      const fee = calculateAdvanceFee(amount);
      const transferAmount = Math.max(amount - fee, 0);
      const payload = {
        type: "advance",
        driverToken: getDriverToken(),
        id: cryptoId("adv"),
        date: dateFrom,
        dateFrom,
        dateTo,
        driverId: driver.id,
        driverName: driver.name,
        siteId: driver.siteId,
        siteName: driver.siteName,
        count: 1,
        workedDays,
        unitPrice: Number(driver.unitPrice || 0),
        salesAmount,
        amount,
        requestedAmount: amount,
        fee,
        transferAmount,
        selectedDates: selectedAvailableDates.slice(),
        tag: "通常",
        note: "",
        bankName: driver.bankName || "",
        branchName: driver.branchName || "",
        accountNumber: driver.accountNumber || "",
        accountHolder: driver.accountHolder || "",
        monthKey: sheetMonthKey(dateFrom),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      setLoading(true, "前払い申請を保存中...");
      try {
        await apiPost(payload);
        upsertLocal("advance", payload, (row) => row.id === payload.id);
        showToast("前払い申請を保存しました");
        renderAppliedPeriods();
        renderOverlap(dateFrom, dateTo);
        updateSummary();
        playCompletionCelebration("申請完了", `振込予定 ${formatMoney(transferAmount)} を送信しました`, "gold");
      } catch (error) {
        showToast(error.message);
      } finally {
        setLoading(false);
      }
    }

    ["advanceDateFrom", "advanceDateTo"].forEach((id) => $(id).addEventListener("change", () => {
      syncRangeLabel();
      calculateAdvance();
    }));
    document.querySelectorAll("[data-period-days]").forEach((button) => {
      button.addEventListener("click", () => {
        const days = Number(button.dataset.periodDays || 1);
        const end = todayISO();
        const start = addDaysISO(end, -(days - 1));
        $("advanceDateFrom").value = start;
        $("advanceDateTo").value = end;
        calendarCursor = new Date(`${end}T00:00:00`);
        syncRangeLabel();
        loadAdvanceCalendarMonth();
        calculateAdvance();
      });
    });
    $("advancePrevMonth").addEventListener("click", () => {
      calendarCursor.setMonth(calendarCursor.getMonth() - 1);
      loadAdvanceCalendarMonth();
    });
    $("advanceNextMonth").addEventListener("click", () => {
      calendarCursor.setMonth(calendarCursor.getMonth() + 1);
      loadAdvanceCalendarMonth();
    });
    $("submitAdvanceBtn").addEventListener("click", submit);
    bindSwipeConfirm("submitAdvanceSwipe", () => $("submitAdvanceBtn").click());
    renderAppliedPeriods();
    syncRangeLabel();
    loadAdvanceCalendarMonth();
    calculateAdvance();
  }

  function holidayTarget(base = new Date()) {
    const add = base.getDate() <= 13 ? 1 : 2;
    const target = new Date(base.getFullYear(), base.getMonth() + add, 1);
    return {
      year: target.getFullYear(),
      month: target.getMonth() + 1,
      yearMonth: monthKey(target)
    };
  }

  async function initHoliday() {
    const driver = await resolveCurrentDriver();
    renderDriver(driver);
    const target = holidayTarget(new Date());
    const state = { selected: [] };
    const existing = readStore("holiday", []).find((row) => row.driverId === driver.id && row.targetYearMonth === target.yearMonth);
    if (existing) {
      state.selected = Array.isArray(existing.days) ? existing.days : [];
      $("holidayNote").value = existing.note || "";
    }
    $("holidayTitle").textContent = `${target.year}年${target.month}月の休み希望`;
    $("holidayRuleText").textContent = "対象月は13日ルールで自動判定。日付を選んでスワイプ送信できます。";
    $("calendarMonth").textContent = `${target.year}年${target.month}月`;

    function renderSelected() {
      $("selectedHolidayText").textContent = state.selected.length
        ? state.selected.map((day) => `${Number(day.slice(-2))}日`).join("、")
        : "未選択";
      $("holidayCountText").textContent = `${state.selected.length}日`;
      setSwipeConfirmEnabled(
        "submitHolidaySwipe",
        state.selected.length > 0,
        state.selected.length ? `${state.selected.length}日分を送信` : "日付を選ぶとスワイプできます"
      );
    }

    function renderCalendar() {
      const grid = $("holidayCalendar");
      grid.innerHTML = "";
      const first = new Date(target.year, target.month - 1, 1);
      const lastDay = new Date(target.year, target.month, 0).getDate();
      for (let i = 0; i < first.getDay(); i += 1) {
        const empty = document.createElement("div");
        empty.className = "day-empty";
        grid.appendChild(empty);
      }
      for (let day = 1; day <= lastDay; day += 1) {
        const date = `${target.year}-${pad(target.month)}-${pad(day)}`;
        const button = document.createElement("button");
        button.type = "button";
        button.className = `day-button${state.selected.includes(date) ? " selected" : ""}`;
        button.textContent = day;
        button.addEventListener("click", () => {
          button.classList.add("pop");
          if (state.selected.includes(date)) state.selected = state.selected.filter((item) => item !== date);
          else state.selected = [...state.selected, date].sort();
          window.setTimeout(renderCalendar, 110);
          renderSelected();
        });
        grid.appendChild(button);
      }
    }

    async function submit() {
      if (!state.selected.length) {
        showToast("休み希望日を選択してください");
        return;
      }
      const payload = {
        type: "holiday_save",
        driverToken: getDriverToken(),
        id: existing && existing.id ? existing.id : cryptoId("hol"),
        driverId: driver.id,
        driverName: driver.name,
        siteId: driver.siteId,
        siteName: driver.siteName,
        targetYearMonth: target.yearMonth,
        targetYear: target.year,
        targetMonth: target.month,
        days: state.selected,
        note: $("holidayNote").value.trim(),
        monthKey: sheetMonthKey(target.yearMonth),
        updatedAt: new Date().toISOString()
      };
      setLoading(true, "休み希望を保存中...");
      try {
        await apiPost(payload);
        upsertLocal("holiday", payload, (row) => row.driverId === driver.id && row.targetYearMonth === target.yearMonth);
        $("holidayForm").classList.add("hidden");
        $("holidayReview").classList.remove("hidden");
        $("holidayReviewText").textContent = `${target.year}年${target.month}月: ${state.selected.map((day) => `${Number(day.slice(-2))}日`).join("、")}`;
        playCompletionCelebration("送信完了", `${state.selected.length}日分の休み希望を保存しました`, "pink");
        showToast("休み希望を保存しました");
      } catch (error) {
        showToast(error.message);
      } finally {
        setLoading(false);
      }
    }

    $("clearHolidayBtn").addEventListener("click", () => {
      state.selected = [];
      renderCalendar();
      renderSelected();
      showToast("選択をリセットしました");
    });
    $("submitHolidayBtn").addEventListener("click", submit);
    bindSwipeConfirm("submitHolidaySwipe", () => $("submitHolidayBtn").click());
    $("editHolidayBtn").addEventListener("click", () => {
      $("holidayReview").classList.add("hidden");
      $("holidayForm").classList.remove("hidden");
    });
    renderCalendar();
    renderSelected();
  }

  function buildDashboard(month) {
    const drivers = readStore("drivers", defaultDrivers);
    const sites = readStore("sites", config.SITES || []);
    const allAttendance = enrichAttendanceRows(readStore("attendance", []), drivers, sites);
    const allAdvances = enrichAdvanceRows(readStore("advance", []), drivers, sites);
    const attendance = allAttendance.filter((row) => inMonth(row.date, month));
    const advances = allAdvances.filter((row) => inMonth(row.date, month));
    const holidays = readStore("holiday", []).filter((row) => row.targetYearMonth === month);
    const fixedShift = readStore("fixedShift", []).filter((row) => row.targetYearMonth === month);
    const serverToday = readStore("serverBusinessDate", "") || todayISO();
    const actualTodayRows = allAttendance.filter((row) => sameDate(row.date, serverToday));
    const latestWorkingDate = attendance
      .filter((row) => isWorkingStatus(row.status))
      .map((row) => normalizeDateKey(row.date))
      .filter(Boolean)
      .sort()
      .pop() || "";
    const latestMonthDate = attendance
      .map((row) => normalizeDateKey(row.date))
      .filter(Boolean)
      .sort()
      .pop() || "";
    const displayDate = actualTodayRows.length ? serverToday : (latestWorkingDate || latestMonthDate || serverToday);
    const todayRows = uniqueLatestAttendanceRows(allAttendance.filter((row) => sameDate(row.date, displayDate) && !isOffStatus(row.status)));
    const activeDrivers = drivers.filter((driver) => driver.lifecycle !== "inactive");
    const todayWorked = todayRows.length;
    const currentWorking = todayRows.filter((row) => isWorkingStatus(row.status)).length;
    const finished = todayRows.filter((row) => isFinishedStatus(row.status)).length;
    const notStarted = Math.max(activeDrivers.length - todayWorked, 0);
    const advanceTotal = advances.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return {
      month,
      today: displayDate,
      serverToday,
      isActualToday: displayDate === serverToday,
      drivers,
      sites,
      attendance,
      advances,
      holidays,
      fixedShift,
      todayRows,
      kpis: {
        working: todayWorked,
        currentWorking,
        finished,
        notStarted,
        warning: currentWorking,
        advanceTotal,
        rate: activeDrivers.length ? Math.round((todayWorked / activeDrivers.length) * 100) : 0
      }
    };
  }

  function item(title, body, tags, actions) {
    return `
      <div class="item">
        <div class="item-top">
          <div><strong>${title}</strong><p>${body}</p></div>
          <div>${(tags || []).map((tag) => `<span class="tag ${tag.kind || ""}">${tag.label}</span>`).join(" ")}</div>
        </div>
        ${actions ? `<div class="item-actions">${actions}</div>` : ""}
      </div>`;
  }

  function dataTable(columns, rows, emptyTitle, emptyBody, template) {
    if (!rows.length) return item(emptyTitle, emptyBody, [{ label: "0件" }]);
    return `
      <div class="data-table" style="--cols:${template || columns.map(() => "1fr").join(" ")}">
        <div class="data-head">${columns.map((column) => `<span>${escapeHtml(column)}</span>`).join("")}</div>
        ${rows.join("")}
      </div>`;
  }

  function dataCell(main, sub, className = "") {
    return `
      <div class="data-cell ${className}">
        <strong>${escapeHtml(main)}</strong>
        ${sub ? `<span>${escapeHtml(sub)}</span>` : ""}
      </div>`;
  }

  function openModal(title, html) {
    $("modalTitle").textContent = title;
    $("modalBody").innerHTML = html;
    $("adminModal").classList.remove("hidden");
  }

  function driverEditForm(driver, sites) {
    const current = driver || {};
    return `
      <input type="hidden" id="editDriverId" value="${escapeHtml(current.id || "")}">
      <label class="field"><span>ドライバー名</span><input id="editDriverName" value="${escapeHtml(current.name || "")}"></label>
      <label class="field"><span>現場</span><select id="editDriverSite">${sites.map((site) => `<option value="${escapeHtml(site.id)}" ${site.id === current.siteId ? "selected" : ""}>${escapeHtml(site.name)}</option>`).join("")}</select></label>
      <label class="field"><span>契約種別</span><input id="editDriverContract" value="${escapeHtml(current.contractType || "日当")}"></label>
      <label class="field"><span>4桁PIN</span><input id="editDriverPin" inputmode="numeric" maxlength="4" value="${escapeHtml(current.pin || "1234")}" placeholder="例: 1234"></label>
      <label class="field"><span>単価</span><input id="editDriverUnitPrice" type="number" min="0" value="${Number(current.unitPrice || 22000)}"></label>
      <label class="field"><span>銀行</span><input id="editDriverBankName" value="${escapeHtml(current.bankName || "")}"></label>
      <label class="field"><span>支店</span><input id="editDriverBranchName" value="${escapeHtml(current.branchName || "")}"></label>
      <label class="field"><span>口座番号</span><input id="editDriverAccountNumber" value="${escapeHtml(current.accountNumber || "")}"></label>
      <label class="field"><span>名義</span><input id="editDriverAccountHolder" value="${escapeHtml(current.accountHolder || "")}"></label>
      <button class="button primary" id="saveDriverEditBtn" style="margin-top:14px;">保存する</button>
    `;
  }

  function siteEditForm(site) {
    const current = site || {};
    const active = String(current.active === undefined ? true : current.active) !== "false";
    return `
      <input type="hidden" id="editSiteId" value="${escapeHtml(current.id || "")}">
      <label class="field"><span>現場名</span><input id="editSiteName" value="${escapeHtml(current.name || "")}" placeholder="例: 川口領家 Amazon"></label>
      <label class="field"><span>表示順</span><input id="editSiteSort" type="number" min="1" value="${Number(current.sort || 1)}"></label>
      <label class="field"><span>状態</span><select id="editSiteActive"><option value="true" ${active ? "selected" : ""}>有効</option><option value="false" ${active ? "" : "selected"}>停止</option></select></label>
      <button class="button primary" id="saveSiteEditBtn" style="margin-top:14px;">保存する</button>
    `;
  }

  function shiftBulkForm(data, type, month) {
    const rows = type === "holiday" ? data.holidays : data.fixedShift;
    const activeDrivers = data.drivers.filter((driver) => driver.lifecycle !== "inactive");
    const label = type === "holiday" ? "休み希望" : "確定シフト";
    const help = type === "holiday"
      ? "各ドライバーの休み希望日を入力します。1, 3, 5 のように日付だけでも入力できます。"
      : "LINE通知を止めたい確定シフト日を入力します。1, 3, 5 のように日付だけでも入力できます。";
    return `
      <input type="hidden" id="bulkShiftType" value="${type}">
      <input type="hidden" id="bulkShiftMonth" value="${escapeHtml(month)}">
      <div class="modal-note">
        <strong>${escapeHtml(month)} ${label}</strong>
        <p>${help}</p>
      </div>
      <div class="bulk-shift-list">
        ${activeDrivers.map((driver) => {
          const existing = rows.find((row) => row.driverId === driver.id);
          const days = existing && existing.days ? (Array.isArray(existing.days) ? existing.days : String(existing.days).split(",").map((day) => day.trim()).filter(Boolean)) : [];
          const value = days.join(", ");
          return `<label class="field bulk-row"><span>${escapeHtml(driver.name)} / ${escapeHtml(driver.siteName || "")}</span><input data-shift-days="${escapeHtml(driver.id)}" value="${escapeHtml(value)}" placeholder="例: 1, 3, 5"></label>`;
        }).join("")}
      </div>
      <button class="button primary" id="saveShiftBulkBtn" style="margin-top:14px;">全員分を保存する</button>
    `;
  }

  function parseDateList(value, month) {
    const base = String(month || monthKey(new Date()));
    const year = base.slice(0, 4);
    const monthPart = base.slice(5, 7);
    const dates = String(value || "")
      .split(/[,\s、，]+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .map((token) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(token)) return token;
        const slash = token.match(/^(\d{1,2})[\/月](\d{1,2})/);
        if (slash) return `${year}-${pad(Number(slash[1]))}-${pad(Number(slash[2]))}`;
        if (/^\d{1,2}$/.test(token)) return `${year}-${monthPart}-${pad(Number(token))}`;
        return "";
      })
      .filter(Boolean);
    return Array.from(new Set(dates)).sort();
  }

  function attendanceStatusText(status) {
    const normalized = normalizeStatus(status);
    if (normalized === "working") return "稼働中";
    if (normalized === "finished") return "退勤済み";
    if (normalized === "off") return "休み";
    return status || "未設定";
  }

  function isSubstituteRow(row) {
    return row && (row.workType === "substitute" || /代走/.test(String(row.note || "")));
  }

  function driverHolidayDays(data, driverId) {
    const days = new Set();
    data.holidays
      .filter((row) => row.driverId === driverId)
      .forEach((row) => {
        const rowDays = Array.isArray(row.days) ? row.days : String(row.days || "").split(",");
        rowDays.map((day) => String(day).trim()).filter(Boolean).forEach((day) => days.add(day));
      });
    return days;
  }

  function driverMonthlyStats(data, driver) {
    const rows = data.attendance
      .filter((row) => row.driverId === driver.id)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const normalDates = new Set();
    const substituteDates = new Set();
    rows.forEach((row) => {
      if (!isFinishedStatus(row.status) || !row.endTime) return;
      if (isSubstituteRow(row)) substituteDates.add(row.date);
      else normalDates.add(row.date);
    });
    const normalWorkedDays = normalDates.size;
    const substituteDays = substituteDates.size;
    const workedDays = normalWorkedDays + substituteDays;
    const holidayDays = driverHolidayDays(data, driver.id).size;
    const billableDays = workedDays;
    const salesTotal = Number(driver.unitPrice || 0) * workedDays;
    return { rows, workedDays, normalWorkedDays, substituteDays, holidayDays, billableDays, salesTotal };
  }

  function adminFinancialSummary(data) {
    const driverStats = data.drivers.map((driver) => ({
      driver,
      ...driverMonthlyStats(data, driver)
    }));
    const salesTotal = driverStats.reduce((sum, row) => sum + row.salesTotal, 0);
    const requestedTotal = data.advances.reduce((sum, row) => sum + Number(row.requestedAmount || row.amount || 0), 0);
    const transferTotal = data.advances.reduce((sum, row) => sum + Number(row.transferAmount || 0), 0);
    const feeTotal = data.advances.reduce((sum, row) => sum + Number(row.fee || 0), 0);
    const workedDaysTotal = driverStats.reduce((sum, row) => sum + row.workedDays, 0);
    const normalWorkedDaysTotal = driverStats.reduce((sum, row) => sum + row.normalWorkedDays, 0);
    const substituteDaysTotal = driverStats.reduce((sum, row) => sum + row.substituteDays, 0);
    const holidayDaysTotal = driverStats.reduce((sum, row) => sum + row.holidayDays, 0);
    return {
      driverStats,
      salesTotal,
      requestedTotal,
      transferTotal,
      feeTotal,
      workedDaysTotal,
      normalWorkedDaysTotal,
      substituteDaysTotal,
      holidayDaysTotal,
      advanceRate: salesTotal ? Math.round((requestedTotal / salesTotal) * 100) : 0
    };
  }

  function renderRankList(summary) {
    const rows = summary.driverStats
      .filter((row) => row.driver.lifecycle !== "inactive")
      .sort((a, b) => b.salesTotal - a.salesTotal)
      .slice(0, 6);
    if (!rows.length) {
      return `<div class="item"><strong>ランキングなし</strong><p>この月の勤怠データはまだありません。</p></div>`;
    }
    return rows.map((row, index) => `
      <div class="rank-row">
        <div class="rank-badge">${index + 1}</div>
        <div class="rank-main">
          <strong>${escapeHtml(row.driver.name)}</strong>
          <span>${escapeHtml(row.driver.siteName || "")} / 実働 ${row.workedDays}日</span>
        </div>
        <div class="rank-money">${formatMoney(row.salesTotal)}</div>
      </div>
    `).join("");
  }

  function renderAdminAlerts(data, summary) {
    const alerts = [];
    const notClockedOut = data.todayRows.filter((row) => isWorkingStatus(row.status));
    const missingBanks = data.drivers.filter((driver) => driver.lifecycle !== "inactive" && (!driver.bankName || !driver.branchName || !driver.accountNumber || !driver.accountHolder));
    const missingPrices = data.drivers.filter((driver) => driver.lifecycle !== "inactive" && !Number(driver.unitPrice || 0));
    if (notClockedOut.length) {
      alerts.push({
        title: `未退勤が${notClockedOut.length}件あります`,
        body: notClockedOut.map((row) => row.driverName).join("、"),
        kind: "danger",
        tag: "要確認"
      });
    }
    if (missingBanks.length) {
      alerts.push({
        title: `口座情報未登録が${missingBanks.length}名あります`,
        body: missingBanks.map((driver) => driver.name).join("、"),
        kind: "warn",
        tag: "口座"
      });
    }
    if (missingPrices.length) {
      alerts.push({
        title: `単価未設定が${missingPrices.length}名あります`,
        body: missingPrices.map((driver) => driver.name).join("、"),
        kind: "danger",
        tag: "単価"
      });
    }
    if (summary.advanceRate >= 50) {
      alerts.push({
        title: "前払い率が高めです",
        body: `売上 ${formatMoney(summary.salesTotal)} に対して希望額 ${formatMoney(summary.requestedTotal)}`,
        kind: "danger",
        tag: `${summary.advanceRate}%`
      });
    } else if (summary.advanceRate >= 30) {
      alerts.push({
        title: "前払い率を確認してください",
        body: `売上に対する前払い希望額は ${summary.advanceRate}% です`,
        kind: "warn",
        tag: `${summary.advanceRate}%`
      });
    }
    const inactive = data.drivers.filter((driver) => driver.lifecycle === "inactive").length;
    if (inactive) {
      alerts.push({
        title: "inactiveドライバーがあります",
        body: `${inactive}名がinactiveです。必要に応じて再有効化できます。`,
        kind: "warn",
        tag: `${inactive}名`
      });
    }
    if (!alerts.length) {
      alerts.push({
        title: "大きなアラートはありません",
        body: "勤怠・前払い・ドライバー状態は安定しています。",
        kind: "good",
        tag: "安定"
      });
    }
    return alerts.map((alert) => `
      <div class="item alert-item ${alert.kind === "danger" ? "danger" : alert.kind === "good" ? "good" : ""}">
        <div class="item-top">
          <div><strong>${escapeHtml(alert.title)}</strong><p>${escapeHtml(alert.body)}</p></div>
          <span class="tag ${alert.kind === "danger" || alert.kind === "warn" ? "warn" : "good"}">${escapeHtml(alert.tag)}</span>
        </div>
      </div>
    `).join("");
  }

  function renderTodayOperationBoard(data) {
    const rowsByDriver = data.todayRows.reduce((acc, row) => {
      acc[driverKeyForRow(row)] = row;
      return acc;
    }, {});
    const activeDrivers = data.drivers.filter((driver) => driver.lifecycle !== "inactive");
    const rows = activeDrivers.map((driver) => {
      const row = rowsByDriver[driver.id] || rowsByDriver[normalizeNameKey(driver.name)] || null;
      const status = row ? attendanceStatusText(row.status) : "未出勤";
      const statusKind = row && isWorkingStatus(row.status) ? "warn" : row ? "good" : "";
      const timeText = row
        ? `出勤 ${row.startTime || "-"} / 退勤 ${row.endTime || "-"}`
        : "本日の出勤報告なし";
      return item(
        driver.name,
        `${driver.siteName || row?.siteName || "-"} / ${timeText}`,
        [{ label: status, kind: statusKind }],
        `<button class="button ghost small" data-driver="${driver.id}">詳細</button>`
      );
    });
    return rows.length ? rows.join("") : item("ドライバーなし", "ドライバー管理から登録してください。", [{ label: "0名" }]);
  }

  function collectAvailableMonths(currentMonth) {
    const months = new Set([currentMonth, monthKey(new Date())]);
    readStore("attendance", []).forEach((row) => {
      if (row.date) months.add(monthKeyFromValue(row.date));
    });
    readStore("advance", []).forEach((row) => {
      if (row.dateFrom) months.add(monthKeyFromValue(row.dateFrom));
      else if (row.date) months.add(monthKeyFromValue(row.date));
    });
    readStore("holiday", []).forEach((row) => {
      if (row.targetYearMonth) months.add(String(row.targetYearMonth));
    });
    readStore("fixedShift", []).forEach((row) => {
      if (row.targetYearMonth) months.add(String(row.targetYearMonth));
    });
    return Array.from(months).filter((month) => /^\d{4}-\d{2}$/.test(month)).sort().reverse();
  }

  function renderAvailableMonths(currentMonth) {
    return collectAvailableMonths(currentMonth).slice(0, 18).map((month) => {
      const label = `${Number(month.slice(5, 7))}月 ${month.slice(0, 4)}`;
      return `<button type="button" class="month-chip ${month === currentMonth ? "active" : ""}" data-month-jump="${month}">${label}</button>`;
    }).join("");
  }

  function renderQualityChecklist(data, summary) {
    const checks = [];
    const activeDrivers = data.drivers.filter((driver) => driver.lifecycle !== "inactive");
    const siteIds = new Set(data.sites.map((site) => site.id));
    const missingBanks = activeDrivers.filter((driver) => !driver.bankName || !driver.branchName || !driver.accountNumber || !driver.accountHolder);
    const missingPrices = activeDrivers.filter((driver) => !Number(driver.unitPrice || 0));
    const unassignedDrivers = activeDrivers.filter((driver) => !driver.siteId || !siteIds.has(driver.siteId));
    const notClockedOut = data.todayRows.filter((row) => isWorkingStatus(row.status));
    const holidayMissing = activeDrivers.filter((driver) => !data.holidays.some((row) => row.driverId === driver.id));
    const fixedMissing = activeDrivers.filter((driver) => !data.fixedShift.some((row) => row.driverId === driver.id));
    const inactiveSites = data.sites.filter((site) => String(site.active) === "false");

    const pushCheck = (ok, title, body, tag) => {
      checks.push({ ok, title, body, tag });
    };
    pushCheck(!missingBanks.length, "口座情報", missingBanks.length ? `${missingBanks.map((driver) => driver.name).join("、")} が未登録です。` : "稼働中ドライバーの口座情報は登録済みです。", missingBanks.length ? `${missingBanks.length}名` : "OK");
    pushCheck(!missingPrices.length, "単価設定", missingPrices.length ? `${missingPrices.map((driver) => driver.name).join("、")} の単価を確認してください。` : "単価は登録済みです。", missingPrices.length ? `${missingPrices.length}名` : "OK");
    pushCheck(!unassignedDrivers.length, "現場紐付け", unassignedDrivers.length ? `${unassignedDrivers.map((driver) => driver.name).join("、")} の現場を確認してください。` : "全員が現場に紐付いています。", unassignedDrivers.length ? `${unassignedDrivers.length}名` : "OK");
    pushCheck(!notClockedOut.length, "未退勤", notClockedOut.length ? `${notClockedOut.map((row) => row.driverName).join("、")} が未退勤です。` : "未退勤はありません。", notClockedOut.length ? `${notClockedOut.length}件` : "OK");
    pushCheck(!holidayMissing.length, "休み希望", holidayMissing.length ? `${holidayMissing.length}名分が未入力です。必要な場合は全員分入力から登録してください。` : "選択月の休み希望は入力済みです。", holidayMissing.length ? `${holidayMissing.length}名` : "OK");
    pushCheck(!fixedMissing.length, "確定シフト", fixedMissing.length ? `${fixedMissing.length}名分が未入力です。通知停止が必要な日は入力してください。` : "選択月の確定シフトは入力済みです。", fixedMissing.length ? `${fixedMissing.length}名` : "OK");
    pushCheck(!inactiveSites.length, "停止中現場", inactiveSites.length ? `${inactiveSites.map((site) => site.name).join("、")} が停止中です。` : "停止中の現場はありません。", inactiveSites.length ? `${inactiveSites.length}件` : "OK");
    pushCheck(summary.salesTotal > 0 || data.attendance.length === 0, "月次売上", data.attendance.length && !summary.salesTotal ? "勤怠はありますが売上が0円です。単価設定を確認してください。" : "月次売上の計算状態は正常です。", summary.salesTotal ? "OK" : "確認");

    return checks.map((check) => item(
      check.title,
      check.body,
      [{ label: check.tag, kind: check.ok ? "good" : "warn" }]
    )).join("");
  }

  function renderAdvanceSummaryByDriver(data) {
    const grouped = data.drivers.reduce((acc, driver) => {
      acc[driver.id] = {
        driverId: driver.id,
        name: driver.name || "未設定",
        siteName: driver.siteName || "",
        lifecycle: driver.lifecycle || "active",
        requested: 0,
        transfer: 0,
        fee: 0,
        count: 0
      };
      return acc;
    }, {});
    data.advances.forEach((row) => {
      const key = row.driverId || row.driverName || "unknown";
      accEnsure(grouped, key, {
        driverId: key,
        name: row.driverName || "未設定",
        siteName: row.siteName || "",
        lifecycle: "active",
        requested: 0,
        transfer: 0,
        fee: 0,
        count: 0
      });
      grouped[key].requested += Number(row.requestedAmount || row.amount || 0);
      grouped[key].transfer += Number(row.transferAmount || 0);
      grouped[key].fee += Number(row.fee || 0);
      grouped[key].count += 1;
    });
    const rows = Object.values(grouped)
      .filter((row) => row.lifecycle !== "inactive" || row.count > 0)
      .sort((a, b) => b.requested - a.requested || b.count - a.count || rowNameSort(a, b));
    return dataTable(
      ["ドライバー", "回数", "希望合計", "振込予定", "手数料"],
      rows.map((row) => `
        <div class="data-row">
          ${dataCell(row.name, row.siteName || "-", "primary")}
          ${dataCell(`${row.count}回`, row.count ? "申請あり" : "申請なし", row.count ? "warn-text" : "")}
          ${dataCell(formatMoney(row.requested), "前払い希望")}
          ${dataCell(formatMoney(row.transfer), "手数料差引後", "good-text")}
          ${dataCell(formatMoney(row.fee), "8% + 260")}
        </div>
      `),
      "ドライバーなし",
      "登録済みドライバーがいません。",
      "1.4fr .55fr .9fr .9fr .75fr"
    );
  }

  function accEnsure(acc, key, value) {
    if (!acc[key]) acc[key] = value;
    return acc[key];
  }

  function rowNameSort(a, b) {
    return String(a.name || "").localeCompare(String(b.name || ""), "ja");
  }

  function renderNotClockedOut(data, editable = false) {
    const rows = data.todayRows.filter((row) => isWorkingStatus(row.status));
    if (!rows.length) return item("未退勤なし", "現在、未退勤のドライバーはいません。", [{ label: "安定", kind: "good" }]);
    return rows.map((row) => item(
      row.driverName || "未設定",
      `${row.siteName || ""} / 出勤 ${row.startTime || "-"} / ${row.date}`,
      [{ label: "未退勤", kind: "warn" }],
      editable
        ? `<button class="button ghost small" data-fix-att="${row.driverId}">通常退勤</button><button class="button ghost small" data-fix-sub="${row.driverId}">代走退勤</button>`
        : `<button class="button ghost small" data-driver="${row.driverId}">詳細</button>`
    )).join("");
  }

  function renderAttendanceFixRows(data) {
    const todayRowsByDriver = data.todayRows.reduce((acc, row) => {
      acc[row.driverId] = row;
      return acc;
    }, {});
    const rows = data.drivers
      .filter((driver) => driver.lifecycle !== "inactive")
      .sort((a, b) => {
        const aRow = todayRowsByDriver[a.id];
        const bRow = todayRowsByDriver[b.id];
        const rank = (row) => row ? (isWorkingStatus(row.status) ? 0 : 1) : 2;
        return rank(aRow) - rank(bRow) || rowNameSort(a, b);
      });
    return dataTable(
      ["ドライバー", "現場", "今日", "区分", "操作"],
      rows.map((driver) => {
        const row = todayRowsByDriver[driver.id];
        const status = row ? attendanceStatusText(row.status) : "未出勤";
        const statusClass = row && isWorkingStatus(row.status) ? "warn-text" : row ? "good-text" : "";
        const workType = row && isSubstituteRow(row) ? "代走" : "通常";
        const normalDisabled = row && isFinishedStatus(row.status) && !isSubstituteRow(row) ? " disabled" : "";
        const subDisabled = row && isFinishedStatus(row.status) && isSubstituteRow(row) ? " disabled" : "";
        return `
          <div class="data-row">
            ${dataCell(driver.name, driver.contractType || "契約", "primary")}
            ${dataCell(driver.siteName || "-", "現場")}
            ${dataCell(status, row ? `出勤 ${row.startTime || "-"}` : "修正可", statusClass)}
            ${dataCell(workType, row && isSubstituteRow(row) ? "代走登録済み" : "通常")}
            <div class="data-actions">
              <button class="button ghost small" data-fix-att="${driver.id}"${normalDisabled}>通常退勤</button>
              <button class="button ghost small" data-fix-sub="${driver.id}"${subDisabled}>代走退勤</button>
              <button class="button ghost small" data-clear-att="${driver.id}"${row ? "" : " disabled"}>勤怠取消</button>
              <button class="button ghost small" data-driver="${driver.id}">履歴</button>
            </div>
          </div>
        `;
      }),
      "修正対象なし",
      "有効なドライバーがいません。",
      "1.1fr 1.05fr .75fr .65fr 1.55fr"
    );
  }

  function renderBankInfo(data, editable = false) {
    const activeDrivers = data.drivers.filter((driver) => driver.lifecycle !== "inactive");
    return dataTable(
      ["ドライバー", "銀行", "口座", "状態", "操作"],
      activeDrivers.map((driver) => {
      const hasBank = driver.bankName && driver.branchName && driver.accountNumber && driver.accountHolder;
      return `
        <div class="data-row">
          ${dataCell(driver.name, driver.siteName || "-", "primary")}
          ${dataCell(driver.bankName || "-", driver.branchName || "-")}
          ${dataCell(driver.accountNumber || "-", driver.accountHolder || "-")}
          ${dataCell(hasBank ? "登録済み" : "未登録", hasBank ? "" : "確認", hasBank ? "good-text" : "warn-text")}
          <div class="data-actions">${editable
            ? `<button class="button ghost small" data-edit-driver="${driver.id}">編集</button>`
            : `<button class="button ghost small" data-driver="${driver.id}">詳細</button>`}</div>
        </div>
      `;
    }),
      "ドライバーなし",
      "登録済みドライバーがいません。",
      "1.15fr 1fr 1.05fr .7fr .65fr"
    );
  }

  function renderAdvanceOverlapHistory(data) {
    const rows = data.advances
      .slice()
      .sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")));
    if (!rows.length) return item("重複履歴なし", "まだ前払い申請がありません。", [{ label: "OK", kind: "good" }]);
    return rows.slice(0, 10).map((row) => item(
      row.driverName || "未設定",
      `${formatShortDate(row.dateFrom || row.date)}〜${formatShortDate(row.dateTo || row.date)} / 申請済み期間として登録中`,
      [{ label: "重複防止中", kind: "good" }]
    )).join("");
  }

  function renderDriverMonthlyRows(data, summary, editable = false) {
    const rows = summary.driverStats.slice().sort((a, b) => b.salesTotal - a.salesTotal);
    return dataTable(
      ["ドライバー", "現場", "出勤", "代走", "休み", "売上", "操作"],
      rows.map((row) => {
      const driver = row.driver;
      const actions = editable
        ? `<button class="button ghost small" data-driver="${driver.id}">履歴</button><button class="button ghost small" data-edit-driver="${driver.id}">編集</button><button class="button ghost small" data-reset-line="${driver.id}">LINE解除</button><button class="button ghost small" data-toggle-driver="${driver.id}">${driver.lifecycle === "inactive" ? "再有効化" : "停止"}</button>`
        : `<button class="button ghost small" data-driver="${driver.id}">詳細</button>`;
      return `
        <div class="data-row">
          ${dataCell(driver.name, driver.contractType || "契約", "primary")}
          ${dataCell(driver.siteName || "-", `単価 ${formatMoney(driver.unitPrice || 0)}`)}
          ${dataCell(`${row.normalWorkedDays}日`, "通常")}
          ${dataCell(`${row.substituteDays}日`, "代走", row.substituteDays ? "warn-text" : "")}
          ${dataCell(`${row.holidayDays}日`, "希望")}
          ${dataCell(formatMoney(row.salesTotal), `${row.billableDays}日分`, "good-text")}
          <div class="data-actions">${actions}</div>
        </div>
      `;
    }),
      "ドライバーなし",
      "登録済みドライバーがいません。",
      "1.15fr 1.05fr .55fr .55fr .55fr .85fr 1.2fr"
    );
  }

  function renderSalesReconciliationRows(data, summary) {
    const advanceByDriver = data.advances.reduce((acc, row) => {
      const key = row.driverId || row.driverName || "unknown";
      acc[key] = acc[key] || { count: 0, requested: 0, transfer: 0 };
      acc[key].count += 1;
      acc[key].requested += Number(row.requestedAmount || row.amount || 0);
      acc[key].transfer += Number(row.transferAmount || 0);
      return acc;
    }, {});
    const rows = summary.driverStats
      .filter((row) => row.driver.lifecycle !== "inactive" || row.workedDays || row.holidayDays || (advanceByDriver[row.driver.id] && advanceByDriver[row.driver.id].count))
      .sort((a, b) => String(a.driver.siteName || "").localeCompare(String(b.driver.siteName || ""), "ja") || rowNameSort({ name: a.driver.name }, { name: b.driver.name }));
    return dataTable(
      ["ドライバー", "現場", "出勤", "代走", "単価", "想定売上", "休み", "前払い"],
      rows.map((row) => {
        const driver = row.driver;
        const advance = advanceByDriver[driver.id] || { count: 0, requested: 0, transfer: 0 };
        return `
          <div class="data-row">
            ${dataCell(driver.name, driver.contractType || "契約", "primary")}
            ${dataCell(driver.siteName || "-", "現場")}
            ${dataCell(`${row.normalWorkedDays}日`, "元請け明細")}
            ${dataCell(`${row.substituteDays}日`, "代走", row.substituteDays ? "warn-text" : "")}
            ${dataCell(formatMoney(driver.unitPrice || 0), "単価")}
            ${dataCell(formatMoney(row.salesTotal), `${row.billableDays}日分`, "good-text")}
            ${dataCell(`${row.holidayDays}日`, "休み希望")}
            ${dataCell(`${advance.count}回`, formatMoney(advance.requested))}
          </div>
        `;
      }),
      "照合データなし",
      "この月の出勤・前払いデータはまだありません。",
      "1.08fr 1.05fr .55fr .55fr .8fr .9fr .55fr .75fr"
    );
  }

  function renderCheckoutDriverRows(data, summary) {
    const todayRowsByDriver = data.todayRows.reduce((acc, row) => {
      acc[row.driverId] = row;
      return acc;
    }, {});
    const rows = summary.driverStats
      .filter((row) => row.driver.lifecycle !== "inactive")
      .sort((a, b) => {
        const aStatus = todayRowsByDriver[a.driver.id] ? (isWorkingStatus(todayRowsByDriver[a.driver.id].status) ? 0 : 1) : 2;
        const bStatus = todayRowsByDriver[b.driver.id] ? (isWorkingStatus(todayRowsByDriver[b.driver.id].status) ? 0 : 1) : 2;
        return aStatus - bStatus || rowNameSort({ name: a.driver.name }, { name: b.driver.name });
      });
    return dataTable(
      ["ドライバー", "現場", "今日", "出勤", "代走", "休み", "操作"],
      rows.map((row) => {
        const today = todayRowsByDriver[row.driver.id];
        const status = today ? attendanceStatusText(today.status) : "未出勤";
        const statusClass = today && isWorkingStatus(today.status) ? "warn-text" : today ? "good-text" : "";
        return `
          <div class="data-row">
            ${dataCell(row.driver.name, row.driver.contractType || "契約", "primary")}
            ${dataCell(row.driver.siteName || "-", "現場")}
            ${dataCell(status, today ? `出勤 ${today.startTime || "-"}` : "", statusClass)}
            ${dataCell(`${row.normalWorkedDays}日`, "通常")}
            ${dataCell(`${row.substituteDays}日`, "代走", row.substituteDays ? "warn-text" : "")}
            ${dataCell(`${row.holidayDays}日`, "休み")}
            <div class="data-actions"><button class="button ghost small" data-driver="${row.driver.id}">詳細</button></div>
          </div>
        `;
      }),
      "ドライバーなし",
      "登録済みドライバーがいません。",
      "1.1fr 1.05fr .75fr .55fr .55fr .55fr .65fr"
    );
  }

  function renderSiteRows(data, editable = false) {
    const sites = data.sites.slice().sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
    return dataTable(
      ["現場", "所属", "稼働中", "状態", "操作"],
      sites.map((site) => {
      const siteDrivers = data.drivers.filter((driver) => driver.siteId === site.id && driver.lifecycle !== "inactive");
      const siteToday = data.todayRows.filter((row) => row.siteId === site.id);
      const working = siteToday.filter((row) => isWorkingStatus(row.status)).length;
      const active = String(site.active) !== "false";
      const actions = editable
        ? `<button class="button ghost small" data-site="${site.id}">詳細</button><button class="button ghost small" data-edit-site="${site.id}">編集</button><button class="button ghost small" data-toggle-site="${site.id}">${active ? "停止" : "有効化"}</button>`
        : `<button class="button ghost small" data-site="${site.id}">詳細</button>`;
      return `
        <div class="data-row">
          ${dataCell(site.name, `表示順 ${site.sort || "-"}`, "primary")}
          ${dataCell(`${siteDrivers.length}人`, "所属")}
          ${dataCell(`${working}人`, "本日")}
          ${dataCell(active ? "有効" : "停止", active ? "" : "確認", active ? "good-text" : "warn-text")}
          <div class="data-actions">${actions}</div>
        </div>
      `;
    }),
      "現場なし",
      "管理メニューから現場を追加できます。",
      "1.4fr .65fr .65fr .65fr 1.1fr"
    );
  }

  function renderMonthlySiteRows(data, summary) {
    const rows = data.sites.map((site) => {
      const stats = summary.driverStats.filter((row) => row.driver.siteId === site.id);
      return {
        site,
        drivers: stats.length,
        workedDays: stats.reduce((sum, row) => sum + row.workedDays, 0),
        normalWorkedDays: stats.reduce((sum, row) => sum + row.normalWorkedDays, 0),
        substituteDays: stats.reduce((sum, row) => sum + row.substituteDays, 0),
        holidayDays: stats.reduce((sum, row) => sum + row.holidayDays, 0),
        salesTotal: stats.reduce((sum, row) => sum + row.salesTotal, 0)
      };
    }).sort((a, b) => b.salesTotal - a.salesTotal);
    return dataTable(
      ["現場", "所属", "出勤", "代走", "休み", "売上", "操作"],
      rows.map((row) => `
        <div class="data-row">
          ${dataCell(row.site.name, `ID ${row.site.id || "-"}`, "primary")}
          ${dataCell(`${row.drivers}人`, "所属")}
          ${dataCell(`${row.normalWorkedDays}日`, "通常")}
          ${dataCell(`${row.substituteDays}日`, "代走", row.substituteDays ? "warn-text" : "")}
          ${dataCell(`${row.holidayDays}日`, "休み")}
          ${dataCell(formatMoney(row.salesTotal), "月間", "good-text")}
          <div class="data-actions"><button class="button ghost small" data-site="${row.site.id}">詳細</button></div>
        </div>
      `),
      "現場なし",
      "現場が登録されていません。",
      "1.25fr .55fr .55fr .55fr .55fr .85fr .65fr"
    );
  }

  function renderMonthlyAdvanceRows(data) {
    const rows = data.advances
      .slice()
      .sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")))
      .map((row) => `
        <div class="data-row">
          ${dataCell(row.driverName || "未設定", row.siteName || "-", "primary")}
          ${dataCell(`${formatShortDate(row.dateFrom || row.date)}〜${formatShortDate(row.dateTo || row.date)}`, `実働 ${row.workedDays || 0}日`)}
          ${dataCell(formatMoney(row.requestedAmount || row.amount || 0), "希望")}
          ${dataCell(formatMoney(row.transferAmount || 0), "振込", "good-text")}
          <div class="data-actions"><button class="button ghost small" data-advance-detail="${row.id}">詳細</button></div>
        </div>
      `);
    return dataTable(
      ["ドライバー", "期間", "希望額", "振込予定", "操作"],
      rows,
      "前払い申請なし",
      "この月の申請はまだありません。",
      "1.15fr 1.2fr .9fr .9fr .65fr"
    );
  }

  function renderAdvanceApplicationRows(data) {
    const rows = data.advances
      .slice()
      .sort((a, b) => String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || "")))
      .map((row) => `
        <div class="data-row">
          ${dataCell(row.driverName || "未設定", row.siteName || "-", "primary")}
          ${dataCell(`${formatShortDate(row.dateFrom || row.date)}〜${formatShortDate(row.dateTo || row.date)}`, `実働 ${row.workedDays || 0}日`)}
          ${dataCell(formatMoney(row.requestedAmount || row.amount || 0), "希望")}
          ${dataCell(formatMoney(row.transferAmount || 0), `手数料 ${formatMoney(row.fee || 0)}`, "good-text")}
          ${dataCell(row.tag || "通常", row.note || "")}
          <div class="data-actions"><button class="button ghost small" data-advance-detail="${row.id}">詳細</button></div>
        </div>
      `);
    return dataTable(
      ["ドライバー", "申請期間", "希望額", "振込予定", "タグ", "操作"],
      rows,
      "前払い申請なし",
      "この月の申請はまだありません。",
      "1.15fr 1.2fr .85fr .9fr .65fr .65fr"
    );
  }

  function advanceDetailHtml(row) {
    return `
      <div class="kpi-grid" style="grid-template-columns:1fr 1fr;margin-top:0;">
        <div class="kpi money"><span>振込予定</span><strong>${formatMoney(row.transferAmount || 0)}</strong></div>
        <div class="kpi"><span>実働日数</span><strong>${row.workedDays || 0}日</strong></div>
      </div>
      <div class="item" style="margin-top:12px;">
        <strong>${escapeHtml(row.driverName || "")}</strong>
        <p>${formatShortDate(row.dateFrom || row.date)}〜${formatShortDate(row.dateTo || row.date)} / ${escapeHtml(row.siteName || "")}</p>
      </div>
      <div class="list" style="margin-top:12px;">
        ${item("売上金額", formatMoney(row.salesAmount || 0), [{ label: "単価計算", kind: "good" }])}
        ${item("前払い希望額", formatMoney(row.requestedAmount || row.amount || 0), [{ label: "売上50%", kind: "good" }])}
        ${item("前払い手数料", formatMoney(row.fee || 0), [{ label: "8% + 260", kind: "warn" }])}
        ${item("口座情報", `銀行:${escapeHtml(row.bankName || "")} / 支店:${escapeHtml(row.branchName || "")} / 口座:${escapeHtml(row.accountNumber || "")} / 名義:${escapeHtml(row.accountHolder || "")}`, [{ label: "振込先", kind: "" }])}
      </div>
    `;
  }

  function driverHistoryHtml(data, driver) {
    const stats = driverMonthlyStats(data, driver);
    const history = stats.rows.length
      ? stats.rows.map((row) => `
          <div class="item">
            <div class="item-top">
              <div>
                <strong>${formatDateJP(row.date)}</strong>
                <p>${isSubstituteRow(row) ? "代走" : "通常"} / 出勤 ${row.startTime || "-"} / 退勤 ${row.endTime || "-"} / ${escapeHtml(row.note || "メモなし")}</p>
              </div>
              <span class="tag ${isWorkingStatus(row.status) || isSubstituteRow(row) ? "warn" : "good"}">${isSubstituteRow(row) ? "代走" : attendanceStatusText(row.status)}</span>
            </div>
          </div>
        `).join("")
      : `<div class="item"><strong>出勤履歴なし</strong><p>この月の出勤報告はまだありません。</p></div>`;

    return `
      <div class="kpi-grid" style="grid-template-columns:1fr 1fr;margin-top:0;">
        <div class="kpi"><span>通常出勤</span><strong>${stats.normalWorkedDays}日</strong></div>
        <div class="kpi warn"><span>代走</span><strong>${stats.substituteDays}日</strong></div>
        <div class="kpi"><span>休み希望</span><strong>${stats.holidayDays}日</strong></div>
        <div class="kpi money"><span>売上合計</span><strong>${formatMoney(stats.salesTotal)}</strong></div>
      </div>
      <div class="item" style="margin-top:12px;">
        <strong>${escapeHtml(driver.name)}</strong>
        <p>${escapeHtml(driver.siteName || "")} / 単価 ${formatMoney(driver.unitPrice || 0)}</p>
      </div>
      <h2 style="margin-top:16px;">出勤履歴</h2>
      <div class="list">${history}</div>
    `;
  }

  function siteDetailHtml(data, site) {
    const siteDrivers = data.drivers.filter((driver) => driver.siteId === site.id);
    const activeDrivers = siteDrivers.filter((driver) => driver.lifecycle !== "inactive");
    const driverStats = siteDrivers.map((driver) => ({
      driver,
      ...driverMonthlyStats(data, driver)
    }));
    const salesTotal = driverStats.reduce((sum, row) => sum + row.salesTotal, 0);
    const workedDays = driverStats.reduce((sum, row) => sum + row.workedDays, 0);
    const substituteDays = driverStats.reduce((sum, row) => sum + row.substituteDays, 0);
    const holidayDays = driverStats.reduce((sum, row) => sum + row.holidayDays, 0);
    const todayRows = data.todayRows.filter((row) => row.siteId === site.id);
    const working = todayRows.filter((row) => isWorkingStatus(row.status)).length;
    const driversHtml = driverStats.length
      ? driverStats.map((row) => item(
        row.driver.name,
        `${row.driver.lifecycle || "active"} / 出勤 ${row.normalWorkedDays}日 / 代走 ${row.substituteDays}日 / 休み ${row.holidayDays}日 / 売上 ${formatMoney(row.salesTotal)}`,
        [{ label: row.driver.lifecycle === "inactive" ? "停止" : "稼働", kind: row.driver.lifecycle === "inactive" ? "warn" : "good" }],
        `<button class="button ghost small" data-driver="${row.driver.id}">履歴</button>`
      )).join("")
      : item("所属ドライバーなし", "この現場に登録されているドライバーはいません。", [{ label: "0名" }]);
    return `
      <div class="kpi-grid" style="grid-template-columns:1fr 1fr;margin-top:0;">
        <div class="kpi"><span>本日稼働中</span><strong>${working}</strong></div>
        <div class="kpi money"><span>月間売上</span><strong>${formatMoney(salesTotal)}</strong></div>
        <div class="kpi good"><span>実働合計</span><strong>${workedDays}日</strong></div>
        <div class="kpi warn"><span>代走合計</span><strong>${substituteDays}日</strong></div>
        <div class="kpi"><span>休み希望</span><strong>${holidayDays}日</strong></div>
        <div class="kpi"><span>所属人数</span><strong>${activeDrivers.length}</strong></div>
      </div>
      <div class="item" style="margin-top:12px;">
        <strong>${escapeHtml(site.name)}</strong>
        <p>ID: ${escapeHtml(site.id || "")} / 表示順 ${escapeHtml(site.sort || "-")} / 状態 ${String(site.active) === "false" ? "停止" : "有効"}</p>
      </div>
      <h2 style="margin-top:16px;">所属ドライバー</h2>
      <div class="list">${driversHtml}</div>
    `;
  }

  function clientInfo() {
    return {
      userAgent: navigator.userAgent || "",
      language: navigator.language || "",
      screen: `${window.screen.width}x${window.screen.height}`,
      path: location.pathname,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || ""
    };
  }

  async function recordAdminLogin(username, success) {
    const row = {
      type: "admin_login",
      id: cryptoId("login"),
      username,
      success,
      loggedAt: new Date().toISOString(),
      client: clientInfo()
    };
    const rows = readStore("adminLogins", []);
    rows.unshift(row);
    writeStore("adminLogins", rows.slice(0, 80));
    try {
      await apiPost(row);
    } catch (error) {
      // ローカル履歴は残す。GAS未設定時や通信失敗時もログイン操作は止めない。
    }
    return row;
  }

  function initAdmin() {
    setAdminToken("");
    const monthInput = $("adminMonth");
    monthInput.value = monthKey(new Date());
    let shiftTab = "holiday";
    let authenticated = false;
    let lastRemoteSync = "";
    let autoRefreshTimer = null;

    function render() {
      const data = buildDashboard(monthInput.value);
      const summary = adminFinancialSummary(data);
      $("kpiWorking").textContent = data.kpis.working;
      $("kpiAdvance").textContent = formatMoney(data.kpis.advanceTotal);
      $("kpiRate").textContent = `${data.kpis.rate}%`;
      $("kpiSales").textContent = formatMoney(summary.salesTotal);
      $("kpiSalesSub").textContent = `延べ実働 ${summary.workedDaysTotal}稼働 / 登録 ${data.drivers.length}名`;
      $("kpiAdvanceRate").textContent = `${summary.advanceRate}%`;
      $("kpiAdvanceRateSub").textContent = `希望額 ${formatMoney(summary.requestedTotal)}`;
      $("kpiTransfer").textContent = formatMoney(summary.transferTotal);
      if ($("opsTodayWorked")) $("opsTodayWorked").textContent = data.kpis.working;
      if ($("opsCurrentWorking")) $("opsCurrentWorking").textContent = data.kpis.currentWorking;
      if ($("opsFinished")) $("opsFinished").textContent = data.kpis.finished;
      if ($("opsNotStarted")) $("opsNotStarted").textContent = data.kpis.notStarted;
      if ($("dashboardTodayMeta")) {
        $("dashboardTodayMeta").textContent = `${formatDateJP(data.today)} の状況${data.isActualToday ? "" : " / 選択月の最新稼働日を表示中"}`;
      }
      if ($("dashboardSyncText")) {
        $("dashboardSyncText").textContent = lastRemoteSync ? `最終取得 ${lastRemoteSync}` : (config.API_BASE_URL ? "GAS未取得" : "デモ表示");
      }
      if ($("dashboardOpsList")) $("dashboardOpsList").innerHTML = renderTodayOperationBoard(data);
      $("dashboardAlertList").innerHTML = renderAdminAlerts(data, summary);
      $("dashboardRankList").innerHTML = renderRankList(summary);
      $("dashboardAdvanceSummary").innerHTML = renderAdvanceSummaryByDriver(data);
      $("dashboardSiteSummary").innerHTML = renderMonthlySiteRows(data, summary);
      $("monthlySalesKpi").textContent = formatMoney(summary.salesTotal);
      $("monthlyWorkedKpi").textContent = `${summary.normalWorkedDaysTotal}稼働`;
      $("monthlyAdvanceKpi").textContent = `${summary.substituteDaysTotal}日`;
      $("monthlyTransferKpi").textContent = `${summary.holidayDaysTotal}日`;
      $("monthlyDriverList").innerHTML = renderSalesReconciliationRows(data, summary);
      $("monthlySiteList").innerHTML = renderMonthlySiteRows(data, summary);
      $("monthlyAvailableMonths").innerHTML = renderAvailableMonths(monthInput.value);
      $("monthlyAdvanceList").innerHTML = renderMonthlyAdvanceRows(data);
      $("attendanceTodayKpi").textContent = data.kpis.working;
      $("attendanceWarningKpi").textContent = data.kpis.warning;
      $("attendanceSalesKpi").textContent = `${data.todayRows.filter((row) => isFinishedStatus(row.status)).length}名`;
      $("attendanceWorkedKpi").textContent = `${summary.substituteDaysTotal}日`;
      $("advanceTransferKpi").textContent = formatMoney(summary.transferTotal);
      $("advanceRequestedKpi").textContent = formatMoney(summary.requestedTotal);
      $("advanceCountKpi").textContent = `${data.advances.length}件`;
      $("advanceOverlapKpi").textContent = "OK";
      $("advanceDriverSummaryList").innerHTML = renderAdvanceSummaryByDriver(data);

      $("siteList").innerHTML = renderSiteRows(data, false);

      $("todayList").innerHTML = data.drivers.map((driver) => {
        const row = data.todayRows.find((item) => item.driverId === driver.id);
        const status = row ? attendanceStatusText(row.status) : "未出勤";
        const body = `${driver.siteName} ・ ${driver.contractType || ""}${row && row.date ? ` ・ ${formatShortDate(row.date)}` : ""}`;
        return item(driver.name, body, [{ label: status, kind: row && isWorkingStatus(row.status) ? "warn" : "good" }], `<button class="button ghost small" data-driver="${driver.id}">詳細</button>`);
      }).join("");

      $("driverList").innerHTML = renderCheckoutDriverRows(data, summary);
      $("managementDriverList").innerHTML = renderDriverMonthlyRows(data, summary, true);
      $("notClockedOutList").innerHTML = renderNotClockedOut(data, false);
      $("managementAttendanceFixList").innerHTML = renderAttendanceFixRows(data);
      $("managementSiteList").innerHTML = renderSiteRows(data, true);
      $("managementQualityList").innerHTML = renderQualityChecklist(data, summary);

      $("advanceList").innerHTML = renderAdvanceApplicationRows(data);
      $("bankInfoList").innerHTML = renderBankInfo(data, false);
      $("advanceOverlapHistory").innerHTML = renderAdvanceOverlapHistory(data);

      const rows = shiftTab === "holiday" ? data.holidays : data.fixedShift;
      $("shiftList").innerHTML = rows.length
        ? rows.map((row) => {
          const days = Array.isArray(row.days) ? row.days : String(row.days || "").split(",").map((day) => day.trim()).filter(Boolean);
          return item(row.driverName, days.length ? days.map((day) => formatDateJP(day)).join("、") : "入力なし", [{ label: shiftTab === "holiday" ? "希望" : "通知停止", kind: shiftTab === "holiday" ? "" : "warn" }]);
        }).join("")
        : item(shiftTab === "holiday" ? "休み希望なし" : "確定シフトなし", "この月のデータはまだありません", [{ label: "未登録" }]);

      const logins = readStore("adminLogins", []);
      $("loginHistoryList").innerHTML = logins.length
        ? logins.map((row) => item(
          row.username || "未入力",
          `${formatDateTimeJP(row.loggedAt)} / ${row.timeZone || (row.client && row.client.timeZone) || "Asia/Tokyo"}`,
          [{ label: row.success === true || String(row.success).toUpperCase() === "TRUE" ? "成功" : "失敗", kind: row.success === true || String(row.success).toUpperCase() === "TRUE" ? "good" : "warn" }]
        )).join("")
        : item("履歴なし", "まだ管理者ログイン履歴はありません", [{ label: "0件" }]);
      applyAdminSearch();
    }

    function setSection(section) {
      document.querySelectorAll(".admin-section").forEach((node) => node.classList.toggle("active", node.id === `section-${section}`));
      document.querySelectorAll("[data-section]").forEach((node) => node.classList.toggle("active", node.dataset.section === section));
      applyAdminSearch();
    }

    function setShiftTab(nextTab) {
      shiftTab = nextTab;
      document.querySelectorAll("[data-shift-tab]").forEach((node) => node.classList.toggle("active", node.dataset.shiftTab === shiftTab));
    }

    function openShiftBulk(type) {
      setShiftTab(type);
      render();
      openModal(type === "holiday" ? "休み希望を全員分入力" : "確定シフトを全員分入力", shiftBulkForm(buildDashboard(monthInput.value), type, monthInput.value));
    }

    function applyAdminSearch() {
      const search = $("adminSearch");
      const q = search ? search.value.trim().toLowerCase() : "";
      const section = document.querySelector(".admin-section.active");
      if (!section) return;
      section.querySelectorAll(".item, .rank-row, .data-row").forEach((node) => {
        node.classList.toggle("search-hidden", Boolean(q) && !node.textContent.toLowerCase().includes(q));
      });
    }

    async function loadRemoteDashboard() {
      if (!config.API_BASE_URL) {
        render();
        return;
      }
      const remote = await apiGet({ type: "dashboard", month: monthInput.value });
      if (!remote || !remote.ok || !remote.data) throw new Error("GASデータの取得に失敗しました");
      const remoteData = remote.data;
      if (remoteData.businessDate) writeStore("serverBusinessDate", remoteData.businessDate);
      if (Array.isArray(remoteData.drivers)) writeStore("drivers", remoteData.drivers);
      if (Array.isArray(remoteData.sites)) writeStore("sites", remoteData.sites);
      if (Array.isArray(remoteData.adminLogins)) writeStore("adminLogins", remoteData.adminLogins);
      replaceMonthRows("attendance", monthInput.value, remoteData.attendance || [], (row) => monthKeyFromValue(row.date));
      replaceMonthRows("advance", monthInput.value, remoteData.advance || [], (row) => monthKeyFromValue(row.date || row.dateFrom));
      replaceMonthRows("holiday", monthInput.value, normalizeShiftRows(remoteData.holiday || [], monthInput.value), (row) => String(row.targetYearMonth || ""));
      replaceMonthRows("fixedShift", monthInput.value, normalizeShiftRows(remoteData.fixedShift || [], monthInput.value), (row) => String(row.targetYearMonth || ""));
      lastRemoteSync = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
      render();
    }

    async function refreshDashboardQuietly() {
      if (!authenticated || !config.API_BASE_URL || document.hidden) return;
      try {
        await loadRemoteDashboard();
      } catch (error) {
        if ($("dashboardSyncText")) $("dashboardSyncText").textContent = "取得失敗";
      }
    }

    function startAdminAutoRefresh() {
      if (autoRefreshTimer) window.clearInterval(autoRefreshTimer);
      autoRefreshTimer = window.setInterval(refreshDashboardQuietly, 45000);
    }

    document.querySelectorAll("[data-section]").forEach((button) => button.addEventListener("click", () => setSection(button.dataset.section)));
    document.querySelectorAll("[data-shift-tab]").forEach((button) => button.addEventListener("click", () => {
      setShiftTab(button.dataset.shiftTab);
      render();
    }));
    $("adminSearch").addEventListener("input", applyAdminSearch);
    window.addEventListener("focus", refreshDashboardQuietly);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refreshDashboardQuietly();
    });

    document.body.addEventListener("click", async (event) => {
      const target = event.target.closest("button");
      if (!target) return;
      const data = buildDashboard(monthInput.value);
      if (target.dataset.monthJump) {
        monthInput.value = target.dataset.monthJump;
        if (config.API_BASE_URL) {
          setLoading(true, "選択月のデータを取得中...");
          try {
            await loadRemoteDashboard();
          } catch (error) {
            showToast(error.message);
            render();
          } finally {
            setLoading(false);
          }
        } else {
          render();
        }
        showToast(`${target.dataset.monthJump} を表示しました`);
        return;
      }
      if (target.dataset.adminAction) {
        if (target.dataset.adminAction === "add-driver") openModal("ドライバー新規登録", driverEditForm(null, readStore("sites", config.SITES || [])));
        if (target.dataset.adminAction === "add-site") openModal("現場新規登録", siteEditForm(null));
        if (target.dataset.adminAction === "bulk-holiday") openShiftBulk("holiday");
        if (target.dataset.adminAction === "bulk-fixed") openShiftBulk("fixed");
        return;
      }
      if (target.dataset.driver) {
        const driver = data.drivers.find((item) => item.id === target.dataset.driver);
        if (driver) openModal("ドライバー履歴", driverHistoryHtml(data, driver));
      }
      if (target.dataset.editDriver) {
        const driver = data.drivers.find((item) => item.id === target.dataset.editDriver);
        const sites = readStore("sites", config.SITES || []);
        openModal("ドライバー編集", driverEditForm(driver, sites));
      }
      if (target.dataset.site) {
        const site = data.sites.find((item) => item.id === target.dataset.site);
        if (site) openModal("現場詳細", siteDetailHtml(data, site));
      }
      if (target.dataset.editSite) {
        const site = data.sites.find((item) => item.id === target.dataset.editSite);
        openModal("現場編集", siteEditForm(site));
      }
      if (target.dataset.advanceDetail) {
        const row = data.advances.find((item) => item.id === target.dataset.advanceDetail);
        if (row) openModal("前払い申請詳細", advanceDetailHtml(row));
      }
      if (target.dataset.toggleDriver) {
        const drivers = readStore("drivers", []);
        const current = drivers.find((driver) => driver.id === target.dataset.toggleDriver);
        if (!current) return;
        const lifecycle = current.lifecycle === "inactive" ? "active" : "inactive";
        setLoading(true, "ドライバー状態を保存中...");
        try {
          await apiPost({ type: "driver_lifecycle", id: current.id, lifecycle });
          const next = drivers.map((driver) => driver.id === current.id ? { ...driver, lifecycle, updatedAt: new Date().toISOString() } : driver);
          writeStore("drivers", next);
          showToast("ドライバー状態を更新しました");
          render();
        } catch (error) {
          showToast(error.message);
        } finally {
          setLoading(false);
        }
      }
      if (target.dataset.resetLine) {
        const drivers = readStore("drivers", []);
        const current = drivers.find((driver) => driver.id === target.dataset.resetLine);
        if (!current) return;
        if (!window.confirm(`${current.name}さんのLINE連携とログイン保持を解除します。次回は名前と4桁PINが必要です。よろしいですか？`)) return;
        setLoading(true, "LINE連携を解除中...");
        try {
          const result = await apiPost({ type: "driver_line_reset", driverId: current.id });
          const nextDriver = result && result.driver ? result.driver : { ...current, lineUserId: "", updatedAt: new Date().toISOString() };
          writeStore("drivers", drivers.map((driver) => driver.id === current.id ? { ...driver, ...nextDriver } : driver));
          showToast("LINE連携を解除しました");
          if (config.API_BASE_URL) await loadRemoteDashboard();
          else render();
        } catch (error) {
          showToast(error.message);
        } finally {
          setLoading(false);
        }
      }
      if (target.dataset.clearAtt) {
        const drivers = readStore("drivers", []);
        const current = drivers.find((driver) => driver.id === target.dataset.clearAtt);
        if (!current) return;
        const date = todayISO();
        if (!window.confirm(`${current.name}さんの本日(${formatDateJP(date)})の出勤・退勤を取り消します。よろしいですか？`)) return;
        setLoading(true, "本日の勤怠を取り消し中...");
        try {
          await apiPost({ type: "attendance_clear", driverId: current.id, date });
          writeStore("attendance", readStore("attendance", []).filter((row) => !(row.driverId === current.id && sameDate(row.date, date))));
          showToast("本日の勤怠を取り消しました");
          if (config.API_BASE_URL) await loadRemoteDashboard();
          else render();
        } catch (error) {
          showToast(error.message);
        } finally {
          setLoading(false);
        }
      }
      if (target.dataset.toggleSite) {
        const sites = readStore("sites", []);
        const current = sites.find((site) => site.id === target.dataset.toggleSite);
        if (!current) return;
        const nextSite = { ...current, active: String(current.active) === "false", updatedAt: new Date().toISOString() };
        setLoading(true, "現場状態を保存中...");
        try {
          await apiPost({ type: "site_upsert", ...nextSite });
          writeStore("sites", sites.map((site) => site.id === current.id ? nextSite : site));
          showToast("現場状態を更新しました");
          render();
        } catch (error) {
          showToast(error.message);
        } finally {
          setLoading(false);
        }
      }
      if (target.dataset.fixAtt) {
        const driver = data.drivers.find((item) => item.id === target.dataset.fixAtt);
        if (!driver) return;
        const payload = {
          type: "attendance",
          action: "admin_fix",
          id: cryptoId("attfix"),
          date: todayISO(),
          driverId: driver.id,
          driverName: driver.name,
          siteId: driver.siteId,
          siteName: driver.siteName,
          status: "finished",
          workType: "normal",
          startTime: "08:00",
          endTime: "18:00",
          note: "管理者修正",
          monthKey: sheetMonthKey(todayISO()),
          updatedAt: new Date().toISOString()
        };
        setLoading(true, "勤務修正を保存中...");
        try {
          await apiPost(payload);
          upsertLocal("attendance", payload, (row) => row.driverId === driver.id && sameDate(row.date, todayISO()));
          showToast("勤務を管理者修正しました");
          render();
        } catch (error) {
          showToast(error.message);
        } finally {
          setLoading(false);
        }
      }
      if (target.dataset.fixSub) {
        const driver = data.drivers.find((item) => item.id === target.dataset.fixSub);
        if (!driver) return;
        const payload = {
          type: "attendance",
          action: "admin_fix",
          id: cryptoId("attfix"),
          date: todayISO(),
          driverId: driver.id,
          driverName: driver.name,
          siteId: driver.siteId,
          siteName: driver.siteName,
          status: "finished",
          workType: "substitute",
          startTime: "08:00",
          endTime: "18:00",
          note: "管理者修正・代走",
          monthKey: sheetMonthKey(todayISO()),
          updatedAt: new Date().toISOString()
        };
        setLoading(true, "代走退勤を保存中...");
        try {
          await apiPost(payload);
          upsertLocal("attendance", payload, (row) => row.driverId === driver.id && sameDate(row.date, todayISO()));
          showToast("代走として退勤修正しました");
          render();
        } catch (error) {
          showToast(error.message);
        } finally {
          setLoading(false);
        }
      }
    });

    $("refreshAdminBtn").addEventListener("click", async () => {
      setLoading(true, "最新データを確認中...");
      try {
        await loadRemoteDashboard();
        showToast(config.API_BASE_URL ? "GASから取得しました" : "ローカルデータを最新化しました");
      } catch (error) {
        showToast(error.message);
      } finally {
        setLoading(false);
      }
    });
    $("resetDemoDataBtn").addEventListener("click", () => {
      seedDemoData(true);
      monthInput.value = monthKey(new Date());
      render();
      showToast("デモデータを更新しました");
    });
    $("exportCsvBtn").addEventListener("click", () => {
      const data = buildDashboard(monthInput.value);
      const summary = adminFinancialSummary(data);
      const rows = [["type", "date_from", "date_to", "driver", "site", "status", "normal_days", "substitute_days", "holiday_days", "unit_price", "sales_amount", "requested_amount", "fee", "transfer_amount", "note"]];
      data.attendance.forEach((row) => rows.push(["attendance", row.date, row.date, row.driverName, row.siteName, row.status, isSubstituteRow(row) ? "" : 1, isSubstituteRow(row) ? 1 : "", "", "", "", "", "", "", row.note || ""]));
      data.advances.forEach((row) => rows.push(["advance", row.dateFrom || row.date, row.dateTo || row.date, row.driverName, row.siteName, row.tag || "", "", "", "", row.unitPrice || "", row.salesAmount || "", row.requestedAmount || row.amount || "", row.fee || "", row.transferAmount || "", row.note || ""]));
      summary.driverStats.forEach((row) => rows.push(["driver_summary", monthInput.value, monthInput.value, row.driver.name, row.driver.siteName, row.driver.lifecycle || "", row.normalWorkedDays, row.substituteDays, row.holidayDays, row.driver.unitPrice || 0, row.salesTotal, "", "", "", "元請け明細照合用"]));
      data.sites.forEach((site) => {
        const stats = summary.driverStats.filter((row) => row.driver.siteId === site.id);
        rows.push(["site_summary", monthInput.value, monthInput.value, "", site.name, String(site.active) === "false" ? "inactive" : "active", stats.reduce((sum, row) => sum + row.normalWorkedDays, 0), stats.reduce((sum, row) => sum + row.substituteDays, 0), stats.reduce((sum, row) => sum + row.holidayDays, 0), "", stats.reduce((sum, row) => sum + row.salesTotal, 0), "", "", "", `drivers:${stats.length}`]);
      });
      const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `poms_${monthInput.value}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      showToast("CSVを書き出しました");
    });
    $("addDriverBtn").addEventListener("click", () => {
      openModal("ドライバー新規登録", driverEditForm(null, readStore("sites", config.SITES || [])));
    });
    $("addSiteBtn").addEventListener("click", () => {
      openModal("現場新規登録", siteEditForm(null));
    });
    $("bulkShiftBtn").addEventListener("click", () => {
      openShiftBulk(shiftTab);
    });
    document.body.addEventListener("click", async (event) => {
      if (!event.target.closest("#saveDriverEditBtn")) return;
      const sites = readStore("sites", config.SITES || []);
      const drivers = readStore("drivers", []);
      const driverId = $("editDriverId").value;
      const site = sites.find((item) => item.id === $("editDriverSite").value) || sites[0] || { id: "", name: "" };
      const current = drivers.find((driver) => driver.id === driverId) || {};
      const nextId = driverId || cryptoId("drv");
      const nextDriver = {
        ...current,
        id: nextId,
        lineUserId: current.lineUserId || "",
        name: $("editDriverName").value.trim(),
        siteId: site.id,
        siteName: site.name,
        contractType: $("editDriverContract").value.trim(),
        pin: $("editDriverPin").value.trim(),
        lifecycle: current.lifecycle || "active",
        unitPrice: Number($("editDriverUnitPrice").value || 0),
        advanceFee: 0,
        bankName: $("editDriverBankName").value.trim(),
        branchName: $("editDriverBranchName").value.trim(),
        accountNumber: $("editDriverAccountNumber").value.trim(),
        accountHolder: $("editDriverAccountHolder").value.trim(),
        createdAt: current.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (!nextDriver.name) {
        showToast("ドライバー名を入力してください");
        return;
      }
      if (!/^\d{4}$/.test(nextDriver.pin)) {
        showToast("4桁PINを入力してください");
        return;
      }
      setLoading(true, "ドライバー情報を保存中...");
      try {
        await apiPost({ type: "driver_upsert", ...nextDriver });
        writeStore("drivers", driverId ? drivers.map((driver) => driver.id === driverId ? nextDriver : driver) : [...drivers, nextDriver]);
        $("adminModal").classList.add("hidden");
        showToast("ドライバー情報を更新しました");
        render();
      } catch (error) {
        showToast(error.message);
      } finally {
        setLoading(false);
      }
    });
    document.body.addEventListener("click", async (event) => {
      if (!event.target.closest("#saveSiteEditBtn")) return;
      const sites = readStore("sites", []);
      const siteId = $("editSiteId").value || cryptoId("site");
      const current = sites.find((site) => site.id === siteId) || {};
      const nextSite = {
        ...current,
        id: siteId,
        name: $("editSiteName").value.trim(),
        sort: Number($("editSiteSort").value || sites.length + 1),
        active: $("editSiteActive").value === "true",
        updatedAt: new Date().toISOString()
      };
      if (!nextSite.name) {
        showToast("現場名を入力してください");
        return;
      }
      setLoading(true, "現場情報を保存中...");
      try {
        await apiPost({ type: "site_upsert", ...nextSite });
        writeStore("sites", sites.some((site) => site.id === siteId) ? sites.map((site) => site.id === siteId ? nextSite : site) : [...sites, nextSite]);
        const drivers = readStore("drivers", []);
        writeStore("drivers", drivers.map((driver) => driver.siteId === siteId ? { ...driver, siteName: nextSite.name, updatedAt: new Date().toISOString() } : driver));
        $("adminModal").classList.add("hidden");
        showToast("現場情報を更新しました");
        render();
      } catch (error) {
        showToast(error.message);
      } finally {
        setLoading(false);
      }
    });
    document.body.addEventListener("click", async (event) => {
      if (!event.target.closest("#saveShiftBulkBtn")) return;
      const data = buildDashboard(monthInput.value);
      const type = $("bulkShiftType").value;
      const month = $("bulkShiftMonth").value;
      const storeName = type === "holiday" ? "holiday" : "fixedShift";
      const payloadType = type === "holiday" ? "holiday_save" : "fixed_shift_save";
      const activeDrivers = data.drivers.filter((driver) => driver.lifecycle !== "inactive");
      const shiftInputs = Array.from(document.querySelectorAll("[data-shift-days]"));
      const payloads = activeDrivers.map((driver) => {
        const input = shiftInputs.find((node) => node.dataset.shiftDays === driver.id);
        const days = parseDateList(input ? input.value : "", month);
        return {
          type: payloadType,
          id: `${type}_${driver.id}_${month}`,
          driverId: driver.id,
          driverName: driver.name,
          siteId: driver.siteId,
          siteName: driver.siteName,
          targetYearMonth: month,
          days,
          note: type === "holiday" ? "管理者一括入力" : "",
          updatedAt: new Date().toISOString()
        };
      });
      setLoading(true, type === "holiday" ? "休み希望を保存中..." : "確定シフトを保存中...");
      try {
        for (const payload of payloads) {
          await apiPost(payload);
        }
        const existing = readStore(storeName, []);
        const ids = new Set(payloads.map((row) => row.driverId));
        writeStore(storeName, [
          ...existing.filter((row) => !(row.targetYearMonth === month && ids.has(row.driverId))),
          ...payloads
        ]);
        $("adminModal").classList.add("hidden");
        showToast(type === "holiday" ? "休み希望を全員分保存しました" : "確定シフトを全員分保存しました");
        render();
      } catch (error) {
        showToast(error.message);
      } finally {
        setLoading(false);
      }
    });
    $("closeModalBtn").addEventListener("click", () => $("adminModal").classList.add("hidden"));
    $("adminModal").addEventListener("click", (event) => {
      if (event.target === $("adminModal")) $("adminModal").classList.add("hidden");
    });
    monthInput.addEventListener("change", async () => {
      if (!config.API_BASE_URL) {
        render();
        return;
      }
      setLoading(true, "選択月のデータを取得中...");
      try {
        await loadRemoteDashboard();
      } catch (error) {
        showToast(error.message);
        render();
      } finally {
        setLoading(false);
      }
    });

    async function handleAdminLogin() {
      const username = $("adminUsername").value.trim();
      const password = $("adminPassword").value;
      if (!username || !/^\d{4}$/.test(password)) {
        showToast("名前と4桁PINを入力してください");
        return;
      }
      let success = false;
      setLoading(true, "管理者ログインを確認中...");
      try {
        if (config.API_BASE_URL) {
          const result = await apiPost({ type: "admin_auth", username, password, client: clientInfo() }, { skipAdminToken: true });
          setAdminToken(result.token || "");
          success = Boolean(result.token);
        } else {
          const auth = config.ADMIN_AUTH || {};
          const demoPassword = auth.password || auth.demoPassword || "1234";
          success = Boolean(username && password && username === auth.username && password === demoPassword);
          await recordAdminLogin(username || "未入力", success);
        }
      } catch (error) {
        setAdminToken("");
        showToast(error.message);
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
      if (!success) {
        showToast("名前またはパスワードが違います");
        return;
      }
      authenticated = true;
      $("adminLoginStage").classList.add("hidden");
      $("adminApp").classList.remove("hidden");
      $("adminBottomNav").classList.remove("hidden");
      showToast("管理画面にログインしました");
      render();
      startAdminAutoRefresh();
      if (config.API_BASE_URL) {
        setLoading(true, "GASから月次データを取得中...");
        try {
          await loadRemoteDashboard();
        } catch (error) {
          showToast(error.message);
        } finally {
          setLoading(false);
        }
      }
    }

    $("adminLoginBtn").addEventListener("click", handleAdminLogin);
    $("adminPassword").addEventListener("keydown", (event) => {
      if (event.key === "Enter") handleAdminLogin();
    });
    $("adminUsername").focus();
  }

  ensureSeed();
  applyDemoModeVisibility();
  if (page === "attendance") initAttendance();
  if (page === "advance") initAdvance();
  if (page === "holiday") initHoliday();
  if (page === "admin") initAdmin();
})();
