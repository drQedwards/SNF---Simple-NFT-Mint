import './styles/stacks-vivid-theme.css';

import { createAppKit } from '@reown/appkit';
import { AppConfig, UserSession, openContractCall, showConnect } from '@stacks/connect';
import { cvToJSON, deserializeCV, uintCV } from '@stacks/transactions';
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
  APP_ICON: `${window.location.origin}/favicon.svg`,
  REOWN_PROJECT_ID: '4fb22bec203d094dbec52767e3bcc016',
  MINT_CAP: 10000,
  AUTO_REFRESH_MS: 30000,
  MARKET_SCAN_LIMIT: 24,
};

const THEME_KEY = 'snf-theme-mode';
const ACTIVITY_KEY = 'snf-activity-v1';
const PREFERENCES_KEY = 'snf-ui-preferences-v2';

const appConfig = new AppConfig(['store_write', 'publish_data']);
const userSession = new UserSession({ appConfig });

const state = {
  userAddress: null,
  userNFTs: [],
  marketListings: [],
  autoRefreshTimer: null,
  refreshInFlight: false,
  statusTimer: null,
  lastRefreshAt: null,
  refreshTickTimer: null,
  stxQuote: null,
  marketInsights: null,
  activityFilter: 'all',
};

let appKit = null;

const elements = {
  connectBtn: document.getElementById('connect-btn'),
  mintBtn: document.getElementById('mint-btn'),
  disconnectBtn: document.getElementById('disconnect-btn'),
  copyAddressBtn: document.getElementById('copy-address-btn'),
  refreshBtn: document.getElementById('refresh-btn'),
  heroConnectBtn: document.getElementById('hero-connect-btn'),
  heroMarketBtn: document.getElementById('hero-market-btn'),
  themeToggle: document.getElementById('theme-toggle'),
  autoRefresh: document.getElementById('auto-refresh'),
  nftFilter: document.getElementById('nft-filter'),
  marketFilter: document.getElementById('market-filter'),
  marketSort: document.getElementById('market-sort'),
  defaultListPrice: document.getElementById('default-list-price'),
  priceLabInput: document.getElementById('price-lab-input'),
  matchFloorBtn: document.getElementById('match-floor-btn'),
  undercutFloorBtn: document.getElementById('undercut-floor-btn'),
  clearActivityBtn: document.getElementById('clear-activity-btn'),
  notConnected: document.getElementById('not-connected'),
  connected: document.getElementById('connected'),
  walletAddress: document.getElementById('wallet-address'),
  walletChip: document.getElementById('wallet-chip'),
  walletSessionState: document.getElementById('wallet-session-state'),
  nextSyncLabel: document.getElementById('next-sync-label'),
  walletState: document.getElementById('wallet-state'),
  walletStateDetail: document.getElementById('wallet-state-detail'),
  dashboardSync: document.getElementById('dashboard-sync'),
  dashboardSyncDetail: document.getElementById('dashboard-sync-detail'),
  marketPulse: document.getElementById('market-pulse'),
  marketPulseDetail: document.getElementById('market-pulse-detail'),
  minted: document.getElementById('minted'),
  mintedDetail: document.getElementById('minted-detail'),
  mintUsdEstimate: document.getElementById('mint-usd-estimate'),
  mintTempo: document.getElementById('mint-tempo'),
  listed: document.getElementById('listed'),
  ownedCount: document.getElementById('owned-count'),
  ownedListedCount: document.getElementById('owned-listed-count'),
  readyToListCount: document.getElementById('ready-to-list-count'),
  portfolioDetail: document.getElementById('portfolio-detail'),
  listingCount: document.getElementById('listing-count'),
  listingCountDetail: document.getElementById('listing-count-detail'),
  salesCount: document.getElementById('sales-count'),
  salesCountDetail: document.getElementById('sales-count-detail'),
  stxPrice: document.getElementById('stx-price'),
  stxPriceUpdated: document.getElementById('stx-price-updated'),
  networkStatus: document.getElementById('network-status'),
  networkHeight: document.getElementById('network-height'),
  status: document.getElementById('status'),
  nftList: document.getElementById('nft-list'),
  marketListings: document.getElementById('market-listings'),
  marketSummary: document.getElementById('market-summary'),
  bestAsk: document.getElementById('best-ask'),
  averageAsk: document.getElementById('average-ask'),
  yourListingsCount: document.getElementById('your-listings-count'),
  scanWindow: document.getElementById('scan-window'),
  activityFeed: document.getElementById('activity-feed'),
  activityFilters: Array.from(document.querySelectorAll('[data-activity-filter]')),
  estimatedNet: document.getElementById('estimated-net'),
  priceLabStance: document.getElementById('price-lab-stance'),
  supplyOutlook: document.getElementById('supply-outlook'),
  listingStrategy: document.getElementById('listing-strategy'),
  walletReadiness: document.getElementById('wallet-readiness'),
  recommendedListPrice: document.getElementById('recommended-list-price'),
  coverageNote: document.getElementById('coverage-note'),
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
        '--w3m-accent': '#3ae6ff',
        '--w3m-border-radius-master': '16px',
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
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function formatFullAddress(address) {
  return address || 'Not connected';
}

function formatExplorerUrl(txId) {
  return `https://explorer.hiro.so/txid/${txId}?chain=${CONFIG.NETWORK}`;
}

function formatTokenUrl(tokenId) {
  return `https://explorer.hiro.so/txid/${CONFIG.NFT_CONTRACT_ADDRESS}.${CONFIG.NFT_CONTRACT_NAME}?chain=${CONFIG.NETWORK}#asset_id=${CONFIG.NFT_CONTRACT_ADDRESS}.${CONFIG.NFT_CONTRACT_NAME}::simple-nft::${tokenId}`;
}

function formatStxFromMicro(value) {
  return `${(Number(value) / 1_000_000).toFixed(4)} STX`;
}

function formatStxValue(value, digits = 4) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  return `${numeric.toFixed(digits)} STX`;
}

function microToStx(value) {
  return Number(value) / 1_000_000;
}

function stxToMicro(value) {
  return Math.floor(Number(value) * 1_000_000);
}

function formatUsd(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: numeric >= 100 ? 0 : 2,
  }).format(numeric);
}

function formatRelativeTime(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
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

function loadPreferences() {
  return parseJsonStorage(PREFERENCES_KEY, {
    autoRefresh: true,
    defaultListPrice: '0.01',
    marketSort: 'recent',
  });
}

function savePreferences(next) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
}

function getPreferences() {
  return {
    autoRefresh: Boolean(elements.autoRefresh?.checked),
    defaultListPrice: elements.defaultListPrice?.value || '0.01',
    marketSort: elements.marketSort?.value || 'recent',
  };
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

  const activity = loadActivity().filter((entry) => {
    if (state.activityFilter === 'all') return true;
    if (state.activityFilter === 'wallet') {
      return entry.type === 'Wallet' || entry.type === 'Theme' || entry.type === 'Refresh';
    }

    return ['Mint', 'List', 'Buy', 'Cancel'].includes(entry.type);
  });
  if (!activity.length) {
    elements.activityFeed.innerHTML = '<li class="activity-empty">No activity yet.</li>';
    return;
  }

  elements.activityFeed.innerHTML = activity
    .map((entry) => {
      const txLine = entry.txId
        ? `<a href="${formatExplorerUrl(entry.txId)}" target="_blank" rel="noopener noreferrer">View transaction</a>`
        : '';

      return `<li>
        <strong>${entry.type}</strong>
        <span>${entry.message}</span>
        ${txLine}
        <span class="activity-time">${formatRelativeTime(entry.at)}</span>
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
  const next = current === 'solar' ? 'aurora' : 'solar';
  setTheme(next);
  addActivity('Theme', `Switched dashboard theme to ${next}.`);
}

function showStatus(message, type = 'info', { persist = false } = {}) {
  if (!elements.status) return;

  if (state.statusTimer) {
    window.clearTimeout(state.statusTimer);
  }

  elements.status.className = `status ${type}`;
  elements.status.innerHTML = message;
  elements.status.classList.remove('hidden');

  if (!persist && type !== 'error') {
    state.statusTimer = window.setTimeout(() => {
      hideStatus();
    }, 4500);
  }
}

function setButtonBusy(button, isBusy, idleLabel, busyLabel) {
  if (!button) return;

  button.textContent = isBusy ? busyLabel : idleLabel;
  button.classList.toggle('loading', isBusy);
  button.disabled = isBusy;
}

function hideStatus() {
  if (state.statusTimer) {
    window.clearTimeout(state.statusTimer);
    state.statusTimer = null;
  }

  elements.status?.classList.add('hidden');
}

function setConnectedState(connected) {
  if (!elements.notConnected || !elements.connected) return;

  elements.notConnected.classList.toggle('hidden', connected);
  elements.connected.classList.toggle('hidden', !connected);
}

function setWalletSignals() {
  const connected = Boolean(state.userAddress);
  setConnectedState(connected);

  if (connected) {
    elements.walletState.textContent = 'Wallet connected';
    elements.walletStateDetail.textContent = `${formatAddress(state.userAddress)} is ready for mint, list, cancel, and buy actions.`;
    elements.walletAddress.textContent = formatFullAddress(state.userAddress);
    elements.walletAddress.title = state.userAddress;
    elements.walletChip.textContent = 'Live';
    elements.walletSessionState.textContent = 'Approved';
    elements.walletReadiness.textContent = 'Wallet connected and ready for execution';
  } else {
    elements.walletState.textContent = 'Waiting for wallet';
    elements.walletStateDetail.textContent = 'Connect Leather or Xverse to unlock mint and market actions.';
    elements.walletAddress.textContent = 'Not connected';
    elements.walletAddress.title = '';
    elements.walletChip.textContent = 'Idle';
    elements.walletSessionState.textContent = 'Standby';
    elements.walletReadiness.textContent = 'Connect to unlock desk tools';
  }
}

function updateSyncStatus(message, detail) {
  elements.dashboardSync.textContent = message;
  elements.dashboardSyncDetail.textContent = detail;
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(Math.ceil(ms / 1000), 0);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function updateRefreshCountdown() {
  if (!elements.nextSyncLabel) return;

  if (!elements.autoRefresh?.checked || !state.lastRefreshAt) {
    elements.nextSyncLabel.textContent = 'Manual';
    return;
  }

  const nextRefreshAt = state.lastRefreshAt + CONFIG.AUTO_REFRESH_MS;
  const remaining = nextRefreshAt - Date.now();
  elements.nextSyncLabel.textContent = remaining <= 0 ? 'Due now' : formatCountdown(remaining);
}

function renderPortfolioSummary() {
  const { ownedCount, listedCount, readyToListCount } = getUserListingStats();
  elements.ownedCount.textContent = ownedCount.toLocaleString();
  elements.ownedListedCount.textContent = listedCount.toLocaleString();
  elements.readyToListCount.textContent = readyToListCount.toLocaleString();
}

function renderMarketPulse() {
  if (!state.marketInsights?.bestAskMicroStx) {
    elements.marketPulse.textContent = 'Waiting for listings';
    elements.marketPulseDetail.textContent = 'Refresh to generate a live floor and pricing read.';
    return;
  }

  elements.marketPulse.textContent = `Floor ${formatStxFromMicro(state.marketInsights.bestAskMicroStx)}`;
  elements.marketPulseDetail.textContent = `${state.marketListings.length.toLocaleString()} active listings from ${state.marketInsights.sellers.toLocaleString()} sellers in the scan window.`;
}

function renderPriceLab() {
  const inputValue = Number.parseFloat(elements.priceLabInput?.value || '');
  const feeStx = microToStx(CONFIG.LIST_FEE);

  if (!Number.isFinite(inputValue)) {
    elements.estimatedNet.textContent = '--';
    elements.priceLabStance.textContent = 'Enter a valid STX price';
    return;
  }

  const net = Math.max(inputValue - feeStx, 0);
  elements.estimatedNet.textContent = formatStxValue(net);

  if (!state.marketInsights?.bestAskMicroStx) {
    elements.priceLabStance.textContent = 'Waiting for listings';
    return;
  }

  const floor = microToStx(state.marketInsights.bestAskMicroStx);
  if (inputValue < floor) {
    elements.priceLabStance.textContent = 'Aggressive undercut versus current floor';
  } else if (inputValue === floor) {
    elements.priceLabStance.textContent = 'Matching the current floor';
  } else {
    elements.priceLabStance.textContent = `Premium of ${(inputValue - floor).toFixed(4)} STX over floor`;
  }
}

function renderMintDesk() {
  if (!state.stxQuote) {
    elements.mintUsdEstimate.textContent = 'Awaiting STX quote';
    return;
  }

  const mintUsd = microToStx(CONFIG.MINT_PRICE) * state.stxQuote;
  elements.mintUsdEstimate.textContent = `${formatStxFromMicro(CONFIG.MINT_PRICE)} | ${formatUsd(mintUsd)}`;
}

function renderMarketStrategy() {
  if (!state.marketInsights?.bestAskMicroStx) {
    elements.listingStrategy.textContent = 'Waiting for market floor';
    elements.recommendedListPrice.textContent = 'Waiting for floor';
    elements.coverageNote.textContent = 'Waiting for scan window';
    return;
  }

  const floor = microToStx(state.marketInsights.bestAskMicroStx);
  const suggested = Math.max(floor - 0.0005, 0.0014);
  elements.listingStrategy.textContent =
    state.marketInsights.userListings > 0 ? 'You already have active exposure in market' : 'Opportunity to enter near current floor';
  elements.recommendedListPrice.textContent = formatStxValue(suggested);
  elements.coverageNote.textContent = `${state.marketListings.length.toLocaleString()} listings scanned across ${CONFIG.MARKET_SCAN_LIMIT} recent tokens`;
}

function updateMintProgress(mintedCount) {
  const safe = Math.max(0, Number(mintedCount) || 0);
  const ratio = Math.min(100, (safe / CONFIG.MINT_CAP) * 100);

  elements.mintProgressFill.style.width = `${ratio.toFixed(2)}%`;
  elements.mintProgressLabel.textContent = `${safe.toLocaleString()} / ${CONFIG.MINT_CAP.toLocaleString()} minted`;
  elements.mintProgressFill.parentElement?.setAttribute('aria-valuenow', String(safe));
  elements.mintedDetail.textContent =
    safe >= CONFIG.MINT_CAP ? 'Collection sold out' : `${(CONFIG.MINT_CAP - safe).toLocaleString()} still available`;
  elements.supplyOutlook.textContent =
    ratio >= 80
      ? 'Late-stage supply, urgency increasing'
      : ratio >= 40
        ? 'Mid-collection release with room to mint'
        : 'Early supply with broad mint availability';
  elements.mintTempo.textContent = `${ratio.toFixed(1)}% of collection minted`;
}

async function callReadOnly(contractAddress, contractName, functionName, args = [], sender = contractAddress) {
  const response = await fetch(`${getApiUrl()}/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender,
      arguments: args,
    }),
  });

  if (!response.ok) {
    throw new Error(`Read-only call failed (${response.status})`);
  }

  const data = await response.json();
  if (!data.okay || !data.result) {
    throw new Error(data.cause || `Read-only call failed for ${functionName}`);
  }

  return cvToJSON(deserializeCV(data.result));
}

function readCvNumber(json) {
  return Number(json?.value ?? 0);
}

function readOptionalListing(json) {
  if (!json?.value?.value) return null;

  return {
    seller: json.value.value.seller?.value || '',
    priceMicroStx: Number(json.value.value.price?.value || 0),
  };
}

function getUserListingStats() {
  if (!state.userAddress) {
    return {
      ownedCount: state.userNFTs.length,
      listedCount: 0,
      readyToListCount: state.userNFTs.length,
    };
  }

  const listedTokenIds = new Set(
    state.marketListings.filter((listing) => listing.seller === state.userAddress).map((listing) => String(listing.tokenId))
  );
  const ownedTokenIds = state.userNFTs.map((nft) => getTokenIdFromHolding(nft)).filter(Boolean);
  const listedCount = ownedTokenIds.filter((tokenId) => listedTokenIds.has(String(tokenId))).length;

  return {
    ownedCount: ownedTokenIds.length,
    listedCount,
    readyToListCount: Math.max(ownedTokenIds.length - listedCount, 0),
  };
}

function deriveMarketInsights(listings) {
  if (!listings.length) {
    return {
      bestAskMicroStx: null,
      averageAskMicroStx: null,
      sellers: 0,
      userListings: 0,
    };
  }

  const total = listings.reduce((sum, listing) => sum + listing.priceMicroStx, 0);
  const bestAskMicroStx = Math.min(...listings.map((listing) => listing.priceMicroStx));
  const uniqueSellers = new Set(listings.map((listing) => listing.seller));
  const userListings = state.userAddress
    ? listings.filter((listing) => listing.seller === state.userAddress).length
    : 0;

  return {
    bestAskMicroStx,
    averageAskMicroStx: Math.floor(total / listings.length),
    sellers: uniqueSellers.size,
    userListings,
  };
}

async function fetchMintedCount() {
  const json = await callReadOnly(CONFIG.NFT_CONTRACT_ADDRESS, CONFIG.NFT_CONTRACT_NAME, 'get-total-minted');
  const mintedCount = readCvNumber(json);
  elements.minted.textContent = mintedCount.toLocaleString();
  updateMintProgress(mintedCount);
  return mintedCount;
}

async function fetchMarketplaceStats() {
  const [listingsJson, salesJson] = await Promise.all([
    callReadOnly(CONFIG.MARKETPLACE_CONTRACT_ADDRESS, CONFIG.MARKETPLACE_CONTRACT_NAME, 'get-total-listings'),
    callReadOnly(CONFIG.MARKETPLACE_CONTRACT_ADDRESS, CONFIG.MARKETPLACE_CONTRACT_NAME, 'get-total-sales'),
  ]);

  const listings = readCvNumber(listingsJson);
  const sales = readCvNumber(salesJson);
  elements.listingCount.dataset.totalListings = String(listings);
  elements.listingCount.textContent = state.marketListings.length.toLocaleString();
  elements.listingCountDetail.textContent = `Tracking recent listings (${listings.toLocaleString()} lifetime total)`;
  elements.salesCount.textContent = sales.toLocaleString();
  elements.salesCountDetail.textContent = 'Completed purchases on contract';
}

async function fetchNetworkStatus() {
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
    elements.networkHeight.textContent = 'Tip unavailable';
  }
}

async function fetchStxPrice() {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=stacks&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true'
    );
    if (!response.ok) {
      throw new Error(`Status ${response.status}`);
    }

    const data = await response.json();
    const usd = data?.stacks?.usd;
    const change = data?.stacks?.usd_24h_change;
    const updatedAt = data?.stacks?.last_updated_at;

    if (typeof usd !== 'number') {
      throw new Error('Quote missing USD value');
    }

    elements.stxPrice.textContent = `$${usd.toFixed(3)}`;
    state.stxQuote = usd;
    renderMintDesk();
    if (typeof change === 'number') {
      elements.stxPriceUpdated.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)}% (24h)`;
    } else {
      elements.stxPriceUpdated.textContent = '24h trend unavailable';
    }

    if (updatedAt) {
      elements.stxPriceUpdated.textContent += ` | ${formatRelativeTime(updatedAt * 1000)}`;
    }
  } catch (error) {
    console.error('Failed to fetch STX quote:', error);
    state.stxQuote = null;
    elements.stxPrice.textContent = '--';
    elements.stxPriceUpdated.textContent = 'Quote unavailable';
    renderMintDesk();
  }
}

async function fetchUserNFTs() {
  if (!state.userAddress) {
    state.userNFTs = [];
    elements.listed.textContent = '0';
    elements.portfolioDetail.textContent = 'Connect a wallet to view your holdings';
    renderPortfolioSummary();
    renderNFTList();
    return;
  }

  try {
    const response = await fetch(
      `${getApiUrl()}/extended/v1/tokens/nft/holdings?principal=${state.userAddress}&asset_identifiers=${CONFIG.NFT_CONTRACT_ADDRESS}.${CONFIG.NFT_CONTRACT_NAME}::simple-nft&limit=80`
    );
    const data = await response.json();
    state.userNFTs = Array.isArray(data.results) ? data.results : [];
    elements.listed.textContent = state.userNFTs.length.toLocaleString();
    elements.portfolioDetail.textContent =
      state.userNFTs.length === 0 ? 'No NFTs in this wallet yet' : 'Ready to list directly from portfolio';
    renderPortfolioSummary();
    renderNFTList();
  } catch (error) {
    console.error('Failed to fetch user NFTs:', error);
    state.userNFTs = [];
    elements.listed.textContent = '0';
    elements.portfolioDetail.textContent = 'Portfolio read failed';
    renderPortfolioSummary();
    renderNFTList();
  }
}

function getTokenIdFromHolding(nft) {
  const repr = nft?.value?.repr;
  if (typeof repr !== 'string') return null;
  return repr.replace(/^u/, '');
}

function renderNFTList() {
  const query = elements.nftFilter?.value?.trim() || '';
  const filtered = query
    ? state.userNFTs.filter((nft) => {
        const tokenId = getTokenIdFromHolding(nft);
        return tokenId && tokenId.includes(query);
      })
    : state.userNFTs;

  if (!filtered.length) {
    const message = query ? `No NFTs matching "${query}".` : state.userAddress ? 'No NFTs yet. Mint one.' : 'Connect wallet to view your NFTs.';
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
            <span class="market-meta">Owned by connected wallet</span>
          </div>
          <a class="btn btn-secondary" href="${formatTokenUrl(tokenId)}" target="_blank" rel="noopener noreferrer">View Explorer</a>
          <button class="btn btn-primary list-nft-btn" data-token-id="${tokenId}" type="button">List for Sale</button>
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

async function fetchRecentListings(latestMintedCount, { silent = false } = {}) {
  const start = Math.max(1, latestMintedCount - CONFIG.MARKET_SCAN_LIMIT + 1);
  const tokenIds = [];

  for (let tokenId = latestMintedCount; tokenId >= start; tokenId -= 1) {
    tokenIds.push(tokenId);
  }

  const listings = [];

  for (const tokenId of tokenIds) {
    try {
      const json = await callReadOnly(
        CONFIG.MARKETPLACE_CONTRACT_ADDRESS,
        CONFIG.MARKETPLACE_CONTRACT_NAME,
        'get-listing',
        [serializeUint(tokenId)]
      );
      const listing = readOptionalListing(json);

      if (listing) {
        listings.push({
          tokenId,
          seller: listing.seller,
          priceMicroStx: listing.priceMicroStx,
          scannedAt: latestMintedCount,
        });
      }
    } catch (error) {
      if (!silent) {
        console.warn(`Listing read failed for token #${tokenId}:`, error);
      }
    }
  }

  state.marketListings = listings;
  state.marketInsights = deriveMarketInsights(listings);
  renderMarketPulse();
  renderPortfolioSummary();
  renderPriceLab();
  renderMarketStrategy();
  renderMarketListings();
}

function serializeUint(value) {
  return `0x${Buffer.from(uintCV(value).serialize()).toString('hex')}`;
}

function getSortedListings() {
  const query = elements.marketFilter?.value?.trim().toLowerCase() || '';
  const sort = elements.marketSort?.value || 'recent';

  let listings = state.marketListings.filter((listing) => {
    if (!query) return true;
    return (
      String(listing.tokenId).includes(query) ||
      listing.seller.toLowerCase().includes(query)
    );
  });

  if (sort === 'price-asc') {
    listings = listings.sort((a, b) => a.priceMicroStx - b.priceMicroStx);
  } else if (sort === 'price-desc') {
    listings = listings.sort((a, b) => b.priceMicroStx - a.priceMicroStx);
  }

  return listings;
}

function renderMarketListings() {
  const listings = getSortedListings();
  const totalListings = Number(elements.listingCount.dataset.totalListings || 0);
  const insights = state.marketInsights || deriveMarketInsights(state.marketListings);

  elements.listingCount.textContent = state.marketListings.length.toLocaleString();
  elements.listingCountDetail.textContent = `Tracking recent listings (${totalListings.toLocaleString()} lifetime total)`;
  elements.averageAsk.textContent = insights.averageAskMicroStx ? formatStxFromMicro(insights.averageAskMicroStx) : '--';
  elements.yourListingsCount.textContent = insights.userListings.toLocaleString();

  if (!state.marketListings.length) {
    elements.bestAsk.textContent = '--';
    elements.scanWindow.textContent = 'No active listings in recent scan';
    elements.marketListings.innerHTML = '<p class="no-nfts">No recent listings found in the latest scan window.</p>';
    return;
  }

  elements.bestAsk.textContent = formatStxFromMicro(insights.bestAskMicroStx);
  elements.scanWindow.textContent = `Last ${CONFIG.MARKET_SCAN_LIMIT} minted tokens scanned`;

  if (!listings.length) {
    elements.marketListings.innerHTML = '<p class="no-nfts">No listings match the current filter.</p>';
    return;
  }

  elements.marketListings.innerHTML = listings
    .map((listing) => {
      const isOwner = Boolean(state.userAddress) && listing.seller === state.userAddress;
      const actionLabel = isOwner ? 'Cancel Listing' : 'Buy NFT';

      return `
        <article class="market-card">
          <div class="market-image"></div>
          <div>
            <span class="market-id">Token #${listing.tokenId}</span>
            <span class="market-owner">Seller: ${formatAddress(listing.seller)}</span>
          </div>
          <div class="market-price">
            <strong>${formatStxFromMicro(listing.priceMicroStx)}</strong>
            <span>${isOwner ? 'Your listing' : 'Current ask'}</span>
          </div>
          <button class="btn btn-primary market-action-btn" data-token-id="${listing.tokenId}" data-action="${isOwner ? 'cancel' : 'buy'}" type="button">${actionLabel}</button>
        </article>
      `;
    })
    .join('');

  document.querySelectorAll('.market-action-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tokenId = Number.parseInt(btn.dataset.tokenId || '', 10);
      const action = btn.dataset.action;

      if (!Number.isFinite(tokenId)) return;
      if (action === 'cancel') {
        cancelListing(tokenId);
      } else {
        buyNFT(tokenId);
      }
    });
  });
}

async function refreshDashboard({ withStatus = false } = {}) {
  if (state.refreshInFlight) return;

  state.refreshInFlight = true;
  setButtonBusy(elements.refreshBtn, true, 'Refresh Dashboard', 'Refreshing');
  updateSyncStatus('Refreshing dashboard', 'Pulling live market and network data.');

  try {
    const mintedCount = await fetchMintedCount();
    await Promise.all([fetchMarketplaceStats(), fetchNetworkStatus(), fetchStxPrice(), fetchUserNFTs()]);
    await fetchRecentListings(mintedCount, { silent: true });

    const completedAt = new Date();
    state.lastRefreshAt = completedAt.getTime();
    updateSyncStatus('Live data synced', `Last refresh ${formatRelativeTime(completedAt)}`);
    updateRefreshCountdown();

    if (withStatus) {
      showStatus('Dashboard refreshed successfully.', 'success');
      addActivity('Refresh', 'Dashboard data refreshed.');
    }
  } catch (error) {
    console.error('Dashboard refresh failed:', error);
    updateSyncStatus('Refresh degraded', 'Some live endpoints did not respond cleanly.');
    if (withStatus) {
      showStatus('Refresh failed. Try again in a moment.', 'error', { persist: true });
    }
  } finally {
    state.refreshInFlight = false;
    setButtonBusy(elements.refreshBtn, false, 'Refresh Dashboard', 'Refreshing');
  }
}

function clearAutoRefresh() {
  if (!state.autoRefreshTimer) return;
  clearInterval(state.autoRefreshTimer);
  state.autoRefreshTimer = null;
}

function setAutoRefresh(enabled) {
  clearAutoRefresh();
  if (state.refreshTickTimer) {
    clearInterval(state.refreshTickTimer);
    state.refreshTickTimer = null;
  }
  if (!enabled) return;

  state.autoRefreshTimer = setInterval(() => {
    refreshDashboard().catch((error) => {
      console.error('Auto refresh failed:', error);
    });
  }, CONFIG.AUTO_REFRESH_MS);

  state.refreshTickTimer = setInterval(updateRefreshCountdown, 1000);
  updateRefreshCountdown();
}

async function connectWallet() {
  setButtonBusy(elements.connectBtn, true, 'Connect Wallet', 'Opening Wallet');
  showStatus('Opening wallet...', 'info');

  showConnect({
    appDetails: {
      name: CONFIG.APP_NAME,
      icon: CONFIG.APP_ICON,
    },
    redirectTo: '/',
    onFinish: async () => {
      const userData = userSession.loadUserData();
      state.userAddress =
        CONFIG.NETWORK === 'mainnet' ? userData.profile.stxAddress.mainnet : userData.profile.stxAddress.testnet;
      setWalletSignals();
      addActivity('Wallet', 'Wallet connected.');
      showStatus('Connected to wallet.', 'success');
      setButtonBusy(elements.connectBtn, false, 'Connect Wallet', 'Opening Wallet');
      await refreshDashboard();
    },
    onCancel: () => {
      showStatus('Connection canceled.', 'error', { persist: true });
      setButtonBusy(elements.connectBtn, false, 'Connect Wallet', 'Opening Wallet');
    },
    userSession,
  });
}

function disconnectWallet() {
  userSession.signUserOut('/');
  state.userAddress = null;
  state.userNFTs = [];
  setWalletSignals();
  renderPortfolioSummary();
  renderNFTList();
  renderMarketListings();
  addActivity('Wallet', 'Wallet disconnected.');
  hideStatus();
}

function getDefaultPriceMicroStx() {
  const raw = elements.defaultListPrice?.value;
  const parsed = Number.parseFloat(raw || '');
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed * 1_000_000);
}

function validateListPrice(priceMicroStx) {
  if (!Number.isFinite(priceMicroStx) || priceMicroStx <= CONFIG.LIST_FEE) {
    showStatus('List price must be greater than 0.0013 STX.', 'error', { persist: true });
    return false;
  }
  return true;
}

function mintNFT() {
  if (!state.userAddress) {
    showStatus('Connect a wallet first.', 'error', { persist: true });
    return;
  }

  setButtonBusy(elements.mintBtn, true, 'Mint NFT', 'Awaiting Approval');
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
      showStatus(`Mint submitted. <a href="${formatExplorerUrl(txId)}" target="_blank" rel="noopener noreferrer">View on explorer</a>`, 'success');
      addActivity('Mint', `Mint submitted by ${formatAddress(state.userAddress)}.`, txId);
      setButtonBusy(elements.mintBtn, false, 'Mint NFT', 'Awaiting Approval');
      window.setTimeout(() => {
        refreshDashboard();
      }, 8000);
    },
    onCancel: () => {
      showStatus('Mint transaction canceled.', 'error', { persist: true });
      setButtonBusy(elements.mintBtn, false, 'Mint NFT', 'Awaiting Approval');
    },
    userSession,
  });
}

function listNFT(tokenId) {
  if (!state.userAddress) {
    showStatus('Connect a wallet first.', 'error', { persist: true });
    return;
  }

  let priceInMicroStx = getDefaultPriceMicroStx();

  if (!validateListPrice(priceInMicroStx)) {
    const promptValue = window.prompt('Enter listing price in STX (example: 0.01):');
    if (!promptValue) return;

    const parsed = Number.parseFloat(promptValue);
    priceInMicroStx = Math.floor(parsed * 1_000_000);
    if (!validateListPrice(priceInMicroStx)) return;
    elements.defaultListPrice.value = parsed.toFixed(4);
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
      addActivity('List', `Listed token #${tokenId} for ${formatStxFromMicro(priceInMicroStx)}.`, txId);
      window.setTimeout(() => {
        refreshDashboard();
      }, 8000);
    },
    onCancel: () => {
      showStatus(`Listing for token #${tokenId} canceled.`, 'error', { persist: true });
    },
    userSession,
  });
}

function buyNFT(tokenId) {
  if (!state.userAddress) {
    showStatus('Connect a wallet first.', 'error', { persist: true });
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
      showStatus(`Purchase submitted. <a href="${formatExplorerUrl(txId)}" target="_blank" rel="noopener noreferrer">View on explorer</a>`, 'success');
      addActivity('Buy', `Bought token #${tokenId}.`, txId);
      window.setTimeout(() => {
        refreshDashboard();
      }, 8000);
    },
    onCancel: () => {
      showStatus('Purchase canceled.', 'error', { persist: true });
    },
    userSession,
  });
}

function cancelListing(tokenId) {
  if (!state.userAddress) {
    showStatus('Connect a wallet first.', 'error', { persist: true });
    return;
  }

  showStatus(`Opening wallet approval to cancel token #${tokenId} listing...`, 'info');

  openContractCall({
    contractAddress: CONFIG.MARKETPLACE_CONTRACT_ADDRESS,
    contractName: CONFIG.MARKETPLACE_CONTRACT_NAME,
    functionName: 'cancel-listing',
    functionArgs: [uintCV(tokenId)],
    network: getStacksNetwork(),
    appDetails: {
      name: CONFIG.APP_NAME,
      icon: CONFIG.APP_ICON,
    },
    onFinish: (data) => {
      const txId = data.txId;
      showStatus(`Listing canceled. <a href="${formatExplorerUrl(txId)}" target="_blank" rel="noopener noreferrer">View on explorer</a>`, 'success');
      addActivity('Cancel', `Canceled listing for token #${tokenId}.`, txId);
      window.setTimeout(() => {
        refreshDashboard();
      }, 8000);
    },
    onCancel: () => {
      showStatus('Cancel listing request was dismissed.', 'error', { persist: true });
    },
    userSession,
  });
}

async function copyAddress() {
  if (!state.userAddress) return;

  try {
    await navigator.clipboard.writeText(state.userAddress);
    showStatus('Wallet address copied.', 'success');
  } catch (error) {
    console.error('Failed to copy address:', error);
    showStatus('Could not copy address from this browser context.', 'error', { persist: true });
  }
}

function bindEvents() {
  elements.connectBtn?.addEventListener('click', connectWallet);
  elements.mintBtn?.addEventListener('click', mintNFT);
  elements.disconnectBtn?.addEventListener('click', disconnectWallet);
  elements.copyAddressBtn?.addEventListener('click', copyAddress);
  elements.themeToggle?.addEventListener('click', toggleTheme);
  elements.refreshBtn?.addEventListener('click', () => {
    refreshDashboard({ withStatus: true });
  });
  elements.nftFilter?.addEventListener('input', renderNFTList);
  elements.marketFilter?.addEventListener('input', renderMarketListings);
  elements.marketSort?.addEventListener('change', () => {
    renderMarketListings();
    savePreferences(getPreferences());
  });
  elements.defaultListPrice?.addEventListener('change', () => savePreferences(getPreferences()));
  elements.priceLabInput?.addEventListener('input', renderPriceLab);
  elements.matchFloorBtn?.addEventListener('click', () => {
    if (!state.marketInsights?.bestAskMicroStx) return;
    const floor = microToStx(state.marketInsights.bestAskMicroStx);
    elements.priceLabInput.value = floor.toFixed(4);
    renderPriceLab();
  });
  elements.undercutFloorBtn?.addEventListener('click', () => {
    if (!state.marketInsights?.bestAskMicroStx) return;
    const floor = microToStx(state.marketInsights.bestAskMicroStx);
    const undercut = Math.max(floor - 0.0005, 0.0014);
    elements.priceLabInput.value = undercut.toFixed(4);
    renderPriceLab();
  });
  elements.autoRefresh?.addEventListener('change', (event) => {
    const enabled = Boolean(event.target.checked);
    setAutoRefresh(enabled);
    savePreferences(getPreferences());
  });
}

function applyPersistedPreferences() {
  const prefs = loadPreferences();
  if (elements.autoRefresh) {
    elements.autoRefresh.checked = prefs.autoRefresh;
  }
  if (elements.defaultListPrice && prefs.defaultListPrice) {
    elements.defaultListPrice.value = prefs.defaultListPrice;
  }
  if (elements.marketSort && prefs.marketSort) {
    elements.marketSort.value = prefs.marketSort;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  initAppKit();
  applyPersistedPreferences();
  bindEvents();
  renderActivityFeed();
  setWalletSignals();
  renderMintDesk();
  renderNFTList();
  renderPriceLab();
  renderMarketStrategy();
  renderMarketListings();

  setAutoRefresh(Boolean(elements.autoRefresh?.checked));

  if (userSession.isUserSignedIn()) {
    const userData = userSession.loadUserData();
    state.userAddress =
      CONFIG.NETWORK === 'mainnet' ? userData.profile.stxAddress.mainnet : userData.profile.stxAddress.testnet;
    setWalletSignals();
  }

  if (userSession.isSignInPending()) {
    try {
      const userData = await userSession.handlePendingSignIn();
      state.userAddress =
        CONFIG.NETWORK === 'mainnet' ? userData.profile.stxAddress.mainnet : userData.profile.stxAddress.testnet;
      addActivity('Wallet', 'Wallet sign-in completed.');
      setWalletSignals();
    } catch (error) {
      console.error('Sign-in completion failed:', error);
      showStatus('Wallet sign-in could not complete.', 'error', { persist: true });
    }
  }

  await refreshDashboard();
});
