pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../../LoanTokenLogicStandard.sol";

contract LoanTokenLogicLM is LoanTokenLogicStandard {
	/**
	 * @notice This function is MANDATORY, which will be called by LoanTokenLogicBeacon and be registered.
	 * Every new public function, the signature needs to be included in this function.
	 *
	 * @dev This function will return the list of function signature in this contract that are available for public call
	 * Then this function will be called by LoanTokenLogicBeacon, and the function signatures will be registred in LoanTokenLogicBeacon.
	 * @dev To save the gas we can just directly return the list of function signature from this pure function.
	 * The other workaround (fancy way) is we can create a storage for the list of the function signature, and then we can store each function signature to that storage from the constructor.
	 * Then, in this function we just need to return that storage variable.
	 *
	 * @return The list of function signatures (bytes4[])
	 */
	function getListFunctionSignatures() external pure returns (bytes4[] memory functionSignatures, bytes32 moduleName) {
		bytes4[] memory res = new bytes4[](36);

		// Loan Token Logic Standard
		res[0] = this.borrow.selector;
		res[1] = this.marginTrade.selector;
		res[2] = this.marginTradeAffiliate.selector;
		res[3] = this.transfer.selector;
		res[4] = this.transferFrom.selector;
		res[5] = this.profitOf.selector;
		res[6] = this.tokenPrice.selector;
		res[7] = this.checkpointPrice.selector;
		res[8] = this.marketLiquidity.selector;
		res[9] = this.avgBorrowInterestRate.selector;
		res[10] = this.borrowInterestRate.selector;
		res[11] = this.nextBorrowInterestRate.selector;
		res[12] = this.supplyInterestRate.selector;
		res[13] = this.nextSupplyInterestRate.selector;
		res[14] = this.totalSupplyInterestRate.selector;
		res[15] = this.totalAssetBorrow.selector;
		res[16] = this.totalAssetSupply.selector;
		res[17] = this.getMaxEscrowAmount.selector;
		res[18] = this.assetBalanceOf.selector;
		res[19] = this.getEstimatedMarginDetails.selector;
		res[20] = this.getDepositAmountForBorrow.selector;
		res[21] = this.getBorrowAmountForDeposit.selector;
		res[22] = this.checkPriceDivergence.selector;
		res[23] = this.checkPause.selector;
		res[24] = this.setLiquidityMiningAddress.selector;
		res[25] = this.calculateSupplyInterestRate.selector;

		// Loan Token LM & OVERLOADING function
		/**
		 * @notice BE CAREFUL,
		 * LoanTokenLogicStandard also has mint & burn function (overloading).
		 * You need to compute the function signature manually --> bytes4(keccak256("mint(address,uint256,bool)"))
		 */
		res[26] = bytes4(keccak256("mint(address,uint256)")); /// LoanTokenLogicStandard
		res[27] = bytes4(keccak256("mint(address,uint256,bool)")); /// LoanTokenLogicLM
		res[28] = bytes4(keccak256("burn(address,uint256)")); /// LoanTokenLogicStandard
		res[29] = bytes4(keccak256("burn(address,uint256,bool)")); /// LoanTokenLogicLM

		// Advanced Token
		res[30] = this.approve.selector;

		// Advanced Token Storage
		res[31] = this.totalSupply.selector;
		res[32] = this.balanceOf.selector;
		res[33] = this.allowance.selector;

		// Loan Token Logic Storage Additional Variable
		res[34] = this.getLiquidityMiningAddress.selector;
		res[35] = this.marginTradeBySig.selector;

		return (res, stringToBytes32("LoanTokenLogicLM"));
	}

	/**
	 * @notice deposit into the lending pool and optionally participate at the Liquidity Mining Program
	 * @param receiver the receiver of the tokens
	 * @param depositAmount The amount of underlying tokens provided on the loan.
	 *						(Not the number of loan tokens to mint).
	 * @param useLM if true -> deposit the pool tokens into the Liquidity Mining contract
	 */
	function mint(
		address receiver,
		uint256 depositAmount,
		bool useLM
	) external nonReentrant returns (uint256 minted) {
		if (useLM) return _mintWithLM(receiver, depositAmount);
		else return _mintToken(receiver, depositAmount);
	}

	/**
	 * @notice withdraws from the lending pool and optionally retrieves the pool tokens from the
	 *         Liquidity Mining Contract
	 * @param receiver the receiver of the underlying tokens. note: potetial LM rewards are always sent to the msg.sender
	 * @param burnAmount The amount of pool tokens to redeem.
	 * @param useLM if true -> deposit the pool tokens into the Liquidity Mining contract
	 */
	function burn(
		address receiver,
		uint256 burnAmount,
		bool useLM
	) external nonReentrant returns (uint256 redeemed) {
		if (useLM) redeemed = _burnFromLM(burnAmount);
		else redeemed = _burnToken(burnAmount);
		//this needs to be here and not in _burnTokens because of the WRBTC implementation
		if (redeemed != 0) {
			_safeTransfer(loanTokenAddress, receiver, redeemed, "asset transfer failed");
		}
	}
}
