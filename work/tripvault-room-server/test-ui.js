import assert from 'node:assert/strict';
import { Database } from 'bun:sqlite';
import { Wallet, getBytes, Interface } from 'ethers';
import { readFileSync } from 'node:fs';
import { createRoomApi } from './entry.js';

const origin = 'http://127.0.0.1:8788';

function providerFor(wallet, readChain) {
  let signatures = 0;
  const account = wallet.address.toLowerCase();
  return {
    isMetaMask: true,
    signatures: () => signatures,
    async request({ method, params }) {
      if (method === 'eth_chainId') return '0xa869';
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [account];
      if (method === 'personal_sign') {
        assert.equal(params[1], account);
        signatures++;
        const message = new TextDecoder().decode(getBytes(params[0]));
        assert.equal(message.split(' wants you to sign in')[0], origin);
        return wallet.signMessage(message);
      }
      if (readChain) return readChain(method, params);
      throw new Error('Unexpected wallet request: ' + method);
    },
  };
}


function switchingProvider() {
  const wallets = [Wallet.createRandom(), Wallet.createRandom()];
  const listeners = new Map();
  let active = wallets[0];
  return {
    isMetaMask: true,
    on(event, listener) { listeners.set(event, listener); },
    removeListener(event) { listeners.delete(event); },
    select(index) {
      active = wallets[index];
      listeners.get('accountsChanged')?.([active.address.toLowerCase()]);
    },
    async request({ method, params }) {
      if (method === 'eth_chainId') return '0xa869';
      if (method === 'eth_accounts' || method === 'eth_requestAccounts') return [active.address.toLowerCase()];
      if (method === 'personal_sign') {
        assert.equal(params[1], active.address.toLowerCase());
        const message = new TextDecoder().decode(getBytes(params[0]));
        assert.equal(message.split(' wants you to sign in')[0], origin);
        return active.signMessage(message);
      }
      throw new Error('Unexpected wallet request: ' + method);
    },
  };
}

export async function testRoomsUi({ launch, flush, start, end }) {
  const legacyDatabase = new Database(':memory:');
  const roomsApi = createRoomApi({ database: legacyDatabase, origin });
  const depositDeadline = new Date(Date.parse(start) - 30_000).toISOString();
  const api = async request => {
    const response = await roomsApi(request);
    if (response.status !== 201 || new URL(request.url).pathname !== '/api/rooms') return response;
    const trip = await response.json();
    legacyDatabase.query("UPDATE rooms SET snapshot = json_remove(snapshot, '$.depositDeadline') WHERE id = ?").run(trip.id);
    delete trip.depositDeadline;
    return Response.json(trip, { status: 201 });
  };
  const ownerProvider = providerFor(Wallet.createRandom());
  const guestProvider = providerFor(Wallet.createRandom());
  const linkProvider = providerFor(Wallet.createRandom());
  const owner = await launch({ url: origin, api, provider: ownerProvider });

  async function connect(tab) {
    tab.click('fuji-connect');
    assert.match(tab.sheet.innerHTML, /Choose a wallet/);
    tab.click('fuji-wallet-option', { id: '0' });
    await flush();
  }

  owner.click('close-sheet');
  owner.click('room-create');
  assert.match(owner.sheet.innerHTML, /Connect Wallet/);
  await connect(owner);
  assert.match(owner.sheet.innerHTML, /id="room-form"/);
  assert.doesNotMatch(owner.sheet.innerHTML, /Other members|name="others"/);
  assert.match(owner.sheet.innerHTML, /Your display name/);
  assert.match(owner.sheet.innerHTML, /name="depositDeadline"/);
  assert.match(owner.sheet.innerHTML, /The trip is cancelled if anyone is below the minimum/);
  assert.match(owner.sheet.innerHTML, /After this time, the organizer can share the final amounts/);
  owner.submit('room-form', {
    name: 'Room UI check', location: '', displayName: 'Owner',
    minimum: '5', mode: 'everyone', depositDeadline, startTime: start, endTime: end,
  });
  await flush();
  assert.match(owner.page.innerHTML, /Invite members/);
  assert.match(owner.page.innerHTML, /All trips/);
  assert.match(owner.page.innerHTML, /aria-current="step">Set up/);
  assert.match(owner.page.innerHTML, /Share the invite link or six-digit code below/);
  assert.match(owner.page.innerHTML, /1 of 12/);
  assert.equal(ownerProvider.signatures(), 1);
  owner.click('room-rename');
  assert.match(owner.sheet.innerHTML, /Rename trip/);
  owner.submit('room-rename-form', { kind: 'room-rename', name: 'Renamed trip' });
  await flush();
  assert.match(owner.page.innerHTML, /Renamed trip/);
  owner.click('room-rename');
  owner.submit('room-rename-form', { kind: 'room-rename', name: 'Room UI check' });
  await flush();
  const code = owner.page.innerHTML.match(/class="room-code"[^>]*>(\d{6})<\/div>/)[1];
  const invite = owner.page.innerHTML.match(/id="trip-invite-link"[^>]*value="([^"]+)"/)[1];
  assert.match(invite, /\?join=[A-Za-z0-9_-]{32}$/);

  const guest = await launch({ url: origin, api, provider: guestProvider });
  guest.click('close-sheet');
  guest.click('room-join');
  await connect(guest);
  assert.match(guest.sheet.innerHTML, /Six-digit room code/);
  guest.submit('room-form', { key: code, displayName: 'Guest via code' });
  await flush();
  assert.match(guest.page.innerHTML, /Guest via code · You/);
  assert.match(guest.page.innerHTML, /data-view="people"[^>]*>View members<\/button>/);
  await owner.poll();
  assert.match(owner.page.innerHTML, /2 of 12/);
  assert.match(owner.page.innerHTML, /Guest via code/);
  assert.equal(guest.button('room-rename'), undefined);
  assert.match(guest.page.innerHTML, /class="trip-profile"[\s\S]*?class="btn soft rename-member" data-act="room-rename-member"/);
  guest.view('wallet');
  guest.click('room-rename-member');
  guest.submit('room-rename-form', { kind: 'room-rename-member', name: 'Updated guest' });
  await flush();
  await owner.poll();
  assert.match(owner.page.innerHTML, /Updated guest/);
  guest.view('overview');
  guest.click('room-rename-member');
  guest.submit('room-rename-form', { kind: 'room-rename-member', name: 'Guest via code' });
  await flush();
  assert.doesNotMatch(guest.page.innerHTML, /Copy invite link/);

  const friend = await launch({ url: invite, api, provider: linkProvider });
  assert.match(friend.sheet.innerHTML, /Cách dùng TripVault/);
  friend.click('close-sheet');
  assert.match(friend.sheet.innerHTML, /Join a room/);
  await connect(friend);
  const key = new URL(invite).searchParams.get('join');
  assert.match(friend.sheet.innerHTML, /type="hidden" value="/);
  assert.doesNotMatch(friend.sheet.innerHTML, /Six-digit room code/);
  friend.submit('room-form', { key, displayName: 'Guest via link' });
  await flush();
  await owner.poll();
  await guest.poll();
  assert.match(owner.page.innerHTML, /3 of 12/);
  assert.match(guest.page.innerHTML, /Guest via link/);
  assert.match(friend.page.innerHTML, /Guest via code/);

  guest.view('bills');
  assert.match(guest.button('new-bill'), /disabled/);
  assert.match(guest.page.innerHTML, /Bills unlock after the organizer links/);

  guest.view('wallet');
  assert.equal(guest.button('fuji-deploy'), undefined);
  assert.match(guest.button('fuji-deposit'), /disabled/);
  assert.match(guest.page.innerHTML, /Waiting for the organizer to deploy/);
  owner.view('wallet');
  owner.click('fuji-deploy');
  assert.match(owner.sheet.innerHTML, /Lock room roster/);
  owner.click('room-freeze');
  await flush();
  assert.match(owner.sheet.innerHTML, /Deploy Fuji vault/);
  assert.match(owner.sheet.innerHTML, /Guest via link/);
  assert.doesNotMatch(owner.sheet.innerHTML, /name="address"/);
  await guest.poll();
  guest.view('overview');
  assert.match(guest.page.innerHTML, /Roster locked/);
  console.log('PASS: signed room joins, background member updates, automatic Fuji roster, and bill lock before deployment');

  assert.equal(guest.button('room-delete'), undefined);
  owner.click('close-sheet');
  owner.view('overview');
  assert.ok(owner.button('room-delete'));
  owner.click('room-delete');
  assert.match(owner.sheet.innerHTML, /Delete trip\?/);
  assert.match(owner.sheet.innerHTML, /permanently removed for all members/);
  owner.click('close-sheet');
  assert.match(owner.page.innerHTML, /Room UI check/);
  owner.click('trip-list');
  const deleteId = owner.button('room-delete').match(/data-id="([^"]+)"/)[1];
  owner.click('room-delete', { id: deleteId });
  const confirmation = owner.sheet.innerHTML.match(/data-act="room-delete-confirm" data-id="([^"]+)" data-version="([^"]+)"/);
  assert.ok(confirmation);
  owner.click('room-delete-confirm', { id: confirmation[1], version: confirmation[2] });
  await flush();
  assert.doesNotMatch(owner.page.innerHTML, /Room UI check/);
  await guest.poll();
  await friend.poll();
  assert.doesNotMatch(guest.page.innerHTML, /Room UI check/);
  assert.doesNotMatch(friend.page.innerHTML, /Room UI check/);
  console.log('PASS: cancel preserves the trip; confirmed deletion returns every member to the room list');

  const switcher = switchingProvider();
  const oneBrowser = await launch({ url: origin, api, provider: switcher });
  oneBrowser.click('close-sheet');
  oneBrowser.click('room-create');
  await connect(oneBrowser);
  oneBrowser.submit('room-form', {
    name: 'One MetaMask, two accounts', location: '', displayName: 'Account 1',
    minimum: '5', mode: 'organizer', depositDeadline, startTime: start, endTime: end,
  });
  await flush();
  const twoAccountCode = oneBrowser.page.innerHTML.match(/class="room-code"[^>]*>(\d{6})<\/div>/)[1];

  switcher.select(1);
  await flush();
  oneBrowser.click('room-join');
  assert.match(oneBrowser.sheet.innerHTML, /Six-digit room code/);
  oneBrowser.submit('room-form', { key: twoAccountCode, displayName: 'Account 2' });
  await flush();
  assert.match(oneBrowser.page.innerHTML, /Account 2 · You/);
  assert.match(oneBrowser.page.innerHTML, /2 of 12/);

  switcher.select(0);
  await flush();
  oneBrowser.click('room-sign-in');
  oneBrowser.submit('room-form', {});
  await flush();
  assert.match(oneBrowser.page.innerHTML, /One MetaMask, two accounts/);
  const roomId = oneBrowser.button('open-trip').match(/data-id="([^"]+)"/)[1];
  oneBrowser.click('open-trip', { id: roomId });
  assert.match(oneBrowser.page.innerHTML, /Account 1 · You/);
  assert.match(oneBrowser.page.innerHTML, /Account 2/);
  assert.match(oneBrowser.page.innerHTML, /2 of 12/);
  console.log('PASS: one browser can create as Account 1, join as Account 2, and sign back in as Account 1 to see both');

  assert.ok(oneBrowser.button('room-end'));
  oneBrowser.click('room-end');
  assert.match(oneBrowser.sheet.innerHTML, /End trip now\?/);
  oneBrowser.click('room-end-confirm', { id: roomId });
  await flush();
  assert.match(oneBrowser.page.innerHTML, /Trip ended early/);
  assert.match(oneBrowser.page.innerHTML, /Withdrawals locked early/);
  assert.equal(oneBrowser.button('room-end'), undefined);
  oneBrowser.view('split');
  assert.match(oneBrowser.page.innerHTML, /Group payments/);
  assert.ok(oneBrowser.button('fuji-deploy'));
  assert.doesNotMatch(oneBrowser.page.innerHTML, /Group payments can start after/);

  oneBrowser.click('trip-list');
  oneBrowser.click('room-create');
  oneBrowser.submit('room-form', { name: 'Bulk second', location: '', displayName: 'Account 1',
    minimum: '5', mode: 'organizer', depositDeadline, startTime: start, endTime: end });
  await flush();
  oneBrowser.click('trip-list');
  oneBrowser.click('room-delete-select-mode');
  const checkboxes = [...oneBrowser.page.innerHTML.matchAll(/data-act="room-select-delete" data-id="([^"]+)"/g)];
  assert.equal(checkboxes.length, 2);
  assert.match(oneBrowser.button('room-delete-selected'), /disabled/);
  for (const match of checkboxes) oneBrowser.click('room-select-delete', { id: match[1] });
  assert.match(oneBrowser.page.innerHTML, /2 selected/);
  oneBrowser.click('room-delete-selected');
  assert.match(oneBrowser.sheet.innerHTML, /Delete 2 trips\?/);
  assert.match(oneBrowser.sheet.innerHTML, /One MetaMask, two accounts/);
  assert.match(oneBrowser.sheet.innerHTML, /Bulk second/);
  oneBrowser.click('close-sheet');
  assert.match(oneBrowser.page.innerHTML, /Bulk second/);
  oneBrowser.click('room-delete-selected');
  oneBrowser.click('room-delete-selected-confirm');
  await flush();
  assert.doesNotMatch(oneBrowser.page.innerHTML, /Bulk second|One MetaMask, two accounts/);
  assert.match(oneBrowser.toast.textContent, /2 trips deleted/);
  console.log('PASS: checkboxes, multiple selection, cancel and one confirmation delete the selected trips');

  await testMemberDeposit({ launch, flush, start, end });
  await testMemberDeposit({ launch, flush, start, end, cancelAtDeadline: true });
}

async function testMemberDeposit({ launch, flush, start, end, cancelAtDeadline = false }) {
  const owner = Wallet.createRandom();
  const member = Wallet.createRandom();
  const roster = [owner.address, member.address];
  const timeEnd = Date.parse(end) / 1000;
  const timeStart = Date.parse(start) / 1000;
  const deadline = timeStart - 30;
  const depositDeadline = new Date(deadline * 1000).toISOString();
  const compiled = JSON.parse(readFileSync(new URL('../fuji-contract/deadline-compiled.json', import.meta.url), 'utf8')).contracts;
  const contract = Object.entries(compiled).find(([name]) => name.endsWith(':TripVaultDeadline'))[1];
  const runtime = contract['bin-runtime'];
  const vault = '0x' + 'cd'.repeat(20);
  const hash = '0x' + 'bc'.repeat(32);
  const depositHash = '0x' + 'bd'.repeat(32);
  const claimHash = '0x' + 'be'.repeat(32);
  let ownerDeposit = 5_000_000;
  let guestDeposit = 0;
  let chainTime = deadline - 1;
  let serverTime = (deadline - 1) * 1000;
  let walletUsdc = 0;
  let expectedDeposit = 5_000_000;
  let deployRequests = 0;
  let usePublicGasEstimate = true;
  let publicEstimates = 0;
  let serverNonceAvailable = true;
  const iface = new Interface([
    'function snapshot() view returns (address[],uint256[],int256[],bool[],bytes32,uint256,uint256,uint256,bool)',
    'function refundDeadline() view returns (uint256)', 'function balanceOf(address) view returns (uint256)',
    'function allowance(address,address) view returns (uint256)', 'function deposit(uint256)',
    'function depositDeadline() view returns (uint256)', 'function fundingFailed() view returns (bool)',
    'function claim()', 'constructor(address[], uint256, uint256, uint256, uint256)',
  ]);
  const q = value => '0x' + value.toString(16);
  const readChain = async (method, params) => {
    if (method === 'eth_getTransactionCount') return serverNonceAvailable
      ? (params[1] === 'latest' ? '0x6' : '0x5') : null;
    if (method === 'eth_estimateGas') {
      assert.equal('nonce' in params[0], false);
      return params[0].to ? '0x30d40' : '0x16e360';
    }
    if (method === 'eth_sendTransaction') {
      assert.equal(BigInt(params[0].gas), params[0].to ? 230_000n : 1_725_000n);
      if (!params[0].to) {
        assert.equal(params[0].from, owner.address.toLowerCase());
        assert.equal(params[0].nonce, '0x6');
        const args = iface.encodeDeploy([roster, deadline, timeStart, timeEnd, 5_000_000]);
        assert.equal(params[0].data, '0x' + contract.bin + args.slice(2));
        deployRequests++;
        throw Object.assign(new Error('Declined'), { code: 4001 });
      }
      if (params[0].data === iface.encodeFunctionData('claim')) {
        assert.ok(cancelAtDeadline && chainTime >= deadline);
        assert.equal(params[0].from, owner.address.toLowerCase());
        ownerDeposit = 0;
        return claimHash;
      }
      assert.equal(params[0].from, member.address.toLowerCase());
      if (serverNonceAvailable) assert.equal(params[0].nonce, '0x6');
      else assert.equal('nonce' in params[0], false);
      assert.equal(params[0].data, iface.encodeFunctionData('deposit', [expectedDeposit]));
      guestDeposit += expectedDeposit;
      return depositHash;
    }
    if (method === 'eth_getTransactionReceipt') {
      if (params[0] === depositHash) return { status: '0x1', from: member.address, transactionHash: depositHash };
      if (params[0] === claimHash) return { status: '0x1', from: owner.address, transactionHash: claimHash };
      return { status: '0x1', from: owner.address, transactionHash: hash, contractAddress: vault, blockNumber: '0x20', transactionIndex: '0x0' };
    }
    if (method === 'eth_getTransactionByHash') return { from: owner.address, hash, to: null };
    if (method === 'eth_getCode') return '0x' + runtime;
    if (method === 'eth_getBlockByNumber') return { timestamp: q(chainTime), number: '0x20' };
    if (method === 'eth_call') {
      const selector = params[0].data.slice(0, 10);
      if (selector === iface.getFunction('refundDeadline').selector) return iface.encodeFunctionResult('refundDeadline', [timeEnd + 604800]);
      if (selector === iface.getFunction('depositDeadline').selector) return iface.encodeFunctionResult('depositDeadline', [deadline]);
      if (selector === iface.getFunction('fundingFailed').selector) return iface.encodeFunctionResult('fundingFailed', [cancelAtDeadline && chainTime >= deadline]);
      if (selector === iface.getFunction('balanceOf').selector) return iface.encodeFunctionResult('balanceOf', [walletUsdc]);
      if (selector === iface.getFunction('allowance').selector) return iface.encodeFunctionResult('allowance', [5_000_000]);
      return iface.encodeFunctionResult('snapshot', [
        roster, [ownerDeposit, guestDeposit], [], [false, false], '0x' + '00'.repeat(32), timeStart, timeEnd, 5_000_000, false,
      ]);
    }
    throw new Error('Unexpected chain method: ' + method);
  };
  const database = new Database(':memory:');
  const api = createRoomApi({ database, origin, rpc: readChain,
    fetchFundingRate: async () => 25000, now: () => serverTime });
  const browser = await launch({ url: origin, api, provider: providerFor(owner, (method, params) => {
    if (method === 'eth_getTransactionCount') return '0x5';
    if (method === 'eth_estimateGas' && usePublicGasEstimate) return '0x0';
    return readChain(method, params);
  }), fujiRpc: async (method, params) => {
    assert.equal(method, 'eth_estimateGas');
    assert.equal('to' in params[0], false);
    assert.equal(params[0].from, owner.address.toLowerCase());
    publicEstimates++;
    return Response.json({ result: publicEstimates === 1 ? '0x0' : await readChain(method, params) });
  } });
  const guest = await launch({ url: origin, api, provider: providerFor(member, (method, params) =>
    method === 'eth_getTransactionCount' ? '0x5' : readChain(method, params)) });
  const connect = async tab => {
    tab.click('fuji-connect');
    tab.click('fuji-wallet-option', { id: '0' });
    await flush();
  };
  browser.click('close-sheet');
  browser.click('room-create');
  await connect(browser);
  browser.submit('room-form', { name: 'After end', location: '', displayName: 'Owner',
    minimum: '5', mode: 'organizer', depositDeadline, startTime: start, endTime: end });
  await flush();
  const code = browser.page.innerHTML.match(/class="room-code"[^>]*>(\d{6})<\/div>/)[1];
  guest.click('close-sheet');
  guest.click('room-join');
  await connect(guest);
  guest.submit('room-form', { key: code, displayName: 'Xu' });
  await flush();
  guest.view('wallet');
  assert.match(guest.button('fuji-deposit'), /disabled/);
  await browser.poll();
  assert.match(browser.page.innerHTML, /Invite your group/);
  assert.match(browser.page.innerHTML, /data-view="wallet" data-focus="fuji-deploy"[^>]*>Go to vault setup<\/button>/);
  browser.click('navigate', { view: 'wallet', focus: 'fuji-deploy' });
  assert.match(browser.page.innerHTML, /Wallet and trip fund/);
  assert.doesNotMatch(browser.button('fuji-deploy'), /disabled/);
  browser.click('fuji-deploy');
  assert.match(browser.sheet.innerHTML, /Lock room roster/);
  browser.click('room-freeze');
  await flush();
  browser.submit('fuji-deploy-form', {});
  await flush();
  assert.equal(publicEstimates, 1);
  assert.equal(deployRequests, 0);
  assert.match(browser.page.innerHTML, /Could not estimate the Fuji network fee/);
  browser.click('fuji-deploy');
  browser.submit('fuji-deploy-form', {});
  await flush();
  assert.equal(publicEstimates, 2);
  usePublicGasEstimate = false;
  assert.equal(deployRequests, 1);
  assert.match(browser.page.innerHTML, /Declined · Deploy Fuji vault/);
  assert.match(browser.page.innerHTML, /Retry deploy vault/);
  browser.click('fuji-deploy');
  assert.match(browser.sheet.innerHTML, /Review deployment in wallet/);
  browser.click('close-sheet');
  browser.now(depositDeadline);
  browser.view('wallet');
  assert.equal(browser.button('fuji-deploy'), undefined);
  assert.ok(browser.button('fuji-link'));
  assert.ok(browser.button('room-replace-expired'));
  browser.click('room-replace-expired');
  assert.match(browser.sheet.innerHTML, /name="name"[^>]*value="After end"/);
  assert.match(browser.sheet.innerHTML, /name="minimum"[^>]*value="5"/);
  assert.match(browser.sheet.innerHTML, /new invite code/);
  assert.doesNotMatch(browser.sheet.innerHTML, /name="depositDeadline"[^>]*value=/);
  browser.click('close-sheet');
  browser.click('fuji-link');
  assert.match(browser.sheet.innerHTML, /Deployment transaction hash/);
  browser.submit('fuji-link-form', { hash });
  await flush();
  assert.match(browser.page.innerHTML, /Vault verified and linked/);
  assert.equal(browser.button('room-replace-expired'), undefined);
  await guest.poll();
  guest.view('overview');
  await flush();
  assert.match(guest.page.innerHTML, /aria-current="step">Add funds/);
  assert.match(guest.page.innerHTML, /1 of 2 members have added at least 5\.00 USDC/);
  if (cancelAtDeadline) {
    chainTime = deadline;
    browser.now(depositDeadline);
    browser.view('wallet');
    await flush();
    assert.match(browser.page.innerHTML, /Trip cancelled/);
    assert.equal(browser.button('fuji-deposit'), undefined);
    assert.equal(browser.button('fuji-withdraw'), undefined);
    assert.ok(browser.button('fuji-claim'));
    browser.click('fuji-claim');
    await flush();
    assert.equal(ownerDeposit, 0);
    browser.view('bills');
    await flush();
    assert.match(browser.button('new-bill'), /disabled/);
    browser.view('overview');
    await flush();
    assert.match(browser.page.innerHTML, /Someone was below the minimum at the deadline/);
    console.log('PASS: underfunded rooms show cancellation at the deadline, lock bills and open refunds in Wallet');
    return;
  }
  guest.view('wallet');
  await flush();
  assert.doesNotMatch(guest.button('fuji-deposit'), /disabled/);
  assert.match(guest.page.innerHTML, /You can take back your own deposit before then/);
  assert.match(guest.page.innerHTML, /Open Circle faucet/);
  guest.click('fuji-deposit');
  assert.match(guest.sheet.innerHTML, /Deposit USDC/);
  guest.submit('fuji-funds-form', { kind: 'deposit', amount: '5' });
  await flush();
  assert.equal(guestDeposit, 0);
  assert.match(guest.page.innerHTML, /Your wallet has 0\.00 USDC on Fuji/);
  walletUsdc = 50_000_000;
  guest.view('bills');
  await flush();
  assert.match(guest.button('new-bill'), /disabled/);
  assert.match(guest.page.innerHTML, /Top up 5\.00 USDC/);
  guest.click('room-funding-top-up');
  await flush();
  assert.equal(guestDeposit, 5_000_000);
  assert.match(guest.button('new-bill'), /disabled/);
  chainTime = deadline;
  guest.now(depositDeadline);
  guest.view('wallet');
  await flush();
  assert.match(guest.page.innerHTML, /The trip is confirmed/);
  assert.equal(guest.button('fuji-deposit'), undefined);
  assert.equal(guest.button('fuji-withdraw'), undefined);
  guest.view('people');
  assert.equal(guest.button('room-rename-member'), undefined);
  chainTime = timeStart;
  guest.now(start);
  browser.now(start);
  serverTime = Date.parse(start);
  guest.view('bills');
  await flush();
  assert.doesNotMatch(guest.button('new-bill'), /disabled/);
  guest.view('overview');
  await flush();
  assert.match(guest.page.innerHTML, /aria-current="step">Record bills/);
  guest.view('wallet');
  await flush();
  assert.match(guest.page.innerHTML, /Withdrawals are locked/);
  assert.match(guest.page.innerHTML, /Confirmed · Deposit 5\.00 USDC/);
  browser.view('bills');
  await flush();
  browser.click('new-bill');
  const draft = browser.billDraft({ label: 'Dinner', amount: '300000', payer: 'm0', participant: ['m0', 'm1'] });
  assert.equal(draft.submit.disabled, true);
  assert.match(draft.status.innerHTML, /Remind Xu to top up/);
  browser.click('send-top-up-reminder');
  await flush();
  assert.match(draft.status.textContent, /Reminder sent in TripVault/);
  guest.click('trip-list');
  await guest.poll();
  assert.match(guest.page.innerHTML, /Owner asked you to top up/);
  assert.match(guest.page.innerHTML, /Requested 1\.00 USDC/);
  const reminderId = guest.button('open-top-up-reminder').match(/data-id="([^"]+)"/)[1];
  guest.click('open-top-up-reminder', { id: reminderId });
  await flush();
  assert.match(guest.page.innerHTML, /Top up 1\.00 USDC/);
  assert.match(guest.page.innerHTML, /class="trip-bell-dot"/);
  guest.click('room-notifications');
  assert.match(guest.sheet.innerHTML, /Top-up reminder/);
  assert.doesNotMatch(guest.page.innerHTML, /class="trip-bell-dot"/);
  guest.click('close-sheet');
  guestDeposit = 5_250_000;
  guest.click('pay-top-up-reminder', { id: reminderId, units: '1000000' });
  await flush();
  assert.equal(guestDeposit, 5_250_000);
  assert.match(guest.page.innerHTML, /Top up 0\.75 USDC/);
  expectedDeposit = 750_000;
  serverNonceAvailable = false;
  guest.click('pay-top-up-reminder', { id: reminderId, units: '750000' });
  await flush();
  assert.equal(guestDeposit, 6_000_000);
  assert.match(guest.page.innerHTML, /You’ve added enough for this bill/);
  await browser.poll();
  assert.equal(draft.submit.disabled, false);
  assert.equal(draft.fields.amount, '300000');
  browser.submit('bill-form', draft.fields);
  await flush();
  assert.equal(browser.sheet.open, false);
  assert.match(browser.page.innerHTML, /Dinner/);
  await guest.poll();
  browser.approveBill(1);
  await flush();
  assert.match(browser.sheet.innerHTML, /1\/2 approved/);
  browser.click('close-sheet');
  // The second member acts from the old room version.
  guest.approveBill(1);
  await flush();
  assert.match(guest.sheet.innerHTML, /Approved/);
  assert.doesNotMatch(guest.sheet.innerHTML, /Waiting for approval/);
  guest.click('close-sheet');
  await browser.poll();
  browser.submit('bill-form', { label: 'Pending snack', amount: '30000', payer: 'm1', participant: ['m0', 'm1'] });
  await flush();
  assert.match(browser.page.innerHTML, /Pending snack/);
  await guest.poll();
  assert.doesNotMatch(guest.page.innerHTML, /Top-up reminders/);
  chainTime = timeEnd + 1;
  serverTime = Date.parse(end);
  browser.now(end);
  guest.now(end);
  await browser.poll();
  await guest.poll();
  assert.match(browser.page.innerHTML, /Dinner/);
  assert.match(browser.page.innerHTML, /Pending snack/);
  assert.match(browser.button('new-bill'), /disabled/);
  browser.view('overview');
  await flush();
  assert.match(browser.page.innerHTML, /aria-current="step">Final payments/);
  assert.match(browser.page.innerHTML, /Finish bill reviews/);
  guest.click('bill-feedback', { id: '2' });
  assert.match(guest.sheet.innerHTML, /Reason or suggested change/);
  assert.match(guest.sheet.innerHTML, /<form method="dialog" id="bill-feedback-form"/);
  database.query('DELETE FROM auth_sessions WHERE address = ?').run(member.address.toLowerCase());
  guest.submit('bill-feedback-form', { id: '2', comment: 'I paid separately' });
  await flush();
  assert.match(guest.page.innerHTML, /All trips/);
  assert.match(guest.page.innerHTML, /Your room sign-in expired/);
  assert.match(guest.sheet.innerHTML, /Reason or suggested change/);
  guest.click('room-reauthenticate');
  await flush();
  guest.submit('bill-feedback-form', { id: '2', comment: 'I paid separately' });
  await flush();
  assert.match(guest.sheet.innerHTML, /I paid separately/);
  assert.doesNotMatch(guest.page.innerHTML, /Your room sign-in expired/);
  await guest.poll();
  assert.doesNotMatch(guest.page.innerHTML, /class="trip-bell-dot"/);
  browser.view('split');
  await flush();
  assert.doesNotMatch(browser.page.innerHTML, /class="trip-bell-dot"/);
  browser.click('fuji-refresh');
  assert.match(browser.page.innerHTML, /Updating status/);
  await flush();
  assert.match(browser.toast.textContent, /Trip status updated/);
  assert.match(browser.page.innerHTML, /class="trip-bell-dot"/);
  await browser.poll();
  browser.click('room-notifications');
  assert.match(browser.sheet.innerHTML, /Bill change requested/);
  assert.match(browser.sheet.innerHTML, /I paid separately/);
  assert.doesNotMatch(browser.page.innerHTML, /class="trip-bell-dot"/);
  const notificationId = browser.sheet.innerHTML.match(/data-act="open-room-notification" data-id="([^"]+)"/)[1];
  browser.click('open-room-notification', { id: notificationId });
  assert.match(browser.sheet.innerHTML, /data-bill-review="2"/);
  assert.match(browser.sheet.innerHTML, /Suggested changes/);
  await browser.poll();
  assert.doesNotMatch(browser.page.innerHTML, /class="trip-bell-dot"/);
  browser.click('close-sheet');
  guest.click('bill-feedback', { id: '2' });
  guest.submit('bill-feedback-form', { id: '2', comment: 'Please remove my share' });
  await flush();
  await browser.poll();
  assert.match(browser.toast.textContent, /New trip notification/);
  assert.match(browser.page.innerHTML, /class="trip-bell-dot"/);
  browser.click('bill-edit', { id: '2' });
  assert.match(browser.sheet.innerHTML, /Edit bill/);
  assert.match(browser.sheet.innerHTML, /name="editing" value="2"/);
  browser.submit('bill-form', { editing: '2', label: 'Snack', amount: '20000', payer: 'm1', participant: ['m0', 'm1'] });
  await flush();
  assert.match(browser.page.innerHTML, /Snack/);
  browser.click('bill-cancel-yes', { id: '2' });
  await flush();
  assert.match(browser.sheet.innerHTML, /1 of 2 agreed/);
  await guest.poll();
  guest.click('bill-cancel-yes', { id: '2' });
  await flush();
  assert.match(guest.sheet.innerHTML, /Rejected · Handle separately/);
  await browser.poll();
  browser.view('split');
  await flush();
  assert.doesNotMatch(browser.page.innerHTML, /Finish open bill reviews/);
  assert.doesNotMatch(browser.page.innerHTML, /20\.000 ₫/);
  chainTime = timeEnd + 604800;
  guest.now(new Date(chainTime * 1000).toISOString());
  guest.view('overview');
  await flush();
  assert.match(guest.page.innerHTML, /aria-current="step">Done/);
  assert.match(guest.page.innerHTML, /Payment window closed/);
  console.log('PASS: Fuji nonce overrides stale wallet nonce for deployment and deposit; unavailable nonce leaves the choice to the wallet');
  console.log('PASS: a bill reminder reaches only its recipient, recalculates after a partial top-up, and lets the sender save once Fuji confirms');
  console.log('PASS: overview updates from setup to funding, bills and final payments as the room and Fuji state change');
  console.log('PASS: manual status refresh gets remote feedback; only recipients get unread notifications with a direct link to the bill');
}
