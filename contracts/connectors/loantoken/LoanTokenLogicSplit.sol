/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./LoanTokenLogicShared.sol";

/**
 * @title Loan Token Logic Standard contract.
 * @notice This contract code comes from bZx. bZx is a protocol for tokenized margin
 * trading and lending https://bzx.network similar to the dYdX protocol.
 *
 * Logic around loan tokens (iTokens) required to operate borrowing,
 * and margin trading financial processes.
 *
 * The user provides funds to the lending pool using the mint function and
 * withdraws funds from the lending pool using the burn function. Mint and
 * burn refer to minting and burning loan tokens. Loan tokens represent a
 * share of the pool and gather interest over time.
 *
 * Interest rates are determined by supply and demand. When a lender deposits
 * funds, the interest rates go down. When a trader borrows funds, the
 * interest rates go up. Fulcrum uses a simple linear interest rate formula
 * of the form y = mx + b. The interest rate starts at 1% when loans aren't
 * being utilized and scales up to 40% when all the funds in the loan pool
 * are being borrowed.
 *
 * The borrow rate is determined at the time of the loan and represents the
 * net contribution of each borrower. Each borrower's interest contribution
 * is determined by the utilization rate of the pool and is netted against
 * all prior borrows. This means that the total amount of interest flowing
 * into the lending pool is not directly changed by lenders entering or
 * exiting the pool. The entrance or exit of lenders only impacts how the
 * interest payments are split up.
 *
 * For example, if there are 2 lenders with equal holdings each earning
 * 5% APR, but one of the lenders leave, then the remaining lender will earn
 * 10% APR since the interest payments don't have to be split between two
 * individuals.
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
    function mint(address receiver, uint256 depositAmount)
        external
        nonReentrant
        globallyNonReentrant
        returns (uint256 mintAmount)
    {
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
     * @return The amount of underlying tokens payed to lender.
     * */
    function burn(address receiver, uint256 burnAmount)
        external
        nonReentrant
        globallyNonReentrant
        returns (uint256 loanAmountPaid)
    {
        loanAmountPaid = _burnToken(burnAmount);

        //this needs to be here and not in _burnTokens because of the WRBTC implementation
        if (loanAmountPaid != 0) {
            _safeTransfer(loanTokenAddress, receiver, loanAmountPaid, "5");
        }
    }

    /**
     * @notice transfers the underlying asset from the msg.sender and mints tokens for the receiver
     * @param receiver the address of the iToken receiver
     * @param depositAmount the amount of underlying assets to be deposited
     * @return the amount of iTokens issued
     */
    function _mintToken(address receiver, uint256 depositAmount)
        internal
        returns (uint256 mintAmount)
    {
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
    function _prepareMinting(uint256 depositAmount)
        internal
        returns (uint256 mintAmount, uint256 currentPrice)
    {
        require(depositAmount != 0, "17");

        _settleInterest();

        currentPrice = _tokenPrice(_totalAssetSupply(0));
        mintAmount = depositAmount.mul(10**18).div(currentPrice);

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

        uint256 loanAmountOwed = burnAmount.mul(currentPrice).div(10**18);
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

    function _mintWithLM(address receiver, uint256 depositAmount)
        internal
        returns (uint256 minted)
    {
        //mint the tokens for the receiver
        minted = _mintToken(receiver, depositAmount);

        //transfer the tokens from the receiver to the LM address
        _internalTransferFrom(receiver, liquidityMiningAddress, minted, minted);

        //inform the LM mining contract
        ILiquidityMining(liquidityMiningAddress).onTokensDeposited(receiver, minted);
    }

    function _burnFromLM(uint256 burnAmount) internal returns (uint256) {
        uint256 balanceOnLM =
            ILiquidityMining(liquidityMiningAddress).getUserPoolTokenBalance(
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
