/**
 * @tripvault/server - Constants & Config
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Load compiled contract bytecode if available, or fallback to embedded artifacts
let compiledContract = null;
try {
  const contractPath = fileURLToPath(new URL('../../../work/fuji-contract/compiled.json', import.meta.url));
  const legacyPath = fileURLToPath(new URL('../../../work/fuji-contract/legacy-compiled.json', import.meta.url));
  const deadlinePath = fileURLToPath(new URL('../../../work/fuji-contract/deadline-compiled.json', import.meta.url));

  const compiled = JSON.parse(readFileSync(contractPath, 'utf8')).contracts;
  const legacy = JSON.parse(readFileSync(legacyPath, 'utf8')).contracts;
  const deadline = JSON.parse(readFileSync(deadlinePath, 'utf8')).contracts;

  const vault = Object.entries(compiled).find(([name]) => name.endsWith(':TripVaultFuji'))[1];
  const legacyVault = Object.entries(legacy).find(([name]) => name.endsWith(':TripVaultFuji'))[1];
  const deadlineVault = Object.entries(deadline).find(([name]) => name.endsWith(':TripVaultDeadline'))[1];

  compiledContract = {
    runtime: vault['bin-runtime'],
    legacyRuntime: legacyVault['bin-runtime'],
    deadlineRuntime: deadlineVault['bin-runtime'],
  };
} catch {
  // Embedded fallback
  compiledContract = {
    runtime: '608060405234801561001057600080fd5b50600436106100cf5760003560e01c80639711715a1161008c578063b6b55f2511610066578063b6b55f251461019f578063c70d484f146101b2578063e1aa1bcc146101c5578063f92a53f2146101ce57600080fd',
    legacyRuntime: '608060405234801561001057600080fd5b506004361061009e5760003560e01c806389a302711161006657806389a30271146101035780639711715a14610136578063987757dd14610153578063b6b55f2514610166578063c70d484f1461017957600080fd',
    deadlineRuntime: '608060405234801561001057600080fd5b50600436106100f55760003560e01c80639711715a11610097578063c70d484f11610066578063c70d484f146101e1578063e1aa1bcc146101f4578063e7786918146101fd578063f92a53f21461021557600080fd',
  };
}

export const CONTRACT = compiledContract;
export const CHAIN = 43113; // Avalanche Fuji Testnet
export const RPC = 'https://api.avax-test.network/ext/bc/C/rpc';
export const MAX_MEMBERS = 12;
export const FIVE_MINUTES = 300_000;
export const DAY = 86_400_000;
export const REFUND_DELAY_SECONDS = 7n * 86_400n;
export const LOCAL_HTML = 'TripVault_Rooms_v9.html';
export const ZERO = /^0x0{40}$/i;
export const ADDRESS = /^0x[0-9a-f]{40}$/i;
export const HASH = /^0x[0-9a-f]{64}$/i;
export const ROOM_ID = /^room-[a-f0-9-]{36}$/;
