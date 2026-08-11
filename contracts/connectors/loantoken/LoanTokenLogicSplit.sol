/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./LoanTokenLogicShared.sol";

/**
 * @title LoanTokenLogicSplit contract.
 * @notice iToken logic module holding the lending entry points: `mint`
 *         (deposit the underlying asset in exchange for iTokens) and `burn`
 *         (redeem iTokens back for the underlying), together with their
 *         LiquidityMining variants and the internal mint/burn helpers
 *         (`_mintToken`, `_prepareMinting`, `_burnToken`, `_mintWithLM`,
 *         `_burnFromLM`). iTokens represent a share of the lending pool and
 *         accrue interest over time. On burn, the lender-exit ColFee is
 *         applied.
 *
 * @dev Carved out from its ERC20/transfer sibling `LoanTokenLogicStandard` so
 *      that each deployed logic contract stays under the EVM 24 KB bytecode
 *      limit (EIP-170). Both inherit the common `LoanTokenLogicShared` and are
 *      attached to the iToken proxy through `LoanTokenLogicBeacon`, which
 *      routes each function selector to the module that implements it.
 * */
contract LoanTokenLogicSplit is LoanTokenLogicShared {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    /// DON'T ADD VARIABLES HERE, PLEASE

    /* Public functions */

    /**
     * @notice Mint loan token wrapper.
     * Adds a check before calling low level _mintToken function.
     * The function retrieves the tokens from the message sender, so make sure
     * to first approve the loan token contract to access your funds. This is
     * done by calling approve(address spender, uint amount) on the ERC20
     * token contract, where spender is the loan token contract address and
     * amount is the amount to be deposited.
     *
     * @param receiver The account getting the minted tokens.
     * @param depositAmount The amount of underlying tokens provided on the
     *   loan. (Not the number of loan tokens to mint).
     *
     * @return The amount of loan tokens minted.
     * */
    function mint(
        address receiver,
        uint256 depositAmount
    ) external nonReentrant globallyNonReentrant returns (uint256 mintAmount) {
        return _mintToken(receiver, depositAmount);
    }

    /**
     * @notice Burn loan token wrapper.
     * Adds a pay-out transfer after calling low level _burnToken function.
     * In order to withdraw funds to the pool, call burn on the respective
     * loan token contract. This will burn your loan tokens and send you the
     * underlying token in exchange.
     *
     * @param receiver The account getting the minted tokens.
     * @param burnAmount The amount of loan tokens to redeem.
     *
     * @return The GROSS amount of underlying tokens redeemed. When a ColFee
     *         exit-fee policy is active the receiver is paid this amount minus
     *         the fee (the split is published in `ExitFeeApplied`) — do not
     *         treat the return value as the amount received.
     * */
    function burn(
        address receiver,
        uint256 burnAmount
    ) external nonReentrant globallyNonReentrant returns (uint256 loanAmountPaid) {
        loanAmountPaid = _burnToken(burnAmount);

        // ColFee: charge the fee and pay the user the underlying ERC20.
        // "5" is the user-leg revert reason.
        _chargeExitFeeAndPay(receiver, loanAmountPaid, "5");
    }

    /**
     * @notice transfers the underlying asset from the msg.sender and mints tokens for the receiver
     * @param receiver the address of the iToken receiver
     * @param depositAmount the amount of underlying assets to be deposited
     * @return the amount of iTokens issued
     */
    function _mintToken(
        address receiver,
        uint256 depositAmount
    ) internal returns (uint256 mintAmount) {
        uint256 currentPrice;

        //calculate amount to mint and transfer the underlying asset
        (mintAmount, currentPrice) = _prepareMinting(depositAmount);

        //compute balances needed for checkpoint update, considering that the user might have a pool token balance
        //on the liquidity mining contract
        uint256 balanceOnLM = 0;
        if (liquidityMiningAddress != address(0))
            balanceOnLM = ILiquidityMining(liquidityMiningAddress).getUserPoolTokenBalance(
                address(this),
                receiver
            );
        uint256 oldBalance = balances[receiver].add(balanceOnLM);
        uint256 newBalance = oldBalance.add(mintAmount);

        //mint the tokens to the receiver
        _mint(receiver, mintAmount, depositAmount, currentPrice);

        //update the checkpoint of the receiver
        _updateCheckpoints(receiver, oldBalance, newBalance, currentPrice);
    }

    /**
     * calculates the amount of tokens to mint and transfers the underlying asset to this contract
     * @param depositAmount the amount of the underyling asset deposited
     * @return the amount to be minted
     */
    function _prepareMinting(
        uint256 depositAmount
    ) internal returns (uint256 mintAmount, uint256 currentPrice) {
        require(depositAmount != 0, "17");

        _settleInterest();

        currentPrice = _tokenPrice(_totalAssetSupply(0));
        mintAmount = depositAmount.mul(10 ** 18).div(currentPrice);

        if (msg.value == 0) {
            _safeTransferFrom(loanTokenAddress, msg.sender, address(this), depositAmount, "18");
        } else {
            IWrbtc(wrbtcTokenAddress).deposit.value(depositAmount)();
        }
    }

    /**
     * @notice A wrapper for AdvancedToken::_burn
     *
     * @param burnAmount The amount of loan tokens to redeem.
     *
     * @return The amount of underlying tokens payed to lender.
     * */
    function _burnToken(uint256 burnAmount) internal returns (uint256 loanAmountPaid) {
        require(burnAmount != 0, "19");

        if (burnAmount > balanceOf(msg.sender)) {
            require(burnAmount == uint256(-1), "32");
            burnAmount = balanceOf(msg.sender);
        }

        _settleInterest();

        uint256 currentPrice = _tokenPrice(_totalAssetSupply(0));

        uint256 loanAmountOwed = burnAmount.mul(currentPrice).div(10 ** 18);
        uint256 loanAmountAvailableInContract = _underlyingBalance();

        loanAmountPaid = loanAmountOwed;
        require(loanAmountPaid <= loanAmountAvailableInContract, "37");

        //compute balances needed for checkpoint update, considering that the user might have a pool token balance
        //on the liquidity mining contract
        uint256 balanceOnLM = 0;
        if (liquidityMiningAddress != address(0))
            balanceOnLM = ILiquidityMining(liquidityMiningAddress).getUserPoolTokenBalance(
                address(this),
                msg.sender
            );
        uint256 oldBalance = balances[msg.sender].add(balanceOnLM);
        uint256 newBalance = oldBalance.sub(burnAmount);

        _burn(msg.sender, burnAmount, loanAmountPaid, currentPrice);

        //this function does not only update the checkpoints but also the current profit of the user
        //all for external use only
        _updateCheckpoints(msg.sender, oldBalance, newBalance, currentPrice);
    }

    function _mintWithLM(
        address receiver,
        uint256 depositAmount
    ) internal returns (uint256 minted) {
        //mint the tokens for the receiver
        minted = _mintToken(receiver, depositAmount);

        //transfer the tokens from the receiver to the LM address
        _internalTransferFrom(receiver, liquidityMiningAddress, minted, minted);

        //inform the LM mining contract
        ILiquidityMining(liquidityMiningAddress).onTokensDeposited(receiver, minted);
    }

    function _burnFromLM(uint256 burnAmount) internal returns (uint256) {
        uint256 balanceOnLM = ILiquidityMining(liquidityMiningAddress).getUserPoolTokenBalance(
            address(this),
            msg.sender
        );
        require(balanceOnLM.add(balanceOf(msg.sender)) >= burnAmount, "not enough balance");

        if (balanceOnLM > 0) {
            //withdraw pool tokens and LM rewards to the passed address
            if (balanceOnLM < burnAmount) {
                ILiquidityMining(liquidityMiningAddress).withdraw(
                    address(this),
                    balanceOnLM,
                    msg.sender
                );
            } else {
                ILiquidityMining(liquidityMiningAddress).withdraw(
                    address(this),
                    burnAmount,
                    msg.sender
                );
            }
        }
        //burn the tokens of the msg.sender
        return _burnToken(burnAmount);
    }
}
