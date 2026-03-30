#!/usr/bin/env node
// Script minting - Mint NFTs programmatically with private key
// Usage: node mint-script.js <private-key> [count]

import { 
  makeContractCall, 
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
//   getNonce
} from '@stacks/transactions';
import { STACKS_DEVNET, STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';

// Configuration - UPDATE THESE
const CONFIG = {
  CONTRACT_ADDRESS: 'SP31G2FZ5JN87BATZMP4ZRYE5F7WZQDNEXJ7G7X97',
  CONTRACT_NAME: 'simple-nft-v3',
  NETWORK: process.env.NETWORK || 'mainnet',
  DEVNET_API_URL: process.env.DEVNET_API_URL || 'http://127.0.0.1:3999'
};

function getNetwork() {
  // Keep broadcast endpoint aligned with nonce reads when DEVNET_API_URL is overridden.
  if (CONFIG.NETWORK === 'mainnet') return STACKS_MAINNET;
  if (CONFIG.NETWORK === 'devnet') {
    return {
      ...STACKS_DEVNET,
      url: CONFIG.DEVNET_API_URL,
      client: STACKS_DEVNET.client
        ? { ...STACKS_DEVNET.client, baseUrl: CONFIG.DEVNET_API_URL }
        : STACKS_DEVNET.client
    };
  }
  return STACKS_TESTNET;
}

async function getAccountNonce(address) {
  const apiUrl = CONFIG.NETWORK === 'mainnet'
    ? 'https://api.mainnet.hiro.so'
    : CONFIG.NETWORK === 'devnet'
      ? CONFIG.DEVNET_API_URL
      : 'https://api.testnet.hiro.so';
  
  const response = await fetch(`${apiUrl}/extended/v1/address/${address}/nonces`);
  const data = await response.json();
  return data.possible_next_nonce;
}

async function mintNFT(privateKey, nonce) {
  const network = getNetwork();
  
  const txOptions = {
    contractAddress: CONFIG.CONTRACT_ADDRESS,
    contractName: CONFIG.CONTRACT_NAME,
    functionName: 'mint',
    functionArgs: [],
    senderKey: privateKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Allow,
    fee: 10000n, // 0.01 STX fee
    nonce: BigInt(nonce)
  };
  
  const tx = await makeContractCall(txOptions);
  const broadcastResponse = await broadcastTransaction({ transaction: tx, network });
  
  return broadcastResponse;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log('Usage: node mint-script.js <private-key> [count]');
    console.log('');
    console.log('Arguments:');
    console.log('  private-key  Your Stacks private key (hex format)');
    console.log('  count        Number of NFTs to mint (default: 1)');
    console.log('');
    console.log('Environment:');
    console.log('  NETWORK      Network to use: mainnet, testnet, or devnet (default: mainnet)');
    console.log('  DEVNET_API_URL Devnet API base URL (default: http://127.0.0.1:3999)');
    process.exit(1);
  }
  
  const privateKey = args[0];
  const count = parseInt(args[1]) || 1;
  
  console.log(`Minting ${count} NFT(s) on ${CONFIG.NETWORK}...`);
  console.log(`Contract: ${CONFIG.CONTRACT_ADDRESS}.${CONFIG.CONTRACT_NAME}`);
  console.log('');
  
  // Get sender address from private key
  const { getAddressFromPrivateKey } = await import('@stacks/transactions');
  const senderAddress = getAddressFromPrivateKey(
    privateKey,
    CONFIG.NETWORK === 'mainnet' ? 'mainnet' : CONFIG.NETWORK === 'devnet' ? 'testnet' : 'testnet'
  );
  console.log(`Sender: ${senderAddress}`);
  
  // Get starting nonce
  let nonce = await getAccountNonce(senderAddress);
  console.log(`Starting nonce: ${nonce}`);
  console.log('');
  
  const results = [];
  
  for (let i = 0; i < count; i++) {
    try {
      console.log(`Minting NFT ${i + 1}/${count}...`);
      const result = await mintNFT(privateKey, nonce);
      
      if (result.error) {
        console.log(`  ❌ Failed: ${result.error}`);
        results.push({ success: false, error: result.error });
      } else {
        console.log(`  ✅ TX: ${result.txid}`);
        results.push({ success: true, txid: result.txid });
        nonce++;
      }
      
      // Small delay between mints
      if (i < count - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      results.push({ success: false, error: error.message });
    }
  }
  
  // Summary
  console.log('');
  console.log('=== Summary ===');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  
  if (successful > 0) {
    const explorerBase = CONFIG.NETWORK === 'mainnet'
      ? 'https://explorer.hiro.so/txid/'
      : 'https://explorer.hiro.so/txid/?chain=testnet&txid=';
    
    console.log('');
    console.log('Transaction IDs:');
    results.filter(r => r.success).forEach(r => {
      console.log(`  ${explorerBase}${r.txid}`);
    });
  }
}

main().catch(console.error);
