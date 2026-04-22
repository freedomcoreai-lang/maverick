#!/usr/bin/env bash
# MAV deployment — Base mainnet (chain ID 8453)
#
# Prerequisites:
#   1. A fresh wallet. Generate one on Coinbase Wallet or via `cast wallet new`.
#      Record the PRIVATE KEY securely — you will need it here and nowhere else.
#   2. Fund the wallet with ~$50 worth of ETH on Base. Bridge via
#      https://bridge.base.org from Ethereum, or buy directly on Coinbase
#      and withdraw to the Base network.
#   3. Install Foundry if not present:
#        curl -L https://foundry.paradigm.xyz | bash && foundryup
#   4. Get a Base RPC URL. Free options:
#        - https://mainnet.base.org (public, rate-limited)
#        - https://base.blockpi.network/v1/rpc/public
#        - Alchemy/QuickNode for higher reliability
#   5. Get a BaseScan API key for contract verification (free):
#        https://basescan.org/myapikey
#
# Safety: this script NEVER prints the private key. It reads from a file,
# uses it once, then it's gone. Keep the keyfile on a USB or password manager.

set -e

cd "$(dirname "$0")/.."

# Config — edit these before running
KEYFILE="${KEYFILE:-$HOME/.mav-deployer-key}"        # path to file containing 0x-prefixed private key
RPC_URL="${RPC_URL:-https://mainnet.base.org}"
ETHERSCAN_API_KEY="${ETHERSCAN_API_KEY:-}"           # BaseScan API key for verification
TREASURY="${TREASURY:-}"                             # Base address that receives the 1B mint

# Sanity checks
if [ ! -f "$KEYFILE" ]; then
    echo "❌ Private key file not found at $KEYFILE"
    echo "   Create it: echo '0x...' > $KEYFILE && chmod 600 $KEYFILE"
    exit 1
fi
if [ -z "$TREASURY" ]; then
    echo "❌ TREASURY env var not set. Export the address that should hold the initial 1B mint."
    echo "   Typically this is your deployer wallet itself, or a multisig."
    exit 1
fi

PK=$(cat "$KEYFILE" | tr -d '\n' | tr -d ' ')

echo "🚀 Deploying MAV to Base..."
echo "   RPC:      $RPC_URL"
echo "   Treasury: $TREASURY"
echo

# Install OpenZeppelin if needed
if [ ! -d "lib/openzeppelin-contracts" ]; then
    echo "📦 Installing OpenZeppelin..."
    forge install OpenZeppelin/openzeppelin-contracts --no-commit
fi

forge build --root .

# Deploy + verify
forge create \
    --rpc-url "$RPC_URL" \
    --private-key "$PK" \
    --broadcast \
    $([ -n "$ETHERSCAN_API_KEY" ] && echo "--verify --etherscan-api-key $ETHERSCAN_API_KEY --verifier-url https://api.basescan.org/api") \
    contracts/MAV.sol:MAV \
    --constructor-args "$TREASURY"

echo
echo "✅ Deployment complete."
echo "   Copy the contract address above into /root/freedomcore-site/js/token-config.js"
echo "   Then run: systemctl restart maverick-dashboard"
echo
echo "Next steps:"
echo "   1. Seed Aerodrome liquidity (see docs/LAUNCH_RUNBOOK.md §3)"
echo "   2. Lock LP via Team Finance (see §4)"
echo "   3. Announce."
