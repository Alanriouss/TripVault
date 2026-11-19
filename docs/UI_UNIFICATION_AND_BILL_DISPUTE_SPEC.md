# TripVault UI Unification & Bill Dispute Specification

**Status:** Approved by User  
**Version:** 1.0  
**Scope:** Demo vs. Real Wallet (Fuji / Room Server) UI Harmonization & 2-Way Bill Approval/Dispute Workflow  

---

## 1. Executive Summary & Purpose

This specification addresses UI divergence between TripVault's **Demo mode** (`demoMode = true`) and **Real Wallet mode** (`trip.shared = true` on Avalanche Fuji / Room Server). It adopts a unified component architecture so both modes share a single source of truth for visual layout, styling, and status reporting, while preserving all underlying on-chain smart contract, cryptographic, and mathematical calculation logic.

Additionally, this document defines the 2-way bill approval flow: enabling participants to reject/dispute a bill with a recorded reason, mediate off-app, and either edit the bill for re-approval or permanently cancel it.

---

## 2. Decision Log

1. **UI Standardization Base**: Standardize the entire application on the modern, card-based layout proven in the Demo version, upgrading the Real Wallet mode to match its visual polish and information density.
2. **2-Way Bill Approval & Dispute Mechanism**:
   - Provide explicit **[Approve]** (green) and **[Disapprove / Reject]** (red) buttons in the bill detail sheet.
   - Disapproving requires entering a brief reason (e.g., *"I did not consume this item"*).
   - If consensus is reached off-app, the bill creator edits the bill, resetting approvals so everyone reviews the revised version.
   - If no consensus is reached, the bill is cancelled/rejected permanently and excluded from the final settlement.
3. **Consolidated Component Architecture (Approach 1)**: Merge dual render functions (`overview` vs `roomOverview`, `people` vs `roomMembers`, `split` vs `roomFinalSplit`) into unified screens with conditional feature slots (e.g., wallet address chip, Fuji action panel, invite card).

---

## 3. Screen-by-Screen Specifications

### 3.1. Landing Screen (`!trip`)
- **Shared Value-Prop Card**:
  - Header with Brand mark (`TV`) and title (`TripVault`).
  - 1-sentence value proposition: *"Shared trip fund: everyone deposits first, you log bills as you go, and the app settles once at the end."*
  - 3 numbered steps:
    1. *Deposit USDC into the fund*
    2. *Log bills and approve them*
    3. *Settle everyone in one step*
- **Real Wallet Mode (`!demoMode`)**:
  - Primary button: **[Create a trip]** (`room-create`)
  - Secondary button: **[Join a trip]** (`room-join`)
  - Subtle text link below: *"Looking for a quick simulation? Try a local demo"* (navigates to `?demo=1`).
  - Deprecate and remove old orientation banner and dashed Đà Lạt preview card.
- **Demo Mode (`demoMode`)**:
  - Primary button: **[Start a fresh sample]** (`judge-demo-sample`).
  - Subtle text link below: *"Using a real wallet? Open shared-trip mode"*.

---

### 3.2. Overview Screen (`state.view === 'overview'`)
- **Shared Financial Metrics (4 Cards)**:
  1. `Vault deposits`: Total USDC deposited into the shared fund.
  2. `Approved expenses`: Total approved expenses in VND.
  3. `You paid`: Total amount paid out-of-pocket by the current user in VND.
  4. `Your net`: Net balance of the current user in VND (green positive / red negative).
- **Recent Bills Panel**: Displays the 3 most recent bills with status badges and a **[View all]** button linking to the Bills tab.
- **Record a Payment Card**: Quick CTA button **[Add a bill]**.
- **Real Wallet Slots**:
  - Include the compact **[Invite Card]** (`roomInviteCard`) showing room code and invite link.
  - Remove redundant full member list from Overview (now solely owned by the People tab).

---

### 3.3. People Screen (`state.view === 'people'`)
- **Standardized Section Header**: *"People — Who paid, who owes, and each member's net position."*
- **Unified Member Row Format**:
  - **Left**: Member avatar + Name (with `· You` indicator) + Shortened wallet address (`0x12..ab` for wallet trips) + `Organizer` chip if applicable.
  - **Subtext**: *"Paid [X] VND · Owes [Y] VND · Deposited [Z] USDC"*
  - **Right**: Net balance formatted in VND (`money-positive` for credit, `money-negative` for debit).

---

### 3.4. Bills Screen & Dispute Workflow (`state.view === 'bills'`)
- **Status Badges**:
  - `Approved` (`.status-approved` / green check): Counted toward trip expenses.
  - `Pending` (`.status-pending` / yellow clock): Awaiting member approvals.
  - `Disputed / Rejected` (`.status-rejected` / red warning): Excluded from settlement calculations until resolved.
- **Detail Sheet Actions**:
  - Two primary buttons: **[Approve bill]** and **[Disapprove bill]**.
  - Clicking **[Disapprove bill]** prompts for a brief reason. The bill status updates to `disputed`, displaying the author's rejection reason in a warning callout.
  - Action **[Edit bill]**: Allows updating amounts or participant lists; saving resets approvals to `pending`.
  - Action **[Cancel bill]**: Permanently sets status to `rejected`, removing it from blocking settlement.

---

### 3.5. Final Split Screen (`state.view === 'split'`)
- **Empty State Card**: When zero bills are approved, render the *"Nothing to split yet"* card with a direct CTA to the Bills tab.
- **Canonical Status Chips**: Enforce standard nomenclature: `Draft · Pending approvals`, `In review`, `Settled`.
- **Pending Bill Guard**: If any bill remains `pending` or `disputed`, disable settlement action buttons and display: *"Finish open bill reviews before making final payments."*
- **Real Wallet Slot**: Embed `fujiPanel('split')` for contract interaction when on Fuji.

---

## 4. Technical Constraints & Build Verification

1. **Source-Level Changes**: Apply all edits inside `work/tripvault-rooms-ui.js`, `work/tripvault-room-bill-ui.js`, and `work/build-tripvault-rooms.py`.
2. **Build Pipeline**: Compile output using `python work/build-tripvault-rooms.py` to regenerate `public/index.html` and `outputs/TripVault_Rooms_v9.html`.
3. **Automated Testing**: Verify that `npm test` / `bun test` passes without mathematical or logic regressions.
