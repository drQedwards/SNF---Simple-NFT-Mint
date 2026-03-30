#!/usr/bin/env node
// Multi-wallet NFT mint runner for Stacks
// Default wallet source: /home/thee1/SpinningB/generated/mainnet-wallets.json

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  getAddressFromPrivateKey,
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';

const DEFAULT_WALLET_FILE = '/home/thee1/SpinningB/generated/mainnet-wallets.json';

const CONFIG = {
  CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || 'SP31G2FZ5JN87BATZMP4ZRYE5F7WZQDNEXJ7G7X97',
  CONTRACT_NAME: process.env.CONTRACT_NAME || 'simple-nft-v4',
  NETWORK: process.env.NETWORK || 'mainnet',
  FEE: BigInt(process.env.FEE_MICROSTX || '10000'),
  DELAY_MS: Number.parseInt(process.env.DELAY_MS || '400', 10),
  WALLET_LIMIT: Number.parseInt(process.env.WALLET_LIMIT || '50', 10),
  START_INDEX: Number.parseInt(process.env.START_INDEX || '0', 10),
  MINTS_PER_WALLET: Number.parseInt(process.env.MINTS_PER_WALLET || '1', 10),
  RETRY_ATTEMPTS: Number.parseInt(process.env.RETRY_ATTEMPTS || '5', 10),
};

function getNetwork() {
  return CONFIG.NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}

function getApiUrl() {
  return CONFIG.NETWORK === 'mainnet'
    ? 'https://api.mainnet.hiro.so'
    : 'https://api.testnet.hiro.so';
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function maskAddress(address) {
  if (!address || address.length < 12) return address || 'unknown';
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function extractRetrySecondsFromBody(textBody) {
  const match = textBody.match(/try again in\s+(\d+)\s+seconds/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

async function fetchJsonWithRetry(url, attempts = CONFIG.RETRY_ATTEMPTS) {
  let delayMs = 1200;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return await response.json();
      }

      const body = await response.text();
      const retrySeconds = response.status === 429 ? extractRetrySecondsFromBody(body) : null;

      if (attempt === attempts) {
        throw new Error(`Request failed (${response.status}): ${body}`);
      }

      const backoff = retrySeconds ? retrySeconds * 1000 : delayMs;
      console.log(`[retry] Status ${response.status}. Waiting ${Math.ceil(backoff / 1000)}s before attempt ${attempt + 1}/${attempts}...`);
      await sleep(backoff + 200);
      delayMs *= 2;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      console.log(`[retry] Fetch error: ${error.message}. Waiting ${Math.ceil(delayMs / 1000)}s before attempt ${attempt + 1}/${attempts}...`);
      await sleep(delayMs + 200);
      delayMs *= 2;
    }
  }

  throw new Error('Unexpected retry flow');
}

async function getAccountNonce(address) {
  const data = await fetchJsonWithRetry(`${getApiUrl()}/extended/v1/address/${address}/nonces`);
  return Number(data.possible_next_nonce);
}

async function mintNFT(privateKey, nonce) {
  const tx = await makeContractCall({
    contractAddress: CONFIG.CONTRACT_ADDRESS,
    contractName: CONFIG.CONTRACT_NAME,
    functionName: 'mint',
    functionArgs: [],
    senderKey: privateKey,
    network: getNetwork(),
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: CONFIG.FEE,
    nonce: BigInt(nonce),
  });

  return broadcastTransaction({ transaction: tx, network: getNetwork() });
}

function parseArgs(argv) {
  const args = {
    walletFile: DEFAULT_WALLET_FILE,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--wallet-file' && argv[i + 1]) {
      args.walletFile = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

function parseCsvWallets(csvRaw) {
  const lines = csvRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const header = lines[0].split(',').map((h) => h.trim());
  const addrIndex = header.indexOf('address');
  const pkIndex = header.indexOf('privateKey');

  if (addrIndex === -1 || pkIndex === -1) {
    throw new Error('CSV is missing required columns: address, privateKey');
  }

  return lines.slice(1).map((line) => {
    const parts = line.split(',');
    return {
      address: (parts[addrIndex] || '').trim(),
      privateKey: (parts[pkIndex] || '').trim(),
    };
  });
}

function loadWallets(walletFile) {
  const absolutePath = resolve(walletFile.replace(/^~\//, `${process.env.HOME || ''}/`));
  const raw = readFileSync(absolutePath, 'utf8');

  let wallets;

  if (absolutePath.endsWith('.csv')) {
    wallets = parseCsvWallets(raw);
  } else {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      wallets = parsed;
    } else if (Array.isArray(parsed.wallets)) {
      wallets = parsed.wallets;
    } else {
      throw new Error('JSON wallet file must be an array or have a wallets[] field');
    }
  }

  const filtered = wallets
    .map((wallet) => ({
      address: wallet.address,
      privateKey: wallet.privateKey,
    }))
    .filter((wallet) => wallet.privateKey);

  return { wallets: filtered, absolutePath };
}


function printHelp() {
  console.log('Usage: node multi-wallet-mint.js [--wallet-file <path>] [--dry-run]');
  console.log('');
  console.log('Defaults:');
  console.log(`  Wallet file: ${DEFAULT_WALLET_FILE}`);
  console.log(`  Network: ${CONFIG.NETWORK}`);
  console.log(`  Contract: ${CONFIG.CONTRACT_ADDRESS}.${CONFIG.CONTRACT_NAME}`);
  console.log(`  Wallet limit: ${CONFIG.WALLET_LIMIT}`);
  console.log(`  Start index: ${CONFIG.START_INDEX}`);
  console.log(`  Mints per wallet: ${CONFIG.MINTS_PER_WALLET}`);
  console.log('');
  console.log('Environment variables:');
  console.log('  NETWORK=mainnet|testnet');
  console.log('  CONTRACT_ADDRESS=<address>');
  console.log('  CONTRACT_NAME=<name>');
  console.log('  FEE_MICROSTX=10000');
  console.log('  WALLET_LIMIT=50');
  console.log('  START_INDEX=0');
  console.log('  MINTS_PER_WALLET=1');
  console.log('  DELAY_MS=400');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (CONFIG.WALLET_LIMIT <= 0) {
    throw new Error('WALLET_LIMIT must be greater than 0');
  }

  if (CONFIG.MINTS_PER_WALLET <= 0) {
    throw new Error('MINTS_PER_WALLET must be greater than 0');
  }

  const { wallets, absolutePath } = loadWallets(args.walletFile);

  const selectedWallets = wallets.slice(
    CONFIG.START_INDEX,
    CONFIG.START_INDEX + CONFIG.WALLET_LIMIT,
  );

  if (selectedWallets.length === 0) {
    throw new Error('No wallets selected. Check wallet file, START_INDEX, and WALLET_LIMIT.');
  }

  console.log(`Network: ${CONFIG.NETWORK}`);
  console.log(`Contract: ${CONFIG.CONTRACT_ADDRESS}.${CONFIG.CONTRACT_NAME}`);
  console.log(`Wallet file: ${absolutePath}`);
  console.log(`Selected wallets: ${selectedWallets.length}`);
  console.log(`Mints per wallet: ${CONFIG.MINTS_PER_WALLET}`);
  console.log(`Delay between transactions: ${CONFIG.DELAY_MS}ms`);
  console.log(`Dry run: ${args.dryRun ? 'yes' : 'no'}`);
  console.log('');

  if (args.dryRun) {
    selectedWallets.forEach((wallet, idx) => {
      const address = wallet.address || getAddressFromPrivateKey(wallet.privateKey, CONFIG.NETWORK);
      console.log(`[DRY RUN] Wallet ${idx + 1}/${selectedWallets.length}: ${maskAddress(address)}`);
    });
    return;
  }

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < selectedWallets.length; i += 1) {
    const wallet = selectedWallets[i];
    const address = wallet.address || getAddressFromPrivateKey(wallet.privateKey, CONFIG.NETWORK);

    console.log(`Wallet ${i + 1}/${selectedWallets.length}: ${maskAddress(address)}`);

    let nonce;
    try {
      nonce = await getAccountNonce(address);
      console.log(`  Starting nonce: ${nonce}`);
    } catch (error) {
      console.log(`  Failed to fetch nonce: ${error.message}`);
      failCount += CONFIG.MINTS_PER_WALLET;
      results.push({
        address,
        success: false,
        error: `nonce-fetch: ${error.message}`,
      });
      continue;
    }

    for (let mintIndex = 0; mintIndex < CONFIG.MINTS_PER_WALLET; mintIndex += 1) {
      try {
        const res = await mintNFT(wallet.privateKey, nonce);

        if (res.error) {
          const errorMessage = res.reason
            ? `${res.error} (${res.reason})`
            : res.error;
          console.log(`  Mint ${mintIndex + 1}: FAILED -> ${errorMessage}`);
          failCount += 1;
          results.push({
            address,
            success: false,
            error: errorMessage,
            reason: res.reason,
            reasonData: res.reason_data,
          });
        } else {
          console.log(`  Mint ${mintIndex + 1}: OK -> ${res.txid}`);
          successCount += 1;
          results.push({
            address,
            success: true,
            txid: res.txid,
          });
          nonce += 1;
        }
      } catch (error) {
        console.log(`  Mint ${mintIndex + 1}: ERROR -> ${error.message}`);
        failCount += 1;
        results.push({
          address,
          success: false,
          error: error.message,
        });
      }

      const isLastWallet = i === selectedWallets.length - 1;
      const isLastMint = mintIndex === CONFIG.MINTS_PER_WALLET - 1;
      if (!isLastWallet || !isLastMint) {
        await sleep(CONFIG.DELAY_MS);
      }
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = `multi-wallet-mint-report-${timestamp}.json`;

  writeFileSync(
    reportFile,
    JSON.stringify(
      {
        network: CONFIG.NETWORK,
        contract: `${CONFIG.CONTRACT_ADDRESS}.${CONFIG.CONTRACT_NAME}`,
        walletFile: absolutePath,
        selectedWallets: selectedWallets.length,
        mintsPerWallet: CONFIG.MINTS_PER_WALLET,
        successCount,
        failCount,
        createdAt: new Date().toISOString(),
        results,
      },
      null,
      2,
    ),
  );

  console.log('');
  console.log('=== Summary ===');
  console.log(`Successful mints: ${successCount}`);
  console.log(`Failed mints: ${failCount}`);
  console.log(`Report: ${reportFile}`);

  if (successCount > 0) {
    const explorerBase =
      CONFIG.NETWORK === 'mainnet'
        ? 'https://explorer.hiro.so/txid/'
        : 'https://explorer.hiro.so/txid/?chain=testnet&txid=';

    console.log('Explorer links:');
    results
      .filter((item) => item.success && item.txid)
      .forEach((item) => console.log(`  ${explorerBase}${item.txid}`));
  }
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
