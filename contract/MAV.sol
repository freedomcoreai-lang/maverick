// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
 * ███╗   ███╗ █████╗ ██╗   ██╗
 * ████╗ ████║██╔══██╗██║   ██║
 * ██╔████╔██║███████║██║   ██║
 * ██║╚██╔╝██║██╔══██║╚██╗ ██╔╝
 * ██║ ╚═╝ ██║██║  ██║ ╚████╔╝
 * ╚═╝     ╚═╝╚═╝  ╚═╝  ╚═══╝
 *
 * MAV - the utility access token for MAVERICK, a self-evolving AI trading organism
 * at https://freedomcore.io
 *
 * This token grants access tiers to a live AI trading experiment. It does NOT promise
 * profit, dividends, or any financial return. Holders get to watch an evolving system
 * and (for higher tiers) receive trade signals. That is all.
 *
 * Tier thresholds (enforced off-chain by the MAVERICK site):
 *   OBSERVER    -   1,000 MAV
 *   SIGNAL      -  10,000 MAV
 *   SOVEREIGN   - 100,000 MAV
 *
 * Chain: Base (Coinbase L2). Contract audited by: nobody yet. Use at your own risk.
 *
 * Tokenomics (1,000,000,000 fixed max supply):
 *   40%  Public sale / DEX liquidity
 *   30%  Protocol treasury (operations)
 *   20%  Community airdrops / loyalty rewards / holder incentives
 *   10%  Team (vested 24 months via separate TokenVesting contract)
 */

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MAV is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    // Once sealed, no more minting is possible. One-way gate for trust.
    bool public mintingFinalized;

    event MintingFinalized(address indexed by, uint256 timestamp);

    error MaxSupplyExceeded(uint256 requested, uint256 remaining);
    error MintingIsFinalized();

    constructor(address treasury)
        ERC20("MAVERICK", "MAV")
        ERC20Permit("MAVERICK")
        Ownable(treasury)
    {
        // Deployer is the treasury. Initial mint of the full supply to treasury.
        // Treasury is responsible for distributing per the tokenomics split above.
        _mint(treasury, MAX_SUPPLY);

        // Auto-finalize minting at deploy time - there will never be another MAV.
        // Removes supply uncertainty for every holder, forever.
        mintingFinalized = true;
        emit MintingFinalized(msg.sender, block.timestamp);
    }

    // Treasury can still move tokens (normal ERC-20 transfers). Minting is
    // permanently disabled. Burning remains available to any holder for their
    // own balance via ERC20Burnable.
    function mint(address, uint256) external view onlyOwner {
        revert MintingIsFinalized();
    }
}
