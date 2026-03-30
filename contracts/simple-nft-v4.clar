;; Simple NFT Contract v4 - Marketplace v2 Compatible
;; Mint fee: 0.001 STX (1000 microSTX)
;; Anyone can mint, NFTs have sequential IDs

(define-non-fungible-token simple-nft uint)

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant MINT_PRICE u1000)
(define-constant ERR_PAYMENT_FAILED (err u100))
(define-constant ERR_MINT_FAILED (err u101))
(define-constant ERR_NOT_OWNER (err u102))
(define-constant ERR_NOT_TOKEN_OWNER (err u103))
(define-constant ERR_NOT_AUTHORIZED (err u104))
(define-constant MAX_SUPPLY u10000)
(define-constant ERR_MAX_SUPPLY_REACHED (err u105))

;; Marketplace contract v2 that is allowed to transfer NFTs
(define-constant MARKETPLACE_CONTRACT 'SPDQ03RC9J9T1GGJ2CGGMP1HZ9W0NYPFPH43BEP8.nft-marketplace-v2)

;; Data variables
(define-data-var last-token-id uint u0)
(define-data-var total-minted uint u0)
(define-data-var base-uri (string-ascii 100) "https://api.example.com/nft/")

;; Read-only functions
(define-read-only (get-last-token-id)
  (var-get last-token-id))

(define-read-only (get-total-minted)
  (var-get total-minted))

(define-read-only (get-mint-price)
  MINT_PRICE)

(define-read-only (get-max-supply)
  MAX_SUPPLY)

(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? simple-nft token-id)))

(define-read-only (get-token-uri (token-id uint))
  (ok (some (var-get base-uri))))

;; Public functions

;; Mint a new NFT
(define-public (mint)
  (let
    (
      (token-id (+ (var-get last-token-id) u1))
      (minter tx-sender)
    )
    (asserts! (< (var-get total-minted) MAX_SUPPLY) ERR_MAX_SUPPLY_REACHED)
    (try! (stx-transfer? MINT_PRICE minter CONTRACT_OWNER))
    (try! (nft-mint? simple-nft token-id minter))
    (var-set last-token-id token-id)
    (var-set total-minted (+ (var-get total-minted) u1))
    (ok token-id)))

;; Transfer NFT - supports marketplace transfers
(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (begin
    (asserts! 
      (or 
        (is-eq tx-sender sender)
        (is-eq contract-caller MARKETPLACE_CONTRACT)
      ) 
      ERR_NOT_AUTHORIZED)
    (nft-transfer? simple-nft token-id sender recipient)))

;; SIP-009 NFT Trait
(define-read-only (get-token-name)
  (ok "Simple NFT"))

(define-read-only (get-token-symbol)
  (ok "SNFT"))
