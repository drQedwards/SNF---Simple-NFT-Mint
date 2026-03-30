;; NFT Marketplace Contract
;; Allows listing, buying, and selling NFTs
;; Fees: List = 0.0013 STX, Buy = 0.0013 STX (included in price)
;; Contract Owner: SPDQ03RC9J9T1GGJ2CGGMP1HZ9W0NYPFPH43BEP8

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant LIST_FEE u1300) ;; 0.0013 STX in microSTX
(define-constant SALE_FEE u1300) ;; 0.0013 STX in microSTX (deducted from sale price)

;; Error codes
(define-constant ERR_NOT_OWNER (err u200))
(define-constant ERR_NOT_LISTED (err u201))
(define-constant ERR_ALREADY_LISTED (err u202))
(define-constant ERR_INSUFFICIENT_FUNDS (err u203))
(define-constant ERR_CANNOT_BUY_OWN (err u204))
(define-constant ERR_PAYMENT_FAILED (err u205))
(define-constant ERR_TRANSFER_FAILED (err u206))
(define-constant ERR_INVALID_PRICE (err u207))
(define-constant ERR_NOT_TOKEN_OWNER (err u208))

;; Data maps
;; Stores listing info: token-id -> {seller, price}
(define-map listings
  uint
  {
    seller: principal,
    price: uint
  }
)

;; Track total fees collected
(define-data-var total-fees-collected uint u0)
(define-data-var total-sales uint u0)
(define-data-var total-listings uint u0)

;; NFT Contract reference
(define-constant NFT_CONTRACT 'SPDQ03RC9J9T1GGJ2CGGMP1HZ9W0NYPFPH43BEP8.simple-nft-v3)

;; Read-only functions

(define-read-only (get-listing (token-id uint))
  (map-get? listings token-id))

(define-read-only (is-listed (token-id uint))
  (is-some (map-get? listings token-id)))

(define-read-only (get-list-fee)
  LIST_FEE)

(define-read-only (get-sale-fee)
  SALE_FEE)

(define-read-only (get-total-fees-collected)
  (var-get total-fees-collected))

(define-read-only (get-total-sales)
  (var-get total-sales))

(define-read-only (get-total-listings)
  (var-get total-listings))

;; Public functions

;; List an NFT for sale
;; Seller pays listing fee of 0.0013 STX
;; NFT is transferred to marketplace contract for escrow
(define-public (list-nft (token-id uint) (price uint))
  (let
    (
      (seller tx-sender)
    )
    ;; Ensure price is greater than sale fee
    (asserts! (> price SALE_FEE) ERR_INVALID_PRICE)
    
    ;; Ensure NFT is not already listed
    (asserts! (not (is-listed token-id)) ERR_ALREADY_LISTED)
    
    ;; Pay listing fee to contract owner
    (try! (stx-transfer? LIST_FEE seller CONTRACT_OWNER))
    
    ;; Transfer NFT to marketplace contract for escrow
    (try! (contract-call? NFT_CONTRACT transfer token-id seller (as-contract tx-sender)))
    
    ;; Create listing
    (map-set listings token-id {seller: seller, price: price})
    
    ;; Update stats
    (var-set total-fees-collected (+ (var-get total-fees-collected) LIST_FEE))
    (var-set total-listings (+ (var-get total-listings) u1))
    
    (ok token-id)
  )
)

;; Buy a listed NFT
;; Buyer pays the listed price
;; Sale fee is deducted and sent to contract owner
;; Remaining amount goes to seller
(define-public (buy-nft (token-id uint))
  (let
    (
      (buyer tx-sender)
      (listing (unwrap! (map-get? listings token-id) ERR_NOT_LISTED))
      (seller (get seller listing))
      (price (get price listing))
      (seller-amount (- price SALE_FEE))
    )
    ;; Cannot buy own NFT
    (asserts! (not (is-eq buyer seller)) ERR_CANNOT_BUY_OWN)
    
    ;; Transfer sale fee to contract owner
    (try! (stx-transfer? SALE_FEE buyer CONTRACT_OWNER))
    
    ;; Transfer remaining amount to seller
    (try! (stx-transfer? seller-amount buyer seller))
    
    ;; Transfer NFT from marketplace to buyer
    (try! (as-contract (contract-call? NFT_CONTRACT transfer token-id tx-sender buyer)))
    
    ;; Remove listing
    (map-delete listings token-id)
    
    ;; Update stats
    (var-set total-fees-collected (+ (var-get total-fees-collected) SALE_FEE))
    (var-set total-sales (+ (var-get total-sales) u1))
    
    (ok token-id)
  )
)

;; Cancel a listing
;; Only the original seller can cancel
;; NFT is returned to seller, no refund on listing fee
(define-public (cancel-listing (token-id uint))
  (let
    (
      (listing (unwrap! (map-get? listings token-id) ERR_NOT_LISTED))
      (seller (get seller listing))
    )
    ;; Only seller can cancel
    (asserts! (is-eq tx-sender seller) ERR_NOT_OWNER)
    
    ;; Transfer NFT back to seller
    (try! (as-contract (contract-call? NFT_CONTRACT transfer token-id tx-sender seller)))
    
    ;; Remove listing
    (map-delete listings token-id)
    
    (ok token-id)
  )
)

;; Update listing price
;; Only seller can update
(define-public (update-price (token-id uint) (new-price uint))
  (let
    (
      (listing (unwrap! (map-get? listings token-id) ERR_NOT_LISTED))
      (seller (get seller listing))
    )
    ;; Only seller can update
    (asserts! (is-eq tx-sender seller) ERR_NOT_OWNER)
    
    ;; Ensure new price is greater than sale fee
    (asserts! (> new-price SALE_FEE) ERR_INVALID_PRICE)
    
    ;; Update listing price
    (map-set listings token-id {seller: seller, price: new-price})
    
    (ok token-id)
  )
)
