/**
 * Lumière Inventory — Apps Script bridge.
 *
 * Fires whenever a human edits the spreadsheet and pings the Railway backend
 * so it re-reads the sheet and pushes the change to all connected staff
 * devices. This is the "Sheet -> Frontend" half of the two-way sync.
 *
 * SETUP (one-time):
 *   1. Open the spreadsheet -> Extensions -> Apps Script.
 *   2. Paste this file over Code.gs.
 *   3. Project Settings -> Script Properties, add:
 *        BACKEND_URL   = https://<your-app>.up.railway.app
 *        WEBHOOK_SECRET = <same value as the Railway WEBHOOK_SECRET env var>
 *   4. Run installTrigger() once (authorize when prompted).
 *
 * Note: onEdit only fires for edits made by a person in the UI. Edits made by
 * the backend via the Sheets API do not trigger it — which is exactly what we
 * want (no echo loop). The backend's 60s poll covers any API-side changes.
 */

function onEditInstalled(e) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('BACKEND_URL');
  var secret = props.getProperty('WEBHOOK_SECRET');
  if (!url) return;

  var range = e && e.range ? e.range.getA1Notation() : '';
  try {
    UrlFetchApp.fetch(url.replace(/\/$/, '') + '/webhook/sheet-changed', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'X-Webhook-Secret': secret || '' },
      payload: JSON.stringify({ secret: secret, editedRange: range }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    console.error('Webhook failed: ' + err);
  }
}

/** Run once to install the installable onEdit trigger. */
function installTrigger() {
  var ss = SpreadsheetApp.getActive();
  // Remove any duplicate triggers first.
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onEditInstalled') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onEditInstalled')
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  console.log('Installed onEdit trigger.');
}
