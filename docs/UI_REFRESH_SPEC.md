# TripVault UI & Display Content Specification

**Version:** 2.0  
**Status:** Ready for Implementation  
**Target Viewport:** Mobile-first (`390px` width) & Desktop Responsive  

---

## 1. Executive Summary & Objectives

This specification defines UI layout improvements, copy refinements, and terminology standardization for **TripVault**. The goal is to make the onboarding, bill-logging, and settlement flows immediately clear to first-time users and judges while strictly preserving all underlying cryptographic, smart contract (Avalanche Fuji), funding math, and SQLite backend logic.

---

## 2. Architecture & Guardrails for Agent

* **Build Pipeline:** Apply changes at the source level (`work/build-tripvault-rooms.py` and `work/*.js`), then compile the output HTML/bundle by running `python work/build-tripvault-rooms.py` followed by `bun run build` (verify `package.json` scripts if applicable). Never edit generated files in `outputs/` directly without updating the build script.
* **CSS Hygiene:** Reuse existing CSS classes, variables (`--ink`, `--subtle`, etc.), and component styles from the codebase. Avoid heavy inline `style=""` attributes; define clean reusable classes in the stylesheet where needed.
* **Relative Navigation:** Never hardcode root-relative paths like `href="/"` for mode switching. Construct URLs dynamically from `window.location.pathname` (adding or removing `?demo=1`) so subpath deployments do not break.
* **Contract & State Integrity:** Do not alter smart contract calls, settlement calculations, or state transitions—only update presentation, copy, and conditional UI rendering.

---

## 3. Canonical Terminology & Status Glossary (Global)

To eliminate confusion across the UI, Guide modal, and `README.md`, enforce a single canonical term per concept:

| Concept | Canonical Term | Deprecated / Avoid | Notes |
| :--- | :--- | :--- | :--- |
| Group event / shared space | **Trip** | Room | Use `Create a trip`, `Your trips`, `Open shared-trip mode` (or keep internal route IDs unchanged while updating user-facing copy). |
| Pooled USDC balance | **Vault** / **Shared fund** | Escrowed vault (in UI) | Use `Shared fund` in plain-language explanations and `Vault` for the on-chain/demo balance container. |
| Status: `Closing` | **Trip ended · Ready to settle** | `Closing` | Reflects `now >= endTime` with settlement pending. |
| Status: `Draft` | **Draft · Pending approvals** | Bare `Draft` | Clarifies that final settlement is waiting on bill/balance approvals. |
| Status: `Revision 1` | **Revision 1** *(with helper text)* | Bare `Revision 1` | Add subtle helper/tooltip text (e.g., `Updated automatically as bills change`) or format cleanly as `Settlement draft (v1)`. |

---

## 4. Detailed Implementation Plan by Priority

### Priority 1 (High): Landing Screen & Onboarding Card
**Target:** `work/build-tripvault-rooms.py` (Landing view when `!trip`)

1. **Replace `.section-head` with Structured Value-Prop Card:**
   * Whenever `!trip` is active in demo mode (regardless of whether `state.trips.length` is `0` or `> 0`, so returning via the `Trips` nav item also renders cleanly), replace the `"TripVault demo / Try a local simulation..."` block with a clean `.card` containing:
     * **Header:** Brand mark (`TV`) + `TripVault` (`<h1>`)
     * **1-Sentence Description:** `Shared trip fund: everyone deposits first, you log bills as you go, and the app settles once at the end.`
     * **3 Numbered Steps (`<ol>`):**
       1. `Deposit USDC into the fund`
       2. `Log bills and approve them`
       3. `Settle everyone in one step`
2. **Full-Width Primary CTA:**
   * Place the `"Start a fresh sample"` button (`[data-act="judge-demo-sample"]`) directly below the 3-step list inside the card.
   * Style it full-width (`width: 100%`) as the single dominant action.
3. **Demote Secondary Wallet Mode Link:**
   * Remove the prominent red-underlined `"Open shared-room mode"` button/link.
   * Place a subtle helper line centered below the primary CTA (`13px` font size, `color: var(--subtle)`):
     `Using a real wallet? Open shared-trip mode`
   * Style the interactive link portion (`Open shared-trip mode`) with `font-weight: 500; color: var(--ink); text-decoration: none;` (showing `text-decoration: underline` on `:hover`) so it retains clear click affordance without competing with the primary button.
   * Clicking this link must navigate to the current pathname without the `demo=1` query parameter.

---

### Priority 2 (High): Remove Repeated Demo Bar Inside Active Trips
**Target:** `work/build-tripvault-rooms.py`

1. **Restrict `.judge-demo-actions` Visibility:**
   * Render the top demo action bar **only** on the landing screen (`!trip`).
   * Completely hide/omit it across all active trip tabs: **Overview**, **People**, **Bills**, **Final split**, and **Wallet**.
2. **Provide Relocated Reset Control:**
   * In `demoMode`, render a subtle secondary button (`Reset demo`, `data-act="judge-demo-sample"`) at the bottom of the **Wallet** tab (and optionally inside the `Trips` menu) so judges can still reset sample data on demand.

---

### Priority 3 (High): Final Split Empty State & FX Rate Formatting
**Target:** `work/build-tripvault-rooms.py` (Final split tab)

1. **Empty State Card When No Bills Are Approved:**
   * Compute `const approvedBills = (trip.bills || []).filter(b => b.status === 'approved');`.
   * When `approvedBills.length === 0`:
     * Render a prominent empty state card at the top of the **Final split** view:
       * **Title:** `Nothing to split yet`
       * **Body:** `Add your first bill in the Bills tab. Balances and transfers appear here once bills are approved.`
       * **Action Button:** `Go to Bills` with attributes `data-act="navigate" data-view="bills"`.
     * Dim (`opacity: 0.55`) or collapse the all-zero `Net balances` and transfer preview panels so users are not confused by `0 ₫` rows.
   * Automatically hide this empty state card and restore full opacity once `approvedBills.length > 0`.
2. **Simplify Reference FX Rate Note:**
   * Replace `"Estimate 25,640.2 VND / USD Xe 11/11/2026 07:00 not live"` with:
     `Reference rate: 25,640 VND per USD (Xe, 11/11 07:00)`
   * Format the rate as a rounded integer (`Math.round(...)` with thousands separator), format timestamp as `DD/MM HH:mm` (omitting year), and remove `"not live"`.

---

### Priority 4 (Medium): Guide Modal Layout & Copy Simplification
**Target:** `work/tripvault-rooms-guide.js`

1. **Fix Cropped / Squished Illustration:**
   * Add `flex-shrink: 0; min-height: 180px;` to `.guide-illustration` so the mockup artwork is never compressed when modal text expands.
2. **Remove Duplicate Navigation Text in Step 1 Title:**
   * Change `"Step 1. Create a room (Your trips → Create a room)"` to `"Step 1. Create a trip"` (aligning with Section 3 terminology and avoiding repetition with the instruction line below it).
3. **Condense "Purpose of TripVault" Box:**
   * Remove jargon (`escrowed vault`, `3 milestones`, `complete group events (1+ days)`).
   * Replace with 1 bold summary sentence and 2 concise bullet points:
     * **Bold lead:** `A shared fund for multi-day trips.`
     * **Bullet 1:** `Name the trip and set the minimum deposit.`
     * **Bullet 2:** `Pick 3 dates: deposit deadline, start, end.`

---

### Priority 5 (Medium): Wallet & Vault Tab Clarity
**Target:** `work/build-tripvault-rooms.py` (Wallet tab)

1. **Deterministic Local Short Date/Time (`DD/MM HH:mm`):**
   * Replace raw ISO timestamps (`2026-11-18 03:55:00.164Z`) for **Start** and **End** with a `formatShortDateTime(iso)` helper using `Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })` to guarantee `DD/MM HH:mm` (e.g., `18/11 10:55`) in the user's local timezone regardless of browser locale.
2. **Shorten Deposit / Early Withdrawal Notice:**
   * Replace the 4-sentence technical warning block with 3 crisp sentences:
     `Deposits lock after the start time. You can still top up. Early withdrawal is only possible before the start.`
3. **Human-Readable Status Badge:**
   * Map the internal `Closing` phase badge to `Trip ended · Ready to settle` using an amber/warning badge style.

---

### Priority 6 (Low): Global Metadata & Documentation Cleanup
**Target:** `work/build-tripvault-rooms.py`, `README.md`

1. **HTML Document Metadata:**
   * Update `<title>` from `"TripVault Rooms"` to `TripVault · Shared Trip Fund`.
   * Update `<meta name="description">` to a clean 1-sentence product description (removing `"prototype"`):
     `Shared trip fund for groups: deposit USDC upfront, log bills as you go, and settle everyone in one step.`
2. **Documentation & Copy Sweep:**
   * Update `README.md` and remaining UI labels/buttons to follow the Canonical Terminology table in Section 3 (`Trip` instead of `Room`, consistent `Vault` / `Shared fund` usage).

---

## 5. Verification Checklist

1. **Build Verification:** Run `python work/build-tripvault-rooms.py` and `bun run build`; confirm zero errors or assertion failures.
2. **Mobile Viewport (`390px`):**
   * Verify Landing card fits cleanly without horizontal overflow, primary CTA is full-width, and secondary wallet link is legible and clickable.
   * Open Guide modal (`?demo=1`) and confirm `.guide-illustration` renders at full height without clipping.
   * Enter a sample trip and confirm `.judge-demo-actions` is hidden on **Overview**, **People**, **Bills**, **Final split**, and **Wallet**.
   * Check **Final split** with `0` approved bills (empty state card + `Go to Bills` button visible; integer FX rate formatted properly), then approve a bill and confirm the empty state card disappears.
   * Check **Wallet** tab for local `DD/MM HH:mm` dates, 3-sentence deposit notice, `Trip ended · Ready to settle` badge, and bottom `Reset demo` button.
3. **Navigation Edge Cases:**
   * Click `Trips` from inside a demo trip and verify the Landing card renders properly.
   * Click `Open shared-trip mode` and confirm `?demo=1` is cleanly removed without breaking relative paths.