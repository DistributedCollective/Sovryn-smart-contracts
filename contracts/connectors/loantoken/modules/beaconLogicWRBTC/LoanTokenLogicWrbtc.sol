/**
 * Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../LoanTokenLogicStandard.sol";

contract LoanTokenLogicWrbtc is LoanTokenLogicStandard {
    /**
     * @notice This function is MANDATORY, which will be called by LoanTokenLogicBeacon and be registered.
     * Every new public function, the sginature needs to be included in this function.
     *
     * @dev This function will return the list of function signature in this contract that are available for public call
     * Then this function will be called by LoanTokenLogicBeacon, and the function signatures will be registred in LoanTokenLogicBeacon.
     * @dev To save the gas we can just directly return the list of function signature from this pure function.
     * The other workaround (fancy way) is we can create a storage for the list of the function signature, and then we can store each function signature to that storage from the constructor.
     * Then, in this function we just need to return that storage variable.
     *
     * @return The list of function signatures (bytes4[])
     */
    function getListFunctionSignatures()
        external
        pure
        returns (bytes4[] memory functionSignatures, bytes32 moduleName)
    {
        bytes4[] memory res = new bytes4[](32);

        // Loan Token Logic Standard
        res[0] = this.mint.selector;
        res[1] = this.burn.selector;
        res[2] = this.borrow.selector;
        res[3] = this.marginTrade.selector;
        res[4] = this.marginTradeAffiliate.selector;
        res[5] = this.transfer.selector;
        res[6] = this.transferFrom.selector;
        res[7] = this.profitOf.selector;
        res[8] = this.tokenPrice.selector;
        res[9] = this.checkpointPrice.selector;
        res[10] = this.marketLiquidity.selector;
        res[11] = this.avgBorrowInterestRate.selector;
        res[12] = this.borrowInterestRate.selector;
        res[13] = this.nextBorrowInterestRate.selector;
        res[14] = this.supplyInterestRate.selector;
        res[15] = this.nextSupplyInterestRate.selector;
        res[16] = this.totalSupplyInterestRate.selector;
        res[17] = this.totalAssetBorrow.selector;
        res[18] = this.totalAssetSupply.selector;
        res[19] = this.getMaxEscrowAmount.selector;
        res[20] = this.assetBalanceOf.selector;
        res[21] = this.getEstimatedMarginDetails.selector;
        res[22] = this.getDepositAmountForBorrow.selector;
        res[23] = this.getBorrowAmountForDeposit.selector;
        res[24] = this.checkPriceDivergence.selector;
        res[25] = this.calculateSupplyInterestRate.selector;

        // Loan Token WRBTC
        res[26] = this.mintWithBTC.selector;
        res[27] = this.burnToBTC.selector;

        // Advanced Token
        res[28] = this.approve.selector;

        // Advanced Token Storage
        res[29] = this.totalSupply.selector;
        res[30] = this.balanceOf.selector;
        res[31] = this.allowance.selector;

        return (res, stringToBytes32("LoanTokenLogicWrbtc"));
    }

    function mintWithBTC(address receiver, bool useLM)
        external
        payable
        nonReentrant
        globallyNonReentrant
        returns (uint256 mintAmount)
    {
        if (useLM) return _mintWithLM(receiver, msg.value);
        else return _mintToken(receiver, msg.value);
    }

    function burnToBTC(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external nonReentrant globallyNonReentrant returns (uint256 loanAmountPaid) {
        if (useLM) loanAmountPaid = _burnFromLM(burnAmount);
        else loanAmountPaid = _burnToken(burnAmount);

        if (loanAmountPaid != 0) {
            IWrbtcERC20(wrbtcTokenAddress).withdraw(loanAmountPaid);
            Address.sendValue(receiver, loanAmountPaid);
        }
    }

    /* Internal functions */

    /**
     * @notice Handle transfers prior to adding newPrincipal to loanTokenSent.
     *
     * @param collateralTokenAddress The address of the collateral token.
     * @param sentAddresses The struct which contains addresses of
     * - lender
     * - borrower
     * - receiver
     * - manager
     *
     * @param sentAmounts The struct which contains uint256 of:
     * - interestRate
     * - newPrincipal
     * - interestInitialAmount
     * - loanTokenSent
     * - collateralTokenSent
     *
     * @param withdrawalAmount The amount to withdraw.
     *
     * @return msgValue The amount of value sent.
     * */
    function _verifyTransfers(
        address collateralTokenAddress,
        MarginTradeStructHelpers.SentAddresses memory sentAddresses,
        MarginTradeStructHelpers.SentAmounts memory sentAmounts,
        uint256 withdrawalAmount
    ) internal returns (uint256 msgValue) {
        address _wrbtcToken = wrbtcTokenAddress;
        address _loanTokenAddress = _wrbtcToken;
        address receiver = sentAddresses.receiver;
        uint256 newPrincipal = sentAmounts.newPrincipal;
        uint256 loanTokenSent = sentAmounts.loanTokenSent;
        uint256 collateralTokenSent = sentAmounts.collateralTokenSent;

        require(_loanTokenAddress != collateralTokenAddress, "26");

        msgValue = msg.value;

        if (withdrawalAmount != 0) {
            /// withdrawOnOpen == true
            IWrbtcERC20(_wrbtcToken).withdraw(withdrawalAmount);
            Address.sendValue(receiver, withdrawalAmount);
            if (newPrincipal > withdrawalAmount) {
                _safeTransfer(
                    _loanTokenAddress,
                    sovrynContractAddress,
                    newPrincipal - withdrawalAmount,
                    ""
                );
            }
        } else {
            _safeTransfer(_loanTokenAddress, sovrynContractAddress, newPrincipal, "27");
        }

        if (collateralTokenSent != 0) {
            _safeTransferFrom(
                collateralTokenAddress,
                msg.sender,
                sovrynContractAddress,
                collateralTokenSent,
                "28"
            );
        }

        if (loanTokenSent != 0) {
            if (msgValue != 0 && msgValue >= loanTokenSent) {
                IWrbtc(_wrbtcToken).deposit.value(loanTokenSent)();
                _safeTransfer(_loanTokenAddress, sovrynContractAddress, loanTokenSent, "29");
                msgValue -= loanTokenSent;
            } else {
                _safeTransferFrom(
                    _loanTokenAddress,
                    msg.sender,
                    sovrynContractAddress,
                    loanTokenSent,
                    "29"
                );
            }
        }
    }
}
