import json
import base64
from pathlib import Path
from upgrade_tripvault_room_fuji import upgrade

root = Path('.')
source = (root / 'outputs/TripVault_TimeLocked_ExternalBills_v8.html').read_text()
room_ui = (root / 'work/tripvault-rooms-ui.js').read_text() + '\n' + (root / 'work/tripvault-room-bulk.js').read_text()
funding_math = (root / 'work/tripvault-room-funding.js').read_text().replace('export function', 'function', 1)
room_ui += '\n' + funding_math + '\n' + (root / 'work/tripvault-room-funding-ui.js').read_text()
room_ui += '\n' + (root / 'work/tripvault-room-progress.js').read_text()
room_ui += '\n' + (root / 'work/tripvault-room-bill-ui.js').read_text()
room_ui += '\n' + (root / 'work/tripvault-room-notifications.js').read_text()
room_ui += '\n' + (root / 'work/tripvault-demo-ui.js').read_text()

def replace(old, new):
    global source
    assert source.count(old) == 1, (source.count(old), old[:150])
    source = source.replace(old, new, 1)

replace('<meta content="TripVault mobile prototype for shared trip expenses." name="description"/>\n<title>TripVault · Trip workspace</title>',
        '<meta content="Shared trip fund for groups: deposit USDC upfront, log bills as you go, and settle everyone in one step." name="description"/>\n<title>TripVault · Shared Trip Fund</title>')
replace('</head>', '''<style>
:root {
  --page: #f8fafc;
  --paper: #ffffff;
  --ink: #0f172a;
  --muted: #475569;
  --subtle: #64748b;
  --line: #e2e8f0;
  --line-strong: #cbd5e1;
  --accent: #e84142;
  --accent-dark: #c52223;
  --accent-light: #ff6b6c;
  --tint: #fef2f2;
  --tint-border: #fecaca;
  --positive: #059669;
  --positive-bg: #ecfdf5;
  --warning: #d97706;
  --warning-bg: #fffbeb;
  --danger: #dc2626;
  --danger-bg: #fef2f2;
  --radius: 16px;
  --radius-sm: 10px;
  --radius-lg: 20px;
  --shadow-sm: 0 1px 2px 0 rgba(15, 23, 42, 0.05);
  --shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.03);
  --shadow-md: 0 10px 24px -4px rgba(15, 23, 42, 0.08), 0 4px 8px -2px rgba(15, 23, 42, 0.03);
  --shadow-lg: 0 20px 35px -5px rgba(15, 23, 42, 0.12), 0 8px 16px -4px rgba(15, 23, 42, 0.05);
}
body {
  background-color: var(--page);
  color: var(--ink);
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
:focus-visible {
  outline: 3px solid rgba(232, 65, 66, 0.45);
  outline-offset: 2px;
}
.header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--line);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
}
.brand-mark {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: linear-gradient(135deg, #e84142 0%, #c52223 100%);
  color: white;
  box-shadow: 0 2px 8px rgba(232, 65, 66, 0.35);
}
.hero {
  min-height: 175px;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  isolation: isolate;
  overflow: hidden;
  color: white;
  border-radius: var(--radius-lg);
  padding: 24px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #181124 100%);
  box-shadow: 0 12px 30px -6px rgba(15, 23, 42, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 4px;
}
.hero::before {
  content: "";
  position: absolute;
  top: -50px;
  right: -50px;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(232, 65, 66, 0.4) 0%, rgba(232, 65, 66, 0) 70%);
  pointer-events: none;
  z-index: 0;
}
.hero::after {
  content: "";
  position: absolute;
  bottom: -40px;
  left: 20%;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
}
.hero h1 {
  font-size: clamp(23px, 5.5vw, 32px);
  font-weight: 800;
  letter-spacing: -0.035em;
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.25);
  z-index: 1;
}
.hero .chip {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  font-weight: 700;
  z-index: 1;
}
.panel {
  background: var(--paper);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.panel:hover {
  border-color: var(--line-strong);
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: var(--accent);
  color: #ffffff;
  font-weight: 700;
  font-size: 13.5px;
  text-align: center;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(232, 65, 66, 0.2);
  transition: all 0.15s ease-in-out;
  cursor: pointer;
}
.btn:hover:not(:disabled) {
  background: var(--accent-dark);
  box-shadow: 0 4px 12px rgba(232, 65, 66, 0.32);
  transform: translateY(-1px);
}
.btn:active:not(:disabled) {
  transform: translateY(0);
}
.btn:disabled {
  opacity: 0.55;
  box-shadow: none;
  cursor: default;
}
.btn.secondary {
  border-color: var(--line);
  background: #ffffff;
  color: var(--ink);
  box-shadow: var(--shadow-sm);
}
.btn.secondary:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #cbd5e1;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.07);
}
.btn.soft {
  background: var(--tint);
  color: var(--accent-dark);
  border-color: #fecaca;
  box-shadow: none;
}
.btn.soft:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #fca5a5;
}
.btn.ghost {
  background: transparent;
  color: var(--accent-dark);
  box-shadow: none;
  padding: 0 10px;
}
.btn.ghost:hover:not(:disabled) {
  background: var(--tint);
}
.btn.danger {
  background: #fef2f2;
  color: var(--danger);
  border-color: #fecaca;
  box-shadow: none;
}
.btn.danger:hover:not(:disabled) {
  background: #fee2e2;
  border-color: #f87171;
}
.btn.full {
  width: 100%;
}
.notice {
  padding: 13px 16px;
  border-radius: 12px;
  font-size: 13px;
  background: #f8fafc;
  color: var(--ink);
  border: 1px solid var(--line);
  border-left: 4px solid var(--accent);
}
.notice.warn {
  color: #92400e;
  background: #fffbeb;
  border-color: #fde68a;
  border-left-color: var(--warning);
}
.notice.green {
  color: #065f46;
  background: #ecfdf5;
  border-color: #a7f3d0;
  border-left-color: var(--positive);
}
.notice.danger {
  color: #991b1b;
  background: #fef2f2;
  border-color: #fecaca;
  border-left-color: var(--danger);
}
.mobile-nav {
  position: fixed;
  z-index: 10;
  bottom: 0;
  left: 0;
  right: 0;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  padding: 7px 12px max(7px, env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid var(--line);
  box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.05);
}
@media (min-width: 900px) {
  .mobile-nav {
    display: none !important;
  }
}
.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 4px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 650;
  min-height: 50px;
  padding: 6px 4px;
  transition: all 0.15s ease;
}
.nav-btn[aria-current="page"] {
  color: var(--accent);
  background: var(--tint);
  font-weight: 750;
}
.nav-btn:hover:not([aria-current]) {
  background: #f1f5f9;
  color: var(--ink);
}
dialog {
  width: min(100%, 540px);
  max-width: 100%;
  margin: auto auto 0;
  padding: 0;
  border: 0;
  border-radius: 24px 24px 0 0;
  color: var(--ink);
  background: #ffffff;
  box-shadow: 0 -8px 40px rgba(15, 23, 42, 0.18);
  max-height: min(94dvh, 850px);
  overflow: auto;
  overscroll-behavior: contain;
}
@media (min-width: 640px) {
  dialog {
    margin: auto;
    border-radius: 20px;
    box-shadow: var(--shadow-lg), 0 0 0 1px rgba(15, 23, 42, 0.08);
    max-height: min(90dvh, 850px);
  }
}
dialog::backdrop {
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}
.sheet-head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 15px 20px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(8px);
}
.sheet-head h2 {
  font-size: 21px;
  font-weight: 750;
  color: var(--ink);
}
.sheet-body {
  padding: 18px 20px;
  display: grid;
  gap: 14px;
}
.sheet-footer {
  position: sticky;
  bottom: 0;
  z-index: 2;
  padding: 12px 20px max(12px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(8px);
}
.field {
  display: grid;
  gap: 6px;
  font-weight: 700;
  font-size: 13px;
  min-width: 0;
  color: var(--ink);
}
.field > input, .field input, .field > select, .input-affix {
  width: 100%;
  min-width: 0;
  min-height: 48px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #ffffff;
  color: var(--ink);
  padding: 10px 14px;
  font-size: 16px;
  font-weight: 500;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.field > input:focus, .field input:focus, .field > select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(232, 65, 66, 0.15);
}
.room-code { width: fit-content; color: var(--accent-dark); background: var(--tint); border: 2px dashed #fca5a5; border-radius: 14px; padding: 8px 18px; font: 800 clamp(24px, 7vw, 36px)/1.2 Inter, monospace, sans-serif; letter-spacing: .2em; font-variant-numeric: tabular-nums; box-shadow: 0 2px 8px rgba(232, 65, 66, 0.08); user-select: all; }
.room-wallet-address { overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; }
.trip-settings-actions { margin-top: 12px; }
.trip-list-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px 0; }
.trip-list-row + .trip-list-row { border-top: 1px solid var(--line); }
.trip-list-row > .inline { margin-inline-start: auto; }
.trip-list-row .bill-name { overflow-wrap: anywhere; }
.trip-list-tools { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid var(--line); padding-bottom: 12px; }
.trip-list-tools > .btn:only-child { margin-inline-start: auto; }
.trip-delete-checkbox { display: grid; place-items: center; min-width: 36px; min-height: 44px; }
.trip-delete-checkbox input { width: 18px; height: 18px; accent-color: var(--accent); }
.trip-delete-list { margin: 0; padding-inline-start: 20px; overflow-wrap: anywhere; }
.field > small { color: var(--muted); font-size: 13px; font-weight: 400; line-height: 1.4; }
#bill-reminder-feedback:empty { display: none; }
.btn.danger.cancel-approval { border-color: #fecaca; background: #fef2f2; }
.btn.danger.cancel-approval:hover:not(:disabled) { background: #fee2e2; }
.trip-return { display: flex; justify-content: space-between; align-items: center; gap: 8px 16px; flex-wrap: wrap; margin-bottom: 14px; }
.trip-profile { display: flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%; margin-inline-start: auto; }
.trip-profile-name { min-width: 0; color: var(--muted); font-size: 13px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trip-profile .btn { flex-shrink: 0; }
.trip-profile .avatar { width: 32px; height: 32px; flex-shrink: 0; }
.btn.rename-member { border-color: #e2e8f0; }
.language-select { position: relative; display: inline-flex; align-items: center; color: var(--accent-dark); flex-shrink: 0; }
.language-select .lang-icon { position: absolute; inset-inline-start: 9px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; color: var(--accent-dark); pointer-events: none; z-index: 1; }
.language-select::after { content: ''; position: absolute; inset-inline-end: 10px; top: calc(50% - 4px); width: 5px; height: 5px; border-right: 1.5px solid; border-bottom: 1.5px solid; transform: rotate(45deg); pointer-events: none; z-index: 1; }
.ui-language { appearance: none; min-width: 66px; width: 66px; margin: 0; min-height: 40px; height: 40px; padding: 0 20px 0 27px; border: 1px solid var(--line); border-radius: 12px; background: #ffffff; color: inherit; font: 700 12.5px Inter, sans-serif; cursor: pointer; box-shadow: var(--shadow-sm); text-align: center; }
.ui-language option { background: var(--paper); color: var(--ink); font-weight: 600; }
.ui-language:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.header .breadcrumb { min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.wallet-actions { margin-top: 4px; }
.wallet-utilities { padding-top: 8px; border-top: 1px solid var(--line); }
.room-final-split { gap: 14px; }
.split-payment { border-top: 4px solid var(--accent); }
.split-payment > h2, .split-breakdown h2 { font-size: clamp(18px, 2.2vw, 22px); font-weight: 800; }
.split-payment .subtitle, .split-breakdown .subtitle { color: var(--muted); }
.split-date { font-weight: 650; }
.split-amount { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; padding: 12px 14px; background: var(--tint); color: var(--accent-dark); border: 1px solid #fecaca; border-radius: 12px; }
.split-amount strong { font-size: 1.2rem; font-variant-numeric: tabular-nums; font-weight: 800; }
.split-actions .btn { padding-inline: 16px; white-space: normal; }
.split-utilities .btn { white-space: normal; }
.split-details { border-top: 1px solid var(--line); }
.split-details summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; cursor: pointer; color: var(--accent-dark); font-size: 14px; font-weight: 700; list-style: none; }
.split-details summary::-webkit-details-marker { display: none; }
.split-details summary::after { content: ''; width: 7px; height: 7px; margin-inline-end: 3px; border-right: 2px solid; border-bottom: 2px solid; transform: rotate(45deg); transition: transform 0.2s ease; }
.split-details[open] summary::after { transform: rotate(225deg); }
.split-detail-body { padding-bottom: 6px; overflow-wrap: anywhere; }
.split-detail-body .row { padding: 8px 0; }
.split-breakdown { row-gap: 6px; }
.split-breakdown .panel-head { margin: 0; }
@media (max-width: 520px) {
  .split-actions .btn { width: 100%; }
}
.bill-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.bill-removal-actions { margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--line); }
.bill-removal-actions.solo { margin: 0; padding: 0; border: 0; }
.bill-cancellation-note h3 { margin-bottom: 4px; }
.bill-cancellation-reason { margin-top: 4px; white-space: pre-wrap; overflow-wrap: anywhere; }
.bill-suggestion { display: grid; gap: 4px; padding: 10px 0; }
.bill-suggestion + .bill-suggestion { border-top: 1px solid var(--line); }
.bill-suggestion .inline { margin-top: 4px; }
.notification-tools { justify-content: flex-end; }
.btn.trip-bell { position: relative; padding: 0; width: 44px; flex: 0 0 44px; color: var(--accent-dark); }
.trip-bell-dot, .trip-bell-badge {
  position: absolute;
  top: 4px;
  inset-inline-end: 4px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border: 2px solid white;
  border-radius: 999px;
  background: var(--danger);
  color: #ffffff;
  font-size: 10px;
  font-weight: 750;
  line-height: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  pointer-events: none;
}
.trip-bell.attention svg { transform-origin: 50% 20%; animation: notification-ring 550ms ease-in-out 3; }
.trip-bell.attention .trip-bell-dot, .trip-bell.attention .trip-bell-badge { animation: notification-pulse 550ms ease-in-out 3; }
@keyframes notification-ring {
  0%, 100% { transform: rotate(0); }
  25% { transform: rotate(16deg); }
  70% { transform: rotate(-16deg); }
}
@keyframes notification-pulse {
  50% { box-shadow: 0 0 0 4px var(--tint); }
}
@media (prefers-reduced-motion: reduce) {
  .trip-bell.attention svg, .trip-bell.attention .trip-bell-dot, .trip-bell.attention .trip-bell-badge { animation: none; }
}
.trip-notification {
  position: relative;
  width: 100%;
  display: grid;
  gap: 6px;
  padding: 13px 15px;
  border: 1px solid var(--line);
  border-left: 4px solid var(--line-strong);
  border-radius: 14px;
  background: var(--paper);
  color: var(--ink);
  text-align: start;
  overflow-wrap: anywhere;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.trip-notification:hover { box-shadow: var(--shadow-sm); }
.trip-notification.unread {
  background: #fffbfa;
  border-color: #fecaca;
  box-shadow: 0 1px 4px rgba(220, 38, 38, 0.05);
}
.trip-notification.notif-topup { border-left-color: var(--danger); }
.trip-notification.notif-warning { border-left-color: var(--warning); }
.trip-notification.notif-success { border-left-color: var(--positive); }
.trip-notification.notif-info { border-left-color: var(--accent); }
.trip-notification:not(.unread) {
  background: var(--page);
  border-left-color: var(--line-strong);
}
.trip-notification:not(.unread) .notif-title { color: var(--muted); }
.trip-notification .notif-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.trip-notification .notif-title {
  border: 0;
  padding: 0;
  background: transparent;
  font: inherit;
  text-align: start;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.35;
}
.trip-notification .notif-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger);
  flex-shrink: 0;
  box-shadow: 0 0 0 2px rgba(220, 38, 38, 0.2);
}
.trip-notification .notif-context {
  font-size: 13px;
  font-weight: 500;
  color: var(--subtle);
}
.trip-notification .notif-message {
  font-size: 13px;
  line-height: 1.45;
  color: var(--muted);
}
.trip-notification small { color: var(--muted); }
.trip-notification .notification-time {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--subtle);
  white-space: nowrap;
}
.trip-notification .inline {
  margin-top: 4px;
  gap: 8px;
}
.trip-notification .inline .btn {
  min-height: 40px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 10px;
}
.empty-notifications {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 38px 20px;
  background: var(--paper);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius);
  color: var(--muted);
  gap: 8px;
}
.empty-notifications .empty-notif-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--tint);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
}
.empty-notifications h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
}
.empty-notifications .subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--subtle);
  max-width: 290px;
  line-height: 1.45;
}
.fund-summary { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 20px; background: linear-gradient(135deg, #ffffff 0%, #fef8f8 100%); border: 1px solid #fee2e2; border-radius: var(--radius); box-shadow: var(--shadow); padding: 18px 20px; }
.fund-summary > strong { color: var(--accent); font-size: clamp(1.4rem, 4vw, 1.85rem); font-weight: 850; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; overflow-wrap: anywhere; }
@media (max-width: 420px) {
  .trip-profile .avatar { display: none; }
  .trip-profile-name { max-width: 96px; }
  .header-inner { gap: 6px; }
  .header .header-demo { display: none; }
}
.trip-progress { display: grid; gap: 14px; }
.trip-progress-steps { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; list-style: none; padding: 0; margin: 0; }
.trip-progress-steps li { display: grid; align-items: center; min-height: 44px; padding: 6px 9px; border: 1px solid var(--line); border-radius: 10px; color: var(--muted); text-align: center; font-size: 13px; font-weight: 650; }
.trip-progress-steps [aria-current="step"] { background: var(--accent); border-color: var(--accent); color: white; font-weight: 750; box-shadow: 0 2px 8px rgba(232, 65, 66, 0.25); }
.trip-progress-next { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.trip-progress-next h3 { font-size: 18px; margin-bottom: 4px; }
@media (max-width: 520px) {
  .trip-progress-steps {
    display: flex;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    gap: 6px;
    padding: 2px 2px 8px;
    -webkit-overflow-scrolling: touch;
  }
  .trip-progress-steps li {
    flex: 0 0 auto;
    scroll-snap-align: start;
    min-width: 105px;
    padding: 8px 10px;
    font-size: 12px;
  }
}
.room-time-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 6px 0 10px 0;
}
.room-time-presets .btn.soft {
  min-height: 44px;
  padding: 0 14px;
  font-size: 13px;
  border-radius: 12px;
  border: 1px solid #fecaca;
  transition: all 0.15s ease;
}
.room-time-presets .btn.soft[aria-pressed="true"] {
  background: var(--accent);
  color: #ffffff;
  border-color: var(--accent);
  box-shadow: 0 2px 8px rgba(232, 65, 66, 0.28);
  font-weight: 750;
}
.room-time-timeline {
  background: linear-gradient(135deg, #ffffff 0%, #fef8f8 100%);
  border: 1px solid #fee2e2;
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  margin-bottom: 8px;
  box-shadow: var(--shadow-sm);
}
.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  margin-bottom: 8px;
}
.timeline-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--tint);
  color: var(--accent-dark);
}
.timeline-items {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  align-items: center;
  gap: 6px;
  text-align: center;
}
.timeline-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.timeline-item strong {
  font-size: 12px;
  color: var(--ink);
  font-weight: 700;
}
.timeline-item span {
  font-size: 11px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.timeline-arrow {
  color: var(--subtle);
  font-size: 14px;
  font-weight: 700;
}
.timeline-error {
  color: var(--danger);
  font-size: 12.5px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
}
@media (max-width: 480px) {
  .timeline-items {
    grid-template-columns: 1fr;
    text-align: left;
    gap: 8px;
  }
  .timeline-arrow {
    display: none;
  }
  .timeline-item {
    flex-direction: row;
    justify-content: space-between;
    padding: 4px 0;
    border-bottom: 1px dashed var(--line);
  }
  .timeline-item:last-child {
    border-bottom: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
.datetime-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 48px;
}
.datetime-input-wrapper input {
  width: 100%;
  min-width: 0;
  min-height: 48px;
  height: 48px;
  box-sizing: border-box;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #ffffff;
  color: var(--ink);
  padding: 10px 48px 10px 14px;
  font-size: 15px;
  font-weight: 500;
  font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.datetime-input-wrapper input:focus,
.datetime-input-wrapper input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(232, 65, 66, 0.15);
}
.datetime-input-wrapper input::-webkit-calendar-picker-indicator {
  display: none !important;
  -webkit-appearance: none !important;
  appearance: none !important;
  opacity: 0 !important;
  pointer-events: none !important;
  width: 0 !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}
.datetime-input-wrapper input::-moz-calendar-picker-indicator {
  display: none !important;
}
.datetime-input-wrapper input::-webkit-inner-spin-button,
.datetime-input-wrapper input::-webkit-clear-button {
  display: none !important;
  -webkit-appearance: none !important;
}
.datetime-calendar-badge {
  position: absolute;
  right: 7px;
  top: 50%;
  transform: translateY(-50%);
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--tint);
  color: var(--accent-dark);
  border: 1px solid var(--tint-border);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
  z-index: 2;
}
.datetime-calendar-badge:hover {
  background: #fee2e2;
  border-color: #fca5a5;
  color: var(--accent);
  transform: translateY(-50%) scale(1.05);
}
.datetime-calendar-badge:active {
  transform: translateY(-50%) scale(0.95);
}
.datetime-calendar-badge:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.custom-dt-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: dt-fade-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes dt-fade-in {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.custom-dt-card {
  width: min(100%, 380px);
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 50px -12px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(232, 65, 66, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--ink);
}
.custom-dt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
  background: rgba(248, 250, 252, 0.95);
}
.custom-dt-head h3 {
  font-size: 14.5px;
  font-weight: 750;
  margin: 0;
  color: var(--ink);
}
.custom-dt-month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px 4px;
}
.custom-dt-month-nav strong {
  font-size: 15px;
  font-weight: 750;
  color: var(--ink);
}
.custom-dt-nav-btn {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #ffffff;
  color: var(--ink);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}
.custom-dt-nav-btn:hover {
  background: var(--tint);
  color: var(--accent-dark);
  border-color: #fca5a5;
}
.custom-dt-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
  padding: 8px 16px;
  text-align: center;
}
.custom-dt-weekday {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  padding: 4px 0;
}
.custom-dt-day {
  height: 36px;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
  transition: all 0.12s ease;
}
.custom-dt-day:hover:not(:disabled):not(.selected) {
  background: #f1f5f9;
  color: var(--accent);
}
.custom-dt-day.selected {
  background: linear-gradient(135deg, #e84142 0%, #c52223 100%);
  color: #ffffff !important;
  font-weight: 750;
  box-shadow: 0 4px 12px rgba(232, 65, 66, 0.35);
}
.custom-dt-day.today:not(.selected) {
  border: 1.5px solid var(--accent);
  color: var(--accent-dark);
  font-weight: 750;
}
.custom-dt-day:disabled {
  opacity: 0.25;
  cursor: not-allowed;
}
.custom-dt-time-section {
  padding: 12px 16px;
  border-top: 1px solid var(--line);
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.custom-dt-time-steppers {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.custom-dt-stepper {
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.custom-dt-stepper-btn {
  width: 38px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--ink);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.12s;
}
.custom-dt-stepper-btn:hover {
  background: var(--tint);
  color: var(--accent-dark);
}
.custom-dt-stepper-value {
  width: 44px;
  text-align: center;
  font-size: 17px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--ink);
}
.custom-dt-colon {
  font-size: 20px;
  font-weight: 800;
  color: var(--muted);
}
.custom-dt-quick-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
}
.custom-dt-quick-btn {
  min-height: 32px;
  padding: 0 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 650;
  cursor: pointer;
  transition: all 0.12s;
}
.custom-dt-quick-btn:hover {
  border-color: #fca5a5;
  color: var(--accent-dark);
  background: var(--tint);
}
.custom-dt-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--line);
  background: #ffffff;
}
.custom-dt-footer .btn {
  flex: 1;
}
/* Trip Settings responsive & unbolded & FX rate */
.trip-settings-panel .row {
  display: flex !important;
  align-items: flex-start !important;
  justify-content: space-between !important;
  flex-wrap: wrap !important;
  gap: 8px 16px !important;
}
.trip-settings-panel .row > .row-label {
  flex: 1 1 240px !important;
  min-width: 180px !important;
}
.trip-settings-panel .row > strong {
  font-weight: 400 !important;
  user-select: text;
  -webkit-user-select: text;
  text-align: right;
  flex: 0 0 auto !important;
  max-width: 100% !important;
  overflow-wrap: anywhere !important;
}
.trip-time-text {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: flex-end;
  gap: 6px;
  text-align: right;
  max-width: 100%;
}
.trip-time-date {
  font-weight: 600;
  color: var(--ink);
  letter-spacing: -0.01em;
}
.trip-time-time {
  font-weight: 500;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}
@media (max-width: 560px) {
  .trip-settings-panel .row {
    flex-direction: column !important;
    align-items: flex-start !important;
    justify-content: flex-start !important;
    gap: 4px !important;
  }
  .trip-settings-panel .row > .row-label {
    flex: 0 0 auto !important;
    width: 100% !important;
    min-width: 0 !important;
  }
  .trip-settings-panel .row > strong {
    flex: 0 0 auto !important;
    text-align: left !important;
    width: 100% !important;
    margin-top: 2px !important;
  }
  .trip-time-text {
    justify-content: flex-start !important;
    text-align: left !important;
  }
  .fx-rate-container {
    align-items: flex-start !important;
    text-align: left !important;
  }
}

/* Bill status badge styles (semantic color coding for approve / rejected / disputed) */
.bill-badge.status-approved,
.bill-row.is-approved .bill-badge {
  background: var(--positive-bg) !important;
  color: var(--positive) !important;
}
.bill-badge.status-rejected,
.bill-row.is-rejected .bill-badge {
  background: var(--danger-bg) !important;
  color: var(--danger) !important;
}
.bill-badge.status-disputed,
.bill-row.is-disputed .bill-badge {
  background: var(--warning-bg) !important;
  color: var(--warning) !important;
}
.bill-badge.status-pending,
.bill-row.is-pending .bill-badge {
  background: #fef3c7;
  color: #854d0e;
}
.bill-status {
  display: inline-block;
  margin-top: 5px;
  padding: 3px 8px;
  border-radius: 8px;
  background: var(--page);
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
}
.is-pending .bill-status, .is-disputed .bill-status, .is-cancellation .bill-status {
  background: #fef3c7;
  color: #854d0e;
}
.is-approved .bill-status { background: var(--positive-bg); color: var(--positive); }
.is-rejected .bill-status { background: var(--danger-bg); color: var(--danger); }
.fx-rate-container {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}
.split-rate .fx-rate-container {
  align-items: flex-start;
  text-align: left;
}
.fx-rate-primary {
  font-weight: 600;
  color: var(--ink);
  font-size: 13px;
  display: block;
}
.split-rate-status { font-size: 12px; color: var(--muted); }
.fx-rate-sub {
  font-weight: 400 !important;
  font-size: 12.5px;
  color: var(--muted);
  display: block;
  margin-top: 3px;
}

/* Warning notice prominent */
.notice-prominent,
.notice.notice-prominent {
  font-size: 15px !important;
  line-height: 1.6;
  padding: 16px 20px;
  border-radius: 14px;
  font-weight: 500;
  border-left: 5px solid var(--warning);
  background: var(--warning-bg);
  color: #92400e;
  box-shadow: 0 2px 8px rgba(217, 119, 6, 0.12);
  margin: 14px 0;
}

/* Travelers details subtitle font size */
.traveler-details,
.row-sub.traveler-details {
  font-size: 14px !important;
  font-weight: 500;
  color: #334155;
  line-height: 1.5;
  margin-top: 3px;
}
@media (max-width: 640px) {
  .traveler-details,
  .row-sub.traveler-details {
    font-size: 13px !important;
  }
}

/* Desktop layout spacing */
@media (min-width: 900px) {
  .shell {
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr) !important;
  }
  .sidebar {
    padding: 24px 18px !important;
    gap: 24px !important;
  }
  .sidebar nav {
    display: flex !important;
    flex-direction: column !important;
    gap: 10px !important;
    margin: 16px 0 !important;
  }
  .sidebar .nav-btn {
    padding: 12px 16px !important;
    font-size: 14.5px !important;
    border-radius: 12px !important;
    gap: 12px !important;
  }
  .header-inner {
    gap: 20px !important;
    padding: 0 28px !important;
  }
  .header-actions {
    gap: 12px !important;
  }
}

/* Mobile header overflow & layout fixes */
@media (max-width: 899px) {
  body, html, .shell, .workspace, .header {
    max-width: 100vw !important;
    overflow-x: clip !important;
  }
  .header-inner {
    padding: 4px 10px !important;
    gap: 6px !important;
    min-height: 58px !important;
    max-width: 100vw !important;
  }
  .header .wordmark {
    flex-shrink: 0;
  }
  .header-actions {
    gap: 6px !important;
    flex: 1 1 auto !important;
    min-width: 0;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .breadcrumb {
    display: none !important;
  }
  .language-select {
    width: 62px !important;
    max-width: 62px !important;
    flex-shrink: 0 !important;
  }
  .language-select .lang-icon {
    inset-inline-start: 7px !important;
    width: 13px !important;
    height: 13px !important;
  }
  .language-select::after {
    inset-inline-end: 8px !important;
    width: 4.5px !important;
    height: 4.5px !important;
  }
  .ui-language {
    width: 62px !important;
    min-width: 62px !important;
    height: 38px !important;
    min-height: 38px !important;
    padding: 0 16px 0 23px !important;
    font-size: 11.5px !important;
    border-radius: 10px !important;
  }
  .trip-bell {
    width: 38px !important;
    height: 38px !important;
    min-height: 38px !important;
    flex: 0 0 38px !important;
    flex-shrink: 0 !important;
  }
  .avatar-button {
    flex-shrink: 0 !important;
  }
  @media (max-width: 520px) {
    .header .wordmark {
      font-size: 0 !important;
      gap: 0 !important;
    }
    .header .brand-mark {
      font-size: 16px !important;
    }
  }
  .trip-bell-dot, .trip-bell-badge {
    top: 2px !important;
    inset-inline-end: 2px !important;
    min-width: 15px !important;
    height: 15px !important;
    font-size: 9px !important;
    padding: 0 3px !important;
  }
  .header .btn {
    min-height: 38px !important;
    padding: 0 10px !important;
    font-size: 12.5px !important;
    border-radius: 10px !important;
  }
  .header-demo {
    display: none !important;
  }
  .mobile-nav {
    display: grid !important;
    grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
    gap: 2px !important;
    padding: 6px 6px max(6px, env(safe-area-inset-bottom)) !important;
  }
  .mobile-nav .nav-btn {
    min-width: 0 !important;
    padding: 4px 2px !important;
    font-size: 11px !important;
  }
  .overview-grid {
    display: flex !important;
    flex-direction: column !important;
    gap: 14px !important;
    width: 100% !important;
  }
  .overview-grid > section {
    width: 100% !important;
    min-width: 0 !important;
  }
}

/* Enlarged Guide Modal */
dialog.guide-modal {
  display: flex !important;
  flex-direction: column !important;
  width: min(100%, 780px) !important;
  max-width: 780px !important;
  max-height: min(90dvh, 820px) !important;
  border-radius: 24px !important;
  box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.3) !important;
  overflow: hidden !important;
}
dialog.guide-modal .sheet-head {
  flex-shrink: 0 !important;
  padding: 20px 24px 12px !important;
  border-bottom: 1px solid var(--line) !important;
}
dialog.guide-modal .sheet-head > div {
  min-width: 0 !important;
  flex: 1 1 auto !important;
}
dialog.guide-modal .sheet-head h2 {
  font-size: 21px !important;
  overflow-wrap: break-word !important;
  line-height: 1.25 !important;
}
dialog.guide-modal .sheet-head p {
  overflow-wrap: break-word !important;
  line-height: 1.4 !important;
  margin-top: 4px !important;
}
dialog.guide-modal .sheet-head .btn {
  flex-shrink: 0 !important;
}
dialog.guide-modal .sheet-body {
  display: block;
  min-height: 0;
  flex: 1 1 auto !important;
  overflow-y: auto !important;
  overscroll-behavior: contain !important;
  -webkit-overflow-scrolling: touch;
  padding: 14px 24px 16px !important;
}
dialog.guide-modal .sheet-footer {
  flex-shrink: 0 !important;
  padding: 0 !important;
  background: #ffffff !important;
  border-top: 1px solid var(--line) !important;
}
.guide-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.guide-illustration {
  margin: 0 0 14px 0;
  border-radius: 16px;
  overflow: hidden;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid var(--line);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
  flex-shrink: 0;
}
.guide-illustration > img {
  display: block;
  width: 100%;
  height: auto !important;
  max-height: none !important;
  object-fit: contain;
}
.guide-description {
  margin-bottom: 14px;
  overflow-wrap: break-word;
  word-break: normal;
}
.guide-description h3 {
  font-size: 18px;
  font-weight: 750;
  color: var(--ink);
  margin: 0 0 10px 0;
  line-height: 1.35;
  overflow-wrap: break-word;
  word-break: normal;
}
.guide-copy {
  overflow-wrap: break-word;
  word-break: normal;
  line-height: 1.55;
}
.guide-step-card {
  background: var(--page);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 14px 16px;
  margin-top: 10px;
  overflow-wrap: break-word;
  word-break: normal;
}
.guide-step-card p {
  margin: 0;
  line-height: 1.5;
  overflow-wrap: break-word;
}
.guide-step-card ul {
  overflow-wrap: break-word;
}
.guide-step-card li {
  overflow-wrap: break-word;
  margin-bottom: 4px;
}
.guide-card-tag {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 6px;
  background: var(--tint);
  color: var(--accent-dark);
  margin-bottom: 8px;
}
.guide-card-tag.danger {
  background: var(--warning-bg);
  color: #92400e;
}
.room-code-badge {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 2px 6px;
  font-family: monospace;
  font-weight: 700;
  color: var(--accent-dark);
}
.guide-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
  padding: 12px 24px 16px;
  background: white;
  border-top: none;
}
@media (max-width: 640px) {
  dialog.guide-modal {
    width: 100% !important;
    max-width: 100% !important;
    max-height: 92dvh !important;
    border-radius: 20px 20px 0 0 !important;
    margin-bottom: 0 !important;
  }
  dialog.guide-modal .sheet-body {
    padding: 10px 16px 14px !important;
  }
  dialog.guide-modal .sheet-head {
    padding: 16px 16px 10px !important;
  }
  .guide-actions {
    padding: 10px 16px 14px;
  }
}

/* Custom Split UI Styles */
.split-type-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 4px;
  background: var(--page);
  border: 1px solid var(--line);
  border-radius: 12px;
  margin-bottom: 12px;
}
.split-type-option {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 14px;
  border-radius: 9px;
  font-size: 13.5px;
  font-weight: 650;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}
.split-type-option input[type="radio"] {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.split-type-option:has(input:checked) {
  background: #ffffff;
  color: var(--accent-dark);
  box-shadow: var(--shadow-sm);
}
.custom-split-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: var(--page);
  border: 1px solid var(--line);
  border-radius: 12px;
  transition: border-color 0.15s ease;
}
.custom-split-row:hover {
  border-color: var(--line-strong);
}
.custom-split-user {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}
.custom-split-name {
  font-weight: 650;
  font-size: 14px;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.custom-share-pct {
  display: block;
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
  margin-top: 2px;
}
.custom-share-input {
  width: 140px;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 650;
  text-align: right;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #ffffff;
  color: var(--ink);
}
.custom-share-input:focus {
  outline: 2px solid var(--accent);
  border-color: var(--accent);
}
.custom-split-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 16px;
  background: var(--tint);
  border: 1px solid var(--tint-border);
  border-radius: 12px;
  font-size: 13.5px;
  font-weight: 650;
}
</style>
</head>''')
replace('  function readStorage(key) {', room_ui + '\n  function readStorage(key) {')
replace("      walletSession.chain = String(chain).toLowerCase();\n      render();", "      walletSession.chain = String(chain).toLowerCase();\n      roomWalletChanged();\n      render();")
replace("const disconnected = () => { clearWallet(); render(); };", "const disconnected = () => { clearWallet(); roomWalletChanged(); render(); };")
replace("      case 'fuji-disconnect': clearWallet(); render(); break;", "      case 'fuji-disconnect': clearWallet(); roomWalletChanged(); render(); break;")
replace("Open TripVault through the Firefox launcher to use it at http://127.0.0.1:8787/.", "Open TripVault through the Rooms launcher to use it at http://127.0.0.1:8788/.")
replace("      walletSession.account = '';\n      walletSession.chain = '';\n      walletStatus", "      walletSession.account = '';\n      walletSession.chain = '';\n      roomWalletChanged();\n      walletStatus")
replace("  function walletError(error) {", """  function walletAccessDenied(error) {
    return Number(error?.code) === 4100
      || /(?:account|method).*not been authorized/i.test(error?.shortMessage || error?.message || '');
  }

  function walletError(error) {
    if (walletAccessDenied(error)) return 'Allow TripVault to use this account in your wallet, then try again.';""")
replace("""    const trip = state.trip?.id === tripId ? state.trip : state.trips.find(item => item.id === tripId);
    if (!trip) return;
    trip.fuji = { ...trip.fuji, lastTx: tx };""", """    const trip = state.trip?.id === tripId ? state.trip : availableTrips().find(item => item.id === tripId);
    if (!trip) return;
    if (trip.shared) return rememberRoomTransaction(trip.id, tx);
    trip.fuji = { ...trip.fuji, lastTx: tx };""")
replace("""        transactionStatus(context, tx, 'confirmed', 'Confirmed on Avalanche Fuji.',""", """        await verifyRoomTransaction(context, tx);
        transactionStatus(context, tx, 'confirmed', 'Confirmed on Avalanche Fuji.',""")
replace("      vault: state.trip?.fuji?.address,", """      vault: state.trip?.fuji?.address, shared: state.trip?.shared === true,
      depositDeadline: state.trip?.depositDeadline ? Math.floor(Date.parse(state.trip.depositDeadline) / 1000) : null,""")
replace("  function rememberFujiTx(tripId, tx, address) {", "  function rememberFujiTx(tripId, tx, address) {\n    if (tripId?.startsWith('room-')) return rememberRoomTransaction(tripId, tx);")
replace("      case 'fuji-deploy': openFujiDeploy(); break;", "      case 'fuji-deploy':\n        if (state.trip?.shared) roomLockForDeploy(state.trip);\n        else openFujiDeploy();\n        break;")
replace("""    if (!trip || trip.fuji?.address || state.actor !== trip.owner
      || walletSession.chain !== FUJI.id || !walletSession.account) return;
    sheetOpen('Deploy Fuji vault', trip.name,""", """    if (!trip || trip.fuji?.address || state.actor !== trip.owner
      || walletSession.chain !== FUJI.id || !walletSession.account
      || (trip.shared && (!trip.locked || trip.members[0].address !== walletSession.account))) return;
    sheetOpen('Deploy Fuji vault', trip.name,""")
replace("""        ${trip.members.map((member, index) =>
          `<label class="field">${safe(member.name)}${index ? '' : ' · Organizer'}""", """        ${trip.shared ? roomMembers(trip) : trip.members.map((member, index) =>
          `<label class="field">${safe(member.name)}${index ? '' : ' · Organizer'}""")
replace("""    const members = data.getAll('address').map(value => String(value).trim().toLowerCase());""", """    const members = trip?.shared ? trip.members.map(member => member.address)
      : data.getAll('address').map(value => String(value).trim().toLowerCase());""")
replace("""    if (!trip || trip.fuji?.address || state.actor !== trip.owner || members.length !== trip.members.length""", """    if (!trip || trip.fuji?.address || state.actor !== trip.owner
      || (trip.shared && !trip.locked) || members.length !== trip.members.length""")
replace("""    const content = trip ? screen() : state.trips.length ? tripsScreen() : empty() + '<div class="stack" style="margin-top:13px">' + fujiPanel() + '</div>';""", """    const content = trip ? screen() : rooms.online ? roomsHome()
      : state.trips.length ? tripsScreen() : empty() + '<div class="stack" style="margin-top:13px">' + fujiPanel() + '</div>';""")
replace("const newTrip = btn('New trip', 'new-trip',", "const newTrip = btn('New trip', 'new-trip',")
replace("const tripsButton = trip ? btn('Trips', 'trip-list', { tone: 'ghost' }) : newTrip;",
        "const tripsButton = trip?.shared ? '' : trip ? btn('Trips', 'trip-list', { tone: 'ghost' }) : newTrip;")
replace("""    const avatarButton = trip
      ? `<button""", """    const avatarButton = trip && !trip.shared && !demoMode
      ? `<button""")
replace('<span class="chip violet header-demo">Demo</span>', '''<span class="chip violet header-demo">${trip?.shared ? 'Room' : 'Demo'}</span>''')
replace("    const saved = storageUnavailable ? null : readStorage(KEY);", "    if (changedTrip?.shared) return true;\n    const saved = storageUnavailable ? null : readStorage(KEY);")
replace("trips, activeTripId: state.trip?.id || null, actor: state.actor, view: state.view,", "trips, activeTripId: state.trip?.shared ? null : state.trip?.id || null, actor: state.actor, view: state.view,")
replace("  function selectTrip(trip) {\n    if (sheet.open) sheet.close();", """  function selectTrip(trip) {
    if (sheet.open) sheet.close();
    if (trip?.shared) return keepRoom(trip, true);""")
replace("""  function lockQuote(trip, quote) {
    trip.reviewQuote""", """  function lockQuote(trip, quote) {
    if (trip.shared) {
      fallbackReview = null;
      changeRoom(trip, 'split.lock', { quote });
      return;
    }
    trip.reviewQuote""")
replace("""    if (bill.approvals.includes(state.actor) === approve) return;
    bill.approvals""", """    if (bill.approvals.includes(state.actor) === approve) return;
    if (trip.shared || isDemoTrip(trip)) {
      changeRoom(trip, 'bill.approve', { id: bill.id, approve }, updated => {
        if (updated) {
          detail(bill.id);
          notice('Your approval was saved.');
        }
      }, showBillReviewError);
      return;
    }
    bill.approvals""")
replace("""    if (act === 'close-sheet') return sheet.close();""", """    if (act === 'close-sheet') {
      if (guideOpen) return dismissGuide();
      rooms.intent = null;
      deleteSelectionSnapshot = null;
      return sheet.close();
    }
    if (act === 'room-create') return startRoomFlow('create');
    if (act === 'room-preset-time') return applyRoomTimePreset(element);
    if (act === 'room-replace-expired') return openReplacementTrip(trip);
    if (act === 'room-join') return startRoomFlow('join');
    if (act === 'room-sign-in') return startRoomFlow('signin');
    if (act === 'room-copy') return copyRoomInvite(trip);
    if (act === 'room-delete-select-mode') return toggleTripSelectionMode();
    if (act === 'room-select-delete') return selectTripForDeletion(id);
    if (act === 'room-delete-selected') return confirmDeleteSelectedTrips();
    if (act === 'room-delete-selected-confirm') return deleteSelectedTrips();
    if (act === 'room-delete') return confirmDeleteRoom(id ? rooms.list.get(id) : trip);
    if (act === 'room-delete-confirm') return deleteConfirmedRoom(rooms.list.get(id), element.dataset);
    if (act === 'room-end') return showEndRoom(trip);
    if (act === 'room-end-confirm') return endRoomNow(trip, id);
    if (act === 'fuji-link') return showLinkVault(trip);
    if (act === 'room-freeze' && trip?.shared) {
      return changeRoom(trip, 'room.freeze', {}, updated => {
        if (updated) openFujiDeploy();
      });
    }""")
replace("    if (act === 'new-trip') return setup();", "    if (act === 'new-trip') return rooms.online ? startRoomFlow('create') : setup();")
replace("${btn('Create a trip','new-trip',{symbol:'plus'})}${btn('Join a trip','join-trip',{tone:'secondary'})}",
        "${btn('Create a trip','new-trip',{symbol:'plus'})}${btn('Join a trip','join-trip',{tone:'secondary'})}${btn('Explore demo trip','judge-demo-sample',{tone:'secondary'})}")
replace("      const selected = state.trips.find(item => item.id === id);", "      const selected = availableTrips().find(item => item.id === id);")
replace("    if (act === 'join-trip') {\n      sheetOpen", "    if (act === 'join-trip') {\n      if (rooms.online) return startRoomFlow('join');\n      sheetOpen")
replace("""    if (!trip) return;

    switch (act) {""", """    if (!trip) return;
    if (trip.shared && ['deposit', 'withdraw', 'claim', 'quick-top-up', 'approve-split',
      'revoke-split', 'settle', 'switch-member', 'choose-member'].includes(act)) return;

    switch (act) {""")
replace("""          invalidateSplit(trip);
          commit(trip, 'Split reopened. Prepare a new rate and collect approvals again.');""", """          if (trip.shared) changeRoom(trip, 'split.reopen');
          else {
            invalidateSplit(trip);
            commit(trip, 'Split reopened. Prepare a new rate and collect approvals again.');
          }""")
shares_old = """function shares(bill) {
    const count = bill.participants.length;
    const base = Math.floor(bill.amount / count);
    const remainder = bill.amount - base * count;
    return bill.participants.map((id, index) => ({ id, amount: base + (index < remainder ? 1 : 0) }));
  }"""
shares_new = """function shares(bill) {
    if (bill && bill.splitType === 'custom' && bill.customShares && typeof bill.customShares === 'object') {
      return (bill.participants || []).map(id => ({ id, amount: Math.round(Number(bill.customShares[id]) || 0) }));
    }
    const count = bill.participants.length;
    const base = Math.floor(bill.amount / count);
    const remainder = bill.amount - base * count;
    return bill.participants.map((id, index) => ({ id, amount: base + (index < remainder ? 1 : 0) }));
  }"""
replace(shares_old, shares_new)

# Demo trip settings unbolded, dates spacing & FX rate
replace('<section class="panel"><div class="panel-head"><h2>Trip settings</h2>', '<section class="panel trip-settings-panel"><div class="panel-head"><h2>Trip settings</h2>')
replace("row('Starts',safe(t.startTime.replace('T',' ')))", "row('Starts',formatTripTimeSpacious(t.startTime))")
replace("row('Ends',safe(t.endTime.replace('T',' ')))", "row('Ends',formatTripTimeSpacious(t.endTime))")
replace("row('Exchange rate',safe(fxLabel(t.reviewQuote || fx)))", "row('Exchange rate',fxRowValue(t.reviewQuote || fx))")
replace("  function fxLabel(quote) {\n    const rate = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(quote.rate);\n    return [rate + ' VND / USD', quote.source, quote.updated,\n      quote.live || quote.historical ? '' : 'not live'].filter(Boolean).join(' · ');\n  }", "  function formatFxShortTime(raw) {\n    if (!raw) return '';\n    const d = new Date(raw);\n    if (!isNaN(d.getTime())) {\n      const pad = n => String(n).padStart(2, '0');\n      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;\n    }\n    return String(raw);\n  }\n\n  function fxLabel(quote) {\n    const rate = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(quote.rate);\n    const shortSource = quote.source ? quote.source.replace(/\\s+USD\\/VND\\s+reference/i, '').replace(/\\s+reference/i, '') : '';\n    const shortTime = quote.updated ? formatFxShortTime(quote.updated) : '';\n    const notLiveLabel = quote.live || quote.historical ? '' : 'not live';\n    return [rate + ' VND / USD', shortSource, shortTime, notLiveLabel].filter(Boolean).join(' · ');\n  }")

# Warning notice prominent
replace('<p class="notice">Early withdrawals use only your own balance. You remain a trip member after withdrawing all. After start, deposits are locked until final settlement; top-ups are allowed.</p>',
        '<p class="notice warn notice-prominent">Early withdrawals use only your own balance. You remain a trip member after withdrawing all. After start, deposits are locked until final settlement; top-ups are allowed.</p>')

# Travelers subtitle font size
replace('<span class="row-sub">Paid ${vnd(m.paid)} · Owes ${vnd(m.owed)} · Deposited ${fmt(depositOf(m.id))} USDC</span>',
        '<span class="row-sub traveler-details">Paid ${vnd(m.paid)} · Owes ${vnd(m.owed)} · Deposited ${fmt(depositOf(m.id))} USDC</span>')

old_record_bill = """function recordBill(trip, data, fail) {
    const label = String(data.get('label') || '').trim();
    const amount = Number(data.get('amount'));
    const payer = data.get('payer');
    const participants = data.getAll('participant');
    if (trip.settled || !label || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1e9
      || !member(payer) || !participants.length || new Set(participants).size !== participants.length
      || participants.some(id => !member(id))) {
      fail('Enter a valid amount, payer and at least one participant for an open trip.');
      return;
    }
    trip.bills.push({ id: trip.nextBillId++, label, amount, payer, participants, approvals: [], status: 'pending' });
    invalidateSplit(trip);
    sheet.close();
    state.view = 'bills';
    commit(trip, 'Bill recorded. Waiting for approval.');
  }"""

new_record_bill = """function recordBill(trip, data, fail) {
    const label = String(data.get('label') || '').trim();
    const amount = Number(data.get('amount'));
    const payer = data.get('payer');
    const splitType = data.get('split_type') || 'equal';
    const vi = siteLanguage === 'vi';
    let participants = [];
    let customShares = null;

    if (splitType === 'custom') {
      customShares = {};
      let sum = 0;
      for (const m of trip.members) {
        const val = Number(data.get('custom_share_' + m.id)) || 0;
        if (val > 0) {
          customShares[m.id] = Math.round(val);
          participants.push(m.id);
          sum += customShares[m.id];
        }
      }
      if (sum !== amount) {
        fail(vi ? 'Tổng số tiền chia (' + vnd(sum) + ') phải bằng tổng hóa đơn (' + vnd(amount) + ')'
          : 'The sum of custom shares (' + vnd(sum) + ') must equal the total bill amount (' + vnd(amount) + ')');
        return;
      }
    } else {
      participants = data.getAll('participant');
    }

    if (trip.settled || !label || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1e9
      || !member(payer) || !participants.length || new Set(participants).size !== participants.length
      || participants.some(id => !member(id))) {
      fail('Enter a valid amount, payer and at least one participant for an open trip.');
      return;
    }

    if (trip.shared || isDemoTrip(trip)) {
      const id = Number(data.get('editing'));
      changeRoom(trip, id ? 'bill.edit' : 'bill.add', { id, label, amount, payer, participants, splitType, customShares }, updated => {
        if (!updated) return;
        if (sheet.open) sheet.close();
        state.view = 'bills';
        render();
        notice(id ? (trip.shared ? 'Bill updated. A new 24-hour review has started.' : 'Your response was saved.') : 'Bill posted for review.');
      }, fail);
      return;
    }

    trip.bills.push({ id: trip.nextBillId++, label, amount, payer, participants, splitType, customShares, approvals: [], status: 'pending' });
    invalidateSplit(trip);
    sheet.close();
    state.view = 'bills';
    commit(trip, 'Bill recorded. Waiting for approval.');
  }"""
replace(old_record_bill, new_record_bill)
replace("""'fuji-deploy-form', 'fuji-funds-form'].includes(form.id)""", """'fuji-deploy-form', 'fuji-funds-form', 'fuji-link-form', 'room-form'].includes(form.id)""")
replace("    if (form.id === 'fuji-deploy-form') deployFuji(data, fail);", "    if (form.id === 'room-form') submitRoomForm(data, fail);\n    else if (form.id === 'fuji-link-form') linkExistingVault(data, fail);\n    else if (form.id === 'fuji-deploy-form') deployFuji(data, fail);")
replace("      updateFunds(state.trip, data.get('kind'), parseUnits(data.get('amount')), fail);", "      if (!state.trip.shared) updateFunds(state.trip, data.get('kind'), parseUnits(data.get('amount')), fail);")
replace("  function screen(){return ({overview,people,bills,split,wallet}[state.view]||overview)()}", """  function screen() {
    if (state.trip.shared || isDemoTrip()) {
      if (state.view === 'overview') return roomOverview();
      if (state.view === 'people') return roomMembers(state.trip);
      if (state.view === 'split') return roomFinalSplit(state.trip);
      if (state.view === 'wallet') return state.trip.shared ? fujiPanel() : demoWallet(state.trip);
    }
    return ({ overview, people, bills, split, wallet }[state.view] || overview)();
  }""")
replace("    } else if (!settled && quote) {\n      reviewActions = approved", """    } else if (!settled && quote && trip.shared) {
      if (organizer) reviewActions = btn('Start a new review', 'reopen-split', { tone: 'secondary' });
    } else if (!settled && quote) {
      reviewActions = approved""")
replace("const shortfalls = !settled && !plan.invalid && plan.shortfalls.length", "const shortfalls = !trip.shared && !settled && !plan.invalid && plan.shortfalls.length")
replace("btn('Cancel approval', 'revoke-split', { tone: 'secondary' })",
        "btn('Cancel approval', 'revoke-split', { tone: 'danger cancel-approval' })")
replace("btn('Cancel my approval','revoke-bill',{tone:'secondary',",
        "btn('Cancel my approval','revoke-bill',{tone:'danger cancel-approval',")
replace("function detail(id){const b=", "function detail(id){if(state.trip?.shared || isDemoTrip())return roomBillDetail(id);const b=")
replace("b.status==='approved'?'Approved':'Pending approval'",
        "state.trip.shared ? roomBillStatus(b) : b.status==='approved'?'Approved':'Pending approval'")
replace("return trip.bills.some(bill => bill.status !== 'approved');",
        "return trip.bills.some(bill => bill.status !== 'approved' && (!(trip.shared || isDemoTrip(trip)) || bill.status !== 'rejected'));")
replace("${pending ? '<p class=\"notice warn\">Approve all pending bills before the final split.</p>' : ''}",
        """${pending ? '<p class="notice warn">' + (trip.shared ? 'Finish open bill reviews before making final payments.'
          : 'Approve all pending bills before the final split.') + '</p>' : ''}""")
replace("""          <h2>${isAddress(trip.fuji?.address) ? 'Demo split review' : 'Review the balances'}</h2>""", """          <h2>${trip.shared ? 'Review trip expenses' : isAddress(trip.fuji?.address) ? 'Demo split review' : 'Review the balances'}</h2>""")
replace("""          <p class="subtitle">${trip.splitApprovals.length} of ${trip.members.length} approved · Revision ${trip.revision}</p>""", """          <p class="subtitle">${trip.shared ? 'Everyone reviews their amount before the organizer makes the group payments.' : trip.splitApprovals.length + ' of ' + trip.members.length + ' approved · Revision ' + trip.revision}</p>""")
replace("fetching ? 'Fetching market rate…' : 'Prepare final split'", "fetching ? 'Checking exchange rate…' : trip.shared ? 'Calculate final amounts' : 'Prepare final split'")
replace("    if (!settled && !quote && organizer) {", """    if (!settled && !quote && organizer && canReviewFundedTrip(trip)) {""")
replace("    if (!settled && !quote && organizer && canReviewFundedTrip(trip)) {",
        "    if (!settled && !quote && organizer && (!trip.shared || ended) && canReviewFundedTrip(trip)) {")
replace("      && !trip.reviewQuote && !hasPendingBills(trip);",
        "      && !trip.reviewQuote && !hasPendingBills(trip) && (!trip.shared || roomBillsClosed(trip)) && canReviewFundedTrip(trip);")
replace('<h2>Net balances</h2>', "<h2>${trip.shared ? 'What each person owes or gets back' : 'Net balances'}</h2>")
replace('<h2>USDC transfers to settle</h2>', "<h2>${trip.shared ? 'Who pays whom' : 'USDC transfers to settle'}</h2>")
replace('Settlement unlocks after the trip end time.', 'Group payments can start after the trip ends.')
replace("""+ ' · ' + (trip.splitApprovals.includes(item.id) ? 'Approved' : 'Awaiting approval'))).join('')}""", """+ (trip.shared ? '' : ' · ' + (trip.splitApprovals.includes(item.id) ? 'Approved' : 'Awaiting approval')))).join('')}""")
replace("""          <p class="notice">Demo settlement moves balances within the simulated vault. Each member can claim their balance in Wallet.</p>""", """          <p class="notice">${trip.shared ? 'Deploy a Fuji vault in Wallet. The organizer can publish this split after the trip ends.' : 'Demo settlement moves balances within the simulated vault. Each member can claim their balance in Wallet.'}</p>""")
replace("""<p class="subtitle">Transactions use test USDC on Avalanche Fuji. Local demo balances are separate.</p>""", """<p class="subtitle">${trip?.shared ? 'Room members transact with test USDC on Avalanche Fuji.' : 'Transactions use test USDC on Avalanche Fuji. Local demo balances are separate.'}</p>""")
guide_art = ['create', 'join', 'fund-trip', 'bills', 'settlement']
pictures = [
    'data:image/png;base64,' + base64.b64encode((root / f'work/guide-art/{name}.png').read_bytes()).decode('ascii')
    for name in guide_art
]
room_guide = (root / 'work/tripvault-rooms-guide.js').read_text().replace('/*ROOM_GUIDE_PICTURES*/', json.dumps(pictures))
guide_start = source.index('  const GUIDE_CONTENT = {')
guide_end = source.index('  function header() {', guide_start)
source = source[:guide_start] + room_guide + '\n' + source[guide_end:]
replace("const GUIDE_KEY = 'tripvault-guide-seen';", "const GUIDE_KEY = 'tripvault-rooms-guide-seen-v3';")
replace("    if (act === 'guide') return showGuide();",
        "    if (act === 'guide') return openGuide();\n    if (act === 'guide-step') return moveGuide(id);")
replace("  showFirstVisitGuide();\n  refreshFX();", "  showFirstVisitGuide();\n  refreshFX();\n  enableRooms();")
replace("${content}\n          </main>", "${!rooms.online && window.location?.protocol === 'file:' ? '<p class=\"notice warn\">Open the TripVault Rooms launcher for invite links and room codes.</p>' : ''}\n            ${content}\n          </main>")
replace("""        ${btn('Try a local demo', 'local-demo', { tone: 'ghost' })}
""", """        ${btn('Explore demo trip', 'judge-demo-sample', { tone: 'secondary' })}
""")
replace("    const ended = Date.now() >= Date.parse(trip.endTime);", "    const ended = Date.now() >= roomEndTime(trip);")
replace("${isAddress(trip.fuji?.address) ? fujiPanel('split') : ''}", "${trip.shared || isAddress(trip.fuji?.address) ? fujiPanel('split') : ''}")
replace("const next = [state.trip.startTime, state.trip.endTime].map(value => Date.parse(value)).find(time => time > now);",
        "const next = [Date.parse(state.trip.depositDeadline), Date.parse(state.trip.startTime), roomEndTime(state.trip)].find(time => time > now);")
replace("if (next) phaseTimer = setTimeout(render, Math.min(next - now, 2_147_483_647));",
        """if (next) phaseTimer = setTimeout(() => {
      render();
      if (state.trip?.shared) refreshRoomFunding();
      if (!walletSession.busy) refreshVault(true);
    }, Math.min(next - now, 2_147_483_647));""")
replace("trip.shared ? 'Deploy a Fuji vault in Wallet. The organizer can publish this split after the trip ends.' : 'Demo settlement moves balances within the simulated vault. Each member can claim their balance in Wallet.'",
        "trip.shared ? 'These amounts are estimates until the split is published and settled on Fuji.' : 'Demo settlement moves balances within the simulated vault. Each member can claim their balance in Wallet.'")
replace("    if (act === 'room-copy') return copyRoomInvite(trip);", """    if (act === 'room-copy') return copyRoomInvite(trip);
    if (act === 'room-copy-code') return copyRoomCode(trip);
    if (act === 'room-funding-refresh') return refreshRoomFunding();
    if (act === 'room-rename' || act === 'room-rename-member') return showRoomRename(trip, act);
    if (act === 'room-reauthenticate') return reauthenticateRoom();
    if (act === 'room-wallet-access') return restoreRoomWalletAccess();
    if (['bill-edit', 'bill-feedback', 'bill-cancel-yes', 'bill-cancel-no'].includes(act)) return roomBillAction(act, Number(id));
    if (act === 'bill-feedback-vote') return respondToBillFeedback(Number(id), element.dataset);
    if (act === 'send-top-up-reminder') return sendBillTopUpReminder(element);
    if (act === 'open-top-up-reminder') return openTopUpReminder(id);
    if (act === 'pay-top-up-reminder') return payTopUpReminder(id, element.dataset.units);
    if (act === 'room-notifications') return openRoomNotifications();
    if (act === 'clear-room-notifications') return clearRoomNotifications();
    if (act === 'open-room-notification') return openRoomNotification(id);
    if (act === 'mark-room-notification-read') return markRoomNotificationRead(id);
    const notification = element.closest?.('[data-notification-id]');
    if (notification) markRoomNotificationRead(notification.dataset.notificationId);
    if (act === 'room-funding-top-up') return topUpRoomFunding(element);""")
replace("disabled:!!t.settled})}</div><section class=\"panel\"><div class=\"panel-head\"><h2>Trip expenses",
        "disabled:t.shared ? !roomBillFunding(t).ready : !!t.settled})}</div>${t.shared ? roomFundingPanel(t) : ''}<section class=\"panel\"><div class=\"panel-head\"><h2>Trip expenses")
old_add_bill = "function addBill(){const t=state.trip;if(t.settled)return;sheetOpen('Add a bill','Record a payment made outside TripVault.',`<form id=\"bill-form\" class=\"stack\"><label class=\"field\">Bill name<input name=\"label\" maxlength=\"70\" required placeholder=\"e.g. Lunch\"></label><label class=\"field\">Amount paid (VND)<input name=\"amount\" type=\"number\" inputmode=\"numeric\" min=\"1\" max=\"1000000000\" step=\"1\" required placeholder=\"300000\"></label><label class=\"field\">Who paid the merchant?<select name=\"payer\" required>${t.members.map(m=>`<option value=\"${m.id}\" ${m.id===state.actor?'selected':''}>${safe(m.name)}</option>`).join('')}</select></label><fieldset class=\"participant-field\"><legend>Who shares this cost?</legend><div class=\"participants\">${t.members.map(m=>`<label class=\"participant\">${avatar(m)}<span>${safe(m.name)}</span><input type=\"checkbox\" name=\"participant\" value=\"${m.id}\" checked></label>`).join('')}</div></fieldset><p class=\"notice\">No recipient wallet is needed: the payer is recorded now. USDC recipients are calculated automatically in Final split.</p><p id=\"sheet-error\" class=\"form-error\"></p></form>`,`<button class=\"btn full\" type=\"submit\" form=\"bill-form\">Save bill</button>`)}"

new_add_bill = """function addBill(editing = null) {
  const t = state.trip;
  if (t.settled || (!editing && t.shared && !roomBillFunding(t).ready)) return;
  const vi = siteLanguage === 'vi';
  const custom = editing?.splitType === 'custom';
  const currentTotal = editing ? editing.amount : '';

  const payerOptions = t.members.map(m =>
    `<option value="${m.id}" ${(editing?.payer || state.actor) === m.id ? 'selected' : ''}>${userText(m.name)}</option>`
  ).join('');

  const equalParticipants = t.members.map(m =>
    `<label class="participant">${avatar(m)}<span>${userText(m.name)}</span><input type="checkbox" name="participant" value="${m.id}" ${!editing || editing.participants.includes(m.id) ? 'checked' : ''}></label>`
  ).join('');

  const customRows = t.members.map(m => {
    const val = editing?.customShares?.[m.id] ?? '';
    return `<div class="custom-split-row">
      <div class="custom-split-user">
        ${avatar(m)}
        <div>
          <div class="custom-split-name">${userText(m.name)}</div>
          <span class="custom-share-pct" data-member-pct="${m.id}">0.0% (0 ₫)</span>
        </div>
      </div>
      <div>
        <input type="number" class="custom-share-input" name="custom_share_${m.id}" data-custom-member="${m.id}" min="0" max="1000000000" step="1" placeholder="0 ₫" value="${val}">
      </div>
    </div>`;
  }).join('');

  sheetOpen(editing ? 'Edit bill' : 'Add a bill', 'Record a payment made outside TripVault.',
    `<form id="bill-form" class="stack" ${t.shared ? `data-room="${safe(t.id)}" data-editing="${editing?.id || ''}"` : ''}>
      ${editing ? `<input type="hidden" name="editing" value="${editing.id}">` : ''}
      <label class="field">Bill name<input name="label" maxlength="70" required placeholder="e.g. Lunch" value="${safe(editing?.label)}"></label>
      <label class="field">Amount paid (VND)<input name="amount" id="bill-amount-input" type="number" inputmode="numeric" min="1" max="1000000000" step="1" required placeholder="300000" value="${currentTotal}"></label>
      <label class="field">Who paid the merchant?<select name="payer" required>${payerOptions}</select></label>

      <div class="stack" style="gap:8px;">
        <span style="font-size:12.5px; font-weight:700; color:var(--muted);">${vi ? 'Phương thức chia:' : 'Split method:'}</span>
        <div class="split-type-toggle" role="radiogroup">
          <label class="split-type-option">
            <input type="radio" name="split_type" value="equal" ${!custom ? 'checked' : ''}>
            <span>${vi ? 'Chia đều' : 'Equal split'}</span>
          </label>
          <label class="split-type-option">
            <input type="radio" name="split_type" value="custom" ${custom ? 'checked' : ''}>
            <span>${vi ? 'Chia tùy chỉnh' : 'Custom split'}</span>
          </label>
        </div>
      </div>

      <fieldset class="participant-field equal-split-view" ${custom ? 'style="display:none;"' : ''}>
        <legend>Who shares this cost?</legend>
        <div class="participants">${equalParticipants}</div>
      </fieldset>

      <div class="custom-split-view stack" style="gap:8px; ${!custom ? 'display:none;' : ''}">
        <span style="font-size:12px; font-weight:700; color:var(--muted);">${vi ? 'Nhập số tiền của từng người:' : 'Enter amount for each person:'}</span>
        <div class="stack" style="gap:8px;">${customRows}</div>
        <div class="custom-split-summary">
          <span class="custom-split-status" id="custom-split-status">Đã chia: 0 ₫ / 0 ₫</span>
          <button type="button" class="btn soft custom-split-autofill" style="font-size:12px; padding:4px 10px;">${vi ? 'Chia đều số còn lại' : 'Auto-fill remaining'}</button>
        </div>
      </div>

      ${t.shared ? '<div id="bill-funding-status" aria-live="polite"></div><p id="bill-reminder-feedback" role="status"></p>' : '<p class="notice">USDC recipients are calculated automatically in Final split.</p>'}
      <p id="sheet-error" class="form-error" role="status"></p>
    </form>`,
    `<button class="btn full" type="submit" form="bill-form">${editing ? 'Save changes' : 'Save bill'}</button>`
  );

  const form = sheet.querySelector('#bill-form');
  if (form) {
    const updateCustomSplitMath = () => {
      const total = Number(form.querySelector('#bill-amount-input')?.value) || 0;
      const isCustom = form.querySelector('input[name="split_type"]:checked')?.value === 'custom';
      const eqView = form.querySelector('.equal-split-view');
      const csView = form.querySelector('.custom-split-view');
      if (eqView) eqView.style.display = isCustom ? 'none' : '';
      if (csView) csView.style.display = isCustom ? '' : 'none';

      if (!isCustom) {
        if (t.shared) updateBillFundingForm();
        return;
      }

      const inputs = form.querySelectorAll('.custom-share-input');
      let sum = 0;
      inputs.forEach(inp => {
        const id = inp.dataset.customMember;
        const val = Number(inp.value) || 0;
        sum += val;
        const pctEl = form.querySelector(`.custom-share-pct[data-member-pct="${id}"]`);
        if (pctEl) {
          const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
          pctEl.textContent = `${pct}% (${vnd(val)})`;
        }
      });

      const statusEl = form.querySelector('#custom-split-status');
      if (statusEl) {
        if (total <= 0) {
          statusEl.textContent = vi ? 'Nhập tổng hóa đơn trước' : 'Enter bill amount first';
          statusEl.style.color = 'var(--muted)';
        } else if (sum === total) {
          statusEl.textContent = `✅ ${vi ? 'Đã chia đủ:' : 'Matched:'} ${vnd(sum)} (100%)`;
          statusEl.style.color = 'var(--positive)';
        } else if (sum < total) {
          statusEl.textContent = `⚠️ ${vi ? 'Còn thiếu:' : 'Remaining:'} ${vnd(total - sum)}`;
          statusEl.style.color = 'var(--warning)';
        } else {
          statusEl.textContent = `❌ ${vi ? 'Dư:' : 'Excess:'} ${vnd(sum - total)}`;
          statusEl.style.color = 'var(--danger)';
        }
      }
      if (t.shared) updateBillFundingForm();
    };

    form.addEventListener('input', updateCustomSplitMath);
    form.addEventListener('change', updateCustomSplitMath);

    const autofillBtn = form.querySelector('.custom-split-autofill');
    if (autofillBtn) {
      autofillBtn.addEventListener('click', () => {
        const total = Number(form.querySelector('#bill-amount-input')?.value) || 0;
        if (total <= 0) return;
        const inputs = Array.from(form.querySelectorAll('.custom-share-input'));
        const emptyInputs = inputs.filter(inp => !(Number(inp.value) > 0));
        let filledSum = 0;
        inputs.forEach(inp => { if (Number(inp.value) > 0) filledSum += Number(inp.value); });
        const remaining = total - filledSum;
        const targets = emptyInputs.length > 0 ? emptyInputs : inputs;
        const base = Math.floor((emptyInputs.length > 0 ? remaining : total) / targets.length);
        const rem = (emptyInputs.length > 0 ? remaining : total) - base * targets.length;
        targets.forEach((inp, idx) => {
          inp.value = Math.max(0, base + (idx < rem ? 1 : 0));
        });
        updateCustomSplitMath();
      });
    }

    updateCustomSplitMath();
    if (t.shared) updateBillFundingForm();
  }
}"""
replace(old_add_bill, new_add_bill)
replace('    app.innerHTML = header();', """    const split = app.querySelector?.('[data-split-trip]');
    const openDetails = new Set(state.view === 'split' && split && split.dataset.splitTrip === state.trip?.id
      ? [...split.querySelectorAll('details[data-split-detail][open]')].map(item => item.dataset.splitDetail) : []);
    app.innerHTML = header();
    for (const detail of app.querySelectorAll?.('details[data-split-detail]') || []) {
      if (openDetails.has(detail.dataset.splitDetail)) detail.open = true;
    }
    updateBillFundingForm();
    updateRoomSignInButton();""")
replace("            ${content}\n          </main>", """            ${trip && (trip.shared || isDemoTrip(trip)) ? roomTripToolbar(trip) : ''}
            ${trip?.shared && !rooms.token ? '<p class="notice warn">Your room sign-in expired. ' + btn('Sign in again', 'room-reauthenticate', { tone: 'secondary' }) + '</p>' : ''}
            ${content}
          </main>""")
replace("          if (view === 'wallet' || view === 'split') refreshVault();", """          if (view === 'wallet' || view === 'split') refreshVault();
          if (view === 'overview' && trip.shared && roomEndTime(trip) <= Date.now()) refreshVault(true);
          if (trip.shared && ['overview', 'bills', 'split'].includes(view)) refreshRoomFunding();""")
replace("""          window.scrollTo(0, 0);
        }
        break;
      case 'deposit':""", """          window.scrollTo(0, 0);
          if (trip.shared && view === 'wallet' && element.dataset.focus === 'fuji-deploy') {
            app.querySelector?.('main [data-act="fuji-deploy"]:not(:disabled)')?.focus();
          }
        }
        break;
      case 'deposit':""")
source, contract = upgrade(source)
replace("    if (trip.settled || (trip.approvalMode === 'organizer' && state.actor !== trip.owner)) return;",
        "    if (trip.settled || (!trip.shared && trip.approvalMode === 'organizer' && state.actor !== trip.owner)) return;")
replace("    if (bill.approvals.includes(state.actor) === approve) return;",
        "    if (!trip.shared && bill.approvals.includes(state.actor) === approve) return;")
replace("'fuji-link-form', 'room-form'].includes(form.id)",
        "'fuji-link-form', 'room-form', 'bill-feedback-form', 'bill-cancellation-form', 'room-rename-form'].includes(form.id)")
replace("    else if (form.id === 'fuji-link-form') linkExistingVault(data, fail);", """    else if (form.id === 'bill-feedback-form') submitBillFeedback(data, fail);
    else if (form.id === 'bill-cancellation-form') submitBillCancellation(data, fail);
    else if (form.id === 'room-rename-form') submitRoomRename(data, fail);
    else if (form.id === 'fuji-link-form') linkExistingVault(data, fail);""")
submit_start = source.index("  document.addEventListener('submit',")
submit_end = source.index("\n  window.addEventListener('storage',", submit_start)
submit_handler = source[submit_start:submit_end].replace('form.id', 'formId').replace(
    '    const form = event.target;\n',
    "    const form = event.target;\n"
    "    // A form control named id can shadow the form's id property.\n"
    "    const formId = form.getAttribute('id');\n",
)
source = source[:submit_start] + submit_handler + source[submit_end:]
replace("""    const calldata = '0x' + VAULT.bytecode + abiWord(128) + abiWord(start) + abiWord(end)
      + abiWord(trip.minimumUnits) + abiArray(members);""", """    const deadline = Math.floor(Date.parse(trip.depositDeadline) / 1000);
    if (deadline && Date.now() >= deadline * 1000) return fail('The deposit deadline has passed.');
    const calldata = deadline
      ? '0x' + VAULT.deadlineBytecode + abiWord(160) + abiWord(deadline) + abiWord(start)
        + abiWord(end) + abiWord(trip.minimumUnits) + abiArray(members)
      : '0x' + VAULT.bytecode + abiWord(128) + abiWord(start) + abiWord(end)
        + abiWord(trip.minimumUnits) + abiArray(members);""")
replace("if (index < 0 || vault.settled || vault.timestamp >= vault.refundDeadline) {", "if (index < 0 || !canDepositFuji(vault)) {")
replace("(!vault.settled && vault.timestamp < vault.refundDeadline)", "(!vault.settled && !vault.cancelled && vault.timestamp < vault.refundDeadline)")
replace("    withFuji('Deposit test USDC', async context => {", "    return withFuji('Deposit test USDC', async context => {")
replace("      if (BigInt(units) > vault.usdc) throw new Error('This wallet needs more Fuji test USDC.');",
        """      if (BigInt(units) > vault.usdc) {
        const available = money(Number(vault.usdc));
        throw new Error(`Your wallet has ${available} on Fuji. This deposit needs ${money(units)}. Get test USDC from the Circle faucet and try again.`);
      }""")
replace("""      walletStatus(context.tripId, error?.code === 4001 ? 'rejected' : 'failed', label, walletError(error));
    } finally {
      walletSession.busy = false;
      render();""", """      walletStatus(context.tripId, error?.code === 4001 ? 'rejected' : 'failed', label, walletError(error));
    } finally {
      walletSession.busy = false;
      render();
      if (context.shared && state.trip?.id === context.tripId) refreshRoomFunding();""")
replace("      case 'fuji-refresh': refreshVault(); break;", "      case 'fuji-refresh': refreshTripStatus(); break;")
replace("""    if (!vault || !vault.members.includes(walletSession.account) || walletSession.busy) return;
    const withdraw = kind === 'withdraw';
    sheetOpen(withdraw ? 'Withdraw test USDC'""", """    const index = vault?.members.indexOf(walletSession.account) ?? -1;
    const withdraw = kind === 'withdraw';
    if (index < 0 || walletSession.busy || (withdraw ? !canWithdrawFuji(vault, index) : !canDepositFuji(vault))) return;
    sheetOpen(withdraw ? 'Withdraw my deposit'""")
replace("""      if (index < 0 || vault.timestamp >= Math.min(vault.start, vault.end) || units > vault.balances[index]) {
        throw new Error('Early withdrawal is unavailable for this amount.');
      }""", """      if (!canWithdrawFuji(vault, index)) {
        throw new Error('You can take back your deposit only before the withdrawal deadline.');
      }
      if (units > vault.balances[index]) throw new Error('Enter an amount up to your balance in the trip fund.');""")
replace("""    if (!draft || vault?.members[0] !== walletSession.account || vault.members.length !== draft.length) return;
    sheetOpen('Review the Fuji split', trip.name,""", """    if (!draft || vault?.members[0] !== walletSession.account || vault.members.length !== draft.length
      || vault.timestamp < vault.end || vault.timestamp >= vault.refundDeadline || vault.settled
      || (vault.net.length && matchesFujiDraft(trip, vault))) return;
    sheetOpen('Review payment amounts', trip.name,""")
replace("safe(trip.members[index].name), (units > 0 ? '+' : '') + money(units), safe(vault.members[index]),",
        "safe(trip.members[index].name), fujiPaymentAmount(units),")
replace('Publishing records these exact amounts and the organizer’s approval on Fuji. Each other member must approve this proposal before settlement.',
        'Sharing these amounts also approves your own amount. Everyone else can then review and approve theirs.')
replace("btn('Publish split on Fuji', 'fuji-publish'", "btn('Share amounts for approval', 'fuji-publish'")
replace("""      'fuji-publish': 'Publish Fuji split', 'fuji-approve': 'Approve Fuji split',
      'fuji-revoke': 'Revoke Fuji approval', 'fuji-settle': 'Settle Fuji vault', 'fuji-claim': 'Claim test USDC',""", """      'fuji-publish': 'Share amounts for approval', 'fuji-approve': 'Approve my amount',
      'fuji-revoke': 'Undo my approval', 'fuji-settle': 'Make group payments', 'fuji-claim': 'Send balance to my wallet',""")
replace("          throw new Error('The split changed or cannot be published. Review the draft again.');",
        "          throw new Error('The amounts changed or cannot be shared yet. Review them again.');")
replace("        calldata = vaultCall('propose(int256[])', 32) + abiArray(draft);", """        if (vault.net.length && matchesFujiDraft(latest, vault)) throw new Error('These amounts are already shared.');
        calldata = vaultCall('propose(int256[])', 32) + abiArray(draft);""")
replace("The local split changed. Publish a replacement before continuing.", "The amounts changed. The organizer needs to share the updated amounts first.")
replace("The organizer can settle after all members approve and fund the plan.", "Everyone needs to approve their amount and add enough USDC before the organizer can pay.")
source = source.replace("'Deposit test USDC'", "'Deposit USDC'")
translation = (root / 'work/tripvault-ui-language.js').read_text()
replace('  function readStorage(key) {', translation + '\n  function readStorage(key) {')
replace("              ${btn('Guide', 'guide', { tone: 'ghost' })}",
        "              ${btn('Guide', 'guide', { tone: 'ghost' })}\n              ${siteLanguageSelect()}\n              ${roomBell()}")
replace("""<span class="chip violet header-demo">${trip?.shared ? 'Room' : 'Demo'}</span>""",
        """${trip?.shared ? '' : '<span class="chip violet header-demo">Demo</span>'}""")
replace("const tripsButton = trip?.shared ? '' : trip ? btn('Trips', 'trip-list', { tone: 'ghost' }) : newTrip;",
        "const tripsButton = trip?.shared || isDemoTrip(trip) || (!trip && rooms.online) ? '' : trip ? btn('Trips', 'trip-list', { tone: 'ghost' }) : newTrip;")
replace("""${trip ? 'Trips / ' + safe(trip.name) : 'Your trips'}""",
        """${trip ? 'Trips / ' + userText(trip.name) : 'Your trips'}""")
replace('    app.innerHTML = header();', """    if (document.documentElement) {
      document.documentElement.lang = siteLanguage;
      document.title = 'TripVault · ' + ui('Shared Trip Fund');
      const skipLink = document.querySelector('.skip');
      if (skipLink) skipLink.textContent = ui('Skip to content');
    }
    app.innerHTML = header();
    localizeUI(app);""")
replace("function sheetOpen(title,subtitle,body,footer='',language='en'){sheet.lang=language;",
        "function sheetOpen(title,subtitle,body,footer='',language=null){sheet.lang=language || siteLanguage;")
replace('<h2 id="sheet-title">${safe(title)}</h2><p>${safe(subtitle)}</p>',
        '<h2 id="sheet-title">${sheetText(title)}</h2><p>${sheetText(subtitle)}</p>')
replace('<div class="sheet-body">${body}</div>${footer?', '''<div class="sheet-body">
  <div class="notice" data-sheet-notification hidden><p role="status"></p>${btn('Open notifications', 'room-notifications', { tone: 'secondary' })}</div>
  ${body}
</div>${footer?''')
replace("if(!sheet.open)sheet.showModal();sheet.scrollTop=0}",
        "if(!language)localizeUI(sheet);if(!sheet.open)sheet.showModal();sheet.scrollTop=0}")
replace("toast.textContent=s;", "toast.textContent=ui(s);")
replace("form.querySelector('#sheet-error').textContent = message;", "form.querySelector('#sheet-error').textContent = ui(message);")
for label in ('Deploy Fuji vault', 'Review payment amounts'):
    replace(f"sheetOpen('{label}', trip.name,", f"sheetOpen('{label}', {{ user: trip.name }},")
source = source.replace('row(safe(trip.members[index].name),', 'row(userText(trip.members[index].name),')
source = source.replace('safe(trip.members[index].name), fujiPaymentAmount(units),',
                        'userText(trip.members[index].name), fujiPaymentAmount(units),')
source = source.replace('row(safe(member(item.id).name),', 'row(userText(member(item.id).name),')
source = source.replace('row(safe(item.name), vnd(item.net),', 'row(userText(item.name), vnd(item.net),')
source = source.replace('<h1>Final split</h1><p>${safe(trip.name)}</p>', '<h1>Final split</h1><p>${userText(trip.name)}</p>')
source = source.replace(".bill-row:nth-child(even) .bill-badge { background: #e4f2ea; color: #22644b; }", "/* nth-child bill-badge alternate removed in favor of status-based color */")
source = source.replace('<button type="button" class="bill-row" data-act="bill-detail" data-id="${b.id}">', '<button type="button" class="bill-row is-${safe(b.status)}" data-act="bill-detail" data-id="${b.id}">')
source = source.replace('<span class="bill-badge">${icon(\'bill\')}</span>', '<span class="bill-badge status-${safe(b.status)}">${icon(b.status === \'approved\' ? \'check\' : b.status === \'rejected\' ? \'close\' : \'bill\')}</span>')
source = source.replace('>${safe(b.label)}</span>', '>${userText(b.label)}</span>')
source = source.replace('>${safe(m.name)}</span>', '>${userText(m.name)}</span>')
bill_item_start = source.index('  function billItem(b)')
bill_item_end = source.index('\n', bill_item_start)
replace(source[bill_item_start:bill_item_end], """  function billItem(bill) {
    const payer = member(bill.payer);
    const status = state.trip.shared || isDemoTrip() ? roomBillStatus(bill) : ui(bill.status === 'approved' ? 'Approved' : 'Pending approval');
    const iconName = bill.status === 'approved' ? 'check' : bill.status === 'rejected' ? 'close' : 'bill';
    return `<button type="button" class="bill-row is-${safe(bill.status)}" data-act="bill-detail" data-id="${bill.id}">
      <span class="row-label">
        <span class="bill-badge status-${safe(bill.status)}">${icon(iconName)}</span>
        <span>
          <span class="bill-name">${userText(bill.label)}</span>
          <span class="bill-sub">${ui('Paid by')} ${userText(payer?.name || ui('Unknown'))} · ${ui(bill.participants.length + ' people')}</span>
          <span class="bill-status">${safe(status)}</span>
        </span>
      </span>
      <span class="row-value">${vnd(bill.amount)}</span>
    </button>`;
  }""")
source = source.replace('>${safe(m.name)}</option>', ' translate="no">${safe(m.name)}</option>')
replace("const KEY = 'tripvault-timelocked-external-v8';", """const demoMode = new URLSearchParams(window.location?.search || '').get('demo') === '1';
  const KEY = demoMode ? 'tripvault-judge-demo-v1' : 'tripvault-timelocked-external-v8';""")
replace("const legacy = readStorage(LEGACY_KEY);", "const legacy = demoMode ? null : readStorage(LEGACY_KEY);")
replace("  enableRooms();", "  if (!demoMode) enableRooms();")
replace('.trip-return { display:', """.subtle-link { font-weight: 500; color: var(--ink); text-decoration: none; }
.subtle-link:hover { text-decoration: underline !important; }
.empty-split-card { padding: 24px; text-align: center; margin-bottom: 20px; background: var(--paper); border: 1px dashed var(--line-strong); border-radius: var(--radius); }
.demo-landing-card { border-radius: var(--radius); border: 1px solid var(--line); box-shadow: var(--shadow-sm); }
.trip-return { display:""")
replace("""    const content = trip ? screen() : rooms.online ? roomsHome()""", """    const content = trip ? screen() : demoMode
      ? demoLandingScreen()
      : rooms.online ? roomsHome()""")
replace("    if (act === 'room-create')", """    if (act === 'judge-demo-sample') {
      if (demoMode) return startJudgeSample();
      window.location.assign('/?demo=1');
      return;
    }
    if (act === 'room-create')""")
replace("  function selectTrip(trip) {", """  function formatShortDateTime(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso).replace('T', ' ');
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month} ${hours}:${mins}`;
    } catch {
      return String(iso).replace('T', ' ');
    }
  }

  function formatFxReference(quote) {
    if (!quote || !quote.rate) return ui('Reference rate unavailable');
    const rounded = new Intl.NumberFormat(siteLanguage === 'vi' ? 'vi-VN' : 'en-US', {
      maximumFractionDigits: 0,
    }).format(quote.rate);
    const source = quote.source || '';
    const time = quote.updated ? formatFxShortTime(quote.updated) : '';
    const details = [source, time].filter(Boolean).join(' · ');
    return ui('Reference rate') + ' · ' + rounded + ' VND / USD' + (details ? ' · ' + details : '');
  }

  function demoLandingScreen() {
    const exitDemoUrl = (() => {
      try {
        const u = new URL(window.location.href);
        u.searchParams.delete('demo');
        return (u.pathname || '/') + (u.search ? u.search : '') + (u.hash || '');
      } catch {
        return window.location.pathname || '/';
      }
    })();
    const card = `
      <div class="card demo-landing-card" style="padding: 24px; margin-bottom: 20px;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
          <span class="brand-mark">TV</span>
          <h1 style="margin:0; font-size:22px; font-weight:700;">TripVault</h1>
        </div>
        <p class="subtle" style="font-size:14px; margin:0 0 16px 0; line-height:1.5;">
          Shared trip fund: everyone deposits first, you log bills as you go, and the app settles once at the end.
        </p>
        <ol class="demo-steps" style="margin:0 0 20px 0; padding-left:20px; font-size:14px; line-height:1.8; color:var(--ink);">
          <li>Deposit USDC into the fund</li>
          <li>Log bills and approve them</li>
          <li>Settle everyone in one step</li>
        </ol>
        <button type="button" class="btn full" data-act="judge-demo-sample" style="width:100%; justify-content:center; padding:12px; font-size:15px; font-weight:600;">
          Start a fresh sample
        </button>
        <div style="text-align:center; margin-top:12px; font-size:13px; color:var(--subtle);">
          Using a real wallet? <a href="${exitDemoUrl}" class="subtle-link">Open shared-trip mode</a>
        </div>
      </div>`;
    const existing = state.trips.length ? tripsScreen() : '';
    return card + existing;
  }

  function startJudgeSample() {
    const members = [{ id: 'm0', name: 'An' }, { id: 'm1', name: 'Bình' }];
    const now = Date.now();
    const trip = {
      id: 'judges-sample', name: 'Đà Lạt weekend', location: 'Đà Lạt', owner: 'm0', members,
      minimumUnits: 5_000_000, depositUnits: { m0: 5_000_000, m1: 5_000_000 },
      startTime: new Date(now - 7_200_000).toISOString(),
      endTime: new Date(now - 60_000).toISOString(),
      approvalMode: 'everyone', bills: [], nextBillId: 1, splitApprovals: [],
      revision: 1, reviewQuote: null, settled: false,
    };
    state.trip = trip;
    state.actor = trip.owner;
    state.view = 'overview';
    fallbackReview = null;
    commit(trip);
    window.scrollTo(0, 0);
  }

  function selectTrip(trip) {
""")
replace("""  const FALLBACK_RATE = {
    rate: 25640.2, source: 'Xe reference', updated: '2026-11-11', live: false,
  };""", """  const FALLBACK_RATE = {
    rate: 25640.2, source: 'Xe', updated: '2026-11-11T00:00:00Z', live: false,
  };""")
replace("""      <div class="stack">
        ${trip.shared || isAddress(trip.fuji?.address) ? fujiPanel('split') : ''}""",
        """      <div class="stack">
        ${(() => {
          const approved = (trip.bills || []).filter(b => b.status === 'approved');
          return approved.length === 0 ? `
            <div class="card empty-split-card">
              <div style="font-size:28px; margin-bottom:8px;">🧾</div>
              <h3 style="margin:0 0 6px 0; font-size:17px; font-weight:600; color:var(--ink);">Nothing to split yet</h3>
              <p class="subtle" style="margin:0 0 16px 0; font-size:13.5px; line-height:1.5;">
                Add your first bill in the Bills tab. Balances and transfers appear here once bills are approved.
              </p>
              <button type="button" class="btn secondary sm" data-act="navigate" data-view="bills">Go to Bills</button>
            </div>` : '';
        })()}
        ${trip.shared || isAddress(trip.fuji?.address) ? fujiPanel('split') : ''}""")
replace("""        <section class="panel">
          <h2>${trip.shared ? 'What each person owes or gets back' : 'Net balances'}</h2>""",
        """        <section class="panel" style="${(trip.bills || []).filter(b => b.status === 'approved').length === 0 ? 'opacity: 0.55; pointer-events: none;' : ''}">
          <h2>${trip.shared ? 'What each person owes or gets back' : 'Net balances'}</h2>""")
replace("""        <section class="panel">
          <h2>${trip.shared ? 'Who pays whom' : 'USDC transfers to settle'}</h2>""",
        """        <section class="panel" style="${(trip.bills || []).filter(b => b.status === 'approved').length === 0 ? 'opacity: 0.55; pointer-events: none;' : ''}">
          <h2>${trip.shared ? 'Who pays whom' : 'USDC transfers to settle'}</h2>""")
replace("""<span class="chip violet">${settled ? 'Settled' : quote ? 'In review' : 'Draft'}</span>""",
        """<span class="chip violet">${settled ? 'Settled' : quote ? 'In review' : 'Draft · Pending approvals'}</span>""")
replace("""Revision ' + trip.revision""", """Settlement draft (v' + trip.revision + ')'""")
replace("""          <p class="notice${(quote || fx).live || quote?.historical ? '' : ' warn'}">${quoteStatus} · ${safe(fxLabel(quote || fx))}</p>""",
        """          <p class="notice">${formatFxReference(quote || fx)}</p>""")
replace("<span class=\"chip\">${phase()} · Time-locked USDC vault</span>", "<span class=\"chip\">${phase() === 'Closing' ? 'Trip ended · Ready to settle' : phase()} · Time-locked USDC vault</span>")
replace("${row('Start',safe(t.startTime.replace('T',' ')))}", "${row('Start',safe(formatShortDateTime(t.startTime)))}")
replace("${row('End',safe(t.endTime.replace('T',' ')))}", "${row('End',safe(formatShortDateTime(t.endTime)))}")
replace("<span class=\"chip violet\">${p}</span>", "<span class=\"${p === 'Closing' ? 'chip warn' : 'chip violet'}\">${p === 'Closing' ? 'Trip ended · Ready to settle' : p}</span>")
replace('<section class="panel"><h2>Demo vault</h2>', '<section class="panel trip-settings-panel"><h2>Demo vault</h2>')
replace("${row('Status',p)}", "${row('Status',p === 'Closing' ? 'Trip ended · Ready to settle' : p)}")
replace('<p class="notice warn notice-prominent">Early withdrawals use only your own balance. You remain a trip member after withdrawing all. After start, deposits are locked until final settlement; top-ups are allowed.</p>', '<p class="notice">Deposits lock after the start time. You can still top up. Early withdrawal is only possible before the start.</p>')
replace("""${btn('Refresh market reference','refresh-fx',{tone:'secondary'})}</section></div>""",
        """${btn('Refresh market reference','refresh-fx',{tone:'secondary'})}</section>${demoMode ? '<div style="margin-top:24px; text-align:center;"><button type="button" class="btn secondary sm" data-act="judge-demo-sample">Reset demo</button></div>' : ''}</div>""")
replace("    const quote = await marketQuote();\n    syncTrips();",
        "    const quote = demoMode ? { rate: 25000, source: 'Fixed demo rate', updated: '', live: false, historical: true } : await marketQuote();\n    syncTrips();")
replace("        fx = quote;\n        lockQuote(trip, quote);",
        "        if (!demoMode) fx = quote;\n        lockQuote(trip, quote);")
replace("  refreshFX();\n  if (!demoMode) enableRooms();",
        "  if (!demoMode) {\n    refreshFX();\n    enableRooms();\n  }")
replace("  discoverWallets();", "  if (!demoMode) discoverWallets();")
replace("  restoreWorkspace(loadWorkspace());", """  if (demoMode) fx = {
    rate: 25000, source: 'Fixed demo rate', updated: '', live: false, historical: true,
  };
  restoreWorkspace(loadWorkspace());""")

replace("  function fujiPanel(section = 'wallet', review = null) {\n    const trip",
        "  function fujiPanel(section = 'wallet', review = null) {\n    if (demoMode) return '';\n    const trip")
replace('!rooms.online && window.location?.protocol', '!demoMode && !rooms.online && window.location?.protocol')

backend = root / 'work/tripvault-room-server/server.js'
generated = backend.read_text(encoding='utf-8').replace('/*ROOM_CONTRACT*/null', json.dumps({
    'runtime': contract['runtime'], 'legacyRuntime': contract['legacyRuntime'], 'deadlineRuntime': contract['deadlineRuntime'],
}))

try:
    (root / 'outputs/TripVault_Rooms_v9.html').write_text(source, encoding='utf-8')
    public_dir = root / 'public'
    public_dir.mkdir(exist_ok=True)
    (public_dir / 'index.html').write_text(source, encoding='utf-8')
    # Keep the standalone GitHub Pages demo on the same UI as the server.
    demo_source = source.replace(
        "const demoMode = new URLSearchParams(window.location?.search || '').get('demo') === '1';",
        "const demoMode = true;", 1)
    demo_source = demo_source.replace('''        <div style="text-align:center; margin-top:12px; font-size:13px; color:var(--subtle);">
          Using a real wallet? <a href="${exitDemoUrl}" class="subtle-link">Open shared-trip mode</a>
        </div>''', '')
    (root / 'docs/index.html').write_text(demo_source, encoding='utf-8')
    (root / 'work/tripvault-v9.js').write_text(source.split('<script>\n', 1)[1].split('</script>', 1)[0], encoding='utf-8')
    (backend.parent / 'entry.js').write_text(generated, encoding='utf-8')
    print("Build output written to workspace.")
except PermissionError:
    import tempfile
    tdir = Path(tempfile.gettempdir()) / 'tripvault_build'
    tdir.mkdir(exist_ok=True)
    (tdir / 'TripVault_Rooms_v9.html').write_text(source, encoding='utf-8')
    (tdir / 'index.html').write_text(source, encoding='utf-8')
    (tdir / 'tripvault-v9.js').write_text(source.split('<script>\n', 1)[1].split('</script>', 1)[0], encoding='utf-8')
    (tdir / 'entry.js').write_text(generated, encoding='utf-8')
    print("Build output written to temp:", tdir)
