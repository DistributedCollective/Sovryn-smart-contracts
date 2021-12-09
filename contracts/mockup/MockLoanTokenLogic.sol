pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../modules/Affiliates.sol";
import "../connectors/loantoken/modules/beaconLogicLM/LoanTokenLogicLM.sol";
import "../modules/interfaces/ProtocolAffiliatesInterface.sol";
import "../interfaces/ILoanTokenModules.sol";

contract MockLoanTokenLogic is LoanTokenLogicLM {
	/*function getAffiliatesUserReferrer(address user) public view returns (address) {
		return affiliatesUserReferrer[user]; // REFACTOR: will be useful if affiliatesUserReferrer visibillity is not public
	}*/

	function getListFunctionSignatures() external pure returns (bytes4[] memory functionSignatures, bytes32 moduleName) {
		bytes4[] memory res = new bytes4[](38);

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

		// Mock
		res[34] = this.setAffiliatesReferrer.selector;
		res[35] = this.setUserNotFirstTradeFlag.selector;
		res[36] = this.getMarginBorrowAmountAndRate.selector;

		// Loan Token Logic Storage Additional Variable
		res[37] = this.getLiquidityMiningAddress.selector;

		return (res, stringToBytes32("MockLoanTokenLogic"));
	}

	function setAffiliatesReferrer(address user, address referrer) public {
		ProtocolAffiliatesInterface(sovrynContractAddress).setAffiliatesReferrer(user, referrer);
	}

	function setUserNotFirstTradeFlag(address user) public {
		ProtocolAffiliatesInterface(sovrynContractAddress).setUserNotFirstTradeFlag(user);
	}

	function getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount) public view returns (uint256, uint256) {
		return _getMarginBorrowAmountAndRate(leverageAmount, depositAmount);
	}

	/*function initialize(address target) external onlyOwner {
		_setTarget(this.setAffiliatesUserReferrer.selector, target);
	}*/
}

contract ILoanTokenModulesMock is ILoanTokenModules {
	function setAffiliatesReferrer(address user, address referrer) external;

	function setUserNotFirstTradeFlag(address user) external;
}
