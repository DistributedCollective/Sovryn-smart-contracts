/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../core/State.sol";
import "../mixins/VaultController.sol";
import "../swaps/SwapsUser.sol";
import "../swaps/ISwapsImpl.sol";

contract SwapsExternal is VaultController, SwapsUser {

    constructor() public {}

    function()
        external
    {
        revert("fallback not allowed");
    }

    function initialize(
        address target)
        external
        onlyOwner
    {
        _setTarget(this.swapExternal.selector, target);
        _setTarget(this.getSwapExpectedReturn.selector, target);
    }

    function swapExternal(
        address sourceToken,
        address destToken,
        address receiver,
        address returnToSender,
        uint256 sourceTokenAmount,
        uint256 requiredDestTokenAmount,
        uint256 minReturn,
        bytes calldata swapData,
        address priceFeeds_)
        external
        payable
        nonReentrant
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        require(sourceTokenAmount != 0, "sourceTokenAmount == 0");
        require(minReturn > 0, "minReturn must larger than zero");
        require(checkPriceDivergence(sourceToken, destToken, sourceTokenAmount, priceFeeds_), "rate disagreement");

        if (msg.value != 0) {
            if (sourceToken == address(0)) {
                sourceToken = address(wrbtcToken);
            }
            require(sourceToken == address(wrbtcToken), "sourceToken mismatch");
            require(msg.value == sourceTokenAmount, "sourceTokenAmount mismatch");
            wrbtcToken.deposit.value(sourceTokenAmount)();
        } else {
            IERC20(sourceToken).safeTransferFrom(
                msg.sender,
                address(this),
                sourceTokenAmount
            );
        }

        (destTokenAmountReceived, sourceTokenAmountUsed) = _swapsCall(
            [
                sourceToken,
                destToken,
                receiver,
                returnToSender,
                msg.sender // user
            ],
            [
                sourceTokenAmount, // minSourceTokenAmount
                sourceTokenAmount, // maxSourceTokenAmount
                requiredDestTokenAmount
            ],
            0, // loanId (not tied to a specific loan)
            false, // bypassFee
            swapData
        );

        require(destTokenAmountReceived >= minReturn, "destTokenAmountReceived too low");

        emit ExternalSwap(
            msg.sender, // user
            sourceToken,
            destToken,
            sourceTokenAmountUsed,
            destTokenAmountReceived
        );
    }

    function getSwapExpectedReturn(
        address sourceToken,
        address destToken,
        uint256 sourceTokenAmount)
        external
        view
        returns (uint256)
    {
        return _swapsExpectedReturn(
            sourceToken,
            destToken,
            sourceTokenAmount
        );
    }

    function checkPriceDivergence(        
        address sourceToken,
        address destToken,
        uint256 sourceTokenAmount,
        address priceFeeds_) 
        public 
        returns(bool result) 
    {
        (uint256 rate, uint256 precision) = IPriceFeeds(priceFeeds_).queryRate(sourceToken, destToken);
        uint256 rateFromSwap = ISwapsImpl(swapsImpl).internalExpectedRate(sourceToken, destToken, sourceTokenAmount);
        rateFromSwap = rateFromSwap.mul(precision).div(sourceTokenAmount);
        result = rate == rateFromSwap ? true : false;
    }
}