# Demo and wallet-room UI verification

Demo is a single sample trip, reached directly from Explore demo trip. All trips returns to the normal wallet-connected home page. It has no separate Demo home, room creation or room-code join flow. The sample renders the same five trip screens and shared wallet/payment card templates as wallet-connected rooms. Demo-specific role switching, reset, and time advancement live in the separate **Demo controls** disclosure below the screen.

| Area | Shared behavior verified in Demo |
| --- | --- |
| Entry and exit | Explore opens the sample directly; All trips exits to the normal home page; sample changes persist without changing real rooms |
| Overview | Common hero, fund summary, progress, members and settings; organizer-only early ending |
| People | Common member list, organizer badge and selected member |
| Bills | Same form and detail layout; equal/custom amounts; required funding; 24-hour review; suggestions and replies; unanimous cancellation with a reason |
| Notifications | Per-member events, individual read state, timestamps, clear action and direct links preserving the selected Demo role; top-up reminders |
| Wallet | Common wallet card, timing notice, funding details and controls; own deposits and withdrawals before the deadline; cancellation refunds and final claims |
| Final split | Common payment card, exact USDC amounts, breakdowns, review dialog, publication with the organizer's approval, member approvals, top-ups, settlement and payout details |

Automated verification: `bun run verify` and `bun run verify:demo`. Both the served HTML and the standalone GitHub Pages Demo are checked. Regression cases include reloads, imported trips, stale publication/top-up selections, pending reviews after early ending, paused 24-hour reviews, cancelled funding, and 0.002 USDC debt without rounding away the transfer.

Browser layout checks use matching fixture data for Demo and wallet-room screens at widths 320, 390 and 1280. Card margins, widths, padding and horizontal overflow are compared for all five tabs, including long trip/member/bill names. Wallet fixtures use simulated RPC state; they do not sign or send live transactions.

The data source differs deliberately: Demo stores simulated balances and member roles in the current browser. It does not authenticate a real wallet, connect different devices to a common room, or send a blockchain transaction. Those operations remain exclusive to shared-trip mode. Demo does not simulate the server's bulk room administration.
