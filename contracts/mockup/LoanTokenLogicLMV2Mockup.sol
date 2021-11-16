pragma solidity 0.5.17;

import "../connectors/loantoken/modules/beaconLogicLM/LoanTokenLogicLM.sol";

contract LoanTokenLogicLMV1Mockup is LoanTokenLogicLM {
	function getListFunctionSignatures() external pure returns (bytes4[] memory functionSignatures, bytes32 moduleName) {
		bytes4[] memory res = new bytes4[](34);

		// Loan Token Logic Standard
		res[0] = bytes4(keccak256("mint(address,uint256)"));
		res[1] = bytes4(keccak256("burn(address,uint256)"));
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
		res[25] = this.checkPause.selector;
		res[26] = this.setLiquidityMiningAddress.selector;
		res[27] = this.calculateSupplyInterestRate.selector;

		// Loan Token LM
		/**
		 * @notice BE CAREFUL,
		 * LoanTokenLogicStandard also has mint & burn function (overloading).
		 * You need to compute the function signature manually --> bytes4(keccak256("mint(address,uint256,bool)"))
		 */
		res[28] = bytes4(keccak256("mint(address,uint256,bool)"));
		res[29] = bytes4(keccak256("burn(address,uint256,bool)"));

		// Advanced Token
		res[30] = this.approve.selector;

		// Advanced Token Storage
		// res[31] = this.totalSupply.selector;
		res[31] = this.balanceOf.selector;
		res[32] = this.allowance.selector;

		// Loan Token Logic Storage Additional Variable
		res[33] = bytes4(keccak256("liquidityMiningAddress()"));

		return (res, stringToBytes32("LoanTokenLogicLM"));
	}
}

contract LoanTokenLogicLMV2Mockup is LoanTokenLogicLM {
	function testNewFunction() external pure returns (bool) {
		return true;
	}

	function getListFunctionSignatures() external pure returns (bytes4[] memory functionSignatures, bytes32 moduleName) {
		bytes4[] memory res = new bytes4[](36);

		// Loan Token Logic Standard
		res[0] = bytes4(keccak256("mint(address,uint256)"));
		res[1] = bytes4(keccak256("burn(address,uint256)"));
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
		res[25] = this.checkPause.selector;
		res[26] = this.setLiquidityMiningAddress.selector;
		res[27] = this.calculateSupplyInterestRate.selector;

		// Loan Token LM
		/**
		 * @notice BE CAREFUL,
		 * LoanTokenLogicStandard also has mint & burn function (overloading).
		 * You need to compute the function signature manually --> bytes4(keccak256("mint(address,uint256,bool)"))
		 */
		res[28] = bytes4(keccak256("mint(address,uint256,bool)"));
		res[29] = bytes4(keccak256("burn(address,uint256,bool)"));

		// Advanced Token
		res[30] = this.approve.selector;

		// Advanced Token Storage
		res[31] = this.totalSupply.selector;
		res[32] = this.balanceOf.selector;
		res[33] = this.allowance.selector;

		// Loan Token Logic Storage Additional Variable
		res[34] = bytes4(keccak256("liquidityMiningAddress()"));

		// Mockup
		res[35] = this.testNewFunction.selector;

		return (res, stringToBytes32("LoanTokenLogicLM"));
	}
}
