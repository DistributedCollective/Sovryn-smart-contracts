pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "../connectors/loantoken/modules/beaconLogicLM/LoanTokenLogicTradeLM.sol";

contract LoanTokenLogicTradeLMV1Mockup is LoanTokenLogicTrade {
    function getListFunctionSignatures()
        external
        pure
        returns (bytes4[] memory functionSignatures, bytes32 moduleName)
    {
        bytes4[] memory res = new bytes4[](27);

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
        res[23] = this.calculateSupplyInterestRate.selector;

        // Advanced Token
        res[24] = this.approve.selector;

        // Advanced Token Storage
        // res[31] = this.totalSupply.selector;
        res[25] = this.balanceOf.selector;
        res[26] = this.allowance.selector;

        return (res, stringToBytes32("LoanTokenLogicTrade"));
    }
}

contract LoanTokenLogicTradeLMV2Mockup is LoanTokenLogicTrade {
    function testNewFunction() external pure returns (bool) {
        return true;
    }

    function getListFunctionSignatures()
        external
        pure
        returns (bytes4[] memory functionSignatures, bytes32 moduleName)
    {
        bytes4[] memory res = new bytes4[](29);

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
        res[23] = this.calculateSupplyInterestRate.selector;

        // Advanced Token
        res[24] = this.approve.selector;

        // Advanced Token Storage
        res[25] = this.totalSupply.selector;
        res[26] = this.balanceOf.selector;
        res[27] = this.allowance.selector;

        // Mockup
        res[28] = this.testNewFunction.selector;

        return (res, stringToBytes32("LoanTokenLogicTrade"));
    }
}
