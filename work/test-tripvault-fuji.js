import assert from 'node:assert/strict';

const A = '0x' + '11'.repeat(20);
const B = '0x' + '22'.repeat(20);
const TOKEN = '0x5425890298aed601595a70ab815c96711a31bc65';
const VAULT_ADDRESS = '0x' + '33'.repeat(20);
const PLAN = '0x' + 'ab'.repeat(32);
const FUJI = '0xa869';
const SCALE = 1_000_000;
const word = value => BigInt.asUintN(256, BigInt(value)).toString(16).padStart(64, '0');

function snapshot({ deposits, balances, net, approvals, hash, start, end, closed }) {
  const lists = [deposits, balances, net, approvals];
  let offset = 9 * 32;
  const offsets = lists.map(items => {
    const position = offset;
    offset += (items.length + 1) * 32;
    return word(position);
  });
  const encoded = lists.map(items => word(items.length) + items.map(word).join('')).join('');
  return '0x' + offsets.join('') + hash.slice(2) + word(start) + word(end) + word(5 * SCALE) + word(closed ? 1 : 0) + encoded;
}

function fakeWallet(artifact, timeEnd) {
  const state = {
    chain: '0xa86a', account: A, sent: [], receipts: new Map(), txId: 0,
    rejectNext: false, revertNext: false, holdSign: null, holdReceipt: null,
    timestamp: timeEnd - 4000, start: timeEnd - 3600, end: timeEnd, refundDeadline: timeEnd + 604800, payouts: [], nextNonce: 5, staleOnce: false, nonceFormat: "hex",
    members: [A, B], balances: [0, 0], net: [], approvals: [0, 0],
    hash: '0x' + '00'.repeat(32), closed: false, deployed: false,
    token: { [A]: 100 * SCALE, [B]: 100 * SCALE }, allowance: {},
  };
  const listeners = new Map();
  const provider = {
    on(name, fn) { listeners.set(name, fn); },
    removeListener(name) { listeners.delete(name); },
    async request({ method, params }) {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [state.account];
        case 'eth_chainId':
          return state.chain;
        case 'wallet_switchEthereumChain':
          state.chain = params[0].chainId;
          listeners.get('chainChanged')?.(state.chain);
          return null;
        case 'eth_getBlockByNumber':
          return { number: '0x22', timestamp: '0x' + state.timestamp.toString(16) };
        case 'eth_getTransactionCount':
          assert.deepEqual(Array.from(params), [state.account, 'pending']);
          if (state.nonceFormat === 'number') return state.nextNonce;
          if (state.nonceFormat === 'unavailable') return null;
          return '0x' + state.nextNonce.toString(16);
        case 'eth_estimateGas':
          assert.equal(params[0].from, state.account);
          assert.equal('nonce' in params[0], false);
          if (state.gasError) throw state.gasError;
          return params[0].to ? '0x30d40' : '0x16e360';
        case 'eth_getCode':
          assert.equal(params[0], VAULT_ADDRESS);
          return state.deployed ? '0x' + artifact.runtime : '0x';
        case 'eth_call': {
          const { to, data } = params[0];
          if (to === VAULT_ADDRESS) {
            if (data === '0x' + artifact.selectors['refundDeadline()']) return '0x' + word(state.refundDeadline);
            if (data === '0x' + artifact.selectors['payoutSnapshot()']) {
              return '0x' + [32, state.payouts.length, ...state.payouts].map(word).join('');
            }
            assert.equal(data, '0x' + artifact.selectors['snapshot()']);
            return snapshot({ ...state, deposits: state.members });
          }
          assert.equal(to, TOKEN);
          if (data.startsWith('0x' + artifact.selectors['balanceOf(address)'])) {
            return '0x' + word(state.token[state.account]);
          }
          assert.ok(data.startsWith('0x' + artifact.selectors['allowance(address,address)']));
          return '0x' + word(state.allowance[state.account] || 0);
        }
        case 'eth_sendTransaction': {
          const tx = params[0];
          assert.equal(state.chain, FUJI);
          assert.equal(tx.from, state.account);
          if (artifact.legacyRuntime) {
            assert.equal(BigInt(tx.gas), tx.to ? 230_000n : 1_725_000n);
            if (state.nonceFormat === 'unavailable') assert.equal('nonce' in tx, false);
            else assert.equal(tx.nonce, '0x' + state.nextNonce.toString(16));
            if (state.staleOnce) {
              state.staleOnce = false;
              state.nextNonce++;
              throw new Error('nonce too low: next nonce 6, tx nonce 5');
            }
          }
          if (state.holdSign) await state.holdSign;
          if (state.rejectNext) {
            state.rejectNext = false;
            throw Object.assign(new Error('Declined'), { code: 4001 });
          }
          state.nextNonce++;
          const hash = '0x' + word(++state.txId);
          const receipt = { transactionHash: hash, from: tx.from, status: state.revertNext ? '0x0' : '0x1' };
          state.sent.push(tx);
          state.receipts.set(hash, receipt);
          if (state.revertNext) {
            state.revertNext = false;
            return hash;
          }
          if (!tx.to) {
            assert.ok(tx.data.startsWith('0x' + artifact.bytecode));
            const args = tx.data.slice(2 + artifact.bytecode.length);
            assert.equal(args, [128, state.start, state.end, 5 * SCALE, 2, A, B].map(word).join(''));
            state.deployed = true;
            receipt.contractAddress = VAULT_ADDRESS;
            return hash;
          }
          const selector = tx.data.slice(2, 10);
          const arg = index => BigInt('0x' + tx.data.slice(10 + index * 64, 10 + (index + 1) * 64));
          const index = state.members.indexOf(tx.from);
          if (tx.to === TOKEN) {
            assert.equal(selector, artifact.selectors['approve(address,uint256)']);
            assert.equal(arg(0), BigInt(VAULT_ADDRESS));
            state.allowance[tx.from] = Number(arg(1));
            return hash;
          }
          assert.equal(tx.to, VAULT_ADDRESS);
          if ([artifact.selectors['deposit(uint256)'], artifact.selectors['depositForPlan(uint256,bytes32)']].includes(selector)) {
            const amount = Number(arg(0));
            if (selector === artifact.selectors['depositForPlan(uint256,bytes32)']) {
              assert.equal(arg(1), BigInt(state.hash));
              assert.equal(amount, Math.max(5 * SCALE, -state.net[index]) - state.balances[index]);
            }
            assert.ok(state.allowance[tx.from] >= amount);
            state.allowance[tx.from] -= amount;
            state.token[tx.from] -= amount;
            state.balances[index] += amount;
          } else if (selector === artifact.selectors['withdraw(uint256)']) {
            const amount = Number(arg(0));
            assert.ok(state.timestamp < Math.min(state.start, state.end));
            assert.ok(amount <= state.balances[index]);
            state.balances[index] -= amount;
            state.token[tx.from] += amount;
          } else if (selector === artifact.selectors['propose(int256[])']) {
            assert.equal(tx.from, A);
            assert.equal(arg(0), 32n);
            assert.equal(arg(1), 2n);
            state.net = [2, 3].map(position => Number(BigInt.asIntN(256, arg(position))));
            assert.deepEqual(state.net, [6 * SCALE, -6 * SCALE]);
            state.hash = PLAN;
            state.approvals = [1, 0];
          } else if (selector === artifact.selectors['approve(bytes32,bool)']) {
            assert.equal(arg(0), BigInt(state.hash));
            state.approvals[index] = Number(arg(1));
          } else if (selector === artifact.selectors['settle(bytes32)']) {
            assert.equal(tx.from, A);
            assert.equal(arg(0), BigInt(state.hash));
            assert.deepEqual(state.approvals, [1, 1]);
            state.balances = state.balances.map((amount, position) => amount + state.net[position]);
            state.payouts = state.balances.slice();
            state.closed = true;
          } else if (selector === artifact.selectors['claim()']) {
            state.token[tx.from] += state.balances[index];
            state.balances[index] = 0;
          } else {
            throw new Error('Unexpected transaction selector ' + selector);
          }
          return hash;
        }
        case 'eth_getTransactionReceipt':
          if (state.holdReceipt) await state.holdReceipt;
          return state.receipts.get(params[0]) || null;
        default: throw new Error('Unexpected RPC: ' + method);
      }
    },
  };
  return {
    state, provider,
    select(account) { state.account = account; listeners.get('accountsChanged')?.([account]); },
  };
}

export async function testFuji({ launch, end, flush, source }) {
  const artifact = JSON.parse(source.match(/const VAULT = (\{[^\n]+\});/)[1]);
  const timeEnd = Date.parse(end) / 1000;
  const { provider, state, select } = fakeWallet(artifact, timeEnd);
  const demo = await launch({ core: provider });
  demo.click('close-sheet');
  demo.click('fuji-connect');
  assert.match(demo.sheet.innerHTML, /Choose a wallet/);
  assert.match(demo.sheet.innerHTML, />Core<\/button>/);
  demo.click('fuji-wallet-option', { id: '0' });
  await flush();
  assert.match(demo.page.innerHTML, /Core/);
  assert.match(demo.page.innerHTML, /Wrong network/);
  assert.equal(state.sent.length, 0);
  demo.click('fuji-switch');
  await flush();
  assert.equal(state.chain, FUJI);
  demo.create('Fuji integration trip');
  demo.view('wallet');
  if (artifact.legacyRuntime) {
    state.gasError = Object.assign(new Error('execution reverted'), { data: '0xdba16ce8' });
    demo.click('fuji-deploy');
    demo.submit('fuji-deploy-form', { address: [A, B] });
    await flush();
    assert.match(demo.page.innerHTML, /Fuji rejected the trip schedule/);
    assert.equal(state.sent.length, 0);
    assert.equal(state.nextNonce, 5);
    state.gasError = new Error('insufficient funds for gas');
    demo.click('fuji-deploy');
    demo.submit('fuji-deploy-form', { address: [A, B] });
    await flush();
    assert.match(demo.page.innerHTML, /needs more Fuji test AVAX/);
    assert.equal(state.sent.length, 0);
    delete state.gasError;
    state.staleOnce = true;
    demo.click('fuji-deploy');
    demo.submit('fuji-deploy-form', { address: [A, B] });
    await flush();
    assert.match(demo.page.innerHTML, /Fuji already used this transaction number/);
    assert.match(demo.page.innerHTML, /Fuji reported the next number was 6/);
    assert.equal(state.sent.length, 0);
    assert.equal(state.nextNonce, 6);
    state.nonceFormat = 'number';
  }
  demo.click('fuji-deploy');
  assert.match(demo.sheet.innerHTML, /Deploy Fuji vault/);
  let unlockSign;
  let unlockReceipt;
  state.holdSign = new Promise(resolve => { unlockSign = resolve; });
  state.holdReceipt = new Promise(resolve => { unlockReceipt = resolve; });
  assert.equal(demo.submit('fuji-deploy-form', { address: [A, B] }), '');
  await flush();
  assert.match(demo.page.innerHTML, /Awaiting signature/);
  unlockSign();
  state.holdSign = null;
  await flush();
  assert.match(demo.page.innerHTML, /Pending · Deploy Fuji vault/);
  assert.match(demo.page.innerHTML, /explorer-test\.avax\.network/);
  assert.equal(demo.active().fuji.lastTx.phase, 'pending');
  const reload = await launch({ storage: demo.storage, provider });
  assert.doesNotMatch(reload.button('fuji-connect'), /disabled/);
  unlockReceipt();
  state.holdReceipt = null;
  await flush();
  assert.match(demo.page.innerHTML, /Confirmed · Deploy Fuji vault/);
  assert.equal(demo.active().fuji.address, VAULT_ADDRESS);

  const deposit = amount => {
    demo.click('fuji-deposit');
    assert.match(demo.sheet.innerHTML, artifact.legacyRuntime ? /Deposit USDC/ : /Deposit test USDC/);
    assert.equal(demo.submit('fuji-funds-form', { kind: 'deposit', amount: String(amount) }), '');
  };
  if (artifact.legacyRuntime) {
    assert.equal(state.sent[0].nonce, '0x6');
    state.nonceFormat = 'unavailable';
  }
  state.rejectNext = true;
  deposit(5);
  await flush();
  assert.match(demo.page.innerHTML, artifact.legacyRuntime ? /Declined · Deposit USDC/ : /Declined · Deposit test USDC/);
  assert.deepEqual(state.balances, [0, 0]);
  state.revertNext = true;
  deposit(5);
  await flush();
  assert.match(demo.page.innerHTML, /Failed · Approve 5\.00 USDC/);
  assert.deepEqual(state.balances, [0, 0]);
  deposit(5);
  await flush();
  assert.match(demo.page.innerHTML, /Confirmed · Deposit 5\.00 USDC/);
  assert.deepEqual(state.balances, [5 * SCALE, 0]);
  if (artifact.legacyRuntime) {
    assert.equal('nonce' in state.sent.at(-1), false);
    state.nonceFormat = 'hex';
  }
  select(B);
  await flush();
  deposit(5);
  await flush();
  assert.deepEqual(state.balances, [5 * SCALE, 5 * SCALE]);
  select(A);
  await flush();

  if (artifact.legacyRuntime) {
    state.timestamp = state.start - 1;
    demo.view('wallet');
    await flush();
    assert.match(demo.page.innerHTML, /You can take back your own deposit before then/);
    assert.ok(demo.button('fuji-withdraw'));
    demo.click('fuji-withdraw');
    assert.match(demo.sheet.innerHTML, /Withdraw my deposit/);
    demo.submit('fuji-funds-form', { kind: 'withdraw', amount: '1' });
    await flush();
    assert.deepEqual(state.balances, [4 * SCALE, 5 * SCALE]);
    deposit(1);
    await flush();
    demo.click('fuji-withdraw');
    state.timestamp = state.start;
    const sentBeforeDeadline = state.sent.length;
    demo.submit('fuji-funds-form', { kind: 'withdraw', amount: '1' });
    await flush();
    assert.equal(state.sent.length, sentBeforeDeadline);
    assert.match(demo.page.innerHTML, /only before the withdrawal deadline/);
    demo.click('fuji-refresh');
    await flush();
    assert.equal(demo.button('fuji-withdraw'), undefined);
    assert.ok(demo.button('fuji-deposit'));
    assert.match(demo.page.innerHTML, /Withdrawals are locked/);
    console.log('PASS: own deposit can be withdrawn just before the deadline, an open withdrawal form stops at the deadline, and top-ups stay available');
  }

  demo.bill(300000);
  demo.approveBill(1);
  demo.now(end);
  state.timestamp = timeEnd;
  await demo.prepare();
  await flush();
  demo.click('fuji-plan');
  assert.match(demo.sheet.innerHTML, artifact.legacyRuntime ? /Review payment amounts/ : /Review the Fuji split/);
  demo.click('fuji-publish', { revision: String(demo.active().revision) });
  await flush();
  assert.match(demo.page.innerHTML, artifact.legacyRuntime ? /Confirmed · Share amounts for approval/ : /Confirmed · Publish Fuji split/);
  if (artifact.legacyRuntime) {
    assert.equal(demo.button('fuji-plan'), undefined);
    assert.match(demo.page.innerHTML, /Undo my approval/);
    assert.match(demo.button('fuji-revoke'), /class="btn danger cancel-approval"/);
  }
  assert.match(demo.button('fuji-settle'), /disabled/);
  demo.click('reopen-split');
  const updatedAmounts = artifact.legacyRuntime ? /The amounts have changed/ : /The (?:local )?split changed/;
  assert.match(demo.page.innerHTML, updatedAmounts);
  const beforeStaleSettlement = state.sent.length;
  demo.click('fuji-settle', { hash: PLAN });
  await flush();
  assert.equal(state.sent.length, beforeStaleSettlement);
  await demo.prepare();
  demo.click('fuji-plan');
  demo.click('fuji-publish', { revision: String(demo.active().revision) });
  await flush();
  assert.doesNotMatch(demo.page.innerHTML, updatedAmounts);

  select(B);
  await flush();
  if (artifact.legacyRuntime) {
    assert.match(demo.button('fuji-approve'), /class="btn\s*"/);
    assert.doesNotMatch(demo.button('fuji-approve'), /disabled/);
  }
  demo.click('fuji-approve', { hash: PLAN });
  await flush();
  assert.match(demo.page.innerHTML, artifact.legacyRuntime ? /Confirmed · Approve my amount/ : /Confirmed · Approve Fuji split/);
  assert.match(demo.page.innerHTML, artifact.legacyRuntime ? /Top up 1\.00 USDC/ : /Top up 1\.00 USDC on Fuji/);
  demo.click('fuji-top-up', { hash: PLAN, units: String(SCALE) });
  await flush();
  assert.deepEqual(state.balances, [5 * SCALE, 6 * SCALE]);

  select(A);
  await flush();
  assert.doesNotMatch(demo.button('fuji-settle'), /disabled/);
  demo.click('fuji-settle', { hash: PLAN });
  await flush();
  assert.match(demo.page.innerHTML, artifact.legacyRuntime ? /Confirmed · Make group payments/ : /Confirmed · Settle Fuji vault/);
  assert.deepEqual(state.balances, [11 * SCALE, 0]);
  if (artifact.legacyRuntime) {
    assert.match(demo.page.innerHTML, /What each person gets back/);
    assert.match(demo.page.innerHTML, /Receives 6\.00 USDC/);
    assert.match(demo.page.innerHTML, /Available to claim · 11\.00 USDC/);
    assert.ok(demo.button('fuji-claim'));
  }
  demo.view('wallet');
  await flush();
  demo.click('fuji-claim');
  await flush();
  assert.match(demo.page.innerHTML, artifact.legacyRuntime ? /Confirmed · Send balance to my wallet/ : /Confirmed · Claim test USDC/);
  assert.deepEqual(state.balances, [0, 0]);
  assert.deepEqual(demo.active().depositUnits, { m0: 0, m1: 0 });
  if (artifact.legacyRuntime) {
    demo.view('split');
    await flush();
    assert.match(demo.page.innerHTML, /Claimed · 11\.00 USDC/);
    assert.equal(demo.button('fuji-claim'), undefined);
  }
  console.log('PASS: mocked injected wallet covers Fuji switch, signature, pending receipt, failed/rejected outcomes, deploy, two-wallet deposits, published approval, exact top-up, settlement and claim');
}
