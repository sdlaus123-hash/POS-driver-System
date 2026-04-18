window.POMS_CONFIG = {
  APP_NAME: "POMS ドライバー運用管理システム",
  API_BASE_URL: "https://script.google.com/macros/s/AKfycbz0c1HDLpVuXmlb_9Qnh3wA3mVBeZgqloLb-j30nxCyWJzhv2kTru122-C4v1pLvupO/exec",
  URLS: {
    attendance: "https://pos-driver-system.vercel.app/attendance.html",
    advance: "https://pos-driver-system.vercel.app/advance.html",
    holiday: "https://pos-driver-system.vercel.app/holiday.html",
    admin: "https://pos-driver-system.vercel.app/admin.html"
  },
  LINE: {
    LIFF_ID: "",
    LIFF_IDS: {
      attendance: "2009828882-H9m2KSf7",
      advance: "2009828882-WiMi5fy3",
      holiday: "2009828882-yhq2234I"
    },
    RICH_MENU: [
      { label: "勤怠報告", url: "https://liff.line.me/2009828882-H9m2KSf7" },
      { label: "前払い申請", url: "https://liff.line.me/2009828882-WiMi5fy3" },
      { label: "休み希望", url: "https://liff.line.me/2009828882-yhq2234I" }
    ]
  },
  ADMIN_AUTH: {
    enabled: true,
    username: "admin",
    demoPassword: "1234",
    mode: "gas-production"
  },
  DEMO_DRIVER: {
    id: "drv_demo_001",
    lineUserId: "LINE_USER_ID_SAMPLE",
    name: "石塚 歩汰",
    siteId: "site_kawaguchi",
    siteName: "川口領家 Amazon",
    contractType: "日当",
    lifecycle: "active",
    unitPrice: 22000,
    advanceFee: 500,
    bankName: "未登録",
    branchName: "未登録",
    accountNumber: "未登録",
    accountHolder: "未登録"
  },
  SITES: [
    { id: "site_kawaguchi", name: "川口領家 Amazon", sort: 1, active: true },
    { id: "site_shinjuku", name: "新宿上落合 Amazon", sort: 2, active: true }
  ]
};
