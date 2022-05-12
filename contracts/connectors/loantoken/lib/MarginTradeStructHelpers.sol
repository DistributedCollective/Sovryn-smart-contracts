pragma solidity 0.5.17;

library MarginTradeStructHelpers {
    struct SentAddresses {
        address lender;
        address borrower;
        address receiver;
        address manager;
    }

    struct SentAmounts {
        uint256 interestRate;
        uint256 newPrincipal;
        uint256 interestInitialAmount;
        uint256 loanTokenSent;
        uint256 collateralTokenSent;
        uint256 minEntryPrice;
    }
}
