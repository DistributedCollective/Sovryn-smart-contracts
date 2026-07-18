# State
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/core/State.sol)

**Inherits:**
[Objects](/contracts/core/Objects.sol/contract.Objects.md), [ReentrancyGuard](/contracts/openzeppelin/ReentrancyGuard.sol/contract.ReentrancyGuard.md), [SharedReentrancyGuard](/contracts/reentrancy/SharedReentrancyGuard.sol/contract.SharedReentrancyGuard.md), [Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains the storage values of the Protocol.


## State Variables
### priceFeeds
Handles asset reference price lookups.


```solidity
address public priceFeeds;
```


### swapsImpl
Handles asset swaps using dex liquidity.


```solidity
address public swapsImpl;
```


### sovrynSwapContractRegistryAddress
Contract registry address of the Sovryn swap network.


```solidity
address public sovrynSwapContractRegistryAddress;
```


### logicTargets
Implementations of protocol functions.


```solidity
mapping(bytes4 => address) public logicTargets;
```


### loans
Loans: loanId => Loan


```solidity
mapping(bytes32 => Loan) public loans;
```


### loanParams
Loan parameters: loanParamsId => LoanParams


```solidity
mapping(bytes32 => LoanParams) public loanParams;
```


### lenderOrders
lender => orderParamsId => Order


```solidity
mapping(address => mapping(bytes32 => Order)) public lenderOrders;
```


### borrowerOrders
borrower => orderParamsId => Order


```solidity
mapping(address => mapping(bytes32 => Order)) public borrowerOrders;
```


### delegatedManagers
loanId => delegated => approved


```solidity
mapping(bytes32 => mapping(address => bool)) public delegatedManagers;
```


### lenderInterest
Interest ***
lender => loanToken => LenderInterest object


```solidity
mapping(address => mapping(address => LenderInterest)) public lenderInterest;
```


### loanInterest
loanId => LoanInterest object


```solidity
mapping(bytes32 => LoanInterest) public loanInterest;
```


### logicTargetsSet
Internals ***
Implementations set.


```solidity
EnumerableBytes32Set.Bytes32Set internal logicTargetsSet;
```


### activeLoansSet
Active loans set.


```solidity
EnumerableBytes32Set.Bytes32Set internal activeLoansSet;
```


### lenderLoanSets
Lender loans set.


```solidity
mapping(address => EnumerableBytes32Set.Bytes32Set) internal lenderLoanSets;
```


### borrowerLoanSets
Borrow loans set.


```solidity
mapping(address => EnumerableBytes32Set.Bytes32Set) internal borrowerLoanSets;
```


### userLoanParamSets
User loan params set.


```solidity
mapping(address => EnumerableBytes32Set.Bytes32Set) internal userLoanParamSets;
```


### feesController
Address controlling fee withdrawals.


```solidity
address public feesController;
```


### lendingFeePercent
10% fee /// Fee taken from lender interest payments.


```solidity
uint256 public lendingFeePercent = 10 ** 19;
```


### lendingFeeTokensHeld
Total interest fees received and not withdrawn per asset.


```solidity
mapping(address => uint256) public lendingFeeTokensHeld;
```


### lendingFeeTokensPaid
Total interest fees withdraw per asset.
lifetime fees = lendingFeeTokensHeld + lendingFeeTokensPaid


```solidity
mapping(address => uint256) public lendingFeeTokensPaid;
```


### tradingFeePercent
0.15% fee /// Fee paid for each trade.


```solidity
uint256 public tradingFeePercent = 15 * 10 ** 16;
```


### tradingFeeTokensHeld
Total trading fees received and not withdrawn per asset.


```solidity
mapping(address => uint256) public tradingFeeTokensHeld;
```


### tradingFeeTokensPaid
Total trading fees withdraw per asset
lifetime fees = tradingFeeTokensHeld + tradingFeeTokensPaid


```solidity
mapping(address => uint256) public tradingFeeTokensPaid;
```


### borrowingFeePercent
0.09% fee /// Origination fee paid for each loan.


```solidity
uint256 public borrowingFeePercent = 9 * 10 ** 16;
```


### borrowingFeeTokensHeld
Total borrowing fees received and not withdrawn per asset.


```solidity
mapping(address => uint256) public borrowingFeeTokensHeld;
```


### borrowingFeeTokensPaid
Total borrowing fees withdraw per asset.
lifetime fees = borrowingFeeTokensHeld + borrowingFeeTokensPaid


```solidity
mapping(address => uint256) public borrowingFeeTokensPaid;
```


### protocolTokenHeld
Current protocol token deposit balance.


```solidity
uint256 public protocolTokenHeld;
```


### protocolTokenPaid
Lifetime total payout of protocol token.


```solidity
uint256 public protocolTokenPaid;
```


### affiliateFeePercent
5% fee share in form of SOV /// Fee share for affiliate program.


```solidity
uint256 public affiliateFeePercent = 5 * 10 ** 18;
```


### liquidationIncentivePercent
5% collateral discount /// Discount on collateral for liquidators.


```solidity
uint256 public liquidationIncentivePercent = 5 * 10 ** 18;
```


### loanPoolToUnderlying
loanPool => underlying


```solidity
mapping(address => address) public loanPoolToUnderlying;
```


### underlyingToLoanPool
underlying => loanPool


```solidity
mapping(address => address) public underlyingToLoanPool;
```


### loanPoolsSet
Loan pools set.


```solidity
EnumerableBytes32Set.Bytes32Set internal loanPoolsSet;
```


### supportedTokens
Supported tokens for swaps.


```solidity
mapping(address => bool) public supportedTokens;
```


### maxDisagreement
% disagreement between swap rate and reference rate.


```solidity
uint256 public maxDisagreement = 5 * 10 ** 18;
```


### sourceBuffer
Used as buffer for swap source amount estimations.


```solidity
uint256 public sourceBuffer = 10000;
```


### maxSwapSize
Maximum support swap size in rBTC


```solidity
uint256 public maxSwapSize = 50 ether;
```


### borrowerNonce
Nonce per borrower. Used for loan id creation.


```solidity
mapping(address => uint256) public borrowerNonce;
```


### rolloverBaseReward
Rollover transaction costs around 0.0000168 rBTC, it is denominated in wrBTC.


```solidity
uint256 public rolloverBaseReward = 16800000000000;
```


### rolloverFlexFeePercent

```solidity
uint256 public rolloverFlexFeePercent = 0.1 ether;
```


### wrbtcToken
0.1%


```solidity
IWrbtcERC20 public wrbtcToken;
```


### protocolTokenAddress

```solidity
address public protocolTokenAddress;
```


### feeRebatePercent
50% fee rebate
potocolToken reward to user, it is worth % of trading/borrowing fee.


```solidity
uint256 public feeRebatePercent = 50 * 10 ** 18;
```


### admin

```solidity
address public admin;
```


### protocolAddress
For modules interaction.


```solidity
address public protocolAddress;
```


### userNotFirstTradeFlag
Affiliates ***
The flag is set on the user's first trade.


```solidity
mapping(address => bool) public userNotFirstTradeFlag;
```


### affiliatesUserReferrer
User => referrer (affiliate).


```solidity
mapping(address => address) public affiliatesUserReferrer;
```


### referralsList
List of referral addresses affiliated to the referrer.


```solidity
mapping(address => EnumerableAddressSet.AddressSet) internal referralsList;
```


### minReferralsToPayout
*Referral threshold for paying out to the referrer.
The referrer reward is being accumulated and locked until the threshold is passed.*


```solidity
uint256 public minReferralsToPayout = 3;
```


### affiliateRewardsHeld
*Total affiliate SOV rewards that held in the protocol
(Because the minimum referrals is less than the rule)*


```solidity
mapping(address => uint256) public affiliateRewardsHeld;
```


### sovTokenAddress
*For affiliates SOV Bonus proccess.*


```solidity
address public sovTokenAddress;
```


### lockedSOVAddress

```solidity
address public lockedSOVAddress;
```


### affiliateTradingTokenFeePercent
*20% fee share of trading token fee.
Fee share of trading token fee for affiliate program.*


```solidity
uint256 public affiliateTradingTokenFeePercent = 20 * 10 ** 18;
```


### affiliatesReferrerTokensList
*Addresses of tokens in which commissions were paid to referrers.*


```solidity
mapping(address => EnumerableAddressSet.AddressSet) internal affiliatesReferrerTokensList;
```


### affiliatesReferrerBalances
*[referrerAddress][tokenAddress] is a referrer's token balance of accrued fees.*


```solidity
mapping(address => mapping(address => uint256)) public affiliatesReferrerBalances;
```


### specialRebates

```solidity
mapping(address => mapping(address => uint256)) public specialRebates;
```


### pause

```solidity
bool public pause;
```


### swapExtrernalFeePercent

```solidity
uint256 internal swapExtrernalFeePercent;
```


### tradingRebateRewardsBasisPoint
Fee percentage for protocol swap

*Defines the portion of the trading rebate rewards (SOV) which is to be paid out in a liquid form in basis points. The rest is vested. The max value is 9999 (means 99.99% liquid, 0.01% vested)*


```solidity
uint256 internal tradingRebateRewardsBasisPoint;
```


### defaultPathConversion
*Defines the defaultPath of conversion swap. This is created to prevent the non-rbtc pairs returning the shortest path which will not give the best rate.
Will be used in internal swap.*


```solidity
mapping(address => mapping(address => IERC20[])) internal defaultPathConversion;
```


### pauser

```solidity
address internal pauser;
```


## Functions
### _setTarget

Add signature and target to storage.

*Protocol is a proxy and requires a way to add every
module function dynamically during deployment.*


```solidity
function _setTarget(bytes4 sig, address target) internal;
```

### onlyAdminOrOwner


```solidity
modifier onlyAdminOrOwner();
```

### onlyPauserOrOwner


```solidity
modifier onlyPauserOrOwner();
```

