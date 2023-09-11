/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./LoanTokenLogicStorage.sol";
import "./interfaces/ProtocolLike.sol";
import "./interfaces/FeedsLike.sol";
import "./interfaces/ProtocolSettingsLike.sol";
import "../../modules/interfaces/ProtocolAffiliatesInterface.sol";
import "../../farm/ILiquidityMining.sol";
import "../../governance/Staking/interfaces/IStaking.sol";
import "../../governance/Vesting/IVesting.sol";

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
contract LoanTokenLogicSplit is LoanTokenLogicStorage {
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
     * @notice Transfer tokens wrapper.
     * Sets token owner the msg.sender.
     * Sets maximun allowance uint256(-1) to ensure tokens are always transferred.
     *
     * If the recipient (_to) is a vesting contract address, transfer the token to the tokenOwner of the vesting contract itself.
     *
     * @param _to The recipient of the tokens.
     * @param _value The amount of tokens sent.
     * @return Success true/false.
     * */
    function transfer(address _to, uint256 _value) external returns (bool) {
        /** need additional check  address(0) here to support backward compatibility
         * in case we don't want to activate this check, just need to set the stakingContractAddress to 0 address
         */
        if (
            stakingContractAddress != address(0) &&
            IStaking(stakingContractAddress).isVestingContract(_to)
        ) {
            (bool success, bytes memory data) =
                _to.staticcall(abi.encodeWithSelector(IVesting(_to).tokenOwner.selector));

            if (success) _to = abi.decode(data, (address));
        }

        return _internalTransferFrom(msg.sender, _to, _value, uint256(-1));
    }

    /**
     * @notice Moves `_value` loan tokens from `_from` to `_to` using the
     * allowance mechanism. Calls internal _internalTransferFrom function.
     *
     * @return A boolean value indicating whether the operation succeeded.
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool) {
        return
            _internalTransferFrom(
                _from,
                _to,
                _value,
                //allowed[_from][msg.sender]
                ProtocolLike(sovrynContractAddress).isLoanPool(msg.sender)
                    ? uint256(-1)
                    : allowed[_from][msg.sender]
            );
    }

    /**
     * @notice Update the user's checkpoint price and profit so far.
     * In this loan token contract, whenever some tokens are minted or burned,
     * the _updateCheckpoints() function is invoked to update the stats to
     * reflect the balance changes.
     *
     * @param _user The user address.
     * @param _oldBalance The user's previous balance.
     * @param _newBalance The user's updated balance.
     * @param _currentPrice The current loan token price.
     * */
    function _updateCheckpoints(
        address _user,
        uint256 _oldBalance,
        uint256 _newBalance,
        uint256 _currentPrice
    ) internal {
        /// @dev keccak256("iToken_ProfitSoFar")
        bytes32 slot = keccak256(abi.encodePacked(_user, iToken_ProfitSoFar));

        int256 _currentProfit;
        if (_newBalance == 0) {
            _currentPrice = 0;
        } else if (_oldBalance != 0) {
            _currentProfit = _profitOf(slot, _oldBalance, _currentPrice, checkpointPrices_[_user]);
        }

        assembly {
            sstore(slot, _currentProfit)
        }

        checkpointPrices_[_user] = _currentPrice;
    }

    /**
     * @notice Profit calculation based on checkpoints of price.
     * @param slot The user slot.
     * @param _balance The user balance.
     * @param _currentPrice The current price of the loan token.
     * @param _checkpointPrice The price of the loan token on checkpoint.
     * @return The profit of a user.
     * */
    function _profitOf(
        bytes32 slot,
        uint256 _balance,
        uint256 _currentPrice,
        uint256 _checkpointPrice
    ) internal view returns (int256 profitSoFar) {
        if (_checkpointPrice == 0) {
            return 0;
        }

        assembly {
            profitSoFar := sload(slot)
        }

        profitSoFar = int256(_currentPrice)
            .sub(int256(_checkpointPrice))
            .mul(int256(_balance))
            .div(sWEI_PRECISION)
            .add(profitSoFar);
    }

    /**
     * @notice Loan token price calculation considering unpaid interests.
     * @return The loan token price.
     * */
    function tokenPrice() public view returns (uint256 price) {
        uint256 interestUnPaid;
        if (lastSettleTime_ != uint88(block.timestamp)) {
            (, interestUnPaid) = _getAllInterest();
        }

        return _tokenPrice(_totalAssetSupply(interestUnPaid));
    }

    /**
     * @notice Get the total amount of loan tokens on debt.
     * Calls protocol getTotalPrincipal function.
     * In the context of borrowing, principal is the initial size of a loan.
     * It can also be the amount still owed on a loan. If you take out a
     * $50,000 mortgage, for example, the principal is $50,000. If you pay off
     * $30,000, the principal balance now consists of the remaining $20,000.
     *
     * @return The total amount of loan tokens on debt.
     * */
    function totalAssetBorrow() public view returns (uint256) {
        return
            ProtocolLike(sovrynContractAddress).getTotalPrincipal(address(this), loanTokenAddress);
    }

    /** INTERNAL FUNCTION */

    /**
     * @notice .
     *
     * @param collateralTokenAddress The address of the token to be used as
     *   collateral. Cannot be the loan token address.
     * @param sentAddresses The addresses to send tokens: lender, borrower,
     *   receiver and manager.
     * @param sentAmounts The amounts to send to each address.
     * @param withdrawalAmount The amount of tokens to withdraw.
     *
     * @return msgValue The amount of rBTC sent minus the collateral on tokens.
     * */
    function _verifyTransfers(
        address collateralTokenAddress,
        MarginTradeStructHelpers.SentAddresses memory sentAddresses,
        MarginTradeStructHelpers.SentAmounts memory sentAmounts,
        uint256 withdrawalAmount
    ) internal returns (uint256 msgValue) {
        address _wrbtcToken = wrbtcTokenAddress;
        address _loanTokenAddress = loanTokenAddress;
        uint256 newPrincipal = sentAmounts.newPrincipal;
        uint256 loanTokenSent = sentAmounts.loanTokenSent;
        uint256 collateralTokenSent = sentAmounts.collateralTokenSent;

        require(_loanTokenAddress != collateralTokenAddress, "26");

        msgValue = msg.value;

        if (withdrawalAmount != 0) {
            /// withdrawOnOpen == true
            _safeTransfer(_loanTokenAddress, sentAddresses.receiver, withdrawalAmount, "");
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
        /**
         * This is a critical piece of code!
         * rBTC are supposed to be held by the contract itself, while other tokens are being transfered from the sender directly.
         * */
        if (collateralTokenSent != 0) {
            if (
                collateralTokenAddress == _wrbtcToken &&
                msgValue != 0 &&
                msgValue >= collateralTokenSent
            ) {
                IWrbtc(_wrbtcToken).deposit.value(collateralTokenSent)();
                _safeTransfer(
                    collateralTokenAddress,
                    sovrynContractAddress,
                    collateralTokenSent,
                    "28-a"
                );
                msgValue -= collateralTokenSent;
            } else {
                _safeTransferFrom(
                    collateralTokenAddress,
                    msg.sender,
                    sovrynContractAddress,
                    collateralTokenSent,
                    "28-b"
                );
            }
        }

        if (loanTokenSent != 0) {
            _safeTransferFrom(
                _loanTokenAddress,
                msg.sender,
                sovrynContractAddress,
                loanTokenSent,
                "29"
            );
        }
    }

    /**
     * @notice Withdraw loan token interests from protocol.
     * This function only operates once per block.
     * It asks protocol to withdraw accrued interests for the loan token.
     *
     * @dev Internal sync required on every loan trade before starting.
     * */
    function _settleInterest() internal {
        uint88 ts = uint88(block.timestamp);
        if (lastSettleTime_ != ts) {
            ProtocolLike(sovrynContractAddress).withdrawAccruedInterest(loanTokenAddress);

            lastSettleTime_ = ts;
        }
    }

    /**
     * @notice Transfer tokens, low level.
     * Checks allowance, updates sender and recipient balances
     * and updates checkpoints too.
     *
     * @param _from The tokens' owner.
     * @param _to The recipient of the tokens.
     * @param _value The amount of tokens sent.
     * @param _allowanceAmount The amount of tokens allowed to transfer.
     *
     * @return Success true/false.
     * */
    function _internalTransferFrom(
        address _from,
        address _to,
        uint256 _value,
        uint256 _allowanceAmount
    ) internal returns (bool) {
        if (_allowanceAmount != uint256(-1)) {
            allowed[_from][msg.sender] = _allowanceAmount.sub(_value, "14");
            /// @dev Allowance mapping update requires an event log
            emit AllowanceUpdate(_from, msg.sender, _allowanceAmount, allowed[_from][msg.sender]);
        }

        require(_to != address(0), "15");

        uint256 _balancesFrom = balances[_from];
        uint256 _balancesFromNew = _balancesFrom.sub(_value, "16");
        balances[_from] = _balancesFromNew;

        uint256 _balancesTo = balances[_to];
        uint256 _balancesToNew = _balancesTo.add(_value);
        balances[_to] = _balancesToNew;

        /// @dev Handle checkpoint update.
        uint256 _currentPrice = tokenPrice();

        //checkpoints are not being used by the smart contract logic itself, but just for external use (query the profit)
        //only update the checkpoints of a user if he's not depositing to / withdrawing from the lending pool
        if (_from != liquidityMiningAddress && _to != liquidityMiningAddress) {
            _updateCheckpoints(_from, _balancesFrom, _balancesFromNew, _currentPrice);
            _updateCheckpoints(_to, _balancesTo, _balancesToNew, _currentPrice);
        }

        emit Transfer(_from, _to, _value);
        return true;
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

    /**
     * @notice Execute the ERC20 token's `transfer` function and reverts
     * upon failure the main purpose of this function is to prevent a non
     * standard ERC20 token from failing silently.
     *
     * @dev Wrappers around ERC20 operations that throw on failure (when the
     * token contract returns false). Tokens that return no value (and instead
     * revert or throw on failure) are also supported, non-reverting calls are
     * assumed to be successful.
     *
     * @param token The ERC20 token address.
     * @param to The target address.
     * @param amount The transfer amount.
     * @param errorMsg The error message on failure.
     */
    function _safeTransfer(
        address token,
        address to,
        uint256 amount,
        string memory errorMsg
    ) internal {
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(IERC20(token).transfer.selector, to, amount),
            errorMsg
        );
    }

    /**
     * @notice Execute the ERC20 token's `transferFrom` function and reverts
     * upon failure the main purpose of this function is to prevent a non
     * standard ERC20 token from failing silently.
     *
     * @dev Wrappers around ERC20 operations that throw on failure (when the
     * token contract returns false). Tokens that return no value (and instead
     * revert or throw on failure) are also supported, non-reverting calls are
     * assumed to be successful.
     *
     * @param token The ERC20 token address.
     * @param from The source address.
     * @param to The target address.
     * @param amount The transfer amount.
     * @param errorMsg The error message on failure.
     */
    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount,
        string memory errorMsg
    ) internal {
        _callOptionalReturn(
            token,
            abi.encodeWithSelector(IERC20(token).transferFrom.selector, from, to, amount),
            errorMsg
        );
    }

    /**
     * @notice Imitate a Solidity high-level call (i.e. a regular function
     * call to a contract), relaxing the requirement on the return value:
     * the return value is optional (but if data is returned, it must not be
     * false).
     *
     * @param token The token targeted by the call.
     * @param data The call data (encoded using abi.encode or one of its variants).
     * @param errorMsg The error message on failure.
     * */
    function _callOptionalReturn(
        address token,
        bytes memory data,
        string memory errorMsg
    ) internal {
        require(Address.isContract(token), "call to a non-contract address");
        (bool success, bytes memory returndata) = token.call(data);
        require(success, errorMsg);

        if (returndata.length != 0) {
            require(abi.decode(returndata, (bool)), errorMsg);
        }
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

    /** Internal view function */
    /**
     * @notice Compute the token price.
     * @param assetSupply The amount of loan tokens supplied.
     * @return The token price.
     * */
    function _tokenPrice(uint256 assetSupply) internal view returns (uint256) {
        uint256 totalTokenSupply = totalSupply_;

        return
            totalTokenSupply != 0 ? assetSupply.mul(10**18).div(totalTokenSupply) : initialPrice;
    }

    /**
     * @notice Get two kind of interests: owed per day and yet to be paid.
     * @return interestOwedPerDay The interest per day.
     * @return interestUnPaid The interest not yet paid.
     * */
    function _getAllInterest()
        internal
        view
        returns (uint256 interestOwedPerDay, uint256 interestUnPaid)
    {
        /// interestPaid, interestPaidDate, interestOwedPerDay, interestUnPaid, interestFeePercent, principalTotal
        uint256 interestFeePercent;
        (, , interestOwedPerDay, interestUnPaid, interestFeePercent, ) = ProtocolLike(
            sovrynContractAddress
        )
            .getLenderInterestData(address(this), loanTokenAddress);

        interestUnPaid = interestUnPaid.mul(SafeMath.sub(10**20, interestFeePercent)).div(10**20);
    }

    /**
     * @notice Compute the total amount of loan tokens on supply.
     * @param interestUnPaid The interest not yet paid.
     * @return assetSupply The total amount of loan tokens on supply.
     * */
    function _totalAssetSupply(uint256 interestUnPaid)
        internal
        view
        returns (uint256 assetSupply)
    {
        if (totalSupply_ != 0) {
            uint256 assetsBalance = _flTotalAssetSupply; /// Temporary locked totalAssetSupply during a flash loan transaction.
            if (assetsBalance == 0) {
                assetsBalance = _underlyingBalance().add(totalAssetBorrow());
            }

            return assetsBalance.add(interestUnPaid);
        }
    }

    /**
     * @notice Get the loan contract balance.
     * @return The balance of the loan token for this contract.
     * */
    function _underlyingBalance() internal view returns (uint256) {
        return IERC20(loanTokenAddress).balanceOf(address(this));
    }
}
