# Simple NFT Marketplace

A minimal NFT marketplace on the Stacks blockchain with minting, listing, buying, and selling functionality.

## Features

-  Simple NFT with sequential IDs
-  Low fees: Mint (0.001 STX), List (0.0013 STX), Sale (0.0013 STX)
-  Built-in marketplace for listing and buying NFTs
-  Wallet connection via browser extensions (Leather, Xverse)
-  Vite-powered frontend


## Project Structure

```
simple-nft-v2/
├── contracts/
│   ├── simple-nft-v3.clar     # NFT contract (SIP-009)
│   └── nft-marketplace.clar   # Marketplace contract
├── src/
│   └── main.js                # Frontend application
├── index.html                 # Main HTML file
├── vite.config.js             # Vite configuration
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

## Fire/CI Build + Contract Deploy

If you want CI to build the frontend and then deploy contracts in one command:

```bash
STACKS_MNEMONIC="..." NETWORK=mainnet npm run build:fire
```

For local devnet deploys:

```bash
NETWORK=devnet DEVNET_API_URL=http://127.0.0.1:3999 npm run deploy:contracts
```

## License

ISC

- Improvement 0.2: Better documentation for marketplace fees.
