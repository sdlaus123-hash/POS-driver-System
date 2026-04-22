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
