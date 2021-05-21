pragma solidity ^0.5.17;

import "../openzeppelin/IERC20_.sol";

/**
 * @title Dummy token with 0 total supply.
 *
 * @dev We need this token for having a flexibility with LiquidityMining configuration
 */
contract LiquidityMiningConfigToken is IERC20_ {

    function totalSupply() external view returns (uint256) {
        return 0;
    }

    function balanceOf(address account) external view returns (uint256) {
        return 0;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        return false;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return 0;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        return false;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool) {
        return false;
    }

}