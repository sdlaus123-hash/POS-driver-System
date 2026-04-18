(function () {
  "use strict";

  const config = window.POMS_CONFIG || {};
  const page = document.body.dataset.page;
  const $ = (id) => document.getElementById(id);
  const storageKey = (name) => `poms:${name}`;
  const pad = (num) => String(num).padStart(2, "0");
  const DEMO_SEED_VERSION = "poms-demo-polish-2026-04-16-clean";
  const adminTokenKey = storageKey("adminToken");
  const driverTokenKey = storageKey("driverToken");
  const driverSessionKey = storageKey("driverSession");

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
      const workedDays = attendanceRows.filter((row) => row.driverId === driverId && row.date >= dateFrom && row.date <= dateTo && row.status !== "off").length;
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
    const date = typeof dateOrString === "string" ? new Date(`${dateOrString}-01T00:00:00`) : dateOrString;
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  }

  function sheetMonthKey(value) {
    return String(value).slice(0, 7).replace("-", "_");
  }

  function formatDateJP(value) {
    const date = value instanceof Date ? value : new Date(`${value}T00:00:00`);
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(date);
  }

  function formatMoney(value) {
    return `¥${Number(value || 0).toLocaleString("ja-JP")}`;
  }

  function formatShortDate(value) {
    if (!value) return "-";
    const date = new Date(`${value}T00:00:00`);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function addDaysISO(value, days) {
    const date = new Date(`${value}T00:00:00`);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function calculateAdvanceFee(requestedAmount) {
    return Math.round(Number(requestedAmount || 0) * 0.08 + 260);
  }

  function rangesOverlap(startA, endA, startB, endB) {
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
    let currentX = 0;
    let maxX = 1;
    let dragging = false;

    const confirm = () => {
      if (swipe.dataset.busy === "1" || swipe.classList.contains("disabled")) return;
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
      dragging = true;
      startX = event.clientX;
      currentX = 0;
      maxX = Math.max(1, swipe.clientWidth - 64);
      swipe.classList.add("dragging");
      swipe.setPointerCapture(event.pointerId);
    });
    swipe.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      moveTo(event.clientX);
    });
    swipe.addEventListener("pointerup", () => {
      if (!dragging) return;
      dragging = false;
      swipe.classList.remove("dragging");
      if (currentX / maxX >= .82) confirm();
      else resetSwipeConfirm(swipe);
    });
    swipe.addEventListener("pointercancel", () => {
      dragging = false;
      resetSwipeConfirm(swipe);
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
    const requested = params.get("driverId") || localStorage.getItem(storageKey("currentDriverId"));
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

  async function requireDriverLogin(requestedDriverId) {
    const main = document.querySelector("main.narrow");
    const session = readDriverSession();
    if (session && session.driver && session.token && (!requestedDriverId || session.driver.id === requestedDriverId)) {
      setDriverToken(session.token);
      localStorage.setItem(storageKey("currentDriverId"), session.driver.id);
      return session.driver;
    }
    clearDriverSession();
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
          const result = await apiPost({ type: "driver_auth", name, pin, driverId: requestedDriverId || "" }, { skipAdminToken: true });
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
    if (initial) initial.textContent = (driver.name || "P").trim().slice(0, 1);
    if (name) name.textContent = driver.name;
    if (site) site.textContent = `${driver.siteName} ・ ${driver.contractType || "契約"}`;
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
    const response = await fetch(config.API_BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(bodyPayload)
    });
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
    const requestParams = getAdminToken() ? { ...params, adminToken: getAdminToken() } : params;
    const url = `${config.API_BASE_URL}?${new URLSearchParams(requestParams).toString()}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error("GASからの取得に失敗しました");
    return response.json();
  }

  function upsertLocal(listName, row, matcher) {
    const rows = readStore(listName, []);
    const index = rows.findIndex(matcher);
    if (index >= 0) rows[index] = { ...rows[index], ...row };
    else rows.push(row);
    writeStore(listName, rows);
    return row;
  }

  function replaceMonthRows(listName, month, remoteRows, monthSelector) {
    const rows = readStore(listName, []);
    const kept = rows.filter((row) => monthSelector(row) !== month);
    writeStore(listName, [...kept, ...(remoteRows || [])]);
  }

  function normalizeShiftRows(rows, month) {
    return (rows || []).map((row) => ({
      ...row,
      targetYearMonth: row.targetYearMonth || month,
      days: Array.isArray(row.days) ? row.days : String(row.days || "").split(",").map((day) => day.trim()).filter(Boolean)
    }));
  }

  async function initAttendance() {
    const driver = await resolveCurrentDriver();
    renderDriver(driver);
    const workDate = todayISO();
    $("workDateText").textContent = formatDateJP(workDate);
    const rows = readStore("attendance", []);
    const existing = rows.find((row) => row.driverId === driver.id && row.date === workDate);
    const state = {
      status: existing ? existing.status : "off",
      startTime: existing ? existing.startTime : "",
      endTime: existing ? existing.endTime : ""
    };

    const note = $("attendanceNote");
    if (existing && existing.note) note.value = existing.note;

    function render() {
      const working = state.status === "working";
      const finished = state.status === "finished";
      $("attendanceStatus").textContent = working ? "稼働中" : finished ? "退勤済み" : "未出勤";
      $("startWorkBtn").classList.add("hidden");
      $("endWorkBtn").classList.add("hidden");
      $("startWorkSwipe").classList.toggle("hidden", working || finished);
      $("endWorkSwipe").classList.toggle("hidden", !working);
      $("attendanceDone").classList.toggle("hidden", !finished);
      $("attendanceLiveCard").classList.toggle("working", working);
      $("attendanceLiveCard").classList.toggle("finished", finished);
      $("attendanceActionTitle").textContent = working ? "退勤待ちです" : finished ? "今日の勤務は完了しました" : "今日の報告を始められます";
      $("attendanceActionText").textContent = working
        ? "業務が終わったら、下のバーを右にスワイプして退勤を保存してください。"
        : finished
          ? "管理画面にも反映済みです。お疲れさまでした。"
          : "メモがなければ、そのまま下のバーを右にスワイプしてください。";
      if (finished) $("doneAttendanceText").textContent = `出勤 ${state.startTime || "-"} / 退勤 ${state.endTime || "-"} / ${formatDateJP(workDate)}`;
    }

    async function save(action) {
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
      setLoading(true, action === "start" ? "出勤を保存中..." : "退勤を保存中...");
      try {
        await apiPost(payload);
        upsertLocal("attendance", payload, (row) => row.driverId === driver.id && row.date === workDate);
        state.status = payload.status;
        state.startTime = payload.startTime;
        state.endTime = payload.endTime;
        render();
        playCompletionCelebration(
          action === "start" ? "出勤完了" : "退勤完了",
          action === "start" ? `${time} に出勤を記録しました` : `${time} に退勤を記録しました`,
          action === "start" ? "blue" : "green"
        );
        showToast(action === "start" ? "出勤を保存しました" : "退勤を保存しました");
      } catch (error) {
        showToast(error.message);
      } finally {
        setLoading(false);
      }
    }

    $("startWorkBtn").addEventListener("click", () => save("start"));
    $("endWorkBtn").addEventListener("click", () => save("end"));
    bindSwipeConfirm("startWorkSwipe", () => $("startWorkBtn").click());
    bindSwipeConfirm("endWorkSwipe", () => $("endWorkBtn").click());
    $("resetDemoBtn").addEventListener("click", () => {
      const filtered = readStore("attendance", []).filter((row) => !(row.driverId === driver.id && row.date === workDate));
      writeStore("attendance", filtered);
      location.reload();
    });
    render();
  }

  async function initAdvance() {
    const driver = await resolveCurrentDriver();
    renderDriver(driver);
    $("advanceDateFrom").value = todayISO();
    $("advanceDateTo").value = todayISO();
    let calcSeq = 0;
    let hasOverlap = false;
    let displayedTransferAmount = 0;
    let moneyAnimFrame = null;
    let calendarCursor = new Date(`${todayISO()}T00:00:00`);
    let calendarWorkedDates = new Set();

    function playMoneyBurst() {
      const card = document.querySelector(".money-focus");
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

    function syncRangeLabel() {
      const from = $("advanceDateFrom").value;
      const to = $("advanceDateTo").value;
      $("advanceRangeLabel").textContent = from && to ? `${formatShortDate(from)}〜${formatShortDate(to)}` : "期間を選択";
      const start = new Date(`${from}T00:00:00`);
      const end = new Date(`${to}T00:00:00`);
      if (from && to && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        const days = Math.round((end - start) / 86400000) + 1;
        setQuickPeriodActive(days > 0 ? days : 0);
      } else {
        setQuickPeriodActive(0);
      }
      renderAdvanceCalendar();
    }

    function currentDriverAdvances() {
      return readStore("advance", [])
        .filter((row) => row.driverId === driver.id)
        .sort((a, b) => String(b.dateFrom || b.date || "").localeCompare(String(a.dateFrom || a.date || "")));
    }

    function currentMonthKey() {
      return `${calendarCursor.getFullYear()}-${pad(calendarCursor.getMonth() + 1)}`;
    }

    function localWorkedDatesForMonth(month) {
      return new Set(readStore("attendance", [])
        .filter((row) => row.driverId === driver.id && String(row.date || "").startsWith(month) && row.status !== "off")
        .map((row) => row.date));
    }

    async function loadAdvanceCalendarMonth() {
      const month = currentMonthKey();
      calendarWorkedDates = localWorkedDatesForMonth(month);
      if (config.API_BASE_URL) {
        try {
          const remote = await apiGet({ type: "advance_calendar", driverId: driver.id, month });
          if (remote && remote.ok) {
            calendarWorkedDates = new Set(remote.workedDates || []);
            if (Array.isArray(remote.advances)) {
              const allAdvances = readStore("advance", []);
              const others = allAdvances.filter((row) => row.driverId !== driver.id);
              writeStore("advance", [...others, ...remote.advances]);
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
      const from = $("advanceDateFrom").value;
      const to = $("advanceDateTo").value;
      if (!from || !to) return false;
      const start = from <= to ? from : to;
      const end = from <= to ? to : from;
      return date >= start && date <= end;
    }

    function isDateApplied(date) {
      return currentDriverAdvances().some((row) => rangesOverlap(date, date, row.dateFrom || row.date, row.dateTo || row.date));
    }

    function chooseCalendarDate(date) {
      const from = $("advanceDateFrom").value;
      const to = $("advanceDateTo").value;
      if (!from || (from && to)) {
        $("advanceDateFrom").value = date;
        $("advanceDateTo").value = "";
      } else if (date < from) {
        $("advanceDateFrom").value = date;
        $("advanceDateTo").value = from;
      } else {
        $("advanceDateTo").value = date;
      }
      syncRangeLabel();
      renderAdvanceCalendar();
      calculateAdvance();
    }

    function renderAdvanceCalendar() {
      const grid = $("advanceCalendarGrid");
      if (!grid) return;
      const year = calendarCursor.getFullYear();
      const month = calendarCursor.getMonth();
      $("advanceCalendarTitle").textContent = `${year}年${month + 1}月`;
      grid.innerHTML = "";
      const first = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0).getDate();
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
        button.className = [
          "advance-day",
          calendarWorkedDates.has(date) ? "worked" : "",
          isDateApplied(date) ? "applied" : "",
          selected ? "selected" : "",
          selected && (date === from || date === to) ? "range-edge" : ""
        ].filter(Boolean).join(" ");
        button.textContent = day;
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
      return currentDriverAdvances().find((row) => rangesOverlap(dateFrom, dateTo, row.dateFrom || row.date, row.dateTo || row.date));
    }

    function renderOverlap(dateFrom, dateTo) {
      const overlap = findOverlap(dateFrom, dateTo);
      hasOverlap = Boolean(overlap);
      const text = $("advanceOverlapText");
      const button = $("submitAdvanceBtn");
      if (!dateFrom || !dateTo) {
        text.textContent = "対象期間を選択してください";
        syncSubmitReady();
        return;
      }
      if (overlap) {
        text.textContent = `申請済み期間と重複しています: ${formatDateJP(overlap.dateFrom || overlap.date)} 〜 ${formatDateJP(overlap.dateTo || overlap.date)}`;
        syncSubmitReady();
        return;
      }
      text.textContent = "この期間は申請できます";
      syncSubmitReady();
    }

    function syncSubmitReady() {
      const dateFrom = $("advanceDateFrom").value;
      const dateTo = $("advanceDateTo").value;
      const workedDays = Number($("advanceWorkedDays").value || 0);
      const amount = Number($("advanceAmount").value || 0);
      const ready = Boolean(dateFrom && dateTo && workedDays && amount && !hasOverlap);
      $("submitAdvanceBtn").disabled = !ready;
      $("advanceFlowCalc").classList.toggle("active", workedDays > 0);
      $("advanceFlowSubmit").classList.toggle("active", ready);
      const detail = ready
        ? `${workedDays}日分 ${formatMoney(Math.max(amount - calculateAdvanceFee(amount), 0))} を申請`
        : hasOverlap
          ? "申請済み期間と重複しています"
          : workedDays
            ? "計算完了。期間を確認してください"
            : "出勤済みの期間を選ぶとスワイプできます";
      setSwipeConfirmEnabled("submitAdvanceSwipe", ready, detail);
    }

    function countWorkedDaysLocal(dateFrom, dateTo) {
      if (!dateFrom || !dateTo) return 0;
      const start = dateFrom <= dateTo ? dateFrom : dateTo;
      const end = dateFrom <= dateTo ? dateTo : dateFrom;
      const dates = new Set();
      readStore("attendance", [])
        .filter((row) => row.driverId === driver.id && row.date >= start && row.date <= end && row.status !== "off")
        .forEach((row) => dates.add(row.date));
      return dates.size;
    }

    async function calculateAdvance() {
      const dateFrom = $("advanceDateFrom").value;
      const dateTo = $("advanceDateTo").value;
      const seq = ++calcSeq;
      let workedDays = countWorkedDaysLocal(dateFrom, dateTo);
      if (config.API_BASE_URL && dateFrom && dateTo) {
        try {
          const remote = await apiGet({ type: "advance_calc", driverId: driver.id, dateFrom, dateTo });
          if (seq !== calcSeq) return;
          if (remote && remote.ok) {
            workedDays = Number(remote.workedDays || 0);
            if (Array.isArray(remote.advances)) {
              const allAdvances = readStore("advance", []);
              const others = allAdvances.filter((row) => row.driverId !== driver.id);
              writeStore("advance", [...others, ...remote.advances]);
            }
          }
        } catch (error) {
          showToast("実働日数はローカルデータで計算しました");
        }
      }
      const salesAmount = Number(driver.unitPrice || 0) * workedDays;
      const requestedAmount = Math.round(salesAmount * 0.5);
      $("advanceWorkedDays").value = workedDays;
      $("advanceAmount").value = requestedAmount || "";
      renderAppliedPeriods();
      renderOverlap(dateFrom, dateTo);
      renderAdvanceCalendar();
      updateSummary();
    }

    function updateSummary() {
      const workedDays = Number($("advanceWorkedDays").value || 0);
      const amount = Number($("advanceAmount").value || 0);
      const salesAmount = Number(driver.unitPrice || 0) * workedDays;
      const fee = amount ? calculateAdvanceFee(amount) : 0;
      const transferAmount = Math.max(amount - fee, 0);
      const meterPercent = Math.min(100, Math.max(0, workedDays * 10));
      animateTransferAmount(transferAmount);
      $("advanceTransferMeta").textContent = workedDays ? `${workedDays}日分を照合済み。申請後に管理者LINEへ送信します。` : "期間を選ぶと自動計算します";
      $("advanceWorkdayBadge").textContent = `${workedDays}日`;
      $("advanceMeterFill").style.width = `${meterPercent}%`;
      $("advanceSalesText").textContent = `売上 ${formatMoney(salesAmount)}`;
      $("advanceFeeText").textContent = `手数料 ${formatMoney(fee)}`;
      $("advanceSummary").textContent = `${workedDays || 0}日間 / 売上 ${formatMoney(salesAmount)} / 希望 ${formatMoney(amount)} / 振込 ${formatMoney(transferAmount)}`;
      syncSubmitReady();
    }

    async function submit() {
      const dateFrom = $("advanceDateFrom").value;
      const dateTo = $("advanceDateTo").value;
      const workedDays = Number($("advanceWorkedDays").value || 0);
      const amount = Number($("advanceAmount").value || 0);
      if (!dateFrom || !dateTo) {
        showToast("対象期間を選択してください");
        return;
      }
      if (hasOverlap || findOverlap(dateFrom, dateTo)) {
        showToast("申請済み期間と重複しています");
        renderOverlap(dateFrom, dateTo);
        return;
      }
      if (!workedDays || !amount) {
        showToast("選択期間内に出勤報告がありません");
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
    const attendance = readStore("attendance", []).filter((row) => row.date && row.date.startsWith(month));
    const advances = readStore("advance", []).filter((row) => row.date && row.date.startsWith(month));
    const holidays = readStore("holiday", []).filter((row) => row.targetYearMonth === month);
    const fixedShift = readStore("fixedShift", []).filter((row) => row.targetYearMonth === month);
    const today = todayISO();
    const todayRows = readStore("attendance", []).filter((row) => row.date === today);
    const activeDrivers = drivers.filter((driver) => driver.lifecycle !== "inactive");
    const working = todayRows.filter((row) => row.status === "working").length;
    const finished = todayRows.filter((row) => row.status === "finished").length;
    const advanceTotal = advances.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return {
      month,
      drivers,
      sites,
      attendance,
      advances,
      holidays,
      fixedShift,
      todayRows,
      kpis: {
        working,
        warning: working,
        advanceTotal,
        rate: activeDrivers.length ? Math.round(((working + finished) / activeDrivers.length) * 100) : 0
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
    if (status === "working") return "稼働中";
    if (status === "finished") return "退勤済み";
    if (status === "off") return "休み";
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
      if (row.status === "off") return;
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
    const notClockedOut = data.todayRows.filter((row) => row.status === "working");
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

  function collectAvailableMonths(currentMonth) {
    const months = new Set([currentMonth, monthKey(new Date())]);
    readStore("attendance", []).forEach((row) => {
      if (row.date) months.add(String(row.date).slice(0, 7));
    });
    readStore("advance", []).forEach((row) => {
      if (row.dateFrom) months.add(String(row.dateFrom).slice(0, 7));
      else if (row.date) months.add(String(row.date).slice(0, 7));
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
    const notClockedOut = data.todayRows.filter((row) => row.status === "working");
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
    const rows = data.todayRows.filter((row) => row.status === "working");
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
        const rank = (row) => row ? (row.status === "working" ? 0 : 1) : 2;
        return rank(aRow) - rank(bRow) || rowNameSort(a, b);
      });
    return dataTable(
      ["ドライバー", "現場", "今日", "区分", "操作"],
      rows.map((driver) => {
        const row = todayRowsByDriver[driver.id];
        const status = row ? attendanceStatusText(row.status) : "未出勤";
        const statusClass = row && row.status === "working" ? "warn-text" : row ? "good-text" : "";
        const workType = row && isSubstituteRow(row) ? "代走" : "通常";
        const normalDisabled = row && row.status === "finished" && !isSubstituteRow(row) ? " disabled" : "";
        const subDisabled = row && row.status === "finished" && isSubstituteRow(row) ? " disabled" : "";
        return `
          <div class="data-row">
            ${dataCell(driver.name, driver.contractType || "契約", "primary")}
            ${dataCell(driver.siteName || "-", "現場")}
            ${dataCell(status, row ? `出勤 ${row.startTime || "-"}` : "修正可", statusClass)}
            ${dataCell(workType, row && isSubstituteRow(row) ? "代走登録済み" : "通常")}
            <div class="data-actions">
              <button class="button ghost small" data-fix-att="${driver.id}"${normalDisabled}>通常退勤</button>
              <button class="button ghost small" data-fix-sub="${driver.id}"${subDisabled}>代走退勤</button>
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
        ? `<button class="button ghost small" data-driver="${driver.id}">履歴</button><button class="button ghost small" data-edit-driver="${driver.id}">編集</button><button class="button ghost small" data-toggle-driver="${driver.id}">${driver.lifecycle === "inactive" ? "再有効化" : "停止"}</button>`
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
        const aStatus = todayRowsByDriver[a.driver.id] ? (todayRowsByDriver[a.driver.id].status === "working" ? 0 : 1) : 2;
        const bStatus = todayRowsByDriver[b.driver.id] ? (todayRowsByDriver[b.driver.id].status === "working" ? 0 : 1) : 2;
        return aStatus - bStatus || rowNameSort({ name: a.driver.name }, { name: b.driver.name });
      });
    return dataTable(
      ["ドライバー", "現場", "今日", "出勤", "代走", "休み", "操作"],
      rows.map((row) => {
        const today = todayRowsByDriver[row.driver.id];
        const status = today ? attendanceStatusText(today.status) : "未出勤";
        const statusClass = today && today.status === "working" ? "warn-text" : today ? "good-text" : "";
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
      const working = siteToday.filter((row) => row.status === "working").length;
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
              <span class="tag ${row.status === "working" || isSubstituteRow(row) ? "warn" : "good"}">${isSubstituteRow(row) ? "代走" : attendanceStatusText(row.status)}</span>
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
    const working = todayRows.filter((row) => row.status === "working").length;
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

    function render() {
      const data = buildDashboard(monthInput.value);
      const summary = adminFinancialSummary(data);
      $("kpiWorking").textContent = data.kpis.working;
      $("kpiAdvance").textContent = formatMoney(data.kpis.advanceTotal);
      $("kpiRate").textContent = `${data.kpis.rate}%`;
      $("kpiSales").textContent = formatMoney(summary.salesTotal);
      $("kpiSalesSub").textContent = `実働 ${summary.workedDaysTotal}日 / ${data.drivers.length}名`;
      $("kpiAdvanceRate").textContent = `${summary.advanceRate}%`;
      $("kpiAdvanceRateSub").textContent = `希望額 ${formatMoney(summary.requestedTotal)}`;
      $("kpiTransfer").textContent = formatMoney(summary.transferTotal);
      $("dashboardAlertList").innerHTML = renderAdminAlerts(data, summary);
      $("dashboardRankList").innerHTML = renderRankList(summary);
      $("dashboardAdvanceSummary").innerHTML = renderAdvanceSummaryByDriver(data);
      $("dashboardSiteSummary").innerHTML = renderMonthlySiteRows(data, summary);
      $("monthlySalesKpi").textContent = formatMoney(summary.salesTotal);
      $("monthlyWorkedKpi").textContent = `${summary.normalWorkedDaysTotal}日`;
      $("monthlyAdvanceKpi").textContent = `${summary.substituteDaysTotal}日`;
      $("monthlyTransferKpi").textContent = `${summary.holidayDaysTotal}日`;
      $("monthlyDriverList").innerHTML = renderSalesReconciliationRows(data, summary);
      $("monthlySiteList").innerHTML = renderMonthlySiteRows(data, summary);
      $("monthlyAvailableMonths").innerHTML = renderAvailableMonths(monthInput.value);
      $("monthlyAdvanceList").innerHTML = renderMonthlyAdvanceRows(data);
      $("attendanceTodayKpi").textContent = data.kpis.working;
      $("attendanceWarningKpi").textContent = data.kpis.warning;
      $("attendanceSalesKpi").textContent = `${data.todayRows.filter((row) => row.status === "finished").length}名`;
      $("attendanceWorkedKpi").textContent = `${summary.substituteDaysTotal}日`;
      $("advanceTransferKpi").textContent = formatMoney(summary.transferTotal);
      $("advanceRequestedKpi").textContent = formatMoney(summary.requestedTotal);
      $("advanceCountKpi").textContent = `${data.advances.length}件`;
      $("advanceOverlapKpi").textContent = "OK";
      $("advanceDriverSummaryList").innerHTML = renderAdvanceSummaryByDriver(data);

      $("siteList").innerHTML = renderSiteRows(data, false);

      $("todayList").innerHTML = data.drivers.map((driver) => {
        const row = data.todayRows.find((item) => item.driverId === driver.id);
        const status = row ? (row.status === "working" ? "稼働中" : "退勤済み") : "未出勤";
        return item(driver.name, `${driver.siteName} ・ ${driver.contractType || ""}`, [{ label: status, kind: row && row.status === "working" ? "warn" : "good" }], `<button class="button ghost small" data-driver="${driver.id}">詳細</button>`);
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
        ? logins.map((row) => item(row.username || "未入力", `${new Date(row.loggedAt).toLocaleString("ja-JP")} / ${row.client && row.client.timeZone ? row.client.timeZone : ""}`, [{ label: row.success ? "成功" : "失敗", kind: row.success ? "good" : "warn" }])).join("")
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
      if (Array.isArray(remoteData.drivers)) writeStore("drivers", remoteData.drivers);
      if (Array.isArray(remoteData.sites)) writeStore("sites", remoteData.sites);
      replaceMonthRows("attendance", monthInput.value, remoteData.attendance || [], (row) => String(row.date || "").slice(0, 7));
      replaceMonthRows("advance", monthInput.value, remoteData.advance || [], (row) => String(row.date || "").slice(0, 7));
      replaceMonthRows("holiday", monthInput.value, normalizeShiftRows(remoteData.holiday || [], monthInput.value), (row) => String(row.targetYearMonth || ""));
      replaceMonthRows("fixedShift", monthInput.value, normalizeShiftRows(remoteData.fixedShift || [], monthInput.value), (row) => String(row.targetYearMonth || ""));
      render();
    }

    document.querySelectorAll("[data-section]").forEach((button) => button.addEventListener("click", () => setSection(button.dataset.section)));
    document.querySelectorAll("[data-shift-tab]").forEach((button) => button.addEventListener("click", () => {
      setShiftTab(button.dataset.shiftTab);
      render();
    }));
    $("adminSearch").addEventListener("input", applyAdminSearch);

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
          upsertLocal("attendance", payload, (row) => row.driverId === driver.id && row.date === todayISO());
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
          upsertLocal("attendance", payload, (row) => row.driverId === driver.id && row.date === todayISO());
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
