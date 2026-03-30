#!/usr/bin/env node
// Deploy the Simple NFT contract to Stacks mainnet
// Usage: node deploy-contract.js

import { 
  makeContractDeploy, 
  broadcastTransaction,
  AnchorMode,
  PostConditionMode
} from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';
import { generateWallet, getStxAddress } from '@stacks/wallet-sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  NETWORK: process.env.NETWORK || 'mainnet',
  CONTRACT_NAME: process.env.CONTRACT_NAME || 'simple-nft-v3',
  CONTRACT_FILE: process.env.CONTRACT_FILE || 'simple-nft-v3.clar',
  MNEMONIC: process.env.STACKS_MNEMONIC
};

function getNetwork() {
  return CONFIG.NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}

async function getAccountNonce(address) {
  const apiUrl = CONFIG.NETWORK === 'mainnet'
    ? 'https://api.mainnet.hiro.so'
    : 'https://api.testnet.hiro.so';
  
  const response = await fetch(`${apiUrl}/extended/v1/address/${address}/nonces`);
  const data = await response.json();
  return data.possible_next_nonce;
}

async function main() {
  console.log('=== Simple NFT Contract Deployment ===\n');
  console.log(`Network: ${CONFIG.NETWORK}`);

  if (!CONFIG.MNEMONIC) {
    console.error('Missing STACKS_MNEMONIC environment variable.');
    process.exit(1);
  }
  
  // Generate wallet from mnemonic
  const wallet = await generateWallet({
    secretKey: CONFIG.MNEMONIC,
    password: ''
  });
  
  const account = wallet.accounts[0];
  const privateKey = account.stxPrivateKey;
  const senderAddress = getStxAddress({
    account,
    transactionVersion: CONFIG.NETWORK === 'mainnet' ? 0x16 : 0x1a // Mainnet = 0x16, Testnet = 0x1a
  });
  
  console.log(`Deployer: ${senderAddress}`);
  
  // Read contract source
  const contractPath = join(__dirname, 'contracts', CONFIG.CONTRACT_FILE);
  const contractSource = readFileSync(contractPath, 'utf8');
  console.log(`Contract: ${CONFIG.CONTRACT_NAME}`);
  console.log(`Source file: ${CONFIG.CONTRACT_FILE}`);
  console.log(`Contract size: ${contractSource.length} bytes\n`);
  
  // Get nonce
  const nonce = await getAccountNonce(senderAddress);
  console.log(`Nonce: ${nonce}`);
  
  // Check balance
  const apiUrl = CONFIG.NETWORK === 'mainnet'
    ? 'https://api.mainnet.hiro.so'
    : 'https://api.testnet.hiro.so';
  
  const balanceRes = await fetch(`${apiUrl}/extended/v1/address/${senderAddress}/stx`);
  const balanceData = await balanceRes.json();
  const balance = parseInt(balanceData.balance) / 1000000;
  console.log(`Balance: ${balance} STX\n`);
  
  if (balance < 0.5) {
    console.log('⚠️  Warning: Low balance. Contract deployment requires ~0.1-0.5 STX in fees.');
  }
  
  // Create deployment transaction
  console.log('Building deployment transaction...');
  
  const txOptions = {
    contractName: CONFIG.CONTRACT_NAME,
    codeBody: contractSource,
    senderKey: privateKey,
    network: getNetwork(),
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 500000n, // 0.5 STX fee for contract deployment
    nonce: BigInt(nonce)
  };
  
  const tx = await makeContractDeploy(txOptions);
  
  console.log('Broadcasting transaction...\n');
  
  const broadcastResponse = await broadcastTransaction({ 
    transaction: tx, 
    network: getNetwork() 
  });
  
  if (broadcastResponse.error) {
    console.log('❌ Deployment failed!');
    console.log(`Error: ${broadcastResponse.error}`);
    console.log(`Reason: ${broadcastResponse.reason}`);
    if (broadcastResponse.reason_data) {
      console.log('Details:', JSON.stringify(broadcastResponse.reason_data, null, 2));
    }
    process.exit(1);
  }
  
  const txId = broadcastResponse.txid;
  console.log('✅ Contract deployment submitted!\n');
  console.log(`Transaction ID: ${txId}`);
  
  const explorerUrl = CONFIG.NETWORK === 'mainnet'
    ? `https://explorer.hiro.so/txid/${txId}`
    : `https://explorer.hiro.so/txid/${txId}?chain=testnet`;
  
  console.log(`Explorer: ${explorerUrl}\n`);
  
  console.log('=== Contract Details ===');
  console.log(`Contract Address: ${senderAddress}.${CONFIG.CONTRACT_NAME}`);
  console.log('\nUpdate your CONFIG in src/main.js and mint-script.js:');
  console.log(`  CONTRACT_ADDRESS: '${senderAddress}'`);
  console.log(`  CONTRACT_NAME: '${CONFIG.CONTRACT_NAME}'`);
  
  console.log('\n⏳ Waiting for confirmation (this may take 10-30 minutes on mainnet)...');
  console.log('   You can check the status on the explorer link above.');
}

main().catch(err => {
  console.error('Deployment error:', err);
  process.exit(1);
});
