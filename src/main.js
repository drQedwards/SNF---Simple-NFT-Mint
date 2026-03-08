// NFT Marketplace App - REOWN AppKit with Stacks Integration
// Uses REOWN AppKit for wallet modal with Stacks blockchain support

import { createAppKit } from '@reown/appkit';
import { AppConfig, UserSession, showConnect, openContractCall } from '@stacks/connect';
import { deserializeCV, cvToValue, uintCV } from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';

// Configuration
const CONFIG = {
  NFT_CONTRACT_ADDRESS: 'SP31G2FZ5JN87BATZMP4ZRYE5F7WZQDNEXJ7G7X97',
  NFT_CONTRACT_NAME: 'simple-nft-v4',
  MARKETPLACE_CONTRACT_ADDRESS: 'SP31G2FZ5JN87BATZMP4ZRYE5F7WZQDNEXJ7G7X97',
  MARKETPLACE_CONTRACT_NAME: 'nft-marketplace-v2',
  NETWORK: 'mainnet',
  MINT_PRICE: 1000, // 0.001 STX
  LIST_FEE: 1300,   // 0.0013 STX
  APP_NAME: 'Simple NFT Marketplace',
  APP_ICON: window.location.origin + '/icon.png',
  // REOWN Project ID - Get yours at https://cloud.reown.com
  REOWN_PROJECT_ID: '4fb22bec203d094dbec52767e3bcc016'
};

// Stacks session for transaction signing
const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

// Custom Stacks network definition for REOWN
const stacksMainnet = {
  id: 'stacks:1',
  name: 'Stacks Mainnet',
  nativeCurrency: {
    name: 'STX',
    symbol: 'STX',
    decimals: 6
  },
  rpcUrls: {
    default: { http: ['https://api.mainnet.hiro.so'] }
  },
  blockExplorers: {
    default: { name: 'Hiro Explorer', url: 'https://explorer.hiro.so' }
  }
};

// Initialize REOWN AppKit
let appKit = null;

function initAppKit() {
  try {
    appKit = createAppKit({
      projectId: CONFIG.REOWN_PROJECT_ID,
      metadata: {
        name: CONFIG.APP_NAME,
        description: 'Mint, list, and trade NFTs on Stacks blockchain',
        url: window.location.origin,
        icons: [CONFIG.APP_ICON]
      },
      themeMode: 'dark',
      themeVariables: {
        '--w3m-accent': '#d73345',
        '--w3m-border-radius-master': '14px'
      }
    });
    console.log('REOWN AppKit initialized');
  } catch (error) {
    console.warn('REOWN AppKit init failed, using fallback:', error);
  }
}

// DOM Elements
const elements = {
  connectBtn: document.getElementById('connect-btn'),
  mintBtn: document.getElementById('mint-btn'),
  listBtn: document.getElementById('list-btn'),
  disconnectBtn: document.getElementById('disconnect-btn'),
  notConnected: document.getElementById('not-connected'),
  connected: document.getElementById('connected'),
  walletAddress: document.getElementById('wallet-address'),
  status: document.getElementById('status'),
  minted: document.getElementById('minted'),
  listed: document.getElementById('listed'),
  nftList: document.getElementById('nft-list')
};

// State
let userAddress = null;
let userNFTs = [];

// Show status message
function showStatus(message, type = 'info') {
  elements.status.textContent = message;
  elements.status.className = `status ${type}`;
  elements.status.classList.remove('hidden');
}

// Hide status
function hideStatus() {
  elements.status.classList.add('hidden');
}

// Update UI based on connection state
function updateUI() {
  if (userAddress) {
    elements.notConnected.classList.add('hidden');
    elements.connected.classList.remove('hidden');
    elements.walletAddress.textContent = `${userAddress.slice(0, 8)}...${userAddress.slice(-8)}`;
    fetchUserNFTs();
  } else {
    elements.notConnected.classList.remove('hidden');
    elements.connected.classList.add('hidden');
    if (elements.nftList) elements.nftList.innerHTML = '';
  }
}

// Connect wallet - tries REOWN first, falls back to Stacks Connect
async function connectWallet() {
  showStatus('Opening wallet...', 'info');
  
  // Use Stacks Connect for Stacks wallets (Leather, Xverse)
  showConnect({
    appDetails: {
      name: CONFIG.APP_NAME,
      icon: CONFIG.APP_ICON,
    },
    redirectTo: '/',
    onFinish: () => {
      hideStatus();
      const userData = userSession.loadUserData();
      userAddress = userData.profile.stxAddress.mainnet;
      updateUI();
      showStatus('Connected!', 'success');
      setTimeout(hideStatus, 2000);
      fetchMintedCount();
    },
    onCancel: () => {
      showStatus('Connection cancelled', 'error');
      setTimeout(hideStatus, 3000);
    },
    userSession,
  });
}

// Disconnect wallet
function disconnectWallet() {
  userSession.signUserOut('/');
  userAddress = null;
  userNFTs = [];
  updateUI();
  hideStatus();
}

// API helpers
function getApiUrl() {
  return CONFIG.NETWORK === 'mainnet' 
    ? 'https://api.mainnet.hiro.so'
    : 'https://api.testnet.hiro.so';
}

// Fetch minted count from contract
async function fetchMintedCount() {
  try {
    const response = await fetch(
      `${getApiUrl()}/v2/contracts/call-read/${CONFIG.NFT_CONTRACT_ADDRESS}/${CONFIG.NFT_CONTRACT_NAME}/get-total-minted`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: CONFIG.NFT_CONTRACT_ADDRESS,
          arguments: []
        })
      }
    );
    
    const data = await response.json();
    if (data.okay && data.result) {
      const cv = deserializeCV(data.result);
      const value = cvToValue(cv);
      elements.minted.textContent = value.toLocaleString();
    }
  } catch (error) {
    console.error('Failed to fetch minted count:', error);
    elements.minted.textContent = '0';
  }
}

// Fetch user's NFTs
async function fetchUserNFTs() {
  if (!userAddress) return;
  
  try {
    const response = await fetch(
      `${getApiUrl()}/extended/v1/tokens/nft/holdings?principal=${userAddress}&asset_identifiers=${CONFIG.NFT_CONTRACT_ADDRESS}.${CONFIG.NFT_CONTRACT_NAME}::simple-nft`
    );
    const data = await response.json();
    userNFTs = data.results || [];
    renderNFTList();
  } catch (error) {
    console.error('Failed to fetch NFTs:', error);
    userNFTs = [];
  }
}

// Render user's NFT list
function renderNFTList() {
  if (!elements.nftList) return;
  
  if (userNFTs.length === 0) {
    elements.nftList.innerHTML = '<p class="no-nfts">No NFTs yet. Mint one!</p>';
    return;
  }
  
  elements.nftList.innerHTML = userNFTs.map(nft => {
    const tokenId = nft.value.repr.replace('u', '');
    return `
      <div class="nft-card">
        <div class="nft-image">🎨</div>
        <div class="nft-info">
          <span class="nft-id">#${tokenId}</span>
          <button class="list-nft-btn" data-token-id="${tokenId}">List for Sale</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Add event listeners to list buttons
  document.querySelectorAll('.list-nft-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tokenId = e.target.dataset.tokenId;
      listNFT(parseInt(tokenId));
    });
  });
}

// Mint NFT
function mintNFT() {
  if (!userAddress) {
    showStatus('Please connect your wallet first', 'error');
    return;
  }
  
  elements.mintBtn.disabled = true;
  showStatus('Opening wallet for approval...', 'info');
  
  openContractCall({
    contractAddress: CONFIG.NFT_CONTRACT_ADDRESS,
    contractName: CONFIG.NFT_CONTRACT_NAME,
    functionName: 'mint',
    functionArgs: [],
    network: CONFIG.NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET,
    appDetails: {
      name: CONFIG.APP_NAME,
      icon: CONFIG.APP_ICON,
    },
    onFinish: (data) => {
      const txId = data.txId;
      const explorerUrl = `https://explorer.hiro.so/txid/${txId}?chain=${CONFIG.NETWORK}`;
      
      elements.status.className = 'status success';
      elements.status.innerHTML = `NFT minted! <a href="${explorerUrl}" target="_blank">View on Explorer</a>`;
      elements.status.classList.remove('hidden');
      elements.mintBtn.disabled = false;
      
      setTimeout(() => {
        fetchMintedCount();
        fetchUserNFTs();
      }, 10000);
    },
    onCancel: () => {
      showStatus('Transaction cancelled', 'error');
      elements.mintBtn.disabled = false;
      setTimeout(hideStatus, 3000);
    },
    userSession,
  });
}

// List NFT for sale
function listNFT(tokenId) {
  if (!userAddress) {
    showStatus('Please connect your wallet first', 'error');
    return;
  }
  
  const price = prompt('Enter listing price in STX (e.g., 0.01):');
  if (!price) return;
  
  const priceInMicroSTX = Math.floor(parseFloat(price) * 1000000);
  if (priceInMicroSTX <= CONFIG.LIST_FEE) {
    showStatus('Price must be greater than 0.0013 STX', 'error');
    return;
  }
  
  showStatus('Opening wallet for listing approval...', 'info');
  
  openContractCall({
    contractAddress: CONFIG.MARKETPLACE_CONTRACT_ADDRESS,
    contractName: CONFIG.MARKETPLACE_CONTRACT_NAME,
    functionName: 'list-nft',
    functionArgs: [uintCV(tokenId), uintCV(priceInMicroSTX)],
    network: CONFIG.NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET,
    appDetails: {
      name: CONFIG.APP_NAME,
      icon: CONFIG.APP_ICON,
    },
    onFinish: (data) => {
      const txId = data.txId;
      const explorerUrl = `https://explorer.hiro.so/txid/${txId}?chain=${CONFIG.NETWORK}`;
      
      elements.status.className = 'status success';
      elements.status.innerHTML = `NFT #${tokenId} listed! <a href="${explorerUrl}" target="_blank">View on Explorer</a>`;
      elements.status.classList.remove('hidden');
      
      setTimeout(fetchUserNFTs, 10000);
    },
    onCancel: () => {
      showStatus('Listing cancelled', 'error');
      setTimeout(hideStatus, 3000);
    },
    userSession,
  });
}

// Buy NFT
function buyNFT(tokenId) {
  if (!userAddress) {
    showStatus('Please connect your wallet first', 'error');
    return;
  }
  
  showStatus('Opening wallet for purchase approval...', 'info');
  
  openContractCall({
    contractAddress: CONFIG.MARKETPLACE_CONTRACT_ADDRESS,
    contractName: CONFIG.MARKETPLACE_CONTRACT_NAME,
    functionName: 'buy-nft',
    functionArgs: [uintCV(tokenId)],
    network: CONFIG.NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET,
    appDetails: {
      name: CONFIG.APP_NAME,
      icon: CONFIG.APP_ICON,
    },
    onFinish: (data) => {
      const txId = data.txId;
      const explorerUrl = `https://explorer.hiro.so/txid/${txId}?chain=${CONFIG.NETWORK}`;
      
      elements.status.className = 'status success';
      elements.status.innerHTML = `NFT purchased! <a href="${explorerUrl}" target="_blank">View on Explorer</a>`;
      elements.status.classList.remove('hidden');
      
      setTimeout(fetchUserNFTs, 10000);
    },
    onCancel: () => {
      showStatus('Purchase cancelled', 'error');
      setTimeout(hideStatus, 3000);
    },
    userSession,
  });
}

// Event listeners
elements.connectBtn?.addEventListener('click', connectWallet);
elements.mintBtn?.addEventListener('click', mintNFT);
elements.disconnectBtn?.addEventListener('click', disconnectWallet);

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initAppKit();
  fetchMintedCount();
  
  // Check for existing session
  if (userSession.isUserSignedIn()) {
    const userData = userSession.loadUserData();
    userAddress = userData.profile.stxAddress.mainnet;
    updateUI();
  }
  
  // Handle redirect from wallet
  if (userSession.isSignInPending()) {
    userSession.handlePendingSignIn().then((userData) => {
      userAddress = userData.profile.stxAddress.mainnet;
      updateUI();
    });
  }
});

// Export for use in HTML
window.buyNFT = buyNFT;
window.listNFT = listNFT;
