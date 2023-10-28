/**
 * Copyright 2017-2021, bZeroX, LLC <https://bzx.network/>. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;

import "../core/State.sol";
import "../feeds/IPriceFeeds.sol";
import "../events/SwapsEvents.sol";
import "../mixins/FeesHelper.sol";
import "./ISwapsImpl.sol";
import "./connectors/interfaces/ISovrynSwapNetwork.sol";

/**
 * @title Perform token swaps for loans and trades.
 * */
contract SwapsUser is State, SwapsEvents, FeesHelper {
    /**
     * @notice Internal loan swap.
     *
     * @param loanId The ID of the loan.
     * @param sourceToken The address of the source tokens.
     * @param destToken The address of destiny tokens.
     * @param user The user address.
     * @param minSourceTokenAmount The minimum amount of source tokens to swap.
     * @param maxSourceTokenAmount The maximum amount of source tokens to swap.
     * @param requiredDestTokenAmount The required amount of destination tokens.
     * @param bypassFee To bypass or not the fee.
     * @param loanDataBytes The payload for the call. These loan DataBytes are
     *   additional loan data (not in use for token swaps).
     *
     * @return destTokenAmountReceived
     * @return sourceTokenAmountUsed
     * @return sourceToDestSwapRate
     * */
    function _loanSwap(
        bytes32 loanId,
        address sourceToken,
        address destToken,
        address user,
        uint256 minSourceTokenAmount,
        uint256 maxSourceTokenAmount,
        uint256 requiredDestTokenAmount,
        bool bypassFee,
        bytes memory loanDataBytes
    )
        internal
        returns (
            uint256 destTokenAmountReceived,
            uint256 sourceTokenAmountUsed,
            uint256 sourceToDestSwapRate
        )
    {
        (destTokenAmountReceived, sourceTokenAmountUsed) = _swapsCall(
            [
                sourceToken,
                destToken,
                address(this), // receiver
                address(this), // returnToSender
                user
            ],
            [minSourceTokenAmount, maxSourceTokenAmount, requiredDestTokenAmount],
            loanId,
            bypassFee,
            loanDataBytes,
            false // swap external flag, set to false so that it will use the tradingFeePercent
        );

        /// Will revert if swap size too large.
        _checkSwapSize(sourceToken, sourceTokenAmountUsed);

        /// Will revert if disagreement found.
        sourceToDestSwapRate = IPriceFeeds(priceFeeds).checkPriceDisagreement(
            sourceToken,
            destToken,
            sourceTokenAmountUsed,
            destTokenAmountReceived,
            maxDisagreement
        );

        emit LoanSwap(
            loanId,
            sourceToken,
            destToken,
            user,
            sourceTokenAmountUsed,
            destTokenAmountReceived
        );
    }

    /**
     * @notice Calculate amount of source and destiny tokens.
     *
     * @dev Wrapper for _swapsCall_internal function.
     *
     * @param addrs The array of addresses.
     * @param vals The array of values.
     * @param loanId The Id of the associated loan.
     * @param miscBool True/false to bypassFee.
     * @param loanDataBytes Additional loan data (not in use yet).
     *
     * @return destTokenAmountReceived The amount of destiny tokens received.
     * @return sourceTokenAmountUsed The amount of source tokens used.
     * */
    function _swapsCall(
        address[5] memory addrs,
        uint256[3] memory vals,
        bytes32 loanId,
        bool miscBool, /// bypassFee
        bytes memory loanDataBytes,
        bool isSwapExternal
    ) internal returns (uint256, uint256) {
        /// addrs[0]: sourceToken
        /// addrs[1]: destToken
        /// addrs[2]: receiver
        /// addrs[3]: returnToSender
        /// addrs[4]: user
        /// vals[0]:  minSourceTokenAmount
        /// vals[1]:  maxSourceTokenAmount
        /// vals[2]:  requiredDestTokenAmount

        require(vals[0] != 0 || vals[1] != 0, "min or max source token amount needs to be set");

        if (vals[1] == 0) {
            vals[1] = vals[0];
        }
        require(vals[0] <= vals[1], "sourceAmount larger than max");

        uint256 destTokenAmountReceived;
        uint256 sourceTokenAmountUsed;

        uint256 tradingFee;
        if (!miscBool) {
            /// bypassFee
            if (vals[2] == 0) {
                /// condition: vals[0] will always be used as sourceAmount

                if (isSwapExternal) {
                    tradingFee = _getSwapExternalFee(vals[0]);
                } else {
                    tradingFee = _getTradingFee(vals[0]);
                }

                if (tradingFee != 0) {
                    _payTradingFee(
                        addrs[4], /// user
                        loanId,
                        addrs[0], /// sourceToken (feeToken)
                        addrs[1], /// pairToken (used to check if there is any special rebates or not) -- to pay fee reward
                        tradingFee
                    );

                    vals[0] = vals[0].sub(tradingFee);
                }
            } else {
                /// Condition: unknown sourceAmount will be used.

                if (isSwapExternal) {
                    tradingFee = _getSwapExternalFee(vals[2]);
                } else {
                    tradingFee = _getTradingFee(vals[2]);
                }

                if (tradingFee != 0) {
                    vals[2] = vals[2].add(tradingFee);
                }
            }
        }

        require(loanDataBytes.length == 0, "invalid state");

        (destTokenAmountReceived, sourceTokenAmountUsed) = _swapsCall_internal(addrs, vals);

        if (vals[2] == 0) {
            /// There's no minimum destTokenAmount, but all of vals[0]
            /// (minSourceTokenAmount) must be spent.
            require(sourceTokenAmountUsed == vals[0], "swap too large to fill");

            if (tradingFee != 0) {
                sourceTokenAmountUsed = sourceTokenAmountUsed.add(tradingFee);
            }
        } else {
            /// There's a minimum destTokenAmount required, but
            /// sourceTokenAmountUsed won't be greater
            /// than vals[1] (maxSourceTokenAmount)
            require(sourceTokenAmountUsed <= vals[1], "swap fill too large");
            require(destTokenAmountReceived >= vals[2], "insufficient swap liquidity");

            if (tradingFee != 0) {
                _payTradingFee(
                    addrs[4], /// user
                    loanId, /// loanId,
                    addrs[1], /// destToken (feeToken)
                    addrs[0], /// pairToken (used to check if there is any special rebates or not) -- to pay fee reward
                    tradingFee
                );

                destTokenAmountReceived = destTokenAmountReceived.sub(tradingFee);
            }
        }

        return (destTokenAmountReceived, sourceTokenAmountUsed);
    }

    /**
     * @notice Calculate amount of source and destiny tokens.
     *
     * @dev Calls swapsImpl::internalSwap
     *
     * @param addrs The array of addresses.
     * @param vals The array of values.
     *
     * @return destTokenAmountReceived The amount of destiny tokens received.
     * @return sourceTokenAmountUsed The amount of source tokens used.
     * */
    function _swapsCall_internal(address[5] memory addrs, uint256[3] memory vals)
        internal
        returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed)
    {
        (destTokenAmountReceived, sourceTokenAmountUsed) = internalSwap(
            addrs[0], /// sourceToken
            addrs[1], /// destToken
            addrs[2], /// receiverAddress
            addrs[3], /// returnToSenderAddress
            vals[0], /// minSourceTokenAmount
            vals[1], /// maxSourceTokenAmount
            vals[2] /// requiredDestTokenAmount)
        );
    }

    /**
     * @notice Calculate expected amount of destiny tokens.
     *
     * @dev Calls swapsImpl::internalExpectedReturn
     *
     * @param sourceToken The address of the source tokens.
     * @param destToken The address of the destiny tokens.
     * @param sourceTokenAmount The amount of the source tokens.
     *
     * @param destTokenAmount The amount of destiny tokens.
     * */
    function _swapsExpectedReturn(
        address sourceToken,
        address destToken,
        uint256 sourceTokenAmount
    ) internal view returns (uint256 destTokenAmount) {
        destTokenAmount = ISwapsImpl(swapsImpl).internalExpectedReturn(
            sourceToken,
            destToken,
            sourceTokenAmount,
            sovrynSwapContractRegistryAddress,
            defaultPathConversion[sourceToken][destToken]
        );
    }

    /**
     * @notice Verify that the amount of tokens are under the swap limit.
     *
     * @dev Calls priceFeeds::amountInEth
     *
     * @param tokenAddress The address of the token to calculate price.
     * @param amount The amount of tokens to calculate price.
     * */
    function _checkSwapSize(address tokenAddress, uint256 amount) internal view {
        uint256 _maxSwapSize = maxSwapSize;
        if (_maxSwapSize != 0) {
            uint256 amountInEth;
            if (tokenAddress == address(wrbtcToken)) {
                amountInEth = amount;
            } else {
                amountInEth = IPriceFeeds(priceFeeds).amountInEth(tokenAddress, amount);
            }
            require(amountInEth <= _maxSwapSize, "swap too large");
        }
    }

    /**
     * Swap the source token for the destination token on the oracle based AMM.
     * On loan opening: minSourceTokenAmount = maxSourceTokenAmount and requiredDestTokenAmount = 0
     *      -> swap the minSourceTokenAmount
     * On loan rollover: (swap interest) minSourceTokenAmount = 0, maxSourceTokenAmount = complete collateral and requiredDestTokenAmount > 0
     *      -> amount of required source tokens to swap is estimated (want to fill requiredDestTokenAmount, not more). maxSourceTokenAMount is not exceeded.
     * On loan closure: minSourceTokenAmount <= maxSourceTokenAmount and requiredDestTokenAmount >= 0
     *      -> same as on rollover. minimum amount is not considered at all.
     *
     * @param sourceTokenAddress The address of the source tokens.
     * @param destTokenAddress The address of the destination tokens.
     * @param receiverAddress The address who will received the swap token results
     * @param returnToSenderAddress The address to return unspent tokens to (when called by the protocol, it's always the protocol contract).
     * @param minSourceTokenAmount The minimum amount of source tokens to swapped (only considered if requiredDestTokens == 0).
     * @param maxSourceTokenAmount The maximum amount of source tokens to swapped.
     * @param requiredDestTokenAmount The required amount of destination tokens.
     * */
    function internalSwap(
        address sourceTokenAddress,
        address destTokenAddress,
        address receiverAddress,
        address returnToSenderAddress,
        uint256 minSourceTokenAmount,
        uint256 maxSourceTokenAmount,
        uint256 requiredDestTokenAmount
    ) internal returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed) {
        require(sourceTokenAddress != destTokenAddress, "source == dest");
        require(
            supportedTokens[sourceTokenAddress] && supportedTokens[destTokenAddress],
            "invalid tokens"
        );

        ISovrynSwapNetwork sovrynSwapNetwork =
            ISwapsImpl(swapsImpl).getSovrynSwapNetworkContract(sovrynSwapContractRegistryAddress);

        IERC20[] memory path =
            getConversionPath(sourceTokenAddress, destTokenAddress, sovrynSwapNetwork);

        uint256 minReturn = 1;
        sourceTokenAmountUsed = minSourceTokenAmount;

        /// If the required amount of destination tokens is passed, we need to
        /// calculate the estimated amount of source tokens regardless of the
        /// minimum source token amount (name is misleading).
        if (requiredDestTokenAmount > 0) {
            sourceTokenAmountUsed = estimateSourceTokenAmount(
                sourceTokenAddress,
                destTokenAddress,
                requiredDestTokenAmount,
                maxSourceTokenAmount
            );
            /// sovrynSwapNetwork.rateByPath does not return a rate, but instead the amount of destination tokens returned.
            require(
                sovrynSwapNetwork.rateByPath(path, sourceTokenAmountUsed) >=
                    requiredDestTokenAmount,
                "insufficient source tokens provided."
            );
            minReturn = requiredDestTokenAmount;
        }

        require(sourceTokenAmountUsed > 0, "cannot swap 0 tokens");

        allowTransfer(sourceTokenAmountUsed, sourceTokenAddress, address(sovrynSwapNetwork));

        /// @dev Note: the kyber connector uses .call() to interact with kyber
        /// to avoid bubbling up. here we allow bubbling up.
        destTokenAmountReceived = sovrynSwapNetwork.convertByPath(
            path,
            sourceTokenAmountUsed,
            minReturn,
            receiverAddress,
            address(0),
            0
        );

        /// If the sender is not the protocol (calling with delegatecall),
        /// return the remainder to the specified address.
        /// @dev Note: for the case that the swap is used without the
        /// protocol. Not sure if it should, though. needs to be discussed.
        if (returnToSenderAddress != address(this)) {
            if (sourceTokenAmountUsed < maxSourceTokenAmount) {
                /// Send unused source token back.
                IERC20(sourceTokenAddress).safeTransfer(
                    returnToSenderAddress,
                    maxSourceTokenAmount - sourceTokenAmountUsed
                );
            }
        }
    }

    /**
     * @notice Check whether the existing allowance suffices to transfer
     *   the needed amount of tokens.
     *   If not, allows the transfer of an arbitrary amount of tokens.
     *
     * @param tokenAmount The amount to transfer.
     * @param tokenAddress The address of the token to transfer.
     * @param sovrynSwapNetwork The address of the sovrynSwap network contract.
     * */
    function allowTransfer(
        uint256 tokenAmount,
        address tokenAddress,
        address sovrynSwapNetwork
    ) internal {
        uint256 tempAllowance = IERC20(tokenAddress).allowance(address(this), sovrynSwapNetwork);
        if (tempAllowance < tokenAmount) {
            IERC20(tokenAddress).safeApprove(sovrynSwapNetwork, uint256(-1));
        }
    }

    function getConversionPath(
        address sourceTokenAddress,
        address destTokenAddress,
        ISovrynSwapNetwork sovrynSwapNetwork
    ) private view returns (IERC20[] memory path) {
        IERC20[] memory _defaultPathConversion =
            defaultPathConversion[sourceTokenAddress][destTokenAddress];

        /// will use the defaultPath if it's set, otherwise query from the SovrynSwapNetwork.
        path = _defaultPathConversion.length >= 3
            ? _defaultPathConversion
            : sovrynSwapNetwork.conversionPath(
                IERC20(sourceTokenAddress),
                IERC20(destTokenAddress)
            );
    }

    /**
     * @notice Calculate the number of source tokens to provide in order to
     *   obtain the required destination amount.
     *
     * @param sourceTokenAddress The address of the source token address.
     * @param destTokenAddress The address of the destination token address.
     * @param requiredDestTokenAmount The number of destination tokens needed.
     * @param maxSourceTokenAmount The maximum number of source tokens to spend.
     *
     * @return The estimated amount of source tokens needed.
     *   Minimum: minSourceTokenAmount, maximum: maxSourceTokenAmount
     * */
    function estimateSourceTokenAmount(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 requiredDestTokenAmount,
        uint256 maxSourceTokenAmount
    ) internal view returns (uint256 estimatedSourceAmount) {
        uint256 sourceToDestPrecision =
            IPriceFeeds(priceFeeds).queryPrecision(sourceTokenAddress, destTokenAddress);
        if (sourceToDestPrecision == 0) return maxSourceTokenAmount;

        /// Compute the expected rate for the maxSourceTokenAmount -> if spending less, we can't get a worse rate.
        uint256 expectedRate =
            internalExpectedRate(
                sourceTokenAddress,
                destTokenAddress,
                maxSourceTokenAmount,
                sovrynSwapContractRegistryAddress
            );

        /// Compute the source tokens needed to get the required amount with the worst case rate.
        estimatedSourceAmount = requiredDestTokenAmount.mul(sourceToDestPrecision).div(
            expectedRate
        );

        /// If the actual rate is exactly the same as the worst case rate, we get rounding issues. So, add a small buffer.
        /// buffer = min(estimatedSourceAmount/1000 , sourceBuffer) with sourceBuffer = 10000
        uint256 buffer = estimatedSourceAmount.div(1000);
        if (buffer > sourceBuffer) buffer = sourceBuffer;
        estimatedSourceAmount = estimatedSourceAmount.add(buffer);

        /// Never spend more than the maximum.
        if (estimatedSourceAmount == 0 || estimatedSourceAmount > maxSourceTokenAmount)
            return maxSourceTokenAmount;
    }

    /**
     * @notice Get the expected rate for 1 source token when exchanging the
     *   given amount of source tokens.
     *
     * @param sourceTokenAddress The address of the source token contract.
     * @param destTokenAddress The address of the destination token contract.
     * @param sourceTokenAmount The amount of source tokens to get the rate for.
     * */
    function internalExpectedRate(
        address sourceTokenAddress,
        address destTokenAddress,
        uint256 sourceTokenAmount,
        address sovrynSwapContractRegistryAddress
    ) internal view returns (uint256) {
        ISovrynSwapNetwork sovrynSwapNetwork =
            ISwapsImpl(swapsImpl).getSovrynSwapNetworkContract(sovrynSwapContractRegistryAddress);

        IERC20[] memory path =
            getConversionPath(sourceTokenAddress, destTokenAddress, sovrynSwapNetwork);

        /// Is returning the total amount of destination tokens.
        uint256 expectedReturn = sovrynSwapNetwork.rateByPath(path, sourceTokenAmount);

        /// Return the rate for 1 token with 18 decimals.
        return expectedReturn.mul(10**18).div(sourceTokenAmount);
    }
}
