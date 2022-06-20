# Affiliates contract. (Affiliates.sol)

View Source: [contracts/modules/Affiliates.sol](../contracts/modules/Affiliates.sol)

**↗ Extends: [State](State.md), [AffiliatesEvents](AffiliatesEvents.md), [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)**

**Affiliates**

Track referrals and reward referrers (affiliates) with tokens.
  In-detail specifications are found at https://wiki.sovryn.app/en/community/Affiliates

## Structs
### SetAffiliatesReferrerResult

```js
struct SetAffiliatesReferrerResult {
 bool success,
 bool alreadySet,
 bool userNotFirstTradeFlag
}
```

## Modifiers

- [onlyCallableByLoanPools](#onlycallablebyloanpools)
- [onlyCallableInternal](#onlycallableinternal)

### onlyCallableByLoanPools

Function modifier to avoid any other calls not coming from loan pools.

```js
modifier onlyCallableByLoanPools() internal
```

### onlyCallableInternal

Function modifier to avoid any other calls not coming from within protocol functions.

```js
modifier onlyCallableInternal() internal
```

## Functions

- [constructor()](#constructor)
- [constructor()](#constructor)
- [initialize(address target)](#initialize)
- [setAffiliatesReferrer(address user, address referrer)](#setaffiliatesreferrer)
- [getReferralsList(address referrer)](#getreferralslist)
- [getUserNotFirstTradeFlag(address user)](#getusernotfirsttradeflag)
- [setUserNotFirstTradeFlag(address user)](#setusernotfirsttradeflag)
- [_getAffiliatesTradingFeePercentForSOV()](#_getaffiliatestradingfeepercentforsov)
- [_getReferrerTradingFeeForToken(uint256 feeTokenAmount)](#_getreferrertradingfeefortoken)
- [getAffiliateTradingTokenFeePercent()](#getaffiliatetradingtokenfeepercent)
- [getMinReferralsToPayout()](#getminreferralstopayout)
- [_getSovBonusAmount(address feeToken, uint256 feeAmount)](#_getsovbonusamount)
- [payTradingFeeToAffiliatesReferrer(address referrer, address trader, address token, uint256 tradingFeeTokenBaseAmount)](#paytradingfeetoaffiliatesreferrer)
- [withdrawAffiliatesReferrerTokenFees(address token, address receiver, uint256 amount)](#withdrawaffiliatesreferrertokenfees)
- [withdrawAllAffiliatesReferrerTokenFees(address receiver)](#withdrawallaffiliatesreferrertokenfees)
- [_removeAffiliatesReferrerToken(address referrer, address token)](#_removeaffiliatesreferrertoken)
- [getAffiliatesReferrerBalances(address referrer)](#getaffiliatesreferrerbalances)
- [getAffiliatesTokenRewardsValueInRbtc(address referrer)](#getaffiliatestokenrewardsvalueinrbtc)
- [getAffiliatesReferrerTokensList(address referrer)](#getaffiliatesreferrertokenslist)
- [getAffiliatesReferrerTokenBalance(address referrer, address token)](#getaffiliatesreferrertokenbalance)
- [getAffiliatesUserReferrer(address user)](#getaffiliatesuserreferrer)
- [getAffiliateRewardsHeld(address referrer)](#getaffiliaterewardsheld)

---    

> ### constructor

Void constructor.

```solidity
function () public nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor() public {}
```
</details>

---    

> ### constructor

Avoid calls to this contract except for those explicitly declared.

```solidity
function () external nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function() external {
        revert("Affiliates - fallback not allowed");
    }
```
</details>

---    

> ### initialize

Set delegate callable functions by proxy contract.

```solidity
function initialize(address target) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address | The address of a new logic implementation. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function initialize(address target) external onlyOwner {
        address prevModuleContractAddress = logicTargets[this.setAffiliatesReferrer.selector];
        _setTarget(this.setAffiliatesReferrer.selector, target);
        _setTarget(this.getUserNotFirstTradeFlag.selector, target);
        _setTarget(this.getReferralsList.selector, target);
        _setTarget(this.setUserNotFirstTradeFlag.selector, target);
        _setTarget(this.payTradingFeeToAffiliatesReferrer.selector, target);
        _setTarget(this.getAffiliatesReferrerBalances.selector, target);
        _setTarget(this.getAffiliatesReferrerTokenBalance.selector, target);
        _setTarget(this.getAffiliatesReferrerTokensList.selector, target);
        _setTarget(this.withdrawAffiliatesReferrerTokenFees.selector, target);
        _setTarget(this.withdrawAllAffiliatesReferrerTokenFees.selector, target);
        _setTarget(this.getMinReferralsToPayout.selector, target);
        _setTarget(this.getAffiliatesUserReferrer.selector, target);
        _setTarget(this.getAffiliateRewardsHeld.selector, target);
        _setTarget(this.getAffiliateTradingTokenFeePercent.selector, target);
        _setTarget(this.getAffiliatesTokenRewardsValueInRbtc.selector, target);
        emit ProtocolModuleContractReplaced(prevModuleContractAddress, target, "Affiliates");
    }
```
</details>

---    

> ### setAffiliatesReferrer

Loan pool calls this function to tell affiliates
  a user coming from a referrer is trading and should be registered if not yet.
  Taking into account some user status flags may lead to the user and referrer
  become added or not to the affiliates record.
     *

```solidity
function setAffiliatesReferrer(address user, address referrer) external nonpayable onlyCallableByLoanPools whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The address of the user that is trading on loan pools. | 
| referrer | address | The address of the referrer the user is coming from. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setAffiliatesReferrer(address user, address referrer)
        external
        onlyCallableByLoanPools
        whenNotPaused
    {
        SetAffiliatesReferrerResult memory result;

        result.userNotFirstTradeFlag = getUserNotFirstTradeFlag(user);
        result.alreadySet = affiliatesUserReferrer[user] != address(0);
        result.success = !(result.userNotFirstTradeFlag || result.alreadySet || user == referrer);
        if (result.success) {
            affiliatesUserReferrer[user] = referrer;
            referralsList[referrer].add(user);
            emit SetAffiliatesReferrer(user, referrer);
        } else {
            emit SetAffiliatesReferrerFail(
                user,
                referrer,
                result.alreadySet,
                result.userNotFirstTradeFlag
            );
        }
    }
```
</details>

---    

> ### getReferralsList

Getter to query the referrals coming from a referrer.

```solidity
function getReferralsList(address referrer) external view
returns(refList address[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The address of a given referrer. | 

**Returns**

The referralsList mapping value by referrer.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getReferralsList(address referrer) external view returns (address[] memory refList) {
        refList = referralsList[referrer].enumerate();
        return refList;
    }
```
</details>

---    

> ### getUserNotFirstTradeFlag

Getter to query the not-first-trade flag of a user.

```solidity
function getUserNotFirstTradeFlag(address user) public view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The address of a given user. | 

**Returns**

The userNotFirstTradeFlag mapping value by user.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUserNotFirstTradeFlag(address user) public view returns (bool) {
        return userNotFirstTradeFlag[user];
    }
```
</details>

---    

> ### setUserNotFirstTradeFlag

Setter to toggle on the not-first-trade flag of a user.

```solidity
function setUserNotFirstTradeFlag(address user) external nonpayable onlyCallableByLoanPools whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The address of a given user. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setUserNotFirstTradeFlag(address user)
        external
        onlyCallableByLoanPools
        whenNotPaused
    {
        if (!userNotFirstTradeFlag[user]) {
            userNotFirstTradeFlag[user] = true;
            emit SetUserNotFirstTradeFlag(user);
        }
    }
```
</details>

---    

> ### _getAffiliatesTradingFeePercentForSOV

Internal getter to query the fee share for affiliate program.

```solidity
function _getAffiliatesTradingFeePercentForSOV() internal view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getAffiliatesTradingFeePercentForSOV() internal view returns (uint256) {
        return affiliateFeePercent;
    }
```
</details>

---    

> ### _getReferrerTradingFeeForToken

Internal to calculate the affiliates trading token fee amount.
  Affiliates program has 2 kind of rewards:
    1. x% based on the fee of the token that is traded (in form of the token itself).
    2. x% based on the fee of the token that is traded (in form of SOV).
  This _getReferrerTradingFeeForToken calculates the first one
  by applying a custom percentage multiplier.

```solidity
function _getReferrerTradingFeeForToken(uint256 feeTokenAmount) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| feeTokenAmount | uint256 | The trading token fee amount. | 

**Returns**

The affiliates share of the trading token fee amount.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getReferrerTradingFeeForToken(uint256 feeTokenAmount)
        internal
        view
        returns (uint256)
    {
        return feeTokenAmount.mul(getAffiliateTradingTokenFeePercent()).div(10**20);
    }
```
</details>

---    

> ### getAffiliateTradingTokenFeePercent

Getter to query the fee share of trading token fee for affiliate program.

```solidity
function getAffiliateTradingTokenFeePercent() public view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getAffiliateTradingTokenFeePercent() public view returns (uint256) {
        return affiliateTradingTokenFeePercent;
    }
```
</details>

---    

> ### getMinReferralsToPayout

Getter to query referral threshold for paying out to the referrer.

```solidity
function getMinReferralsToPayout() public view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getMinReferralsToPayout() public view returns (uint256) {
        return minReferralsToPayout;
    }
```
</details>

---    

> ### _getSovBonusAmount

Get the sovToken reward of a trade.

```solidity
function _getSovBonusAmount(address feeToken, uint256 feeAmount) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| feeToken | address | The address of the token in which the trading/borrowing fee was paid. | 
| feeAmount | uint256 | The height of the fee. | 

**Returns**

The reward amount.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getSovBonusAmount(address feeToken, uint256 feeAmount)
        internal
        view
        returns (uint256)
    {
        uint256 rewardAmount;
        address _priceFeeds = priceFeeds;

        /// @dev Calculate the reward amount, querying the price feed.
        (bool success, bytes memory data) =
            _priceFeeds.staticcall(
                abi.encodeWithSelector(
                    IPriceFeeds(_priceFeeds).queryReturn.selector,
                    feeToken,
                    sovTokenAddress, /// dest token = SOV
                    feeAmount.mul(_getAffiliatesTradingFeePercentForSOV()).div(1e20)
                )
            );
        // solhint-disable-next-line no-inline-assembly
        assembly {
            if eq(success, 1) {
                rewardAmount := mload(add(data, 32))
            }
        }

        return rewardAmount;
    }
```
</details>

---    

> ### payTradingFeeToAffiliatesReferrer

Protocol calls this function to pay the affiliates rewards to a user (referrer).
     *

```solidity
function payTradingFeeToAffiliatesReferrer(address referrer, address trader, address token, uint256 tradingFeeTokenBaseAmount) external nonpayable onlyCallableInternal whenNotPaused 
returns(referrerBonusSovAmount uint256, referrerBonusTokenAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The address of the referrer. | 
| trader | address | The address of the trader. | 
| token | address | The address of the token in which the trading/borrowing fee was paid. | 
| tradingFeeTokenBaseAmount | uint256 | Total trading fee amount, the base for calculating referrer's fees.      * | 

**Returns**

referrerBonusSovAmount The amount of SOV tokens paid to the referrer (through a vesting contract, lockedSOV).

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function payTradingFeeToAffiliatesReferrer(
        address referrer,
        address trader,
        address token,
        uint256 tradingFeeTokenBaseAmount
    )
        external
        onlyCallableInternal
        whenNotPaused
        returns (uint256 referrerBonusSovAmount, uint256 referrerBonusTokenAmount)
    {
        bool isHeld = referralsList[referrer].length() < getMinReferralsToPayout();
        bool bonusPaymentIsSuccess = true;
        uint256 paidReferrerBonusSovAmount;

        /// Process token fee rewards first.
        referrerBonusTokenAmount = _getReferrerTradingFeeForToken(tradingFeeTokenBaseAmount);
        if (!affiliatesReferrerTokensList[referrer].contains(token))
            affiliatesReferrerTokensList[referrer].add(token);
        affiliatesReferrerBalances[referrer][token] = affiliatesReferrerBalances[referrer][token]
            .add(referrerBonusTokenAmount);

        /// Then process SOV rewards.
        referrerBonusSovAmount = _getSovBonusAmount(token, tradingFeeTokenBaseAmount);
        uint256 rewardsHeldByProtocol = affiliateRewardsHeld[referrer];

        if (isHeld) {
            /// If referrals less than minimum, temp the rewards SOV to the storage
            affiliateRewardsHeld[referrer] = rewardsHeldByProtocol.add(referrerBonusSovAmount);
        } else {
            /// If referrals >= minimum, directly send all of the remain rewards to locked sov
            /// Call depositSOV() in LockedSov contract
            /// Set the affiliaterewardsheld = 0
            if (affiliateRewardsHeld[referrer] > 0) {
                affiliateRewardsHeld[referrer] = 0;
            }

            paidReferrerBonusSovAmount = referrerBonusSovAmount.add(rewardsHeldByProtocol);
            IERC20(sovTokenAddress).approve(lockedSOVAddress, paidReferrerBonusSovAmount);

            (bool success, ) =
                lockedSOVAddress.call(
                    abi.encodeWithSignature(
                        "depositSOV(address,uint256)",
                        referrer,
                        paidReferrerBonusSovAmount
                    )
                );

            if (!success) {
                bonusPaymentIsSuccess = false;
            }
        }

        if (bonusPaymentIsSuccess) {
            emit PayTradingFeeToAffiliate(
                referrer,
                trader, // trader
                token,
                isHeld,
                tradingFeeTokenBaseAmount,
                referrerBonusTokenAmount,
                referrerBonusSovAmount,
                paidReferrerBonusSovAmount
            );
        } else {
            emit PayTradingFeeToAffiliateFail(
                referrer,
                trader, // trader
                token,
                tradingFeeTokenBaseAmount,
                referrerBonusTokenAmount,
                referrerBonusSovAmount,
                paidReferrerBonusSovAmount
            );
        }

        return (referrerBonusSovAmount, referrerBonusTokenAmount);
    }
```
</details>

---    

> ### withdrawAffiliatesReferrerTokenFees

Referrer calls this function to receive its reward in a given token.
  It will send the other (non-SOV) reward tokens from trading protocol fees,
  to the referrer’s wallet.

```solidity
function withdrawAffiliatesReferrerTokenFees(address token, address receiver, uint256 amount) public nonpayable whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address | The address of the token to withdraw. | 
| receiver | address | The address of the withdrawal beneficiary. | 
| amount | uint256 | The amount of tokens to claim. If greater than balance, just sends balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction withdrawAffiliatesReferrerTokenFees(
        address token,
        address receiver,
        uint256 amount
    ) public whenNotPaused {
        require(receiver != address(0), "Affiliates: cannot withdraw to zero address");
        address referrer = msg.sender;
        uint256 referrerTokenBalance = affiliatesReferrerBalances[referrer][token];
        uint256 withdrawAmount = referrerTokenBalance > amount ? amount : referrerTokenBalance;

        require(withdrawAmount > 0, "Affiliates: cannot withdraw zero amount");

        require(
            referralsList[referrer].length() >= getMinReferralsToPayout(),
            "Your referrals has not reached the minimum request"
        );

        uint256 newReferrerTokenBalance = referrerTokenBalance.sub(withdrawAmount);

        if (newReferrerTokenBalance == 0) {
            _removeAffiliatesReferrerToken(referrer, token);
        } else {
            affiliatesReferrerBalances[referrer][token] = newReferrerTokenBalance;
        }

        IERC20(token).safeTransfer(receiver, withdrawAmount);

        emit WithdrawAffiliatesReferrerTokenFees(referrer, receiver, token, withdrawAmount);
    }

```
</details>

---    

> ### withdrawAllAffiliatesReferrerTokenFees

Withdraw to msg.sender all token fees for a referrer.

```solidity
function withdrawAllAffiliatesReferrerTokenFees(address receiver) external nonpayable whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address | The address of the withdrawal beneficiary. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction withdrawAllAffiliatesReferrerTokenFees(address receiver) external whenNotPaused {
        require(receiver != address(0), "Affiliates: cannot withdraw to zero address");
        address referrer = msg.sender;

        require(
            referralsList[referrer].length() >= getMinReferralsToPayout(),
            "Your referrals has not reached the minimum request"
        );

        (address[] memory tokenAddresses, uint256[] memory tokenBalances) =
            getAffiliatesReferrerBalances(referrer);
        for (uint256 i; i < tokenAddresses.length; i++) {
            withdrawAffiliatesReferrerTokenFees(tokenAddresses[i], receiver, tokenBalances[i]);
        }
    }

```
</details>

---    

> ### _removeAffiliatesReferrerToken

Internal function to delete a referrer's token balance.

```solidity
function _removeAffiliatesReferrerToken(address referrer, address token) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The address of the referrer. | 
| token | address | The address of the token specifying the balance to remove. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction _removeAffiliatesReferrerToken(address referrer, address token) internal {
        delete affiliatesReferrerBalances[referrer][token];
        affiliatesReferrerTokensList[referrer].remove(token);
    }

```
</details>

---    

> ### getAffiliatesReferrerBalances

Get all token balances of a referrer.

```solidity
function getAffiliatesReferrerBalances(address referrer) public view
returns(referrerTokensList address[], referrerTokensBalances uint256[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The address of the referrer. | 

**Returns**

referrerTokensList The array of available tokens (keys).

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getAffiliatesReferrerBalances(address referrer)
        public
        view
        returns (address[] memory referrerTokensList, uint256[] memory referrerTokensBalances)
    {
        referrerTokensList = getAffiliatesReferrerTokensList(referrer);
        referrerTokensBalances = new uint256[](referrerTokensList.length);
        for (uint256 i; i < referrerTokensList.length; i++) {
            referrerTokensBalances[i] = getAffiliatesReferrerTokenBalance(
                referrer,
                referrerTokensList[i]
            );
        }
        return (referrerTokensList, referrerTokensBalances);
    }

```
</details>

---    

> ### getAffiliatesTokenRewardsValueInRbtc

Get all token rewards estimation value in rbtc.
     *

```solidity
function getAffiliatesTokenRewardsValueInRbtc(address referrer) external view
returns(rbtcTotalAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | Address of referrer.      * | 

**Returns**

The value estimation in rbtc.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getAffiliatesTokenRewardsValueInRbtc(address referrer)
        external
        view
        returns (uint256 rbtcTotalAmount)
    {
        address[] memory tokensList = getAffiliatesReferrerTokensList(referrer);
        address _priceFeeds = priceFeeds;

        for (uint256 i; i < tokensList.length; i++) {
            // Get the value of each token in rbtc

            (bool success, bytes memory data) =
                _priceFeeds.staticcall(
                    abi.encodeWithSelector(
                        IPriceFeeds(_priceFeeds).queryReturn.selector,
                        tokensList[i], // source token
                        address(wrbtcToken), // dest token = SOV
                        affiliatesReferrerBalances[referrer][tokensList[i]] // total token rewards
                    )
                );

            assembly {
                if eq(success, 1) {
                    rbtcTotalAmount := add(rbtcTotalAmount, mload(add(data, 32)))
                }
            }
        }
    }

```
</details>

---    

> ### getAffiliatesReferrerTokensList

Get all available tokens at the affiliates program for a given referrer.

```solidity
function getAffiliatesReferrerTokensList(address referrer) public view
returns(tokensList address[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The address of a given referrer. | 

**Returns**

tokensList The list of available tokens.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getAffiliatesReferrerTokensList(address referrer)
        public
        view
        returns (address[] memory tokensList)
    {
        tokensList = affiliatesReferrerTokensList[referrer].enumerate();
        return tokensList;
    }

```
</details>

---    

> ### getAffiliatesReferrerTokenBalance

Getter to query the affiliate balance for a given referrer and token.

```solidity
function getAffiliatesReferrerTokenBalance(address referrer, address token) public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The address of the referrer. | 
| token | address | The address of the token to get balance for. | 

**Returns**

The affiliatesReferrerBalances mapping value by referrer and token keys.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getAffiliatesReferrerTokenBalance(address referrer, address token)
        public
        view
        returns (uint256)
    {
        return affiliatesReferrerBalances[referrer][token];
    }

```
</details>

---    

> ### getAffiliatesUserReferrer

Getter to query the address of referrer for a given user.

```solidity
function getAffiliatesUserReferrer(address user) public view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| user | address | The address of the user. | 

**Returns**

The address on affiliatesUserReferrer mapping value by user key.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getAffiliatesUserReferrer(address user) public view returns (address) {
        return affiliatesUserReferrer[user];
    }

```
</details>

---    

> ### getAffiliateRewardsHeld

Getter to query the reward amount held for a given referrer.

```solidity
function getAffiliateRewardsHeld(address referrer) public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| referrer | address | The address of the referrer. | 

**Returns**

The affiliateRewardsHeld mapping value by referrer key.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getAffiliateRewardsHeld(address referrer) public view returns (uint256) {
        return affiliateRewardsHeld[referrer];
    }
}
```
</details>

## Contracts

* [Address](Address.md)
* [Administered](Administered.md)
* [AdminRole](AdminRole.md)
* [AdvancedToken](AdvancedToken.md)
* [AdvancedTokenStorage](AdvancedTokenStorage.md)
* [Affiliates](Affiliates.md)
* [AffiliatesEvents](AffiliatesEvents.md)
* [ApprovalReceiver](ApprovalReceiver.md)
* [BProPriceFeed](BProPriceFeed.md)
* [Checkpoints](Checkpoints.md)
* [Constants](Constants.md)
* [Context](Context.md)
* [DevelopmentFund](DevelopmentFund.md)
* [DummyContract](DummyContract.md)
* [ECDSA](ECDSA.md)
* [EnumerableAddressSet](EnumerableAddressSet.md)
* [EnumerableBytes32Set](EnumerableBytes32Set.md)
* [EnumerableBytes4Set](EnumerableBytes4Set.md)
* [ERC20](ERC20.md)
* [ERC20Detailed](ERC20Detailed.md)
* [ErrorDecoder](ErrorDecoder.md)
* [Escrow](Escrow.md)
* [EscrowReward](EscrowReward.md)
* [FeedsLike](FeedsLike.md)
* [FeesEvents](FeesEvents.md)
* [FeeSharingLogic](FeeSharingLogic.md)
* [FeeSharingProxy](FeeSharingProxy.md)
* [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
* [FeesHelper](FeesHelper.md)
* [FourYearVesting](FourYearVesting.md)
* [FourYearVestingFactory](FourYearVestingFactory.md)
* [FourYearVestingLogic](FourYearVestingLogic.md)
* [FourYearVestingStorage](FourYearVestingStorage.md)
* [GenericTokenSender](GenericTokenSender.md)
* [GovernorAlpha](GovernorAlpha.md)
* [GovernorVault](GovernorVault.md)
* [IApproveAndCall](IApproveAndCall.md)
* [IChai](IChai.md)
* [IContractRegistry](IContractRegistry.md)
* [IConverterAMM](IConverterAMM.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IFeeSharingProxy](IFeeSharingProxy.md)
* [IFourYearVesting](IFourYearVesting.md)
* [IFourYearVestingFactory](IFourYearVestingFactory.md)
* [ILiquidityMining](ILiquidityMining.md)
* [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
* [ILoanPool](ILoanPool.md)
* [ILoanToken](ILoanToken.md)
* [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
* [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
* [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
* [ILoanTokenModules](ILoanTokenModules.md)
* [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
* [ILockedSOV](ILockedSOV.md)
* [IMoCState](IMoCState.md)
* [Initializable](Initializable.md)
* [InterestUser](InterestUser.md)
* [IPot](IPot.md)
* [IPriceFeeds](IPriceFeeds.md)
* [IPriceFeedsExt](IPriceFeedsExt.md)
* [IProtocol](IProtocol.md)
* [IRSKOracle](IRSKOracle.md)
* [ISovryn](ISovryn.md)
* [ISovrynSwapNetwork](ISovrynSwapNetwork.md)
* [IStaking](IStaking.md)
* [ISwapsImpl](ISwapsImpl.md)
* [ITeamVesting](ITeamVesting.md)
* [ITimelock](ITimelock.md)
* [IV1PoolOracle](IV1PoolOracle.md)
* [IVesting](IVesting.md)
* [IVestingFactory](IVestingFactory.md)
* [IVestingRegistry](IVestingRegistry.md)
* [IWrbtc](IWrbtc.md)
* [IWrbtcERC20](IWrbtcERC20.md)
* [LenderInterestStruct](LenderInterestStruct.md)
* [LiquidationHelper](LiquidationHelper.md)
* [LiquidityMining](LiquidityMining.md)
* [LiquidityMiningConfigToken](LiquidityMiningConfigToken.md)
* [LiquidityMiningProxy](LiquidityMiningProxy.md)
* [LiquidityMiningStorage](LiquidityMiningStorage.md)
* [LoanClosingsEvents](LoanClosingsEvents.md)
* [LoanClosingsLiquidation](LoanClosingsLiquidation.md)
* [LoanClosingsRollover](LoanClosingsRollover.md)
* [LoanClosingsShared](LoanClosingsShared.md)
* [LoanClosingsWith](LoanClosingsWith.md)
* [LoanInterestStruct](LoanInterestStruct.md)
* [LoanMaintenance](LoanMaintenance.md)
* [LoanMaintenanceEvents](LoanMaintenanceEvents.md)
* [LoanOpenings](LoanOpenings.md)
* [LoanOpeningsEvents](LoanOpeningsEvents.md)
* [LoanParamsStruct](LoanParamsStruct.md)
* [LoanSettings](LoanSettings.md)
* [LoanSettingsEvents](LoanSettingsEvents.md)
* [LoanStruct](LoanStruct.md)
* [LoanToken](LoanToken.md)
* [LoanTokenBase](LoanTokenBase.md)
* [LoanTokenLogicBeacon](LoanTokenLogicBeacon.md)
* [LoanTokenLogicLM](LoanTokenLogicLM.md)
* [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
* [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
* [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
* [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
* [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
* [LockedSOV](LockedSOV.md)
* [Medianizer](Medianizer.md)
* [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
* [ModulesCommonEvents](ModulesCommonEvents.md)
* [MultiSigKeyHolders](MultiSigKeyHolders.md)
* [MultiSigWallet](MultiSigWallet.md)
* [Objects](Objects.md)
* [OrderStruct](OrderStruct.md)
* [OrigingVestingCreator](OrigingVestingCreator.md)
* [OriginInvestorsClaim](OriginInvestorsClaim.md)
* [Ownable](Ownable.md)
* [Pausable](Pausable.md)
* [PausableOz](PausableOz.md)
* [PreviousLoanToken](PreviousLoanToken.md)
* [PreviousLoanTokenSettingsLowerAdmin](PreviousLoanTokenSettingsLowerAdmin.md)
* [PriceFeedRSKOracle](PriceFeedRSKOracle.md)
* [PriceFeeds](PriceFeeds.md)
* [PriceFeedsLocal](PriceFeedsLocal.md)
* [PriceFeedsMoC](PriceFeedsMoC.md)
* [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
* [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
* [ProtocolLike](ProtocolLike.md)
* [ProtocolSettings](ProtocolSettings.md)
* [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
* [ProtocolSettingsLike](ProtocolSettingsLike.md)
* [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
* [ProtocolTokenUser](ProtocolTokenUser.md)
* [Proxy](Proxy.md)
* [ReentrancyGuard](ReentrancyGuard.md)
* [RewardHelper](RewardHelper.md)
* [RSKAddrValidator](RSKAddrValidator.md)
* [SafeERC20](SafeERC20.md)
* [SafeMath](SafeMath.md)
* [SafeMath96](SafeMath96.md)
* [setGet](setGet.md)
* [SignedSafeMath](SignedSafeMath.md)
* [SOV](SOV.md)
* [sovrynProtocol](sovrynProtocol.md)
* [Staking](Staking.md)
* [StakingInterface](StakingInterface.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingStorage](StakingStorage.md)
* [State](State.md)
* [SVR](SVR.md)
* [SwapsEvents](SwapsEvents.md)
* [SwapsExternal](SwapsExternal.md)
* [SwapsImplLocal](SwapsImplLocal.md)
* [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
* [SwapsUser](SwapsUser.md)
* [TeamVesting](TeamVesting.md)
* [Timelock](Timelock.md)
* [TimelockHarness](TimelockHarness.md)
* [TimelockInterface](TimelockInterface.md)
* [TokenSender](TokenSender.md)
* [UpgradableProxy](UpgradableProxy.md)
* [USDTPriceFeed](USDTPriceFeed.md)
* [VaultController](VaultController.md)
* [Vesting](Vesting.md)
* [VestingCreator](VestingCreator.md)
* [VestingFactory](VestingFactory.md)
* [VestingLogic](VestingLogic.md)
* [VestingRegistry](VestingRegistry.md)
* [VestingRegistry2](VestingRegistry2.md)
* [VestingRegistry3](VestingRegistry3.md)
* [VestingRegistryLogic](VestingRegistryLogic.md)
* [VestingRegistryProxy](VestingRegistryProxy.md)
* [VestingRegistryStorage](VestingRegistryStorage.md)
* [VestingStorage](VestingStorage.md)
* [WeightedStaking](WeightedStaking.md)
* [WRBTC](WRBTC.md)
