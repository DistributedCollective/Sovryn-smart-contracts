// SPDX-License-Identifier: MIT
pragma solidity 0.5.17;

/**
 * The two reads a task makes on a lending pool: the asset its withdrawals
 * escrow and its display symbol.
 */
contract MockLoanPool {
    address public loanTokenAddress;
    string public symbol;

    constructor(address asset, string memory poolSymbol) public {
        loanTokenAddress = asset;
        symbol = poolSymbol;
    }

    function setLoanTokenAddress(address asset) external {
        loanTokenAddress = asset;
    }
}
