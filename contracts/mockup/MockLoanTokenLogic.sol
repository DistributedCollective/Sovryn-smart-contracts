pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../modules/Affiliates.sol";
import "../connectors/loantoken/modules/beaconLogicLM/LoanTokenLogic.sol";
import "../modules/interfaces/ProtocolAffiliatesInterface.sol";
import "../interfaces/ILoanTokenModules.sol";

contract MockLoanTokenLogic is LoanTokenLogic {
    /*function getAffiliatesUserReferrer(address user) public view returns (address) {
		return affiliatesUserReferrer[user]; // REFACTOR: will be useful if affiliatesUserReferrer visibillity is not public
	}*/

    function getListFunctionSignatures()
        external
        pure
        returns (bytes4[] memory functionSignatures, bytes32 moduleName)
    {
        bytes4[] memory res = new bytes4[](31);

        // Loan Token Logic
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
        res[23] = this.calculateSupplyInterestRate.selector;

        // Advanced Token
        res[24] = this.approve.selector;

        // Advanced Token Storage
        res[25] = this.totalSupply.selector;
        res[26] = this.balanceOf.selector;
        res[27] = this.allowance.selector;

        // Mock
        res[28] = this.setAffiliatesReferrer.selector;
        res[29] = this.setUserNotFirstTradeFlag.selector;
        res[30] = this.getMarginBorrowAmountAndRate.selector;

        return (res, stringToBytes32("MockLoanTokenLogic"));
    }

    function setAffiliatesReferrer(address user, address referrer) public {
        ProtocolAffiliatesInterface(sovrynContractAddress).setAffiliatesReferrer(user, referrer);
    }

    function setUserNotFirstTradeFlag(address user) public {
        ProtocolAffiliatesInterface(sovrynContractAddress).setUserNotFirstTradeFlag(user);
    }

    function getMarginBorrowAmountAndRate(uint256 leverageAmount, uint256 depositAmount)
        public
        view
        returns (uint256, uint256)
    {
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
