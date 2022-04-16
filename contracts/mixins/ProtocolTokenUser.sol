/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../core/State.sol";
import "../openzeppelin/SafeERC20.sol";

/**
 * @title The Protocol Token User contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized margin
 * trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * This contract implements functionality to withdraw protocol tokens.
 * */
contract ProtocolTokenUser is State {
    using SafeERC20 for IERC20;

    /**
     * @notice Internal function to withdraw an amount of protocol tokens from this contract.
     *
     * @param receiver The address of the recipient.
     * @param amount The amount of tokens to withdraw.
     *
     * @return The protocol token address.
     * @return Withdrawal success (true/false).
     * */
    function _withdrawProtocolToken(address receiver, uint256 amount)
        internal
        returns (address, bool)
    {
        uint256 withdrawAmount = amount;

        uint256 tokenBalance = protocolTokenHeld;
        if (withdrawAmount > tokenBalance) {
            withdrawAmount = tokenBalance;
        }
        if (withdrawAmount == 0) {
            return (protocolTokenAddress, false);
        }

        protocolTokenHeld = tokenBalance.sub(withdrawAmount);

        IERC20(protocolTokenAddress).safeTransfer(receiver, withdrawAmount);

        return (protocolTokenAddress, true);
    }
}
