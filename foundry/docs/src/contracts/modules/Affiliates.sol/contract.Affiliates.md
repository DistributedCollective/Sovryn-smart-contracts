# Affiliates
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/modules/Affiliates.sol)

**Inherits:**
[State](/contracts/core/State.sol/contract.State.md), [AffiliatesEvents](/contracts/events/AffiliatesEvents.sol/contract.AffiliatesEvents.md), [ModuleCommonFunctionalities](/contracts/mixins/ModuleCommonFunctionalities.sol/contract.ModuleCommonFunctionalities.md)

Copyright 2017-2020, Sovryn, All Rights Reserved.
Licensed under the Apache License, Version 2.0.

Track referrals and reward referrers (affiliates) with tokens.
In-detail specifications are found at https://wiki.sovryn.app/en/community/Affiliates

*Module: Affiliates upgradable
Storage: from State, functions called from Protocol by delegatecall*


## Functions
### constructor

Void constructor.


```solidity
constructor() public;
```

### function

Avoid calls to this contract except for those explicitly declared.


```solidity
function() external;
```

### initialize

Set delegate callable functions by proxy contract.

*This contract is designed as a module, this way logic can be
expanded and upgraded w/o losing storage that is kept in the protocol (State.sol)
initialize() is used to register in the proxy external (module) functions
to be called via the proxy.*


```solidity
function initialize(address target) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`target`|`address`|The address of a new logic implementation.|


### onlyCallableByLoanPools

Function modifier to avoid any other calls not coming from loan pools.


```solidity
modifier onlyCallableByLoanPools();
```

### onlyCallableInternal

Function modifier to avoid any other calls not coming from within protocol functions.


```solidity
modifier onlyCallableInternal();
```

### setAffiliatesReferrer

Loan pool calls this function to tell affiliates
a user coming from a referrer is trading and should be registered if not yet.
Taking into account some user status flags may lead to the user and referrer
become added or not to the affiliates record.


```solidity
function setAffiliatesReferrer(address user, address referrer) external onlyCallableByLoanPools whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|The address of the user that is trading on loan pools.|
|`referrer`|`address`|The address of the referrer the user is coming from.|


### getReferralsList

Getter to query the referrals coming from a referrer.


```solidity
function getReferralsList(address referrer) external view returns (address[] memory refList);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`referrer`|`address`|The address of a given referrer.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`refList`|`address[]`|The referralsList mapping value by referrer.|


### getUserNotFirstTradeFlag

Getter to query the not-first-trade flag of a user.


```solidity
function getUserNotFirstTradeFlag(address user) public view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|The address of a given user.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|The userNotFirstTradeFlag mapping value by user.|


### setUserNotFirstTradeFlag

Setter to toggle on the not-first-trade flag of a user.


```solidity
function setUserNotFirstTradeFlag(address user) external onlyCallableByLoanPools whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|The address of a given user.|


### _getAffiliatesTradingFeePercentForSOV

Internal getter to query the fee share for affiliate program.

*It returns a value defined at protocol storage (State.sol)*


```solidity
function _getAffiliatesTradingFeePercentForSOV() internal view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The percentage of fee share w/ 18 decimals.|


### _getReferrerTradingFeeForToken

Internal to calculate the affiliates trading token fee amount.
Affiliates program has 2 kind of rewards:
1. x% based on the fee of the token that is traded (in form of the token itself).
2. x% based on the fee of the token that is traded (in form of SOV).
This _getReferrerTradingFeeForToken calculates the first one
by applying a custom percentage multiplier.


```solidity
function _getReferrerTradingFeeForToken(uint256 feeTokenAmount) internal view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`feeTokenAmount`|`uint256`|The trading token fee amount.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The affiliates share of the trading token fee amount.|


### getAffiliateTradingTokenFeePercent

Getter to query the fee share of trading token fee for affiliate program.

*It returns a value defined at protocol storage (State.sol)*


```solidity
function getAffiliateTradingTokenFeePercent() public view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The percentage of fee share w/ 18 decimals.|


### getMinReferralsToPayout

Getter to query referral threshold for paying out to the referrer.

*It returns a value defined at protocol storage (State.sol)*


```solidity
function getMinReferralsToPayout() public view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The minimum number of referrals set by Protocol.|


### _getSovBonusAmount

Get the sovToken reward of a trade.

*The reward is worth x% of the trading fee.*


```solidity
function _getSovBonusAmount(address feeToken, uint256 feeAmount) internal view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`feeToken`|`address`|The address of the token in which the trading/borrowing fee was paid.|
|`feeAmount`|`uint256`|The height of the fee.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The reward amount.|


### payTradingFeeToAffiliatesReferrer

Protocol calls this function to pay the affiliates rewards to a user (referrer).

*Calculate the reward amount, querying the price feed.
dest token = SOV*

*Affiliates program has 2 kind of rewards:
1. x% based on the fee of the token that is traded (in form of the token itself).
2. x% based on the fee of the token that is traded (in form of SOV).
Both are paid in this function.*

*Actually they are not paid, but just holded by protocol until user claims them by
actively calling withdrawAffiliatesReferrerTokenFees() function,
and/or when unvesting lockedSOV.*

*To be precise, what this function does is updating the registers of the rewards
for the referrer including the assignment of the SOV tokens as rewards to the
referrer's vesting contract.*


```solidity
function payTradingFeeToAffiliatesReferrer(
    address referrer,
    address trader,
    address token,
    uint256 tradingFeeTokenBaseAmount
)
    external
    onlyCallableInternal
    whenNotPaused
    returns (uint256 referrerBonusSovAmount, uint256 referrerBonusTokenAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`referrer`|`address`|The address of the referrer.|
|`trader`|`address`|The address of the trader.|
|`token`|`address`|The address of the token in which the trading/borrowing fee was paid.|
|`tradingFeeTokenBaseAmount`|`uint256`|Total trading fee amount, the base for calculating referrer's fees.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`referrerBonusSovAmount`|`uint256`|The amount of SOV tokens paid to the referrer (through a vesting contract, lockedSOV).|
|`referrerBonusTokenAmount`|`uint256`|The amount of trading tokens paid directly to the referrer.|


### withdrawAffiliatesReferrerTokenFees

Process token fee rewards first.
Then process SOV rewards.
If referrals less than minimum, temp the rewards SOV to the storage
If referrals >= minimum, directly send all of the remain rewards to locked sov
Call depositSOV() in LockedSov contract
Set the affiliaterewardsheld = 0

Referrer calls this function to receive its reward in a given token.
It will send the other (non-SOV) reward tokens from trading protocol fees,
to the referrer’s wallet.

*Rewards are held by protocol in different tokens coming from trading fees.
Referrer has to claim them one by one for every token with accumulated balance.*


```solidity
function withdrawAffiliatesReferrerTokenFees(address token, address receiver, uint256 amount) public whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|The address of the token to withdraw.|
|`receiver`|`address`|The address of the withdrawal beneficiary.|
|`amount`|`uint256`|The amount of tokens to claim. If greater than balance, just sends balance.|


### withdrawAllAffiliatesReferrerTokenFees

Withdraw to msg.sender all token fees for a referrer.

*It's done by looping through its available tokens.*


```solidity
function withdrawAllAffiliatesReferrerTokenFees(address receiver) external whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|The address of the withdrawal beneficiary.|


### _removeAffiliatesReferrerToken

Internal function to delete a referrer's token balance.


```solidity
function _removeAffiliatesReferrerToken(address referrer, address token) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`referrer`|`address`|The address of the referrer.|
|`token`|`address`|The address of the token specifying the balance to remove.|


### getAffiliatesReferrerBalances

Get all token balances of a referrer.


```solidity
function getAffiliatesReferrerBalances(address referrer)
    public
    view
    returns (address[] memory referrerTokensList, uint256[] memory referrerTokensBalances);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`referrer`|`address`|The address of the referrer.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`referrerTokensList`|`address[]`|The array of available tokens (keys).|
|`referrerTokensBalances`|`uint256[]`|The array of token balances (values).|


### getAffiliatesTokenRewardsValueInRbtc

*Get all token rewards estimation value in rbtc.*


```solidity
function getAffiliatesTokenRewardsValueInRbtc(address referrer) external view returns (uint256 rbtcTotalAmount);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`referrer`|`address`|Address of referrer.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`rbtcTotalAmount`|`uint256`|The value estimation in rbtc.|


### getAffiliatesReferrerTokensList

Get all available tokens at the affiliates program for a given referrer.


```solidity
function getAffiliatesReferrerTokensList(address referrer) public view returns (address[] memory tokensList);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`referrer`|`address`|The address of a given referrer.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`tokensList`|`address[]`|The list of available tokens.|


### getAffiliatesReferrerTokenBalance

Getter to query the affiliate balance for a given referrer and token.


```solidity
function getAffiliatesReferrerTokenBalance(address referrer, address token) public view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`referrer`|`address`|The address of the referrer.|
|`token`|`address`|The address of the token to get balance for.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The affiliatesReferrerBalances mapping value by referrer and token keys.|


### getAffiliatesUserReferrer

Getter to query the address of referrer for a given user.


```solidity
function getAffiliatesUserReferrer(address user) public view returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`user`|`address`|The address of the user.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The address on affiliatesUserReferrer mapping value by user key.|


### getAffiliateRewardsHeld

Getter to query the reward amount held for a given referrer.


```solidity
function getAffiliateRewardsHeld(address referrer) public view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`referrer`|`address`|The address of the referrer.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The affiliateRewardsHeld mapping value by referrer key.|


## Structs
### SetAffiliatesReferrerResult
Data structure comprised of 3 flags to compute the result of setting a referrer.


```solidity
struct SetAffiliatesReferrerResult {
    bool success;
    bool alreadySet;
    bool userNotFirstTradeFlag;
}
```

