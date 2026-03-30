# Simple NFT Mint Studio

A polished Stacks mainnet desk for minting Simple NFTs, watching live marketplace activity, and operating listings with fee-aware pricing guidance.

## Features

-  Live mint, list, buy, and cancel flows for the Simple NFT collection
-  Professional dashboard theme with responsive card-based layout
-  Wallet desk with connection status, sync cadence, and portfolio inventory
-  Live market pulse with floor, average ask, and seller exposure
-  Fee-aware price lab for modeling seller net and floor positioning
-  Browser-stored activity history and UI preferences
-  Low fees: Mint (0.001 STX), List (0.0013 STX), Sale (0.0013 STX)


## Project Structure

```
SNF---Simple-NFT-Mint/
├── contracts/
│   ├── simple-nft-v4.clar          # NFT contract used by the dashboard
│   └── nft-marketplace-v2.clar     # Marketplace contract used for listings and sales
├── src/
│   ├── main.js                     # Frontend logic, wallet flows, and live data reads
│   └── styles/stacks-vivid-theme.css
├── index.html                      # Studio shell and dashboard structure
├── multi-wallet-mint.js            # Bulk minting helper for generated wallets
├── multi-wallet-marketplace.js     # Bulk marketplace helper
├── vite.config.js
└── package.json
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## Contract Details

### NFT Contract Functions

| Function | Description |
|----------|-------------|
| `mint` | Mint a new NFT (costs 0.001 STX) |
| `transfer` | Transfer NFT to another address |
| `get-owner` | Get owner of a token ID |
| `get-total-minted` | Get total NFTs minted |

### Marketplace Contract Functions

| Function | Description |
|----------|-------------|
| `list-nft` | List an NFT for sale (costs 0.0013 STX) |
| `buy-nft` | Buy a listed NFT |
| `cancel-listing` | Cancel your listing |
| `update-price` | Update listing price |
| `get-listing` | Get listing details |

### Fee Structure

| Action | Fee |
|--------|-----|
| Mint | 0.001 STX |
| List | 0.0013 STX |
| Sale | 0.0013 STX (deducted from sale price) |

### Constants

- **Max Supply**: 10,000 NFTs
- **Token Name**: Simple NFT
- **Token Symbol**: SNFT

## Wallet Support

The frontend supports these Stacks wallets:
- [Leather](https://leather.io/) (formerly Hiro Wallet)
- [Xverse](https://www.xverse.app/)

## Building for Production

```bash
npm run build
npm run preview
```

## Multi-Wallet Mint Script

Use the bundled multi-wallet script to mint from your 50 pre-generated wallets in:
`/home/thee1/SpinningB/generated/mainnet-wallets.json`

### Dry run (recommended first)

```bash
npm run mint:multi:dry
```

### Run actual mints

```bash
npm run mint:multi
```

### Useful overrides

```bash
# Mint from testnet
NETWORK=testnet npm run mint:multi

# Mint from a different wallet file
node multi-wallet-mint.js --wallet-file /path/to/wallets.json

# Limit wallet range / repeat mints per wallet
WALLET_LIMIT=10 START_INDEX=0 MINTS_PER_WALLET=1 npm run mint:multi
```

## License

ISC
