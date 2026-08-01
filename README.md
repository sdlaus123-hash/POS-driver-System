# POMS ドライバー運用管理システム

GitHub / Vercel / GAS / Googleスプレッドシートで運用する、軽貨物ドライバー向けの勤怠・前払い・休み希望管理システムです。

## ファイル構成

- `attendance.html`: 勤務報告
- `advance.html`: 前払い申請
- `holiday.html`: 休み希望
- `admin.html`: 管理画面
- `styles.css`: スマホファースト共通デザイン
- `app.js`: 画面操作、ローカル確認、GAS連携
- `config.js`: WebアプリURL、LIFF、固定URL
- `apps_script.gs`: GASバックエンド
- `api/line-webhook.js`: LINE Webhook転送

## セットアップ

1. このフォルダをGitHubへアップロードします。
2. VercelでGitHubリポジトリを接続します。
3. Googleスプレッドシートを作成します。
4. GASに `apps_script.gs` を貼り付けます。
5. GASの「プロジェクトの設定 > スクリプト プロパティ」に下記を設定します。
6. GASをWebアプリとしてデプロイします。
7. `config.js` の `API_BASE_URL` にGAS Web App URLを入れます。

## GAS Script Properties

公開リポジトリへ秘密情報を置かないため、GAS側の値は Script Properties で管理します。

| Key | 内容 |
| --- | --- |
| `SPREADSHEET_ID` | POMS本体スプレッドシートID |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE公式アカウントのチャネルアクセストークン |
| `LINE_ADMIN_TO` | 管理者のLINE userIdまたはgroupId。複数は改行またはカンマ区切り |
| `ADMIN_PASSWORD` | 初期管理者PIN。通常は `AdminUsers` シートで管理 |
| `ATTENDANCE_DEST_SPREADSHEET_ID` | 退勤日報の送信先スプレッドシートURLまたはID |
| `ATTENDANCE_DEST_SHEET_NAME` | 退勤日報の送信先シート名 |

必須値が未設定の場合、GASは秘密情報をソースコードから補完しません。次の順で設定してください。

1. `SPREADSHEET_ID`、`ADMIN_USERNAME`、`ADMIN_PASSWORD`をScript Propertiesへ登録します。
2. GASで`setupPomsOperationalRebuildNow`を1回実行し、権限を承認します。
3. スプレッドシートを開き直し、`POMS管理 > 運用ガイド / 設定診断`を実行します。
4. `POMS_運用ガイド`の「要設定」がなくなるまで設定します。

日常的に編集するシートは、原則として次の4つです。

- `マスターデータ`: ドライバー、単価、PIN、口座、前払い上限
- `現場管理`: 現場と手数料設定
- `日報送信先設定`: 月ごとの日報送信先
- `現場異動予約`: 適用開始日を指定した所属現場・単価の変更

## 現場異動の予約

`POMS管理 > 現場異動予約を準備`を実行し、次を入力します。

- ドライバー名（またはドライバーID）
- 異動先現場
- 適用開始日
- 適用終了日（無期限の場合は空欄）
- 適用単価

指定日以降の勤怠と前払いには異動先の現場・単価が使われます。異動前後の日が同じ前払い申請に含まれる場合は、安全のため分けて申請するよう案内されます。過去の勤怠に保存された現場名は変更されません。

## 高速化

勤怠・前払いの保存時は、稼働台帳・管理カレンダー・LINE通知の完了を待ちません。保存を先に完了し、集計は約30秒後、LINE通知はバックグラウンドで処理します。管理画面は90秒間隔で静かに更新され、更新ボタンでは即時取得できます。

勤怠・前払い・休み希望はWeb画面から登録します。集計が崩れた場合は、元データを直接作り直さず、`POMS管理 > 初期設定 / 修復`を実行してください。

## Vercel Environment Variables

| Key | 内容 |
| --- | --- |
| `POMS_GAS_URL` | GAS WebアプリURL。LINE Webhook転送用 |
| `LINE_CHANNEL_SECRET` | LINEチャネルシークレット。Webhook署名検証用 |
| `GOOGLE_SHEETS_WEBHOOK_URL` | 採用応募データの保存先Webhook |

`LINE_CHANNEL_SECRET`が未設定、または署名が一致しないWebhookは拒否されます。

## 運用ルール

- 勤務日は0:00ではなく3:00切替です。
- 退勤済み、かつ退勤時刻がある日だけ前払い申請の対象です。
- 前払い申請済みの日は再申請できません。
- 退勤保存時、日報送信先が設定されていれば日報へ追加します。同じドライバー、同じ勤務日は重複追加しません。
- 前払い手数料は基本 `前払い希望額 × 8% + 260円` です。現場シートの手数料設定があればそちらを優先します。
- LINEトークンなどの秘密情報はコードへ直書きしません。

## 管理者ログイン

管理画面は4桁PINでログインします。GAS連携後は `AdminUsers` シートで判定します。

初回セットアップ時に `AdminUsers` が空の場合、Script Propertiesの`ADMIN_USERNAME`と`ADMIN_PASSWORD`から管理者を作成します。固定の初期PINはありません。

## ドライバーログイン

ドライバー画面は、GAS連携後に名前と4桁PINでログインします。LINE LIFFで開いた場合は、LINE userIdをドライバーに紐付けて次回以降の確認を簡略化します。

## 前払い申請

前払い画面では、退勤済みの稼働日だけが「申請できる稼働日」として表示されます。ドライバーは申請したい日をタップして選びます。

計算式:

- 売上金額 = ドライバー単価 × 選択した退勤済み日数
- 前払い希望額 = 売上金額 × 50%
- 前払い手数料 = 前払い希望額 × 現場別手数料率 + 振込手数料
- 振込予定額 = 前払い希望額 - 前払い手数料

GAS側でも保存前に、退勤済み日かどうか、申請済み日と重複していないかを再確認します。

## 固定URL

- 勤務報告: `https://pos-driver-system.vercel.app/attendance.html`
- 前払い申請: `https://pos-driver-system.vercel.app/advance.html`
- 休み希望: `https://pos-driver-system.vercel.app/holiday.html`
- 管理者用: `https://pos-driver-system.vercel.app/admin.html`

## デザイン

HTMLベースのスマホファーストUIです。ドライバー画面は片手操作、管理画面はスマホでは下部ナビ、PCではサイドナビで確認できる構成です。
