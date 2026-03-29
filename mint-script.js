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
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';

// Configuration - UPDATE THESE
const CONFIG = {
  CONTRACT_ADDRESS: 'SP31G2FZ5JN87BATZMP4ZRYE5F7WZQDNEXJ7G7X97',
  CONTRACT_NAME: 'simple-nft-v4',
  NETWORK: process.env.NETWORK || 'mainnet'
};

function getNetwork() {
  return CONFIG.NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}

async function getAccountNonce(address) {
  const network = getNetwork();
  const apiUrl = CONFIG.NETWORK === 'mainnet'
    ? 'https://api.mainnet.hiro.so'
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
    console.log('  NETWORK      Network to use: mainnet or testnet (default: mainnet)');
    process.exit(1);
  }
  
  const privateKey = args[0];
  const count = parseInt(args[1]) || 1;
  
  console.log(`Minting ${count} NFT(s) on ${CONFIG.NETWORK}...`);
  console.log(`Contract: ${CONFIG.CONTRACT_ADDRESS}.${CONFIG.CONTRACT_NAME}`);
  console.log('');
  
  // Get sender address from private key
  const { getAddressFromPrivateKey, TransactionVersion } = await import('@stacks/transactions');
  const senderAddress = getAddressFromPrivateKey(
    privateKey,
    CONFIG.NETWORK === 'mainnet' ? 'mainnet' : 'testnet'
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
        const errorMessage = result.reason
          ? `${result.error} (${result.reason})`
          : result.error;
        console.log(`  ❌ Failed: ${errorMessage}`);
        results.push({
          success: false,
          error: errorMessage,
          reason: result.reason,
          reasonData: result.reason_data
        });
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
