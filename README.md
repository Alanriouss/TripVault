# TripVault

TripVault records expenses paid in VND outside the app. Members deposit USDC into a time-locked trip fund, review the bills that involve them, and settle the net amounts after the trip. The shared-room prototype runs on Avalanche Fuji.

## Run locally

1. Install [Bun](https://bun.com/docs/installation) and reopen your terminal. This release was tested with Bun 1.4.2.
2. Download or clone this repository. In a terminal opened at its root, run:

   ```sh
   bun run start
   ```

3. Leave the terminal running and open [TripVault](http://127.0.0.1:8788/). The runtime bundle and HTML assets are included, so this step needs no package installation, API keys, or environment file.

If port 8788 is occupied, stop the other service or set `TRIPVAULT_PORT` to an unused port and open the URL printed in the terminal. Use the exact host and port shown there for wallet sign-in. Shared room data is stored locally in `work/tripvault-rooms.sqlite3`.

## Review the demo without a wallet

Open [local simulation](http://127.0.0.1:8788/?demo=1), dismiss the guide, and click **Start a fresh sample**. The sample opens with An and Bình, 5 simulated USDC each, and the trip end time already passed for a quick settlement walkthrough.

1. Go to **Bills → Add bill** and record **Lunch**, **100000 VND**, paid by **An**, shared by both.
2. Click the profile avatar to switch between An and Bình. Open the bill and click **Approve bill** as each person.
3. Switch back to An. Open **Final split**, choose **Prepare final split**, then click **Approve split** as each person.
4. Switch back to An and choose **Settle group**. At the fixed demo rate of 25,000 VND per USD, Bình owes An **2 USDC**. The simulated balances after settlement are **7 USDC** for An and **3 USDC** for Bình.

The local simulation uses its own browser storage and a fixed exchange rate. **Start a fresh sample** resets that sample in the current browser.

## Test the shared-room flow on Avalanche Fuji

1. Open [shared-room mode](http://127.0.0.1:8788/) in a browser with an Ethereum-compatible wallet. Use two browser profiles with different accounts if both members are testing on the same computer. Each account needs Fuji AVAX for network fees and Fuji test USDC to deposit.
2. Connect the organizer’s wallet and choose **Create a room**. Pick a deposit deadline, a later start time, and an end time after that. Leave time to join, create the fund, and deposit before the deadline.
3. On the other browser profile, choose **Join a room** with the second wallet and enter the code. After everyone has joined, use **Wallet → Deploy Fuji vault** as the organizer. Confirm the roster and wallet transaction. Each member then deposits their share.
4. After the start, record and review a bill. After the end, each member reviews and approves the final amount. The organizer makes the group payments, and each member can claim their remaining balance in **Wallet**.

## Source and checks

- `outputs/TripVault_Rooms_v9.html` and `outputs/TripVault_Room_Server.mjs` are the runnable release. The HTML design and build inputs are also in `outputs/` and `work/`.
- `work/tripvault-room-server/server.js` and `work/tripvault-room-*.js` contain the room API and interface logic. `work/fuji-contract/src/` contains the Solidity contracts.

To rebuild and run the automated checks, install Python 3, then run these commands from the repository root:

```sh
bun install --cwd work/tripvault-room-server --frozen-lockfile
bun run build
bun run verify
```

The automated tests use simulated wallets and an in-memory database. Bundled dependency notices are in `third-party/`.
