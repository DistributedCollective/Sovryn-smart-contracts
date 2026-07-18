# MarginTradeStructHelpers
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/lib/MarginTradeStructHelpers.sol)


## Structs
### SentAddresses

```solidity
struct SentAddresses {
    address lender;
    address borrower;
    address receiver;
    address manager;
}
```

### SentAmounts

```solidity
struct SentAmounts {
    uint256 interestRate;
    uint256 newPrincipal;
    uint256 interestInitialAmount;
    uint256 loanTokenSent;
    uint256 collateralTokenSent;
    uint256 minEntryPrice;
    uint256 loanToCollateralSwapRate;
    uint256 interestDuration;
    uint256 entryLeverage;
}
```

