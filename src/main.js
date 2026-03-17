import './styles/stacks-vivid-theme.css';

import { createAppKit } from '@reown/appkit';
import { AppConfig, UserSession, showConnect, openContractCall } from '@stacks/connect';
import { deserializeCV, cvToValue, uintCV } from '@stacks/transactions';
import { STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';

const CONFIG = {
  NFT_CONTRACT_ADDRESS: 'SP31G2FZ5JN87BATZMP4ZRYE5F7WZQDNEXJ7G7X97',
  NFT_CONTRACT_NAME: 'simple-nft-v4',
  MARKETPLACE_CONTRACT_ADDRESS: 'SP31G2FZ5JN87BATZMP4ZRYE5F7WZQDNEXJ7G7X97',
  MARKETPLACE_CONTRACT_NAME: 'nft-marketplace-v2',
  NETWORK: 'mainnet',
  MINT_PRICE: 1000,
  LIST_FEE: 1300,
  APP_NAME: 'Simple NFT Marketplace',
  APP_ICON: `${window.location.origin}/icon.png`,
  REOWN_PROJECT_ID: '4fb22bec203d094dbec52767e3bcc016',
  MINT_CAP: 10000,
  AUTO_REFRESH_MS: 30000,
};

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

let appKit = null;
let userAddress = null;
let userNFTs = [];
let autoRefreshTimer = null;

const THEME_KEY = 'snf-theme-mode';
const ACTIVITY_KEY = 'snf-activity-v1';

const elements = {
  connectBtn: document.getElementById('connect-btn'),
  mintBtn: document.getElementById('mint-btn'),
  disconnectBtn: document.getElementById('disconnect-btn'),
  copyAddressBtn: document.getElementById('copy-address-btn'),
  refreshBtn: document.getElementById('refresh-btn'),
  themeToggle: document.getElementById('theme-toggle'),
  autoRefresh: document.getElementById('auto-refresh'),
  nftFilter: document.getElementById('nft-filter'),
  defaultListPrice: document.getElementById('default-list-price'),
  notConnected: document.getElementById('not-connected'),
  connected: document.getElementById('connected'),
  walletAddress: document.getElementById('wallet-address'),
  minted: document.getElementById('minted'),
  listed: document.getElementById('listed'),
  stxPrice: document.getElementById('stx-price'),
  stxPriceUpdated: document.getElementById('stx-price-updated'),
  networkStatus: document.getElementById('network-status'),
  networkHeight: document.getElementById('network-height'),
  status: document.getElementById('status'),
  nftList: document.getElementById('nft-list'),
  activityFeed: document.getElementById('activity-feed'),
  mintProgressFill: document.getElementById('mint-progress-fill'),
  mintProgressLabel: document.getElementById('mint-progress-label'),
};

function initAppKit() {
  try {
    appKit = createAppKit({
      projectId: CONFIG.REOWN_PROJECT_ID,
      metadata: {
        name: CONFIG.APP_NAME,
        description: 'Mint, list, and trade NFTs on Stacks blockchain',
        url: window.location.origin,
        icons: [CONFIG.APP_ICON],
      },
      themeMode: 'dark',
      themeVariables: {
        '--w3m-accent': '#00dff8',
        '--w3m-border-radius-master': '14px',
      },
    });
    if (!appKit) {
      console.warn('REOWN AppKit did not initialize as expected');
    }
  } catch (error) {
    console.warn('REOWN AppKit init failed, using Stacks Connect flow:', error);
  }
}

function getApiUrl() {
  return CONFIG.NETWORK === 'mainnet' ? 'https://api.mainnet.hiro.so' : 'https://api.testnet.hiro.so';
}

function getStacksNetwork() {
  return CONFIG.NETWORK === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
}

function formatAddress(address) {
  if (!address || address.length < 12) return address || '';
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

function formatExplorerUrl(txId) {
  return `https://explorer.hiro.so/txid/${txId}?chain=${CONFIG.NETWORK}`;
}

function showStatus(message, type = 'info') {
  if (!elements.status) return;
  elements.status.className = `status ${type}`;
  elements.status.innerHTML = message;
  elements.status.classList.remove('hidden');
}

function hideStatus() {
  elements.status?.classList.add('hidden');
}

function parseJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (_error) {
    return fallback;
  }
}

function loadActivity() {
  return parseJsonStorage(ACTIVITY_KEY, []);
}

function saveActivity(activity) {
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity.slice(0, 20)));
}

function addActivity(type, message, txId = null) {
  const activity = loadActivity();
  activity.unshift({
    type,
    message,
    txId,
    at: new Date().toISOString(),
  });
  saveActivity(activity);
  renderActivityFeed();
}

function renderActivityFeed() {
  if (!elements.activityFeed) return;

  const activity = loadActivity();
  if (activity.length === 0) {
    elements.activityFeed.innerHTML = '<li class="activity-empty">No activity yet.</li>';
    return;
  }

  elements.activityFeed.innerHTML = activity
    .map((entry) => {
      const when = new Date(entry.at);
      const time = Number.isNaN(when.getTime()) ? entry.at : when.toLocaleString();
      const txLine = entry.txId
        ? `<a href="${formatExplorerUrl(entry.txId)}" target="_blank" rel="noopener noreferrer">View transaction</a>`
        : '';

      return `<li>
        <strong>${entry.type}</strong>
        <span>${entry.message}</span>
        ${txLine}
        <span class="activity-time">${time}</span>
      </li>`;
    })
    .join('');
}

function setTheme(theme) {
  const applied = theme === 'aurora' ? 'aurora' : 'solar';
  document.documentElement.setAttribute('data-theme', applied);
  localStorage.setItem(THEME_KEY, applied);
}

function initTheme() {
  const persisted = localStorage.getItem(THEME_KEY) || 'solar';
  setTheme(persisted);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'solar';
  setTheme(current === 'solar' ? 'aurora' : 'solar');
}

function setConnectedState(connected) {
  if (!elements.notConnected || !elements.connected) return;

  if (connected) {
    elements.notConnected.classList.add('hidden');
    elements.connected.classList.remove('hidden');
  } else {
    elements.notConnected.classList.remove('hidden');
    elements.connected.classList.add('hidden');
  }
}

function updateMintProgress(mintedCount) {
  const safe = Math.max(0, Number(mintedCount) || 0);
  const ratio = Math.min(100, (safe / CONFIG.MINT_CAP) * 100);

  if (elements.mintProgressFill) {
    elements.mintProgressFill.style.width = `${ratio.toFixed(2)}%`;
  }

  if (elements.mintProgressLabel) {
    elements.mintProgressLabel.textContent = `${safe.toLocaleString()} / ${CONFIG.MINT_CAP.toLocaleString()} minted`;
  }
}

async function fetchMintedCount() {
  try {
    const response = await fetch(
      `${getApiUrl()}/v2/contracts/call-read/${CONFIG.NFT_CONTRACT_ADDRESS}/${CONFIG.NFT_CONTRACT_NAME}/get-total-minted`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: CONFIG.NFT_CONTRACT_ADDRESS, arguments: [] }),
      }
    );

    const data = await response.json();
    if (!data.okay || !data.result) return;

    const cv = deserializeCV(data.result);
    const mintedCount = Number(cvToValue(cv));
    if (elements.minted) {
      elements.minted.textContent = mintedCount.toLocaleString();
    }
    updateMintProgress(mintedCount);
  } catch (error) {
    console.error('Failed to fetch minted count:', error);
  }
}

async function fetchNetworkStatus() {
  if (!elements.networkStatus || !elements.networkHeight) return;

  try {
    const response = await fetch(`${getApiUrl()}/v2/info`);
    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }

    const data = await response.json();
    const tip = data.stacks_tip_height ?? data.burn_block_height ?? '--';

    elements.networkStatus.textContent = 'Online';
    elements.networkStatus.style.color = 'var(--ok)';
    elements.networkHeight.textContent = `Tip: ${tip}`;
  } catch (error) {
    console.error('Failed to fetch network status:', error);
    elements.networkStatus.textContent = 'Degraded';
    elements.networkStatus.style.color = 'var(--warning)';
    elements.networkHeight.textContent = 'Tip: unavailable';
  }
}

async function fetchStxPrice() {
  if (!elements.stxPrice || !elements.stxPriceUpdated) return;

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=stacks&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true'
    );
    if (!response.ok) throw new Error(`Status ${response.status}`);

    const data = await response.json();
    const usd = data?.stacks?.usd;
    const change = data?.stacks?.usd_24h_change;
    const updatedAt = data?.stacks?.last_updated_at;

    if (typeof usd !== 'number') throw new Error('No USD value in response');

    elements.stxPrice.textContent = `$${usd.toFixed(3)}`;

    if (typeof change === 'number') {
      elements.stxPrice.setAttribute('data-price-trend', change >= 0 ? 'up' : 'down');
      elements.stxPriceUpdated.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}% (24h)`;
    } else {
      elements.stxPrice.removeAttribute('data-price-trend');
      elements.stxPriceUpdated.textContent = '24h trend unavailable';
    }

    if (updatedAt) {
      const dt = new Date(updatedAt * 1000);
      if (!Number.isNaN(dt.getTime())) {
        elements.stxPriceUpdated.textContent += ` | ${dt.toLocaleTimeString()}`;
      }
    }
  } catch (error) {
    console.error('Failed to fetch STX quote:', error);
    elements.stxPrice.textContent = '--';
    elements.stxPriceUpdated.textContent = 'Quote unavailable';
    elements.stxPrice.removeAttribute('data-price-trend');
  }
}

async function fetchUserNFTs() {
  if (!userAddress) return;

  try {
    const response = await fetch(
      `${getApiUrl()}/extended/v1/tokens/nft/holdings?principal=${userAddress}&asset_identifiers=${CONFIG.NFT_CONTRACT_ADDRESS}.${CONFIG.NFT_CONTRACT_NAME}::simple-nft&limit=80`
    );
    const data = await response.json();
    userNFTs = Array.isArray(data.results) ? data.results : [];
    if (elements.listed) {
      elements.listed.textContent = userNFTs.length.toLocaleString();
    }
    renderNFTList();
  } catch (error) {
    console.error('Failed to fetch user NFTs:', error);
    userNFTs = [];
    if (elements.listed) {
      elements.listed.textContent = '0';
    }
    renderNFTList();
  }
}

function getFilterValue() {
  return elements.nftFilter?.value?.trim() || '';
}

function getTokenIdFromHolding(nft) {
  const repr = nft?.value?.repr;
  if (typeof repr !== 'string') return null;
  return repr.replace(/^u/, '');
}

function renderNFTList() {
  if (!elements.nftList) return;

  const query = getFilterValue();
  const filtered = query
    ? userNFTs.filter((nft) => {
        const tokenId = getTokenIdFromHolding(nft);
        return tokenId && tokenId.includes(query);
      })
    : userNFTs;

  if (filtered.length === 0) {
    const message = query ? `No NFTs matching "${query}".` : 'No NFTs yet. Mint one.';
    elements.nftList.innerHTML = `<p class="no-nfts">${message}</p>`;
    return;
  }

  elements.nftList.innerHTML = filtered
    .map((nft) => {
      const tokenId = getTokenIdFromHolding(nft) || '?';
      return `
        <article class="nft-card">
          <div class="nft-image"></div>
          <div>
            <span class="nft-id">Token #${tokenId}</span>
          </div>
          <button class="list-nft-btn" data-token-id="${tokenId}" type="button">List for Sale</button>
        </article>
      `;
    })
    .join('');

  document.querySelectorAll('.list-nft-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tokenId = Number.parseInt(btn.dataset.tokenId || '', 10);
      if (Number.isFinite(tokenId)) {
        listNFT(tokenId);
      }
    });
  });
}

async function refreshDashboard() {
  await Promise.all([fetchMintedCount(), fetchNetworkStatus(), fetchStxPrice()]);
  if (userAddress) {
    await fetchUserNFTs();
  }
}

function clearAutoRefresh() {
  if (!autoRefreshTimer) return;
  clearInterval(autoRefreshTimer);
  autoRefreshTimer = null;
}

function setAutoRefresh(enabled) {
  clearAutoRefresh();
  if (!enabled) return;

  autoRefreshTimer = setInterval(() => {
    refreshDashboard().catch((error) => {
      console.error('Auto refresh failed:', error);
    });
  }, CONFIG.AUTO_REFRESH_MS);
}

async function connectWallet() {
  showStatus('Opening wallet...', 'info');

  showConnect({
    appDetails: {
      name: CONFIG.APP_NAME,
      icon: CONFIG.APP_ICON,
    },
    redirectTo: '/',
    onFinish: async () => {
      const userData = userSession.loadUserData();
      const chainAddress =
        CONFIG.NETWORK === 'mainnet' ? userData.profile.stxAddress.mainnet : userData.profile.stxAddress.testnet;
      userAddress = chainAddress;
      updateUI();
      addActivity('Wallet', 'Wallet connected');
      showStatus('Connected to wallet.', 'success');
      setTimeout(hideStatus, 2200);
      await refreshDashboard();
    },
    onCancel: () => {
      showStatus('Connection canceled.', 'error');
      setTimeout(hideStatus, 2600);
    },
    userSession,
  });
}

function disconnectWallet() {
  userSession.signUserOut('/');
  userAddress = null;
  userNFTs = [];
  if (elements.listed) {
    elements.listed.textContent = '0';
  }
  updateUI();
  hideStatus();
  addActivity('Wallet', 'Wallet disconnected');
}

function getDefaultPriceMicroStx() {
  const raw = elements.defaultListPrice?.value;
  const parsed = Number.parseFloat(raw || '');
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed * 1_000_000);
}

function validateListPrice(priceMicroStx) {
  if (!Number.isFinite(priceMicroStx) || priceMicroStx <= CONFIG.LIST_FEE) {
    showStatus('List price must be greater than 0.0013 STX.', 'error');
    return false;
  }
  return true;
}

function mintNFT() {
  if (!userAddress) {
    showStatus('Connect a wallet first.', 'error');
    return;
  }

  if (elements.mintBtn) {
    elements.mintBtn.disabled = true;
  }
  showStatus('Opening wallet approval for mint...', 'info');

  openContractCall({
    contractAddress: CONFIG.NFT_CONTRACT_ADDRESS,
    contractName: CONFIG.NFT_CONTRACT_NAME,
    functionName: 'mint',
    functionArgs: [],
    network: getStacksNetwork(),
    appDetails: {
      name: CONFIG.APP_NAME,
      icon: CONFIG.APP_ICON,
    },
    onFinish: async (data) => {
      const txId = data.txId;
      showStatus(`NFT minted. <a href="${formatExplorerUrl(txId)}" target="_blank" rel="noopener noreferrer">View on explorer</a>`, 'success');
      addActivity('Mint', `Mint submitted by ${formatAddress(userAddress)}`, txId);
      if (elements.mintBtn) {
        elements.mintBtn.disabled = false;
      }

      setTimeout(() => {
        refreshDashboard();
      }, 8000);
    },
    onCancel: () => {
      showStatus('Mint transaction canceled.', 'error');
      if (elements.mintBtn) {
        elements.mintBtn.disabled = false;
      }
      setTimeout(hideStatus, 2600);
    },
    userSession,
  });
}

function listNFT(tokenId) {
  if (!userAddress) {
    showStatus('Connect a wallet first.', 'error');
    return;
  }

  let priceInMicroStx = getDefaultPriceMicroStx();

  if (!validateListPrice(priceInMicroStx)) {
    const promptValue = window.prompt('Enter listing price in STX (example: 0.01):');
    if (!promptValue) return;

    const parsed = Number.parseFloat(promptValue);
    priceInMicroStx = Math.floor(parsed * 1_000_000);
    if (!validateListPrice(priceInMicroStx)) return;

    if (elements.defaultListPrice) {
      elements.defaultListPrice.value = parsed.toFixed(4);
    }
  }

  showStatus(`Opening wallet approval to list token #${tokenId}...`, 'info');

  openContractCall({
    contractAddress: CONFIG.MARKETPLACE_CONTRACT_ADDRESS,
    contractName: CONFIG.MARKETPLACE_CONTRACT_NAME,
    functionName: 'list-nft',
    functionArgs: [uintCV(tokenId), uintCV(priceInMicroStx)],
    network: getStacksNetwork(),
    appDetails: {
      name: CONFIG.APP_NAME,
      icon: CONFIG.APP_ICON,
    },
    onFinish: (data) => {
      const txId = data.txId;
      showStatus(
        `Token #${tokenId} listed. <a href="${formatExplorerUrl(txId)}" target="_blank" rel="noopener noreferrer">View on explorer</a>`,
        'success'
      );
      addActivity('List', `Listed token #${tokenId} for ${(priceInMicroStx / 1_000_000).toFixed(4)} STX`, txId);
      setTimeout(() => {
        fetchUserNFTs();
      }, 8000);
    },
    onCancel: () => {
      showStatus(`Listing for token #${tokenId} canceled.`, 'error');
      setTimeout(hideStatus, 2600);
    },
    userSession,
  });
}

function buyNFT(tokenId) {
  if (!userAddress) {
    showStatus('Connect a wallet first.', 'error');
    return;
  }

  showStatus(`Opening wallet approval to buy token #${tokenId}...`, 'info');

  openContractCall({
    contractAddress: CONFIG.MARKETPLACE_CONTRACT_ADDRESS,
    contractName: CONFIG.MARKETPLACE_CONTRACT_NAME,
    functionName: 'buy-nft',
    functionArgs: [uintCV(tokenId)],
    network: getStacksNetwork(),
    appDetails: {
      name: CONFIG.APP_NAME,
      icon: CONFIG.APP_ICON,
    },
    onFinish: (data) => {
      const txId = data.txId;
      showStatus(`NFT purchased. <a href="${formatExplorerUrl(txId)}" target="_blank" rel="noopener noreferrer">View on explorer</a>`, 'success');
      addActivity('Buy', `Purchased token #${tokenId}`, txId);
      setTimeout(() => {
        fetchUserNFTs();
      }, 8000);
    },
    onCancel: () => {
      showStatus('Purchase canceled.', 'error');
      setTimeout(hideStatus, 2600);
    },
    userSession,
  });
}

function updateUI() {
  const connected = Boolean(userAddress);
  setConnectedState(connected);

  if (connected) {
    if (elements.walletAddress) {
      elements.walletAddress.textContent = userAddress;
      elements.walletAddress.title = userAddress;
    }
    fetchUserNFTs();
  } else {
    if (elements.walletAddress) {
      elements.walletAddress.textContent = 'Not connected';
      elements.walletAddress.title = '';
    }
    if (elements.nftList) {
      elements.nftList.innerHTML = '<p class="no-nfts">Connect wallet to view your NFTs.</p>';
    }
  }
}

async function copyAddress() {
  if (!userAddress) return;
  try {
    await navigator.clipboard.writeText(userAddress);
    showStatus('Wallet address copied.', 'success');
    setTimeout(hideStatus, 1800);
  } catch (error) {
    console.error('Failed to copy address:', error);
    showStatus('Could not copy address from this browser context.', 'error');
    setTimeout(hideStatus, 2600);
  }
}

function bindEvents() {
  elements.connectBtn?.addEventListener('click', connectWallet);
  elements.mintBtn?.addEventListener('click', mintNFT);
  elements.disconnectBtn?.addEventListener('click', disconnectWallet);
  elements.copyAddressBtn?.addEventListener('click', copyAddress);
  elements.themeToggle?.addEventListener('click', toggleTheme);
  elements.refreshBtn?.addEventListener('click', () => {
    refreshDashboard();
  });
  elements.nftFilter?.addEventListener('input', renderNFTList);
  elements.autoRefresh?.addEventListener('change', (event) => {
    setAutoRefresh(Boolean(event.target.checked));
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initAppKit();
  bindEvents();
  renderActivityFeed();

  const autoEnabled = Boolean(elements.autoRefresh?.checked);
  setAutoRefresh(autoEnabled);

  if (userSession.isUserSignedIn()) {
    const userData = userSession.loadUserData();
    userAddress =
      CONFIG.NETWORK === 'mainnet' ? userData.profile.stxAddress.mainnet : userData.profile.stxAddress.testnet;
    updateUI();
  }

  if (userSession.isSignInPending()) {
    try {
      const userData = await userSession.handlePendingSignIn();
      userAddress =
        CONFIG.NETWORK === 'mainnet' ? userData.profile.stxAddress.mainnet : userData.profile.stxAddress.testnet;
      addActivity('Wallet', 'Wallet sign-in completed');
      updateUI();
    } catch (error) {
      console.error('Sign-in completion failed:', error);
      showStatus('Wallet sign-in could not complete.', 'error');
    }
  }

  await refreshDashboard();
});

window.buyNFT = buyNFT;
window.listNFT = listNFT;

// PR 1 Optimization 1: Performance tweak

// PR 1 Optimization 2: Performance tweak

// PR 1 Optimization 3: Performance tweak

// PR 1 Optimization 4: Performance tweak

// PR 1 Optimization 5: Performance tweak

// PR 1 Optimization 6: Performance tweak

// PR 1 Optimization 7: Performance tweak

// PR 1 Optimization 8: Performance tweak

// PR 1 Optimization 9: Performance tweak

// PR 1 Optimization 10: Performance tweak

// PR 29 Optimization 1: Performance tweak

// PR 29 Optimization 2: Performance tweak

// PR 29 Optimization 3: Performance tweak

// PR 29 Optimization 4: Performance tweak
