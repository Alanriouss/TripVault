import json
from pathlib import Path

root = Path('.')

def load_contract(path, name='TripVaultFuji'):
    contracts = json.loads((root / path).read_text())['contracts']
    vault = next(value for key, value in contracts.items() if key.endswith(':' + name))
    token = next(value for key, value in contracts.items() if key.endswith(':IFujiUSDC'))
    return {'bytecode': vault['bin'], 'runtime': vault['bin-runtime'], 'selectors': vault['hashes'] | token['hashes']}

def upgrade(source):
    def replace(old, new):
        nonlocal source
        assert source.count(old) == 1, (source.count(old), old[:150])
        source = source.replace(old, new, 1)

    current = load_contract('work/fuji-contract/compiled.json')
    old = load_contract('work/fuji-contract/legacy-compiled.json')
    current['legacyRuntime'] = old['runtime']
    deadline = load_contract('work/fuji-contract/deadline-compiled.json', 'TripVaultDeadline')
    current['deadlineBytecode'] = deadline['bytecode']
    current['deadlineRuntime'] = deadline['runtime']
    current['selectors'].update(deadline['selectors'])
    start = source.index('  const VAULT = ')
    end = source.index('\n', start)
    source = source[:start] + '  const VAULT = ' + json.dumps(current, separators=(',', ':')) + ';' + source[end:]

    replace('providers: new Map(), choices: [], listeners: [], generation: 0,',
            'providers: new Map(), choices: [], listeners: [], generation: 0, vaultRead: 0, readingVault: false,')
    replace("""    return String(error?.shortMessage || error?.message || 'Wallet request failed.').slice(0, 260);""",
            r"""    const message = error?.shortMessage || error?.message || error?.data?.originalError?.message || 'Wallet request failed.';
    const rpcDetails = [message, error?.message, error?.data?.message, error?.data?.originalError?.message, error?.cause?.message].join(' ');
    if (/nonce too low|nonce has already been used/i.test(rpcDetails)) {
      const expected = normalizeFujiNonce(rpcDetails.match(/next nonce\s*:?\s*(0x[0-9a-f]+|[0-9]+)/i)?.[1]);
      const next = expected === null ? '' : ' Fuji reported the next number was ' + BigInt(expected) + '.';
      return 'Fuji already used this transaction number.' + next
        + ' Check wallet Activity for a confirmed deployment before trying again. You can link a confirmed vault.';
    }
    return String(message).slice(0, 260);""")
    start = source.index('  function ethCall(context, address, data)')
    end = source.index('  function currentVault()', start)
    source = source[:start] + '''  function ethCall(context, address, data, block = 'latest') {
    return request(context.provider, 'eth_call', [{ to: address, data }, block]);
  }

  function fujiContractVersion(code) {
    const runtime = code?.toLowerCase();
    if (runtime === '0x' + VAULT.deadlineRuntime) return 3;
    if (runtime === '0x' + VAULT.runtime) return 2;
    return runtime === '0x' + VAULT.legacyRuntime ? 1 : 0;
  }

  function decodeFujiPayouts(raw, count) {
    const data = raw.slice(2);
    const value = index => Number(BigInt('0x' + data.slice(index * 64, (index + 1) * 64)));
    if (data.length !== (count + 2) * 64 || value(0) !== 32 || value(1) !== count) {
      throw new Error('Could not read the Fuji payout amounts.');
    }
    return Array.from({ length: count }, (_, index) => value(index + 2));
  }

  async function fetchVault(context) {
    if (!isAddress(context.vault)) throw new Error('Deploy the Fuji vault first.');
    await checkWallet(context);
    const block = await request(context.provider, 'eth_getBlockByNumber', ['latest', false]);
    const tag = block.number;
    if (!/^0x[0-9a-f]+$/i.test(tag) || !/^0x[0-9a-f]+$/i.test(block.timestamp)) {
      throw new Error('Could not read the latest Fuji block.');
    }
    const [code, raw, rawUsdc] = await Promise.all([
      request(context.provider, 'eth_getCode', [context.vault, tag]),
      ethCall(context, context.vault, vaultCall('snapshot()'), tag),
      ethCall(context, FUJI.usdc, vaultCall('balanceOf(address)', context.account), tag),
    ]);
    const version = fujiContractVersion(code);
    if (!version) throw new Error('The stored address is not a supported TripVault contract.');
    const snapshot = abiDecodeSnapshot(raw);
    if (!snapshot.members.length || snapshot.members.length !== snapshot.balances.length
      || snapshot.members.length !== snapshot.approvals.length
      || (snapshot.net.length && snapshot.members.length !== snapshot.net.length)) {
      throw new Error('Could not read the Fuji vault.');
    }
    let refundDeadline = snapshot.end + REFUND_DELAY;
    const timestamp = Number(BigInt(block.timestamp));
    const depositDeadline = version === 3 ? context.depositDeadline : null;
    let cancelled = false;
    let payouts;
    if (version >= 2) {
      refundDeadline = Number(BigInt(await ethCall(context, context.vault, vaultCall('refundDeadline()'), tag)));
      if (snapshot.settled) {
        const rawPayouts = await ethCall(context, context.vault, vaultCall('payoutSnapshot()'), tag);
        payouts = decodeFujiPayouts(rawPayouts, snapshot.members.length);
      }
    }
    if (depositDeadline && timestamp >= depositDeadline) {
      cancelled = BigInt(await ethCall(context, context.vault, vaultCall('fundingFailed()'), tag)) === 1n;
    }
    await checkWallet(context);
    return {
      ...snapshot, version, refundDeadline, payouts, timestamp, depositDeadline, cancelled, usdc: BigInt(rawUsdc),
      account: context.account, address: context.vault, tripId: context.tripId,
    };
  }

''' + source[end:]
    start = source.index('  async function refreshVault()')
    end = source.index('  function rememberFujiTx', start)
    source = source[:start] + '''  function vaultViewState(vault) {
    if (!vault) return '';
    return JSON.stringify([
      vault.tripId, vault.account, vault.address, vault.version, vault.hash, vault.balances,
      vault.approvals, vault.net, vault.payouts, vault.settled, vault.cancelled, vault.usdc.toString(), vault.end,
      vault.depositDeadline && vault.timestamp >= vault.depositDeadline,
      vault.timestamp < vault.start, vault.timestamp >= vault.end, vault.timestamp >= vault.refundDeadline,
    ]);
  }

  async function refreshVault(silent = false) {
    const context = walletContext();
    const generation = walletSession.generation;
    if (!context.vault || !context.account || walletSession.chain !== FUJI.id
      || (silent && walletSession.readingVault)) return;
    const read = ++walletSession.vaultRead;
    walletSession.readingVault = true;
    const stillCurrent = () => walletSession.vaultRead === read && walletSession.generation === generation
      && state.trip?.id === context.tripId && walletSession.account === context.account
      && state.trip.fuji?.address === context.vault;
    try {
      const result = await fetchVault(context);
      if (stillCurrent()) {
        const changed = vaultViewState(currentVault()) !== vaultViewState(result);
        walletSession.vault = result;
        if (changed || !silent) render();
        return true;
      }
    } catch (error) {
      if (stillCurrent() && !silent) {
        walletSession.vault = null;
        if (!walletSession.busy) walletStatus(context.tripId, 'failed', 'Read Fuji vault', walletError(error));
      }
    } finally {
      if (walletSession.vaultRead === read) walletSession.readingVault = false;
    }
  }

''' + source[end:]
    replace("""          if (code?.toLowerCase() !== '0x' + VAULT.runtime) {""", """          if (!fujiContractVersion(code)) {""")
    replace("  async function sendFuji(context, label, kind, to, data, revision) {", """  function normalizeFujiNonce(value) {
    if (value && typeof value === 'object') value = value.result;
    const valid = typeof value === 'bigint' || (typeof value === 'number' && Number.isSafeInteger(value))
      || (typeof value === 'string' && /^(?:0x[0-9a-f]+|[0-9]+)$/i.test(value.trim()));
    if (!valid) return null;
    const count = BigInt(value);
    if (count < 0n || count >= (1n << 64n)) return null;
    return '0x' + count.toString(16);
  }

  async function nextFujiNonce(context) {
    if (context.shared) {
      if (rooms.account !== context.account || !rooms.token) return null;
      try {
        const result = await roomApi('/wallet/fuji-nonce');
        return normalizeFujiNonce(result.nonce);
      } catch {
        // Leave the number to the wallet if the server cannot verify it on Fuji.
        return null;
      }
    }
    let timeout;
    try {
      const result = await Promise.race([
        request(context.provider, 'eth_getTransactionCount', [context.account, 'pending']),
        new Promise(resolve => { timeout = setTimeout(() => resolve(null), 3000); }),
      ]);
      const nonce = normalizeFujiNonce(result);
      if (nonce !== null) return nonce;
    } catch {
      // Leave the number to the wallet in the standalone demo.
    } finally {
      clearTimeout(timeout);
    }
    return null;
  }

  function fujiGasFailure(error) {
    const nested = error?.data?.originalError;
    const parts = [error?.message, nested?.message, error?.data?.message, error?.data, nested?.data]
      .filter(value => typeof value === 'string').join(' ');
    if (/0xdba16ce8|InvalidSchedule/i.test(parts)) {
      return 'Fuji rejected the trip schedule. Check the deposit deadline, start time, and end time.';
    }
    if (/insufficient funds|insufficient balance|funds for gas/i.test(parts)) {
      return 'This wallet needs more Fuji test AVAX to pay the network fee.';
    }
    if (error?.code === 3 || nested?.code === 3 || /execution reverted|will fail|always failing transaction/i.test(parts)) {
      return 'Fuji would reject this transaction. Check the trip status and try again.';
    }
    return '';
  }

  async function estimateFujiGas(context, transaction) {
    const valid = value => typeof value === 'string' && /^0x[0-9a-f]+$/i.test(value)
      && BigInt(value) >= 21_000n && BigInt(value) < (1n << 64n);
    let estimate;
    let timeout;
    try {
      estimate = await Promise.race([
        request(context.provider, 'eth_estimateGas', [transaction]),
        new Promise(resolve => { timeout = setTimeout(() => resolve(null), 3000); }),
      ]);
    } catch (error) {
      const reason = fujiGasFailure(error);
      if (reason) throw new Error(reason);
    } finally {
      clearTimeout(timeout);
    }
    if (!valid(estimate)) {
      const controller = new AbortController();
      const stop = setTimeout(() => controller.abort(), 5000);
      let result;
      try {
        const response = await fetch(FUJI.rpc, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_estimateGas', params: [transaction] }),
        });
        if (response.ok) result = await response.json();
      } catch {
        // Report a missing estimate in TripVault if both sources are unavailable.
      } finally {
        clearTimeout(stop);
      }
      if (!valid(result?.result)) {
        throw new Error(fujiGasFailure(result?.error) || 'Could not estimate the Fuji network fee. Check your connection and try again.');
      }
      estimate = result.result;
    }
    const gas = (BigInt(estimate) * 115n + 99n) / 100n;
    return '0x' + gas.toString(16);
  }

  async function sendFuji(context, label, kind, to, data, revision) {""")
    replace("""    const tx = { kind, label, from: context.account, revision };
    transactionStatus(context, tx, 'signature', 'Review and confirm in your wallet.');
    const params = { from: context.account, data };
    if (to) params.to = to;""", """    const transaction = { from: context.account, data };
    if (to) transaction.to = to;
    const gas = await estimateFujiGas(context, transaction);
    await checkWallet(context);
    if (state.trip?.id !== context.tripId) throw new Error('Return to the original trip to continue.');
    const nonce = await nextFujiNonce(context);
    await checkWallet(context);
    if (state.trip?.id !== context.tripId) throw new Error('Return to the original trip to continue.');
    if (kind === 'deploy' && context.depositDeadline && Date.now() >= context.depositDeadline * 1000) {
      throw new Error('The deposit deadline has passed.');
    }
    const params = { ...transaction, gas };
    const tx = { kind, label, from: context.account, revision };
    transactionStatus(context, tx, 'signature', 'Review and confirm in your wallet.');
    if (nonce !== null) params.nonce = nonce;""")
    replace("""    const end = Math.floor(Date.parse(trip.endTime) / 1000);
    if (end <= Date.now() / 1000) {
      fail('Choose a trip with an end time in the future.');
      return;
    }""", """    const end = Math.floor(roomEndTime(trip) / 1000);""")
    replace("""      if (index < 0 || vault.settled || vault.timestamp >= vault.end + REFUND_DELAY) {""", """      if (index < 0 || vault.settled || vault.timestamp >= vault.refundDeadline) {""")
    replace("""      if (index < 0 || vault.timestamp >= vault.start || units > vault.balances[index]) {""",
            """      if (index < 0 || vault.timestamp >= Math.min(vault.start, vault.end) || units > vault.balances[index]) {""")
    source = source.replace('vault.timestamp >= vault.end + REFUND_DELAY', 'vault.timestamp >= vault.refundDeadline')
    source = source.replace('vault.timestamp < vault.end + REFUND_DELAY', 'vault.timestamp < vault.refundDeadline')
    start = source.index("  function fujiPanel(section = 'wallet')")
    end = source.index('  function handleFujiAction', start)
    panel = (root / 'work/tripvault-room-fuji-panel.js').read_text()
    source = source[:start] + panel + '\n' + source[end:]
    return source, current
