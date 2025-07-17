# ISovryn
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/interfaces/ISovryn.sol)

**Inherits:**
[State](/contracts/core/State.sol/contract.State.md), [ProtocolSettingsEvents](/contracts/events/ProtocolSettingsEvents.sol/contract.ProtocolSettingsEvents.md), [LoanSettingsEvents](/contracts/events/LoanSettingsEvents.sol/contract.LoanSettingsEvents.md), [LoanOpeningsEvents](/contracts/events/LoanOpeningsEvents.sol/contract.LoanOpeningsEvents.md), [LoanMaintenanceEvents](/contracts/events/LoanMaintenanceEvents.sol/contract.LoanMaintenanceEvents.md), [LoanClosingsEvents](/contracts/events/LoanClosingsEvents.sol/contract.LoanClosingsEvents.md), [SwapsEvents](/contracts/events/SwapsEvents.sol/contract.SwapsEvents.md), [AffiliatesEvents](/contracts/events/AffiliatesEvents.sol/contract.AffiliatesEvents.md), [FeesEvents](/contracts/events/FeesEvents.sol/contract.FeesEvents.md)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.


## Functions
### replaceContract


```solidity
function replaceContract(address target) external;
```

### setTargets


```solidity
function setTargets(string[] calldata sigsArr, address[] calldata targetsArr) external;
```

### getTarget


```solidity
function getTarget(string calldata sig) external view returns (address);
```

### setSovrynProtocolAddress


```solidity
function setSovrynProtocolAddress(address newProtocolAddress) external;
```

### setSOVTokenAddress


```solidity
function setSOVTokenAddress(address newSovTokenAddress) external;
```

### setLockedSOVAddress


```solidity
function setLockedSOVAddress(address newSOVLockedAddress) external;
```

### setMinReferralsToPayoutAffiliates


```solidity
function setMinReferralsToPayoutAffiliates(uint256 newMinReferrals) external;
```

### setPriceFeedContract


```solidity
function setPriceFeedContract(address newContract) external;
```

### setSwapsImplContract


```solidity
function setSwapsImplContract(address newContract) external;
```

### setLoanPool


```solidity
function setLoanPool(address[] calldata pools, address[] calldata assets) external;
```

### setSupportedTokens


```solidity
function setSupportedTokens(address[] calldata addrs, bool[] calldata toggles) external;
```

### setLendingFeePercent


```solidity
function setLendingFeePercent(uint256 newValue) external;
```

### setTradingFeePercent


```solidity
function setTradingFeePercent(uint256 newValue) external;
```

### setBorrowingFeePercent


```solidity
function setBorrowingFeePercent(uint256 newValue) external;
```

### setSwapExternalFeePercent


```solidity
function setSwapExternalFeePercent(uint256 newValue) external;
```

### setAffiliateFeePercent


```solidity
function setAffiliateFeePercent(uint256 newValue) external;
```

### setAffiliateTradingTokenFeePercent


```solidity
function setAffiliateTradingTokenFeePercent(uint256 newValue) external;
```

### setLiquidationIncentivePercent


```solidity
function setLiquidationIncentivePercent(uint256 newAmount) external;
```

### setMaxDisagreement


```solidity
function setMaxDisagreement(uint256 newAmount) external;
```

### setSourceBuffer


```solidity
function setSourceBuffer(uint256 newAmount) external;
```

### setMaxSwapSize


```solidity
function setMaxSwapSize(uint256 newAmount) external;
```

### setFeesController


```solidity
function setFeesController(address newController) external;
```

### withdrawFees


```solidity
function withdrawFees(address[] calldata tokens, address receiver) external returns (uint256 totalWRBTCWithdrawn);
```

### withdrawLendingFees


```solidity
function withdrawLendingFees(address token, address receiver, uint256 amount) external returns (bool);
```

### withdrawTradingFees


```solidity
function withdrawTradingFees(address token, address receiver, uint256 amount) external returns (bool);
```

### withdrawBorrowingFees


```solidity
function withdrawBorrowingFees(address token, address receiver, uint256 amount) external returns (bool);
```

### withdrawProtocolToken


```solidity
function withdrawProtocolToken(address receiver, uint256 amount) external returns (address, bool);
```

### depositProtocolToken


```solidity
function depositProtocolToken(uint256 amount) external;
```

### getLoanPoolsList


```solidity
function getLoanPoolsList(uint256 start, uint256 count) external view returns (bytes32[] memory);
```

### isLoanPool


```solidity
function isLoanPool(address loanPool) external view returns (bool);
```

### setWrbtcToken


```solidity
function setWrbtcToken(address wrbtcTokenAddress) external;
```

### setSovrynSwapContractRegistryAddress


```solidity
function setSovrynSwapContractRegistryAddress(address registryAddress) external;
```

### setProtocolTokenAddress


```solidity
function setProtocolTokenAddress(address _protocolTokenAddress) external;
```

### setRolloverBaseReward


```solidity
function setRolloverBaseReward(uint256 transactionCost) external;
```

### setRebatePercent


```solidity
function setRebatePercent(uint256 rebatePercent) external;
```

### setSpecialRebates


```solidity
function setSpecialRebates(address sourceToken, address destToken, uint256 specialRebatesPercent) external;
```

### getSpecialRebates


```solidity
function getSpecialRebates(address sourceToken, address destToken)
    external
    view
    returns (uint256 specialRebatesPercent);
```

### togglePaused


```solidity
function togglePaused(bool paused) external;
```

### isProtocolPaused


```solidity
function isProtocolPaused() external view returns (bool);
```

### getSovrynSwapNetworkContract


```solidity
function getSovrynSwapNetworkContract(address sovrynSwapRegistryAddress) public view returns (address);
```

### getContractHexName


```solidity
function getContractHexName(string calldata source) external pure returns (bytes32 result);
```

### swapsImplExpectedRate


```solidity
function swapsImplExpectedRate(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount)
    external
    view
    returns (uint256);
```

### swapsImplExpectedReturn


```solidity
function swapsImplExpectedReturn(address sourceTokenAddress, address destTokenAddress, uint256 sourceTokenAmount)
    external
    view
    returns (uint256 expectedReturn);
```

### setupLoanParams


```solidity
function setupLoanParams(LoanParams[] calldata loanParamsList) external returns (bytes32[] memory loanParamsIdList);
```

### disableLoanParams


```solidity
function disableLoanParams(bytes32[] calldata loanParamsIdList) external;
```

### getLoanParams


```solidity
function getLoanParams(bytes32[] calldata loanParamsIdList)
    external
    view
    returns (LoanParams[] memory loanParamsList);
```

### getLoanParamsList


```solidity
function getLoanParamsList(address owner, uint256 start, uint256 count)
    external
    view
    returns (bytes32[] memory loanParamsList);
```

### getTotalPrincipal


```solidity
function getTotalPrincipal(address lender, address loanToken) external view returns (uint256);
```

### minInitialMargin


```solidity
function minInitialMargin(bytes32 loanParamsId) external view returns (uint256);
```

### borrowOrTradeFromPool


```solidity
function borrowOrTradeFromPool(
    bytes32 loanParamsId,
    bytes32 loanId,
    bool isTorqueLoan,
    uint256 initialMargin,
    MarginTradeStructHelpers.SentAddresses calldata sentAddresses,
    MarginTradeStructHelpers.SentAmounts calldata sentValues,
    bytes calldata loanDataBytes
) external payable returns (uint256 newPrincipal, uint256 newCollateral);
```

### setDelegatedManager


```solidity
function setDelegatedManager(bytes32 loanId, address delegated, bool toggle) external;
```

### getEstimatedMarginExposure


```solidity
function getEstimatedMarginExposure(
    address loanToken,
    address collateralToken,
    uint256 loanTokenSent,
    uint256 collateralTokenSent,
    uint256 interestRate,
    uint256 newPrincipal
) external view returns (uint256);
```

### getRequiredCollateral


```solidity
function getRequiredCollateral(
    address loanToken,
    address collateralToken,
    uint256 newPrincipal,
    uint256 marginAmount,
    bool isTorqueLoan
) external view returns (uint256 collateralAmountRequired);
```

### getBorrowAmount


```solidity
function getBorrowAmount(
    address loanToken,
    address collateralToken,
    uint256 collateralTokenAmount,
    uint256 marginAmount,
    bool isTorqueLoan
) external view returns (uint256 borrowAmount);
```

### liquidate


```solidity
function liquidate(bytes32 loanId, address receiver, uint256 closeAmount)
    external
    payable
    returns (uint256 loanCloseAmount, uint256 seizedAmount, address seizedToken);
```

### rollover


```solidity
function rollover(bytes32 loanId, bytes calldata loanDataBytes) external;
```

### closeWithDeposit


```solidity
function closeWithDeposit(bytes32 loanId, address receiver, uint256 depositAmount)
    external
    payable
    returns (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken);
```

### closeWithSwap


```solidity
function closeWithSwap(
    bytes32 loanId,
    address receiver,
    uint256 swapAmount,
    bool returnTokenIsCollateral,
    bytes calldata loanDataBytes
) external returns (uint256 loanCloseAmount, uint256 withdrawAmount, address withdrawToken);
```

### depositCollateral


```solidity
function depositCollateral(bytes32 loanId, uint256 depositAmount) external payable;
```

### withdrawCollateral


```solidity
function withdrawCollateral(bytes32 loanId, address receiver, uint256 withdrawAmount)
    external
    returns (uint256 actualWithdrawAmount);
```

### withdrawAccruedInterest


```solidity
function withdrawAccruedInterest(address loanToken) external;
```

### getLenderInterestData


```solidity
function getLenderInterestData(address lender, address loanToken)
    external
    view
    returns (
        uint256 interestPaid,
        uint256 interestPaidDate,
        uint256 interestOwedPerDay,
        uint256 interestUnPaid,
        uint256 interestFeePercent,
        uint256 principalTotal
    );
```

### getLoanInterestData


```solidity
function getLoanInterestData(bytes32 loanId)
    external
    view
    returns (
        address loanToken,
        uint256 interestOwedPerDay,
        uint256 interestDepositTotal,
        uint256 interestDepositRemaining
    );
```

### getUserLoans


```solidity
function getUserLoans(address user, uint256 start, uint256 count, uint256 loanType, bool isLender, bool unsafeOnly)
    external
    view
    returns (LoanReturnData[] memory loansData);
```

### getUserLoansV2


```solidity
function getUserLoansV2(address user, uint256 start, uint256 count, uint256 loanType, bool isLender, bool unsafeOnly)
    external
    view
    returns (LoanReturnDataV2[] memory loansDataV2);
```

### getLoan


```solidity
function getLoan(bytes32 loanId) external view returns (LoanReturnData memory loanData);
```

### getLoanV2


```solidity
function getLoanV2(bytes32 loanId) external view returns (LoanReturnDataV2 memory loanDataV2);
```

### getActiveLoans


```solidity
function getActiveLoans(uint256 start, uint256 count, bool unsafeOnly)
    external
    view
    returns (LoanReturnData[] memory loansData);
```

### getActiveLoansV2


```solidity
function getActiveLoansV2(uint256 start, uint256 count, bool unsafeOnly)
    external
    view
    returns (LoanReturnDataV2[] memory loansDataV2);
```

### extendLoanDuration


```solidity
function extendLoanDuration(bytes32 loanId, uint256 depositAmount, bool useCollateral, bytes calldata)
    external
    returns (uint256 secondsExtended);
```

### reduceLoanDuration


```solidity
function reduceLoanDuration(bytes32 loanId, address receiver, uint256 withdrawAmount)
    external
    returns (uint256 secondsReduced);
```

### swapExternal


```solidity
function swapExternal(
    address sourceToken,
    address destToken,
    address receiver,
    address returnToSender,
    uint256 sourceTokenAmount,
    uint256 requiredDestTokenAmount,
    uint256 minReturn,
    bytes calldata swapData
) external returns (uint256 destTokenAmountReceived, uint256 sourceTokenAmountUsed);
```

### getSwapExpectedReturn


```solidity
function getSwapExpectedReturn(address sourceToken, address destToken, uint256 sourceTokenAmount)
    external
    view
    returns (uint256);
```

### checkPriceDivergence


```solidity
function checkPriceDivergence(address sourceToken, address destToken, uint256 sourceTokenAmount, uint256 minReturn)
    public
    view;
```

### getUserNotFirstTradeFlag


```solidity
function getUserNotFirstTradeFlag(address user) external view returns (bool);
```

### setUserNotFirstTradeFlag


```solidity
function setUserNotFirstTradeFlag(address user) external;
```

### payTradingFeeToAffiliatesReferrer


```solidity
function payTradingFeeToAffiliatesReferrer(
    address referrer,
    address trader,
    address token,
    uint256 tradingFeeTokenBaseAmount
) external returns (uint256 affiliatesBonusSOVAmount, uint256 affiliatesBonusTokenAmount);
```

### setAffiliatesReferrer


```solidity
function setAffiliatesReferrer(address user, address referrer) external;
```

### getReferralsList


```solidity
function getReferralsList(address referrer) external view returns (address[] memory refList);
```

### getAffiliatesReferrerBalances


```solidity
function getAffiliatesReferrerBalances(address referrer)
    external
    view
    returns (address[] memory referrerTokensList, uint256[] memory referrerTokensBalances);
```

### getAffiliatesReferrerTokensList


```solidity
function getAffiliatesReferrerTokensList(address referrer) external view returns (address[] memory tokensList);
```

### getAffiliatesReferrerTokenBalance


```solidity
function getAffiliatesReferrerTokenBalance(address referrer, address token) external view returns (uint256);
```

### withdrawAffiliatesReferrerTokenFees


```solidity
function withdrawAffiliatesReferrerTokenFees(address token, address receiver, uint256 amount) external;
```

### withdrawAllAffiliatesReferrerTokenFees


```solidity
function withdrawAllAffiliatesReferrerTokenFees(address receiver) external;
```

### getProtocolAddress


```solidity
function getProtocolAddress() external view returns (address);
```

### getSovTokenAddress


```solidity
function getSovTokenAddress() external view returns (address);
```

### getLockedSOVAddress


```solidity
function getLockedSOVAddress() external view returns (address);
```

### getFeeRebatePercent


```solidity
function getFeeRebatePercent() external view returns (uint256);
```

### getMinReferralsToPayout


```solidity
function getMinReferralsToPayout() external view returns (uint256);
```

### getAffiliatesUserReferrer


```solidity
function getAffiliatesUserReferrer(address user) external view returns (address referrer);
```

### getAffiliateRewardsHeld


```solidity
function getAffiliateRewardsHeld(address referrer) external view returns (uint256);
```

### getAffiliateTradingTokenFeePercent


```solidity
function getAffiliateTradingTokenFeePercent() external view returns (uint256 affiliateTradingTokenFeePercent);
```

### getAffiliatesTokenRewardsValueInRbtc


```solidity
function getAffiliatesTokenRewardsValueInRbtc(address referrer) external view returns (uint256 rbtcTotalAmount);
```

### getSwapExternalFeePercent


```solidity
function getSwapExternalFeePercent() external view returns (uint256 swapExternalFeePercent);
```

### setTradingRebateRewardsBasisPoint


```solidity
function setTradingRebateRewardsBasisPoint(uint256 newBasisPoint) external;
```

### getTradingRebateRewardsBasisPoint


```solidity
function getTradingRebateRewardsBasisPoint() external view returns (uint256);
```

### getDedicatedSOVRebate


```solidity
function getDedicatedSOVRebate() external view returns (uint256);
```

### setRolloverFlexFeePercent


```solidity
function setRolloverFlexFeePercent(uint256 newRolloverFlexFeePercent) external;
```

### getDefaultPathConversion


```solidity
function getDefaultPathConversion(address sourceTokenAddress, address destTokenAddress)
    external
    view
    returns (IERC20[] memory);
```

### setDefaultPathConversion


```solidity
function setDefaultPathConversion(IERC20[] calldata defaultPath) external;
```

### removeDefaultPathConversion


```solidity
function removeDefaultPathConversion(address sourceTokenAddress, address destTokenAddress) external;
```

### checkCloseWithDepositIsTinyPosition


```solidity
function checkCloseWithDepositIsTinyPosition(bytes32 loanId, uint256 depositAmount)
    external
    view
    returns (bool isTinyPosition, uint256 tinyPositionAmount);
```

### setAdmin


```solidity
function setAdmin(address newAdmin) external;
```

### getAdmin


```solidity
function getAdmin() external view returns (address);
```

### setPauser


```solidity
function setPauser(address newPauser) external;
```

### getPauser


```solidity
function getPauser() external view returns (address);
```

## Events
### PayInterestTransfer
Triggered whenever interest is paid to lender.


```solidity
event PayInterestTransfer(address indexed interestToken, address indexed lender, uint256 effectiveInterest);
```

## Structs
### LoanReturnData

```solidity
struct LoanReturnData {
    bytes32 loanId;
    address loanToken;
    address collateralToken;
    uint256 principal;
    uint256 collateral;
    uint256 interestOwedPerDay;
    uint256 interestDepositRemaining;
    uint256 startRate;
    uint256 startMargin;
    uint256 maintenanceMargin;
    uint256 currentMargin;
    uint256 maxLoanTerm;
    uint256 endTimestamp;
    uint256 maxLiquidatable;
    uint256 maxSeizable;
}
```

### LoanReturnDataV2

```solidity
struct LoanReturnDataV2 {
    bytes32 loanId;
    address loanToken;
    address collateralToken;
    address borrower;
    uint256 principal;
    uint256 collateral;
    uint256 interestOwedPerDay;
    uint256 interestDepositRemaining;
    uint256 startRate;
    uint256 startMargin;
    uint256 maintenanceMargin;
    uint256 currentMargin;
    uint256 maxLoanTerm;
    uint256 endTimestamp;
    uint256 maxLiquidatable;
    uint256 maxSeizable;
    uint256 creationTimestamp;
}
```

