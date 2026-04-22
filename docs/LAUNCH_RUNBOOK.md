# $MAV Launch Runbook - Step By Step

*Written so you can follow this half-asleep with one coffee. Every step is copy-paste.*

## 📋 Current state when you wake up

Already built and waiting on you to deploy:

- ✅ **Smart contract:** `/root/mav-token/contracts/MAV.sol` (Solidity, OpenZeppelin-based, 1B fixed supply, mint permanently disabled at deploy, burnable, EIP-2612 permit-enabled)
- ✅ **Deployment script:** `/root/mav-token/scripts/deploy.sh` (Foundry-based, verifies on BaseScan automatically)
- ✅ **Backend tier-check:** `/root/Maverick_Web_Modular/token_gate.py` - Flask blueprint with SIWE login + on-chain balance read + 60s cache + `@require_tier()` decorator
- ✅ **Config file:** `/root/Maverick_Web_Modular/token_gate_config.py` - holds the contract address + tier thresholds. Currently has zero-address placeholder.
- ✅ **Frontend wallet flow:** `/root/freedomcore-site/js/mav-wallet.js` - wallet connect, SIWE, nav badge, tier display. Uses `ethers.umd.min.js` (self-hosted).
- ✅ **Access page:** `/root/freedomcore-site/pages/access.html` - full connect-wallet UX with tier cards, disclaimer, FAQ. Works in pre-launch grace mode.
- ✅ **Index page updated:** Access section points to `/pages/access.html`.
- ✅ **Signal feed gated:** `/api/signals` returns 403 for non-Signal tier. UI shows "Connect wallet to unlock" card when 403.
- ✅ **Pre-launch grace:** every connected wallet currently receives Observer tier for free. Lets the waitlist explore before the token is live.

The site is running with token-gating **active but in grace mode**.

---

## 🚀 Launch checklist - in order

### 1. Create the deployer wallet (~ 2 min)

Generate a fresh wallet that will deploy the contract and receive the initial 1B mint.

**Option A - Coinbase Wallet (recommended, easiest):**
1. Install Coinbase Wallet mobile app
2. Create new wallet, write down the recovery phrase on paper
3. Export the private key (Settings → Developer Settings → Show private key)
4. On the server, save it to `~/.mav-deployer-key`:
   ```
   echo '0xYOUR_PRIVATE_KEY' > ~/.mav-deployer-key && chmod 600 ~/.mav-deployer-key
   ```

**Option B - `cast` CLI (pure terminal):**
```
curl -L https://foundry.paradigm.xyz | bash && source ~/.bashrc && foundryup
cast wallet new
# Copy the address. The private key is shown in hex - save securely.
echo '0xYOUR_PRIVATE_KEY' > ~/.mav-deployer-key && chmod 600 ~/.mav-deployer-key
```

Record the deployer **public address** (0x...) - you'll need it everywhere below.

### 2. Fund with Base ETH (~5-15 min depending on bridge)

Deployment + contract verification costs ~$1 in gas on Base. Bridging adds a bit more. Total: send ~$20 worth of ETH to be safe.

**Cheapest path:** Buy ETH on Coinbase → withdraw directly to your Base wallet address on the "Base" network (Coinbase supports Base natively, no bridge needed).

**If you already have ETH on mainnet:** Use https://bridge.base.org (official Base bridge). ~10 min.

Verify the wallet on BaseScan after funding:
```
https://basescan.org/address/0xYOUR_ADDRESS
```

### 3. Deploy the contract (~1 min)

```bash
# Install Foundry if not already (one-liner, takes ~30s)
curl -L https://foundry.paradigm.xyz | bash && source ~/.bashrc && foundryup

# Grab a free BaseScan API key (for contract verification)
# https://basescan.org/myapikey → Create new key
export ETHERSCAN_API_KEY="your_basescan_key"

# Your deployer address (same wallet that has the ETH)
export TREASURY="0xYOUR_DEPLOYER_ADDRESS"

# Optional: swap in a better RPC if you have Alchemy/QuickNode. Public works.
# export RPC_URL="https://base-mainnet.g.alchemy.com/v2/YOUR_KEY"

# Run it
cd /root/mav-token && bash scripts/deploy.sh
```

The script prints the deployed contract address at the end. Copy it.

### 4. Wire the contract into the site (~30 sec)

Edit `/root/Maverick_Web_Modular/token_gate_config.py`:

```python
MAV_CONTRACT_ADDRESS = "0xACTUAL_DEPLOYED_ADDRESS"   # paste here
TOKEN_DEPLOYED = True                                # flip to True
```

Restart the backend:
```
systemctl restart maverick-dashboard
```

Smoke test:
```
curl -H "X-API-Key: fcweb_60fd94aa2d910f38a9f3e0557076791a" \
  https://freedomcore.io/api/gate/status
# Should return token_deployed: true
```

### 5. Seed Aerodrome liquidity pool (~10 min)

Aerodrome is Base's native DEX. Liquidity lives there.

1. Open https://aerodrome.finance → connect the deployer wallet
2. Go to "Liquidity" → "New Position"
3. Select pair: **MAV / WETH**
4. Paste your contract address as the MAV token (it's not yet listed, so you paste the custom address)
5. Choose **vAMM** (volatile pool - right one for a new token)
6. Deposit initial liquidity:
   - Recommended minimum: **400M MAV + 2 ETH (~$5,000 at 2026 ETH prices)**
   - Initial price becomes: 2 ETH ÷ 400M MAV = 0.000000005 ETH per MAV = ~$0.0000125 per token (adjust to taste)
   - **At this price:** 1,000 MAV (Observer) = ~$0.01 → free on grace, nominal after launch. Too low.
   - **Better starting price:** 100M MAV + 1 ETH = 0.00000001 ETH/MAV ≈ $0.000025
     - Observer (1k): $0.025
     - Signal (10k): $0.25
     - Sovereign (100k): $2.50

   **Realistic tier-access targeting:** aim so that Sovereign costs the equivalent of $3k-5k at launch. That means:
   ```
   1 MAV = $0.03 target launch price
   → 100k MAV = $3,000 sovereign floor
   → 10k MAV = $300 signal floor
   → 1k MAV = $30 observer floor
   → LP seed: 66.6M MAV + 1 ETH = $2,000-2,500 ETH + 66.6M tokens = ~$2k each side
   ```
   Adjust the LP ratio to hit whatever tier-pricing makes sense to you. Rough rule: launch with $4-8k of your own liquidity.

7. Confirm the deposit. You'll get LP tokens.

### 6. Lock the LP tokens for 24 months (~5 min - **anti-rug signal**)

This is the single biggest trust signal. Before you announce, lock the LP.

1. Go to https://team.finance → connect deployer wallet → "Lock Liquidity"
2. Select Base network
3. Paste your Aerodrome LP token address (shown in Aerodrome → Portfolio)
4. Set lock duration: **24 months**
5. Confirm (costs ~$5 in gas)
6. Save the team.finance lock URL - put it on the /access.html FAQ as proof

### 7. Renounce contract ownership (~1 min)

Makes minting and owner-only functions permanently unreachable. Zero future dilution risk.

```bash
cd /root/mav-token
cast send "0xYOUR_CONTRACT" \
  "transferOwnership(address)" \
  "0x000000000000000000000000000000000000dEaD" \
  --rpc-url https://mainnet.base.org \
  --private-key $(cat ~/.mav-deployer-key)
```

(Ownership goes to the burn address. Can't be reversed.)

Verify on BaseScan:
```
https://basescan.org/address/0xYOUR_CONTRACT#readContract
# Call "owner()" - should return 0x000...dEaD
```

### 8. Send the team allocation to a vesting contract (~10 min - only if you want public proof)

Skip this if you're keeping the 10% team allocation in the deployer wallet. Or use https://sablier.com or https://hedgey.finance to stream it to yourself over 24 months on-chain. Adds trust; not required.

### 9. Update the site with the deployed address in FAQ + About (~5 min)

Edit `/root/freedomcore-site/pages/access.html` - find the "Where can I buy?" FAQ and update:
```
Buy on Aerodrome: https://aerodrome.finance/swap?from=eth&to=0xYOUR_CONTRACT
BaseScan: https://basescan.org/token/0xYOUR_CONTRACT
Team.finance LP lock: https://team.finance/view-coin/0xYOUR_CONTRACT
```

Also edit `/root/freedomcore-site/pages/about.html` and add a Token section.

Sync to live:
```
rsync -a /root/freedomcore-site/ /var/www/freedomcore/ --exclude='api_data/performance.json'
```

### 10. Announce (the hour that matters)

**Pre-tweet (1 hour before):**
> Something big at 6pm UTC. 13 months of work. 1,000 generations of AI evolution. About to give you a front-row seat. Not a promise. An experiment. Stay tuned. @freedomcoreai

**Launch tweet:**
> 🔴 LIVE: MAVERICK $MAV is now tradable on Base.
>
> A self-evolving AI trading organism. Watch it think. Follow its signals. Run it autonomously.
>
> Contract: 0xYOUR_CONTRACT
> Buy: https://aerodrome.finance/swap?from=eth&to=0xYOUR_CONTRACT
> LP locked 24mo: [team.finance link]
> Ownership renounced: [basescan tx link]
>
> Not financial advice. Crypto can go to zero. You're buying access to the experiment, not a promise of yield.

**Farcaster cast (same content, plus frame):**
Use Warpcast's native frame builder to create a one-click "check my MAV tier" frame.

### 11. Activate burn-on-win (later, optional)

Once you want the deflationary mechanic live, build `/root/Trinity_Core/mav_burn_on_win.py`:
- Reads Goliath's 24h PnL from latest_performance.txt
- If positive, computes: burn_amount = min(0.05% of treasury_balance, $500_equivalent)
- Calls the `burn()` function on the MAV contract from a dedicated burn-wallet
- Posts a tweet: "24h PnL +X%. Burned 500k MAV. Total supply now: 999.5M"

Hook it up as a systemd timer firing once per day at 18:00 UTC (after snapshot agent).

---

## 📞 If anything breaks

**Wallet won't connect on phone:**
- User needs MetaMask or Coinbase Wallet mobile app with walletconnect enabled
- Safari on iOS can be flaky - recommend Chrome/Brave
- Instruct them to visit https://freedomcore.io/pages/access.html IN the Coinbase Wallet browser (built-in DApp browser)

**Signature works but tier shows NONE after buy:**
- The 60-second balance cache hasn't expired. Wait 60s and reload.
- Or hard-invalidate: `rm -f /tmp/mav_balance_cache.json && systemctl restart maverick-dashboard` (no cache file exists but restart clears in-memory cache).

**"Network error" on verify:**
- Check `journalctl -u maverick-dashboard -f` for backend exception
- Most common: invalid SIWE nonce format. Nonce expires after 5 min, user needs to click Connect again.

**Someone complains they bought and still can't see Signal content:**
- Ask for their wallet address. Check: `curl -s "https://api.basescan.org/api?module=account&action=tokenbalance&contractaddress=0xCONTRACT&address=0xTHEIRS&tag=latest&apikey=KEY"`
- If balance shows 10k+ MAV but site says NONE → backend bug, check `journalctl`

**BaseScan doesn't verify automatically:**
- Re-run manually: `forge verify-contract --watch --chain-id 8453 --etherscan-api-key $KEY --verifier-url https://api.basescan.org/api 0xCONTRACT contracts/MAV.sol:MAV`

---

## 🧾 Post-launch quick-wins (no token required - can ship anytime)

- **Holder governance:** Set up Snapshot.org space for $MAV. Signal+Sovereign holders vote on weekly swarm prompt additions. Free, gasless voting. Takes 30 minutes to set up.
- **Collab.Land bot:** Auto-assign Discord/Telegram roles based on tier. Free for first 10,000 users.
- **Farcaster frame:** "Check your MAV tier" interactive frame in Warpcast. Distribution multiplier.
- **Burn dashboard:** Public page showing every treasury burn event. Adds transparency and gives something to tweet about weekly.
- **Performance attestation:** Daily on-chain Goliath PnL event log - trustless proof of performance.

---

## 🙅 Don't do this

- **DON'T promise profit share from trading.** That's a securities violation in the US AND UK. Access-only is the legal framing. Keep it utility.
- **DON'T tweet price predictions.** Let the market decide.
- **DON'T say "guaranteed" anything.** Ever.
- **DON'T airdrop to random wallets.** Airdrop farmers are not your community. Reward connected-wallet waitlist only.
- **DON'T forget to geoblock the UK and US** on the buy flow if you want clean regulatory posture. Cloudflare IP filter takes 5 min.

---

Built on 2026-04-22 while Rob slept. Go make this work.

- Claude
