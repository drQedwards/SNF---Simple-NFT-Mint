#!/usr/bin/env node
// Multi-wallet marketplace interaction runner (list-nft)
// Default wallet source: /home/thee1/SpinningB/generated/mainnet-wallets.json

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  getAddressFromPrivateKey,
  uintCV,
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';

const DEFAULT_WALLET_FILE = '/home/thee1/SpinningB/generated/mainnet-wallets.json';

const CONFIG = {
  NETWORK: process.env.NETWORK || 'mainnet',
  MARKETPLACE_CONTRACT_ADDRESS:
    process.env.MARKETPLACE_CONTRACT_ADDRESS || 'SP31G2FZ5JN87BATZMP4ZRYE5F7WZQDNEXJ7G7X97',
  MARKETPLACE_CONTRACT_NAME: process.env.MARKETPLACE_CONTRACT_NAME || 'nft-marketplace-v2',
  NFT_ASSET_IDENTIFIER:
    process.env.NFT_ASSET_IDENTIFIER ||
    'SP31G2FZ5JN87BATZMP4ZRYE5F7WZQDNEXJ7G7X97.simple-nft-v4::simple-nft',
  LIST_PRICE_MICROSTX: BigInt(process.env.LIST_PRICE_MICROSTX || '50000'), // 0.05 STX
  FEE_MICROSTX: BigInt(process.env.FEE_MICROSTX || '10000'),
  DELAY_MS: Number.parseInt(process.env.DELAY_MS || '1800', 10),
  WALLET_LIMIT: Number.parseInt(process.env.WALLET_LIMIT || '50', 10),
  START_INDEX: Number.parseInt(process.env.START_INDEX || '0', 10),
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

async function getFirstOwnedTokenId(address) {
  const url = `${getApiUrl()}/extended/v1/tokens/nft/holdings?principal=${address}&asset_identifiers=${CONFIG.NFT_ASSET_IDENTIFIER}&limit=50`;
  const data = await fetchJsonWithRetry(url);
  const first = (data.results || [])[0];

  if (!first || !first.value || !first.value.repr) {
    return null;
  }

  const tokenId = first.value.repr.replace(/^u/, '');
  if (!/^\d+$/.test(tokenId)) {
    return null;
  }

  return BigInt(tokenId);
}

async function listNft(privateKey, nonce, tokenId) {
  const tx = await makeContractCall({
    contractAddress: CONFIG.MARKETPLACE_CONTRACT_ADDRESS,
    contractName: CONFIG.MARKETPLACE_CONTRACT_NAME,
    functionName: 'list-nft',
    functionArgs: [uintCV(tokenId), uintCV(CONFIG.LIST_PRICE_MICROSTX)],
    senderKey: privateKey,
    network: getNetwork(),
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: CONFIG.FEE_MICROSTX,
    nonce: BigInt(nonce),
  });

  return broadcastTransaction({ transaction: tx, network: getNetwork() });
}

function printHelp() {
  console.log('Usage: node multi-wallet-marketplace.js [--wallet-file <path>] [--dry-run]');
  console.log('');
  console.log('Defaults:');
  console.log(`  Wallet file: ${DEFAULT_WALLET_FILE}`);
  console.log(`  Network: ${CONFIG.NETWORK}`);
  console.log(`  Marketplace: ${CONFIG.MARKETPLACE_CONTRACT_ADDRESS}.${CONFIG.MARKETPLACE_CONTRACT_NAME}`);
  console.log(`  NFT asset: ${CONFIG.NFT_ASSET_IDENTIFIER}`);
  console.log(`  List price (microSTX): ${CONFIG.LIST_PRICE_MICROSTX.toString()}`);
  console.log(`  Wallet limit: ${CONFIG.WALLET_LIMIT}`);
  console.log(`  Start index: ${CONFIG.START_INDEX}`);
  console.log('');
  console.log('Environment variables:');
  console.log('  NETWORK=mainnet|testnet');
  console.log('  MARKETPLACE_CONTRACT_ADDRESS=<address>');
  console.log('  MARKETPLACE_CONTRACT_NAME=nft-marketplace-v2');
  console.log('  NFT_ASSET_IDENTIFIER=<contract.asset>');
  console.log('  LIST_PRICE_MICROSTX=50000');
  console.log('  FEE_MICROSTX=10000');
  console.log('  WALLET_LIMIT=50');
  console.log('  START_INDEX=0');
  console.log('  DELAY_MS=1800');
  console.log('  RETRY_ATTEMPTS=5');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const { wallets, absolutePath } = loadWallets(args.walletFile);
  const selectedWallets = wallets.slice(CONFIG.START_INDEX, CONFIG.START_INDEX + CONFIG.WALLET_LIMIT);

  if (selectedWallets.length === 0) {
    throw new Error('No wallets selected. Check wallet file, START_INDEX, and WALLET_LIMIT.');
  }

  console.log(`Network: ${CONFIG.NETWORK}`);
  console.log(`Marketplace: ${CONFIG.MARKETPLACE_CONTRACT_ADDRESS}.${CONFIG.MARKETPLACE_CONTRACT_NAME}`);
  console.log(`NFT asset: ${CONFIG.NFT_ASSET_IDENTIFIER}`);
  console.log(`Wallet file: ${absolutePath}`);
  console.log(`Selected wallets: ${selectedWallets.length}`);
  console.log(`List price (microSTX): ${CONFIG.LIST_PRICE_MICROSTX.toString()}`);
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

    let tokenId;
    try {
      tokenId = await getFirstOwnedTokenId(address);
      if (tokenId === null) {
        throw new Error('No owned token found for configured NFT asset');
      }
      console.log(`  Token selected: ${tokenId.toString()}`);
    } catch (error) {
      console.log(`  Failed token lookup: ${error.message}`);
      failCount += 1;
      results.push({
        address,
        success: false,
        error: `token-lookup: ${error.message}`,
      });
      continue;
    }

    let nonce;
    try {
      nonce = await getAccountNonce(address);
      console.log(`  Starting nonce: ${nonce}`);
    } catch (error) {
      console.log(`  Failed to fetch nonce: ${error.message}`);
      failCount += 1;
      results.push({
        address,
        tokenId: tokenId.toString(),
        success: false,
        error: `nonce-fetch: ${error.message}`,
      });
      continue;
    }

    try {
      const res = await listNft(wallet.privateKey, nonce, tokenId);

      if (res.error) {
        const errorMessage = res.reason ? `${res.error} (${res.reason})` : res.error;
        console.log(`  List: FAILED -> ${errorMessage}`);
        failCount += 1;
        results.push({
          address,
          tokenId: tokenId.toString(),
          success: false,
          error: errorMessage,
          reason: res.reason,
          reasonData: res.reason_data,
          txid: res.txid,
        });
      } else {
        console.log(`  List: OK -> ${res.txid}`);
        successCount += 1;
        results.push({
          address,
          tokenId: tokenId.toString(),
          success: true,
          txid: res.txid,
        });
      }
    } catch (error) {
      console.log(`  List: ERROR -> ${error.message}`);
      failCount += 1;
      results.push({
        address,
        tokenId: tokenId.toString(),
        success: false,
        error: error.message,
      });
    }

    if (i < selectedWallets.length - 1) {
      await sleep(CONFIG.DELAY_MS);
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = `multi-wallet-marketplace-report-${timestamp}.json`;

  writeFileSync(
    reportFile,
    JSON.stringify(
      {
        network: CONFIG.NETWORK,
        marketplace: `${CONFIG.MARKETPLACE_CONTRACT_ADDRESS}.${CONFIG.MARKETPLACE_CONTRACT_NAME}`,
        nftAssetIdentifier: CONFIG.NFT_ASSET_IDENTIFIER,
        listPriceMicroStx: CONFIG.LIST_PRICE_MICROSTX.toString(),
        walletFile: absolutePath,
        selectedWallets: selectedWallets.length,
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
  console.log(`Successful interactions: ${successCount}`);
  console.log(`Failed interactions: ${failCount}`);
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
