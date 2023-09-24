/**
 * Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0.
 */

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "./LoanTokenLogicShared.sol";

contract LoanTokenLogicStandard is LoanTokenLogicShared {
    /**
     * @notice Borrow funds from the pool.
     * The underlying loan token may not be used as collateral.
     *
     * @param loanId The ID of the loan, 0 for a new loan.
     * @param withdrawAmount The amount to be withdrawn (actually borrowed).
     * @param initialLoanDuration The duration of the loan in seconds.
     *   If the loan is not paid back until then, it'll need to be rolled over.
     * @param collateralTokenSent The amount of collateral tokens provided by the user.
     *   (150% of the withdrawn amount worth in collateral tokens).
     * @param collateralTokenAddress The address of the token to be used as
     *   collateral. Cannot be the loan token address.
     * @param borrower The one paying for the collateral.
     * @param receiver The one receiving the withdrawn amount.
     *
     * @return New principal and new collateral added to loan.
     * */
    function borrow(
        bytes32 loanId, /// 0 if new loan.
        uint256 withdrawAmount,
        uint256 initialLoanDuration, /// Duration in seconds.
        uint256 collateralTokenSent, /// If 0, loanId must be provided; any rBTC sent must equal this value.
        address collateralTokenAddress, /// If address(0), this means rBTC and rBTC must be sent with the call or loanId must be provided.
        address borrower,
        address receiver,
        bytes memory /// loanDataBytes: arbitrary order data (for future use).
    )
        public
        payable
        nonReentrant /// Note: needs to be removed to allow flashloan use cases.
        globallyNonReentrant
        returns (
            uint256,
            uint256 /// Returns new principal and new collateral added to loan.
        )
    {
        require(withdrawAmount != 0, "6");

        _checkPause();

        /// Temporary: limit transaction size.
        if (transactionLimit[collateralTokenAddress] > 0)
            require(collateralTokenSent <= transactionLimit[collateralTokenAddress]);

        require(
            (msg.value == 0 || msg.value == collateralTokenSent) &&
                (collateralTokenSent != 0 || loanId != 0) &&
                (collateralTokenAddress != address(0) || msg.value != 0 || loanId != 0) &&
                (loanId == 0 || msg.sender == borrower),
            "7"
        );

        /// @dev We have an issue regarding contract size code is too big. 1 of the solution is need to keep the error message 32 bytes length
        // Temporarily, we combine this require to the above, so can save the contract size code
        // require(collateralTokenSent != 0 || loanId != 0, "8");
        // require(collateralTokenAddress != address(0) || msg.value != 0 || loanId != 0, "9");

        /// @dev Ensure authorized use of existing loan.
        // require(loanId == 0 || msg.sender == borrower, "401 use of existing loan");

        /// @dev The condition is never met.
        ///   Address zero is not allowed by previous require validation.
        ///   This check is unneeded and was lowering the test coverage index.
        // if (collateralTokenAddress == address(0)) {
        // 	collateralTokenAddress = wrbtcTokenAddress;
        // }

        require(collateralTokenAddress != loanTokenAddress, "10");

        _settleInterest();

        MarginTradeStructHelpers.SentAddresses memory sentAddresses;
        MarginTradeStructHelpers.SentAmounts memory sentAmounts;

        sentAddresses.lender = address(this); /// The lender.
        sentAddresses.borrower = borrower;
        sentAddresses.receiver = receiver;
        /// sentAddresses.manager = address(0); /// The manager.

        sentAmounts.newPrincipal = withdrawAmount;

        /// interestRate, interestInitialAmount, borrowAmount (newBorrowAmount).
        (
            sentAmounts.interestRate,
            sentAmounts.interestInitialAmount,
            sentAmounts.newPrincipal
        ) = _getInterestRateAndBorrowAmount(
            sentAmounts.newPrincipal,
            _totalAssetSupply(0), /// Interest is settled above.
            initialLoanDuration
        );

        /// sentAmounts.loanTokenSent = 0; /// loanTokenSent
        sentAmounts.collateralTokenSent = collateralTokenSent;

        return
            _borrowOrTrade(
                loanId,
                withdrawAmount,
                ProtocolSettingsLike(sovrynContractAddress).minInitialMargin(
                    loanParamsIds[
                        uint256(keccak256(abi.encodePacked(collateralTokenAddress, true)))
                    ]
                ),
                collateralTokenAddress,
                sentAddresses,
                sentAmounts,
                "" /// loanDataBytes
            );
    }

    /**
     * @notice Borrow and immediately get into a position.
     *
     * Trading on margin is used to increase an investor's buying power.
     * Margin is the amount of money required to open a position, while
     * leverage is the multiple of exposure to account equity.
     *
     * Leverage allows you to trade positions LARGER than the amount
     * of money in your trading account. Leverage is expressed as a ratio.
     *
     * When trading on margin, investors first deposit some token that then
     * serves as collateral for the loan, and then pay ongoing interest
     * payments on the money they borrow.
     *
     * Margin trading = taking a loan and swapping it:
     * In order to open a margin trade position,
     *  1.- The user calls marginTrade on the loan token contract.
     *  2.- The loan token contract provides the loan and sends it for processing
     *    to the protocol proxy contract.
     *  3.- The protocol proxy contract uses the module LoanOpening to create a
     *    position and swaps the loan tokens to collateral tokens.
     *  4.- The Sovryn Swap network looks up the correct converter and swaps the
     *    tokens.
     * If successful, the position is being held by the protocol proxy contract,
     * which is why positions need to be closed at the protocol proxy contract.
     *
     * @param loanId The ID of the loan, 0 for a new loan.
     * @param leverageAmount The multiple of exposure: 2x ... 5x. The leverage with 18 decimals.
     * @param loanTokenSent The number of loan tokens provided by the user.
     * @param collateralTokenSent The amount of collateral tokens provided by the user.
     * @param collateralTokenAddress The token address of collateral.
     * @param trader The account that performs this trade.
     * @param minEntryPrice Value of loan token in collateral.
     * @param loanDataBytes Additional loan data (not in use for token swaps).
     *
     * @return New principal and new collateral added to trade.
     * */
    function marginTrade(
        bytes32 loanId, /// 0 if new loan
        uint256 leverageAmount, /// Expected in x * 10**18 where x is the actual leverage (2, 3, 4, or 5).
        uint256 loanTokenSent,
        uint256 collateralTokenSent,
        address collateralTokenAddress,
        address trader,
        uint256 minEntryPrice, // value of loan token in collateral
        bytes memory loanDataBytes /// Arbitrary order data.
    )
        public
        payable
        nonReentrant /// Note: needs to be removed to allow flashloan use cases.
        globallyNonReentrant
        returns (
            uint256,
            uint256 /// Returns new principal and new collateral added to trade.
        )
    {
        _checkPause();

        if (collateralTokenAddress == address(0)) {
            collateralTokenAddress = wrbtcTokenAddress;
        }

        require(collateralTokenAddress != loanTokenAddress, "11");

        /// @dev Ensure authorized use of existing loan.
        require(loanId == 0 || msg.sender == trader, "401 use of existing loan");

        /// Temporary: limit transaction size.
        if (transactionLimit[collateralTokenAddress] > 0)
            require(collateralTokenSent <= transactionLimit[collateralTokenAddress]);
        if (transactionLimit[loanTokenAddress] > 0)
            require(loanTokenSent <= transactionLimit[loanTokenAddress]);

        /// @dev Compute the worth of the total deposit in loan tokens.
        /// (loanTokenSent + convert(collateralTokenSent))
        /// No actual swap happening here.
        uint256 totalDeposit =
            _totalDeposit(collateralTokenAddress, collateralTokenSent, loanTokenSent);
        require(totalDeposit != 0, "12");

        MarginTradeStructHelpers.SentAddresses memory sentAddresses;
        MarginTradeStructHelpers.SentAmounts memory sentAmounts;

        sentAddresses.lender = address(this);
        sentAddresses.borrower = trader;
        sentAddresses.receiver = trader;
        /// sentAddresses.manager = address(0); /// The manager.

        /// sentAmounts.interestRate = 0; /// interestRate (found later).
        sentAmounts.newPrincipal = totalDeposit;
        /// sentAmounts.interestInitialAmount = 0; /// interestInitialAmount (interest is calculated based on fixed-term loan).
        sentAmounts.loanTokenSent = loanTokenSent;
        sentAmounts.collateralTokenSent = collateralTokenSent;

        _settleInterest();

        (sentAmounts.newPrincipal, sentAmounts.interestRate) = _getMarginBorrowAmountAndRate( /// borrowAmount, interestRate
            leverageAmount,
            sentAmounts.newPrincipal /// depositAmount
        );

        require(
            _getAmountInRbtc(loanTokenAddress, sentAmounts.newPrincipal) > TINY_AMOUNT,
            "principal too small"
        );

        /// @dev Converting to initialMargin
        leverageAmount = SafeMath.div(10**38, leverageAmount);
        sentAmounts.minEntryPrice = minEntryPrice;
        return
            _borrowOrTrade(
                loanId,
                0, /// withdrawAmount
                leverageAmount, //initial margin
                collateralTokenAddress,
                sentAddresses,
                sentAmounts,
                loanDataBytes
            );
    }

    /**
     * @notice Wrapper for marginTrade invoking setAffiliatesReferrer to track
     *   referral trade by affiliates program.
     *
     * @param loanId The ID of the loan, 0 for a new loan.
     * @param leverageAmount The multiple of exposure: 2x ... 5x. The leverage with 18 decimals.
     * @param loanTokenSent The number of loan tokens provided by the user.
     * @param collateralTokenSent The amount of collateral tokens provided by the user.
     * @param collateralTokenAddress The token address of collateral.
     * @param trader The account that performs this trade.
     * @param minEntryPrice Value of loan token in collateral.
     * @param affiliateReferrer The address of the referrer from affiliates program.
     * @param loanDataBytes Additional loan data (not in use for token swaps).
     *
     * @return New principal and new collateral added to trade.
     */
    function marginTradeAffiliate(
        bytes32 loanId, // 0 if new loan
        uint256 leverageAmount, // expected in x * 10**18 where x is the actual leverage (2, 3, 4, or 5)
        uint256 loanTokenSent,
        uint256 collateralTokenSent,
        address collateralTokenAddress,
        address trader,
        uint256 minEntryPrice, /// Value of loan token in collateral
        address affiliateReferrer, /// The user was brought by the affiliate (referrer).
        bytes calldata loanDataBytes /// Arbitrary order data.
    )
        external
        payable
        returns (
            uint256,
            uint256 /// Returns new principal and new collateral added to trade.
        )
    {
        if (affiliateReferrer != address(0))
            ProtocolAffiliatesInterface(sovrynContractAddress).setAffiliatesReferrer(
                trader,
                affiliateReferrer
            );
        return
            marginTrade(
                loanId,
                leverageAmount,
                loanTokenSent,
                collateralTokenSent,
                collateralTokenAddress,
                trader,
                minEntryPrice,
                loanDataBytes
            );
    }

    /* Public View functions */

    /**
     * @notice Wrapper for internal _profitOf low level function.
     * @param user The user address.
     * @return The profit of a user.
     * */
    function profitOf(address user) external view returns (int256) {
        /// @dev keccak256("iToken_ProfitSoFar")
        bytes32 slot = keccak256(abi.encodePacked(user, iToken_ProfitSoFar));
        //TODO + LM balance
        return _profitOf(slot, balances[user], tokenPrice(), checkpointPrices_[user]);
    }

    /**
     * @notice Getter for the price checkpoint mapping.
     * @param _user The user account as the mapping index.
     * @return The price on the checkpoint for this user.
     * */
    function checkpointPrice(address _user) public view returns (uint256 price) {
        return checkpointPrices_[_user];
    }

    /**
     * @notice Get current liquidity.
     * A part of total funds supplied are borrowed. Liquidity = supply - borrow
     * @return The market liquidity.
     * */
    function marketLiquidity() public view returns (uint256) {
        uint256 totalSupply = _totalAssetSupply(0);
        uint256 totalBorrow = totalAssetBorrow();
        if (totalSupply > totalBorrow) {
            return totalSupply - totalBorrow;
        }
    }

    /**
     * @notice Wrapper for average borrow interest.
     * @return The average borrow interest.
     * */
    function avgBorrowInterestRate() public view returns (uint256) {
        return _avgBorrowInterestRate(totalAssetBorrow());
    }

    /**
     * @notice Get borrow interest rate.
     * The minimum rate the next base protocol borrower will receive
     * for variable-rate loans.
     * @return The borrow interest rate.
     * */
    function borrowInterestRate() public view returns (uint256) {
        return _nextBorrowInterestRate(0);
    }

    /**
     * @notice Public wrapper for internal call.
     * @param borrowAmount The amount of tokens to borrow.
     * @return The next borrow interest rate.
     * */
    function nextBorrowInterestRate(uint256 borrowAmount) public view returns (uint256) {
        return _nextBorrowInterestRate(borrowAmount);
    }

    /**
     * @notice Get interest rate.
     *
     * @return Interest that lenders are currently receiving when supplying to
     * the pool.
     * */
    function supplyInterestRate() public view returns (uint256) {
        return totalSupplyInterestRate(_totalAssetSupply(0));
    }

    /**
     * @notice Get interest rate w/ added supply.
     * @param supplyAmount The amount of tokens supplied.
     * @return Interest that lenders are currently receiving when supplying
     * a given amount of tokens to the pool.
     * */
    function nextSupplyInterestRate(uint256 supplyAmount) public view returns (uint256) {
        return totalSupplyInterestRate(_totalAssetSupply(0).add(supplyAmount));
    }

    /**
     * @notice Get interest rate w/ added supply assets.
     * @param assetSupply The amount of loan tokens supplied.
     * @return Interest that lenders are currently receiving when supplying
     * a given amount of loan tokens to the pool.
     * */
    function totalSupplyInterestRate(uint256 assetSupply) public view returns (uint256) {
        uint256 assetBorrow = totalAssetBorrow();
        if (assetBorrow != 0) {
            return calculateSupplyInterestRate(assetBorrow, assetSupply);
        }
    }

    /**
     * @notice Get the total amount of loan tokens on supply.
     * @dev Wrapper for internal _totalAssetSupply function.
     * @return The total amount of loan tokens on supply.
     * */
    function totalAssetSupply() public view returns (uint256) {
        uint256 interestUnPaid;
        if (lastSettleTime_ != uint88(block.timestamp)) {
            (, interestUnPaid) = _getAllInterest();
        }

        return _totalAssetSupply(interestUnPaid);
    }

    /**
     * @notice Compute the maximum deposit amount under current market conditions.
     * @dev maxEscrowAmount = liquidity * (100 - interestForDuration) / 100
     * @param leverageAmount The chosen multiplier with 18 decimals.
     * */
    function getMaxEscrowAmount(uint256 leverageAmount)
        public
        view
        returns (uint256 maxEscrowAmount)
    {
        /**
         * @dev Mathematical imperfection: depending on liquidity we might be able
         * to borrow more if utilization is below the kink level.
         * */
        uint256 interestForDuration = maxScaleRate.mul(28).div(365);
        uint256 factor = uint256(10**20).sub(interestForDuration);
        uint256 maxLoanSize = marketLiquidity().mul(factor).div(10**20);
        maxEscrowAmount = maxLoanSize.mul(10**18).div(leverageAmount);
    }

    /**
     * @notice Get loan token balance.
     * @return The user's balance of underlying token.
     * */
    function assetBalanceOf(address _owner) public view returns (uint256) {
        uint256 balanceOnLM = 0;
        if (liquidityMiningAddress != address(0)) {
            balanceOnLM = ILiquidityMining(liquidityMiningAddress).getUserPoolTokenBalance(
                address(this),
                _owner
            );
        }
        return balanceOf(_owner).add(balanceOnLM).mul(tokenPrice()).div(10**18);
    }

    /**
     * @notice Get margin information on a trade.
     *
     * @param leverageAmount The multiple of exposure: 2x ... 5x. The leverage with 18 decimals.
     * @param loanTokenSent The number of loan tokens provided by the user.
     * @param collateralTokenSent The amount of collateral tokens provided by the user.
     * @param collateralTokenAddress The token address of collateral.
     *
     * @return The principal, the collateral and the interestRate.
     * */
    function getEstimatedMarginDetails(
        uint256 leverageAmount,
        uint256 loanTokenSent,
        uint256 collateralTokenSent,
        address collateralTokenAddress // address(0) means ETH
    )
        public
        view
        returns (
            uint256 principal,
            uint256 collateral,
            uint256 interestRate
        )
    {
        if (collateralTokenAddress == address(0)) {
            collateralTokenAddress = wrbtcTokenAddress;
        }

        uint256 totalDeposit =
            _totalDeposit(collateralTokenAddress, collateralTokenSent, loanTokenSent);

        (principal, interestRate) = _getMarginBorrowAmountAndRate(leverageAmount, totalDeposit);
        if (principal > _underlyingBalance()) {
            return (0, 0, 0);
        }

        loanTokenSent = loanTokenSent.add(principal);

        collateral = ProtocolLike(sovrynContractAddress).getEstimatedMarginExposure(
            loanTokenAddress,
            collateralTokenAddress,
            loanTokenSent,
            collateralTokenSent,
            interestRate,
            principal
        );
    }

    /**
     * @notice Calculate the deposit required to a given borrow.
     *
     * The function for doing over-collateralized borrows against loan tokens
     * expects a minimum amount of collateral be sent to satisfy collateral
     * requirements of the loan, for borrow amount, interest rate, and
     * initial loan duration. To determine appropriate values to pass to this
     * function for a given loan, `getDepositAmountForBorrow` and
     * 'getBorrowAmountForDeposit` are required.
     *
     * @param borrowAmount The amount of borrow.
     * @param initialLoanDuration The duration of the loan.
     * @param collateralTokenAddress The token address of collateral.
     *
     * @return The amount of deposit required.
     * */
    function getDepositAmountForBorrow(
        uint256 borrowAmount,
        uint256 initialLoanDuration, /// Duration in seconds.
        address collateralTokenAddress /// address(0) means rBTC
    ) public view returns (uint256 depositAmount) {
        if (borrowAmount != 0) {
            (, , uint256 newBorrowAmount) =
                _getInterestRateAndBorrowAmount(
                    borrowAmount,
                    totalAssetSupply(),
                    initialLoanDuration
                );

            if (newBorrowAmount <= _underlyingBalance()) {
                if (collateralTokenAddress == address(0))
                    collateralTokenAddress = wrbtcTokenAddress;
                bytes32 loanParamsId =
                    loanParamsIds[
                        uint256(keccak256(abi.encodePacked(collateralTokenAddress, true)))
                    ];
                return
                    ProtocolLike(sovrynContractAddress)
                        .getRequiredCollateral(
                        loanTokenAddress,
                        collateralTokenAddress,
                        newBorrowAmount,
                        ProtocolSettingsLike(sovrynContractAddress).minInitialMargin(loanParamsId), /// initialMargin
                        true /// isTorqueLoan
                    )
                        .add(10); /// Some dust to compensate for rounding errors.
            }
        }
    }

    /**
     * @notice Calculate the borrow allowed for a given deposit.
     *
     * The function for doing over-collateralized borrows against loan tokens
     * expects a minimum amount of collateral be sent to satisfy collateral
     * requirements of the loan, for borrow amount, interest rate, and
     * initial loan duration. To determine appropriate values to pass to this
     * function for a given loan, `getDepositAmountForBorrow` and
     * 'getBorrowAmountForDeposit` are required.
     *
     * @param depositAmount The amount of deposit.
     * @param initialLoanDuration The duration of the loan.
     * @param collateralTokenAddress The token address of collateral.
     *
     * @return The amount of borrow allowed.
     * */
    function getBorrowAmountForDeposit(
        uint256 depositAmount,
        uint256 initialLoanDuration, /// Duration in seconds.
        address collateralTokenAddress /// address(0) means rBTC
    ) public view returns (uint256 borrowAmount) {
        if (depositAmount != 0) {
            if (collateralTokenAddress == address(0)) collateralTokenAddress = wrbtcTokenAddress;
            bytes32 loanParamsId =
                loanParamsIds[uint256(keccak256(abi.encodePacked(collateralTokenAddress, true)))];
            borrowAmount = ProtocolLike(sovrynContractAddress).getBorrowAmount(
                loanTokenAddress,
                collateralTokenAddress,
                depositAmount,
                ProtocolSettingsLike(sovrynContractAddress).minInitialMargin(loanParamsId), /// initialMargin,
                true /// isTorqueLoan
            );

            (, , borrowAmount) = _getInterestRateAndBorrowAmount(
                borrowAmount,
                totalAssetSupply(),
                initialLoanDuration
            );

            if (borrowAmount > _underlyingBalance()) {
                borrowAmount = 0;
            }
        }
    }

    /**
     * @notice Check if entry price lies above a minimum
     *
     * @param loanTokenSent The amount of deposit.
     * @param collateralTokenAddress The token address of collateral.
     * @param minEntryPrice Value of loan token in collateral
     * */
    function checkPriceDivergence(
        uint256 loanTokenSent,
        address collateralTokenAddress,
        uint256 minEntryPrice
    ) public view {
        /// @dev See how many collateralTokens we would get if exchanging this amount of loan tokens to collateral tokens.
        uint256 collateralTokensReceived =
            ProtocolLike(sovrynContractAddress).getSwapExpectedReturn(
                loanTokenAddress,
                collateralTokenAddress,
                loanTokenSent
            );
        uint256 collateralTokenPrice =
            (collateralTokensReceived.mul(WEI_PRECISION)).div(loanTokenSent);
        require(collateralTokenPrice >= minEntryPrice, "entry price above the minimum");
    }

    /**
     * @notice Compute the next supply interest adjustment.
     * @param assetBorrow The amount of loan tokens on debt.
     * @param assetSupply The amount of loan tokens supplied.
     * @return The next supply interest adjustment.
     * */
    function calculateSupplyInterestRate(uint256 assetBorrow, uint256 assetSupply)
        public
        view
        returns (uint256)
    {
        if (assetBorrow != 0 && assetSupply >= assetBorrow) {
            return
                _avgBorrowInterestRate(assetBorrow)
                    .mul(_utilizationRate(assetBorrow, assetSupply))
                    .mul(
                    SafeMath.sub(10**20, ProtocolLike(sovrynContractAddress).lendingFeePercent())
                )
                    .div(10**40);
        }
    }

    /* Internal functions */

    /**
     * @notice Compute what the deposit is worth in loan tokens using the swap rate
     *      used for loan size computation.
     *
     * @param collateralTokenAddress The token address of the collateral.
     * @param collateralTokenSent The amount of collateral tokens provided by the user.
     * @param loanTokenSent The number of loan tokens provided by the user.
     *
     * @return The value of the deposit in loan tokens.
     * */
    function _totalDeposit(
        address collateralTokenAddress,
        uint256 collateralTokenSent,
        uint256 loanTokenSent
    ) internal view returns (uint256 totalDeposit) {
        totalDeposit = loanTokenSent;

        if (collateralTokenSent != 0) {
            /// @dev Get the oracle rate from collateral -> loan
            (uint256 collateralToLoanRate, uint256 collateralToLoanPrecision) =
                FeedsLike(ProtocolLike(sovrynContractAddress).priceFeeds()).queryRate(
                    collateralTokenAddress,
                    loanTokenAddress
                );
            require(
                (collateralToLoanRate != 0) && (collateralToLoanPrecision != 0),
                "invalid rate collateral token"
            );

            /// @dev Compute the loan token amount with the oracle rate.
            uint256 loanTokenAmount =
                collateralTokenSent.mul(collateralToLoanRate).div(collateralToLoanPrecision);

            /// @dev See how many collateralTokens we would get if exchanging this amount of loan tokens to collateral tokens.
            uint256 collateralTokenAmount =
                ProtocolLike(sovrynContractAddress).getSwapExpectedReturn(
                    loanTokenAddress,
                    collateralTokenAddress,
                    loanTokenAmount
                );

            /// @dev Probably not the same due to the price difference.
            if (collateralTokenAmount != collateralTokenSent) {
                //scale the loan token amount accordingly, so we'll get the expected position size in the end
                loanTokenAmount = loanTokenAmount.mul(collateralTokenAmount).div(
                    collateralTokenSent
                );
            }

            totalDeposit = loanTokenAmount.add(totalDeposit);
        }
    }

    /**
     * @dev returns amount of the asset converted to RBTC
     * @param asset the asset to be transferred
     * @param amount the amount to be transferred
     * @return amount in RBTC
     * */
    function _getAmountInRbtc(address asset, uint256 amount) internal returns (uint256) {
        (uint256 rbtcRate, uint256 rbtcPrecision) =
            FeedsLike(ProtocolLike(sovrynContractAddress).priceFeeds()).queryRate(
                asset,
                wrbtcTokenAddress
            );
        return amount.mul(rbtcRate).div(rbtcPrecision);
    }

    /*
     * @notice Compute interest rate and other loan parameters.
     *
     * @param borrowAmount The amount of tokens to borrow.
     * @param assetSupply The amount of loan tokens supplied.
     * @param initialLoanDuration The duration of the loan in seconds.
     *   If the loan is not paid back until then, it'll need to be rolled over.
     *
     * @return The interest rate, the interest calculated based on fixed-term
     *   loan, and the new borrow amount.
     * */
    function _getInterestRateAndBorrowAmount(
        uint256 borrowAmount,
        uint256 assetSupply,
        uint256 initialLoanDuration /// Duration in seconds.
    )
        internal
        view
        returns (
            uint256 interestRate,
            uint256 interestInitialAmount,
            uint256 newBorrowAmount
        )
    {
        interestRate = _nextBorrowInterestRate2(borrowAmount, assetSupply);

        /// newBorrowAmount = borrowAmount * 10^18 / (10^18 - interestRate * 7884000 * 10^18 / 31536000 / 10^20)
        newBorrowAmount = borrowAmount.mul(10**18).div(
            SafeMath.sub(
                10**18,
                interestRate.mul(initialLoanDuration).mul(10**18).div(31536000 * 10**20) /// 365 * 86400 * 10**20
            )
        );

        interestInitialAmount = newBorrowAmount.sub(borrowAmount);
    }

    /**
     * @notice Compute principal and collateral.
     *
     * @param loanId The ID of the loan, 0 for a new loan.
     * @param withdrawAmount The amount to be withdrawn (actually borrowed).
     * @param initialMargin The initial margin with 18 decimals
     * @param collateralTokenAddress  The address of the token to be used as
     *   collateral. Cannot be the loan token address.
     * @param sentAddresses The addresses to send tokens: lender, borrower,
     *   receiver and manager.
     * @param sentAmounts The amounts to send to each address.
     * @param loanDataBytes Additional loan data (not in use for token swaps).
     *
     * @return The new principal and the new collateral. Principal is the
     *   complete borrowed amount (in loan tokens). Collateral is the complete
     *   position size (loan + margin) (in collateral tokens).
     * */
    function _borrowOrTrade(
        bytes32 loanId,
        uint256 withdrawAmount,
        uint256 initialMargin,
        address collateralTokenAddress,
        MarginTradeStructHelpers.SentAddresses memory sentAddresses,
        MarginTradeStructHelpers.SentAmounts memory sentAmounts,
        bytes memory loanDataBytes
    ) internal returns (uint256, uint256) {
        _checkPause();
        require(
            sentAmounts.newPrincipal <= _underlyingBalance() && /// newPrincipal (borrowed amount + fees)
                sentAddresses.borrower != address(0), /// The borrower.
            "24"
        );

        if (sentAddresses.receiver == address(0)) {
            sentAddresses.receiver = sentAddresses.borrower; /// The receiver = the borrower.
        }

        /// @dev Handle transfers prior to adding newPrincipal to loanTokenSent
        uint256 msgValue =
            _verifyTransfers(collateralTokenAddress, sentAddresses, sentAmounts, withdrawAmount);

        /**
         * @dev Adding the loan token portion from the lender to loanTokenSent
         * (add the loan to the loan tokens sent from the user).
         * */
        sentAmounts.loanTokenSent = sentAmounts.loanTokenSent.add(sentAmounts.newPrincipal); /// newPrincipal

        if (withdrawAmount != 0) {
            /// @dev withdrawAmount already sent to the borrower, so we aren't sending it to the protocol.
            sentAmounts.loanTokenSent = sentAmounts.loanTokenSent.sub(withdrawAmount);
        }

        bool withdrawAmountExist = false; /// Default is false, but added just as to make sure.

        if (withdrawAmount != 0) {
            withdrawAmountExist = true;
        }

        bytes32 loanParamsId =
            loanParamsIds[
                uint256(keccak256(abi.encodePacked(collateralTokenAddress, withdrawAmountExist)))
            ];

        (sentAmounts.newPrincipal, sentAmounts.collateralTokenSent) = ProtocolLike(
            sovrynContractAddress
        )
            .borrowOrTradeFromPool
            .value(msgValue)(
            loanParamsId,
            loanId,
            withdrawAmountExist,
            initialMargin,
            sentAddresses,
            sentAmounts,
            loanDataBytes
        ); /// newPrincipal, newCollateral
        require(sentAmounts.newPrincipal != 0, "25");

        /// @dev Setting not-first-trade flag to prevent binding to an affiliate existing users post factum.
        /// @dev REFACTOR: move to a general interface: ProtocolSettingsLike?
        ProtocolAffiliatesInterface(sovrynContractAddress).setUserNotFirstTradeFlag(
            sentAddresses.borrower
        );

        return (sentAmounts.newPrincipal, sentAmounts.collateralTokenSent); // newPrincipal, newCollateral
    }

    /* Internal View functions */

    /**
     * @notice Compute the average borrow interest rate.
     * @param assetBorrow The amount of loan tokens on debt.
     * @return The average borrow interest rate.
     * */
    function _avgBorrowInterestRate(uint256 assetBorrow) internal view returns (uint256) {
        if (assetBorrow != 0) {
            (uint256 interestOwedPerDay, ) = _getAllInterest();
            return interestOwedPerDay.mul(10**20).mul(365).div(assetBorrow);
        }
    }

    /**
     * @notice Compute the next borrow interest adjustment.
     * @param borrowAmount The amount of tokens to borrow.
     * @return The next borrow interest adjustment.
     * */
    function _nextBorrowInterestRate(uint256 borrowAmount) internal view returns (uint256) {
        uint256 interestUnPaid;
        if (borrowAmount != 0) {
            if (lastSettleTime_ != uint88(block.timestamp)) {
                (, interestUnPaid) = _getAllInterest();
            }

            uint256 balance = _underlyingBalance().add(interestUnPaid);
            if (borrowAmount > balance) {
                borrowAmount = balance;
            }
        }

        return _nextBorrowInterestRate2(borrowAmount, _totalAssetSupply(interestUnPaid));
    }

    /**
     * @notice Compute the next borrow interest adjustment under target-kink
     * level analysis.
     *
     * The "kink" in the cDAI interest rate model reflects the utilization rate
     * at which the slope of the interest rate goes from "gradual" to "steep".
     * That is, below this utilization rate, the slope of the interest rate
     * curve is gradual. Above this utilization rate, it is steep.
     *
     * Because of this dynamic between the interest rate curves before and
     * after the "kink", the "kink" can be thought of as the target utilization
     * rate. Above that rate, it quickly becomes expensive to borrow (and
     * commensurately lucrative for suppliers).
     *
     * @param newBorrowAmount The new amount of tokens to borrow.
     * @param assetSupply The amount of loan tokens supplied.
     * @return The next borrow interest adjustment.
     * */
    function _nextBorrowInterestRate2(uint256 newBorrowAmount, uint256 assetSupply)
        internal
        view
        returns (uint256 nextRate)
    {
        uint256 utilRate = _utilizationRate(totalAssetBorrow().add(newBorrowAmount), assetSupply);

        uint256 thisMinRate;
        uint256 thisRateAtKink;
        uint256 thisBaseRate = baseRate;
        uint256 thisRateMultiplier = rateMultiplier;
        uint256 thisTargetLevel = targetLevel;
        uint256 thisKinkLevel = kinkLevel;
        uint256 thisMaxScaleRate = maxScaleRate;

        if (utilRate < thisTargetLevel) {
            // target targetLevel utilization when utilization is under targetLevel
            utilRate = thisTargetLevel;
        }

        if (utilRate > thisKinkLevel) {
            /// @dev Scale rate proportionally up to 100%
            uint256 thisMaxRange = WEI_PERCENT_PRECISION - thisKinkLevel; /// Will not overflow.

            utilRate -= thisKinkLevel;
            if (utilRate > thisMaxRange) utilRate = thisMaxRange;

            // Modified the rate calculation as it is slightly exaggerated around kink level
            // thisRateAtKink = thisRateMultiplier.add(thisBaseRate).mul(thisKinkLevel).div(WEI_PERCENT_PRECISION);
            thisRateAtKink = thisKinkLevel.mul(thisRateMultiplier).div(WEI_PERCENT_PRECISION).add(
                thisBaseRate
            );

            nextRate = utilRate
                .mul(SafeMath.sub(thisMaxScaleRate, thisRateAtKink))
                .div(thisMaxRange)
                .add(thisRateAtKink);
        } else {
            nextRate = utilRate.mul(thisRateMultiplier).div(WEI_PERCENT_PRECISION).add(
                thisBaseRate
            );

            thisMinRate = thisBaseRate;
            thisRateAtKink = thisRateMultiplier.add(thisBaseRate);

            if (nextRate < thisMinRate) nextRate = thisMinRate;
            else if (nextRate > thisRateAtKink) nextRate = thisRateAtKink;
        }
    }

    /**
     * @notice Compute the loan size and interest rate.
     * @param leverageAmount The leverage with 18 decimals.
     * @param depositAmount The amount the user deposited in underlying loan tokens.
     * @return borrowAmount The amount of tokens to borrow.
     * @return interestRate The interest rate to pay on the position.
     * */
    function _getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount)
        internal
        view
        returns (uint256 borrowAmount, uint256 interestRate)
    {
        uint256 loanSizeBeforeInterest = depositAmount.mul(leverageAmount).div(10**18);
        /**
         * @dev Mathematical imperfection. we calculate the interest rate based on
         * the loanSizeBeforeInterest, but the actual borrowed amount will be bigger.
         * */
        interestRate = _nextBorrowInterestRate2(loanSizeBeforeInterest, _totalAssetSupply(0));
        /// @dev Assumes that loan, collateral, and interest token are the same.
        borrowAmount = _adjustLoanSize(interestRate, 28 days, loanSizeBeforeInterest);
    }

    /**
     * @notice Make sure call is not paused.
     * @dev Used for internal verification if the called function is paused.
     *   It throws an exception in case it's not.
     * */
    function _checkPause() internal view {
        /// keccak256("iToken_FunctionPause")
        bytes32 slot =
            keccak256(
                abi.encodePacked(
                    msg.sig,
                    uint256(0xd46a704bc285dbd6ff5ad3863506260b1df02812f4f857c8cc852317a6ac64f2)
                )
            );
        bool isPaused;
        assembly {
            isPaused := sload(slot)
        }
        require(!isPaused, "unauthorized");
    }

    /**
     * @notice Adjusts the loan size to make sure the expected exposure remains after prepaying the interest.
     * @dev loanSizeWithInterest = loanSizeBeforeInterest * 100 / (100 - interestForDuration)
     * @param interestRate The interest rate to pay on the position.
     * @param maxDuration The maximum duration of the position (until rollover).
     * @param loanSizeBeforeInterest The loan size before interest is added.
     * */
    function _adjustLoanSize(
        uint256 interestRate,
        uint256 maxDuration,
        uint256 loanSizeBeforeInterest
    ) internal pure returns (uint256 loanSizeWithInterest) {
        uint256 interestForDuration = interestRate.mul(maxDuration).div(365 days);
        uint256 divisor = uint256(10**20).sub(interestForDuration);
        loanSizeWithInterest = loanSizeBeforeInterest.mul(10**20).div(divisor);
    }

    /**
     * @notice Calculate the utilization rate.
     * @dev Utilization rate = assetBorrow / assetSupply
     * @param assetBorrow The amount of loan tokens on debt.
     * @param assetSupply The amount of loan tokens supplied.
     * @return The utilization rate.
     * */
    function _utilizationRate(uint256 assetBorrow, uint256 assetSupply)
        internal
        pure
        returns (uint256)
    {
        if (assetBorrow != 0 && assetSupply != 0) {
            /// U = total_borrow / total_supply
            return assetBorrow.mul(10**20).div(assetSupply);
        }
    }
}
