[README.md](https://github.com/user-attachments/files/34852275/README.md)
# TripVault

TripVault records expenses paid in VND outside the app. Members deposit USDC into a time-locked trip fund, review the bills that involve them, and settle the net amounts after the trip. The shared-room prototype runs on Avalanche Fuji.

## Start here for judging

| What you want to test | How to open it |
| --- | --- |
| **Laptop with a real wallet** | Follow [the laptop setup](#run-tripvault-on-a-fresh-computer), then open [http://127.0.0.1:8788/](http://127.0.0.1:8788/) in a browser with a wallet extension. Your laptop runs its own copy. |
| **Phone with a real wallet** | Open a TripVault HTTPS link inside your wallet app’s browser. Follow [the phone wallet steps](#test-a-real-wallet-on-a-phone) to use the team’s temporary link or create one from your own laptop. |
| **Quick demo with simulated balances** | Open [http://127.0.0.1:8788/?demo=1](http://127.0.0.1:8788/?demo=1) after starting the app. Follow [the sample walkthrough](#first-demo-walkthrough). |

### Test a real wallet on a phone

**During a live demo**, open the [team’s temporary TripVault link](https://always-upon-ultra-pan.trycloudflare.com/) on either a laptop or a phone. On a laptop, use a browser with your wallet extension. On a phone, copy the link into your wallet’s built-in browser. The link depends on the team’s demo server and tunnel staying online. If it is unavailable, use the steps below to run your own session. [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)

**Run your own phone test.** The team’s MacBook can be off. Your laptop runs TripVault and keeps the HTTPS link available for your phone.

1. Download the repository and install Bun using [the laptop setup](#run-tripvault-on-a-fresh-computer). Install [`cloudflared` for your operating system](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/downloads/). If TripVault is already running locally, press **Ctrl + C** in its terminal before restarting it in step 3.
2. In one terminal, run the following command. Leave this terminal open and copy the `https://…trycloudflare.com` link it prints.

   ```sh
   cloudflared tunnel --protocol http2 --url http://127.0.0.1:8788
   ```

3. Open a second terminal in the folder containing `package.json`. Replace `https://YOUR-TUNNEL.trycloudflare.com` with the exact link from step 2 so the wallet can verify the sign-in address. Leave both terminals open.

   **macOS or Linux**

   ```sh
   TRIPVAULT_ORIGIN="https://YOUR-TUNNEL.trycloudflare.com" bun run start
   ```

   **Windows PowerShell**

   ```powershell
   $env:TRIPVAULT_ORIGIN = "https://YOUR-TUNNEL.trycloudflare.com"
   bun run start
   ```

4. On your phone, copy the HTTPS link into the wallet’s built-in browser. In **MetaMask Mobile**, tap **Explore**, then open the browser and paste the link. In TripVault, tap **Connect Wallet**, switch to **Avalanche Fuji** if prompted, and choose **Create a trip**. Sign the login message when asked. A trip with a **six-digit invite code** confirms that wallet sign-in worked. Creating the trip only requires a signature and uses no gas. [MetaMask Mobile browser guide](https://support.metamask.io/configure/wallet/how-to-use-the-metamask-mobile-browser/)
5. To test across devices, open the **same HTTPS link** in your laptop browser with a different wallet account, click **Join a trip**, and enter the six-digit code. Continue with [the shared-trip flow](#test-the-shared-trip-flow-on-avalanche-fuji) if you want to test deposits and settlement using Fuji test tokens.

If you restart the tunnel, Cloudflare gives you a new link. Update `TRIPVAULT_ORIGIN` and restart TripVault before signing in again. [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)

## Mobile simulation

### Try the mobile demo over Wi-Fi

1. Connect your Mac and phone to the same Wi-Fi. On the Mac, open the project folder in Terminal as described below. If TripVault is already running on port 8788 in that terminal, press **Ctrl + C** to stop it.
2. Start TripVault so the phone can reach the Mac on your network.

   ```sh
   TRIPVAULT_HOST=0.0.0.0 bun run start
   ```

3. On the Mac, open **System Settings → Wi-Fi → Details → TCP/IP** and note the Mac’s IPv4 address. [Apple’s Wi-Fi settings guide](https://support.apple.com/guide/mac-help/mh11935/mac)
4. On the phone, open Safari or Chrome at `http://<MAC-IP>:8788/?demo=1`. Replace `<MAC-IP>` with the address from step 3. For example, if the Mac’s address is `192.168.1.23`, open `http://192.168.1.23:8788/?demo=1`. Keep the Mac awake and Terminal open.
5. Dismiss the guide and tap **Start a fresh sample**. Follow the demo walkthrough below using the menu at the bottom of the screen. This Wi-Fi path is for the simulation.

### Share a mobile demo link with judges

The repository includes a static demo at [`docs/index.html`](docs/index.html). To publish it with **GitHub Pages**, upload the `docs/` directory to the repository. Go to **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/docs`, then click **Save**. When GitHub displays the published HTTPS link, test it on a phone and share it with the judges. This works on GitHub Free for a public repository. [GitHub Pages publishing guide](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

Judges can open the published link in Safari or Chrome and tap **Start a fresh sample**. The Pages demo uses simulated balances saved in each browser. For shared rooms, wallet sign-in, and Fuji transactions on mobile, host the bundled Bun server at a public HTTPS address, set `TRIPVAULT_ORIGIN` to that exact address, and open it in a mobile wallet’s built-in browser. [What GitHub Pages hosts](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

## Run TripVault on a fresh computer

The bundled app needs Bun and a web browser. You can run the demo without installing project dependencies, creating an account, connecting a wallet, or setting API keys. This release was tested on macOS with Bun 1.4.2.

### 1. Download and extract the project

On the GitHub repository page, choose **Code → Download ZIP**. Double-click the ZIP in Finder on macOS, or right-click it and choose **Extract All** on Windows. Open the extracted folder. You should see `README.md`, `package.json`, and the `outputs/` and `work/` folders at the same level.

### 2. Install and verify Bun

If `bun --version` already prints a version number, go to step 3. Otherwise, run the installer for your operating system. [Official Bun installation guide](https://bun.com/docs/installation)

**macOS or Linux.** On macOS, press **⌘ + Space**, search for **Terminal**, and press **Return**. On Linux, open your terminal app. Paste this command and press **Return**:

```sh
curl -fsSL https://bun.com/install | bash
```

**Windows.** Open **PowerShell** from the Start menu. Paste this command and press **Enter**:

```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

Close and reopen the terminal, then run:

```sh
bun --version
```

Continue once you see a version number. If the command is still missing, follow the PATH instructions printed by the installer. [Bun PATH setup](https://bun.com/docs/installation#add-bun-to-your-path)

### 3. Open the project folder in your terminal

- **macOS.** Type `cd` followed by one space. Drag the extracted folder that contains `package.json` from Finder into Terminal. Press **Return**.
- **Windows.** Open the folder containing `package.json` in File Explorer. Click the address bar, type `powershell`, and press **Enter**. PowerShell opens in that folder.
- **Linux.** Open a terminal in the extracted folder that contains `package.json`.

Run `ls` on macOS or Linux, or `dir` on Windows. Confirm that `package.json` and `README.md` are both listed.

### 4. Start the app

```sh
bun run start
```

When the terminal prints `TripVault Rooms: http://127.0.0.1:8788`, keep it open and go to [the local demo](http://127.0.0.1:8788/?demo=1) in your browser. To stop the server when finished, press **Ctrl + C** in the terminal. The address works on the computer running the command.

## First demo walkthrough

1. In [the local demo](http://127.0.0.1:8788/?demo=1), dismiss the guide if it appears. Select **English** from the language menu in the header so the labels match this guide. Click **Start a fresh sample**. An and Bình each start with **5 simulated USDC**. The sample trip has already ended so you can try settlement immediately.
2. Go to **Bills → Add bill**. Enter **Lunch**, enter **100000** in the VND amount field, select **An** as the payer, keep **An** and **Bình** selected, then click **Save bill**.
3. Open **Lunch**, click **Approve bill** as An, and close the bill. Click An’s avatar in the top-right corner, choose **Bình**, then open **Lunch** and click **Approve bill** again.
4. Close the bill and switch back to **An** using the avatar. Go to **Final split → Prepare final split → Approve split**. Switch to **Bình** and click **Approve split** as him as well.
5. Switch back to **An** and click **Settle group**. The demo rate is **25,000 VND per USD**, so Bình owes An **2 USDC**. To verify, open **Wallet → Demo vault** and check **Your deposited balance** before clicking **Claim refund**. An should have **7 USDC** and Bình should have **3 USDC** after you switch to his profile.

**Start a fresh sample** resets the sample in the current browser.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| `bun: command not found` or `bun is not recognized` | Install Bun in step 2 and reopen the terminal. |
| Bun cannot find the `start` script | Repeat step 3 and confirm that the folder lists `package.json`. |
| The browser shows **Unable to connect** or **Connection refused** | Run `bun run start` and keep the terminal open. Use the address displayed there. |
| Bun says port 8788 is in use | Use port 8789 with the command below for your operating system, then open [the demo on port 8789](http://127.0.0.1:8789/?demo=1). |
| The page asks you to connect a wallet | Add `?demo=1` at the end of the address and click **Start a fresh sample**. |

On macOS or Linux:

```sh
TRIPVAULT_PORT=8789 bun run start
```

On Windows PowerShell:

```powershell
$env:TRIPVAULT_PORT = "8789"
bun run start
```

## Test the shared-trip flow on Avalanche Fuji

1. Open [shared-trip mode](http://127.0.0.1:8788/) in a browser with an Ethereum-compatible wallet. Use two browser profiles with different accounts if both members are testing on the same computer. Each account needs Fuji AVAX for network fees and Fuji test USDC to deposit.
2. Connect the organizer’s wallet and choose **Create a trip**. Pick a deposit deadline, a later start time, and an end time after that. Leave time to join, create the fund, and deposit before the deadline.
3. On the other browser profile, choose **Join a trip** with the second wallet and enter the code. After everyone has joined, use **Wallet → Deploy Fuji vault** as the organizer. Confirm the roster and wallet transaction. Each member then deposits their share.
4. After the start, record and review a bill. Once the trip has ended and bill reviews are complete, the organizer opens **Final split** and chooses **Calculate final amounts → Review payment amounts → Share amounts for approval**. Each other member chooses **Approve my amount** and tops up if prompted. The organizer chooses **Make group payments**, and each member can send their remaining balance to their wallet.

For wallet sign-in, use the exact host and port printed in the terminal. Shared-room data is stored locally in `work/tripvault-rooms.sqlite3`.

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
