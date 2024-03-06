// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title Sovryn Token for BitcoinOS: a 'coupon token' to be transitioned to BitcoinOS.
 *
 * @notice This contract accounts for all holders' balances.
 *
 * @dev This contract represents a token with dynamic supply.
 *   The owner of the token contract can mint/burn tokens to/from any account
 *   based upon previous governance voting and approval.
 *
 */
contract Token is ERC20, ERC20Permit, Ownable {
    /**
     * @dev initializing Owner with address(1) because 0 address is not allowed
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _initialOwner
    ) ERC20(_name, _symbol) ERC20Permit(_name) {}

    /**
     * @dev Creates a `value` amount of tokens and assigns them to `account`, by transferring it from address(0).
     * Relies on the `_update` mechanism
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * NOTE: This function is not override, {_update} should be overridden instead.
     */
    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }
}
