# Protocol Settings contract.
 * (ProtocolSettings.sol)

View Source: [contracts/modules/ProtocolSettings.sol](../contracts/modules/ProtocolSettings.sol)

**↗ Extends: [State](State.md), [ProtocolTokenUser](ProtocolTokenUser.md), [ProtocolSettingsEvents](ProtocolSettingsEvents.md), [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)**

**ProtocolSettings**

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
 * This contract contains functions to customize protocol settings.

## Functions

- [constructor()](#constructor)
- [constructor()](#constructor)
- [initialize(address target)](#initialize)
- [setSovrynProtocolAddress(address newProtocolAddress)](#setsovrynprotocoladdress)
- [setSOVTokenAddress(address newSovTokenAddress)](#setsovtokenaddress)
- [setLockedSOVAddress(address newLockedSOVAddress)](#setlockedsovaddress)
- [setTradingRebateRewardsBasisPoint(uint256 newBasisPoint)](#settradingrebaterewardsbasispoint)
- [setMinReferralsToPayoutAffiliates(uint256 newMinReferrals)](#setminreferralstopayoutaffiliates)
- [setPriceFeedContract(address newContract)](#setpricefeedcontract)
- [setSwapsImplContract(address newContract)](#setswapsimplcontract)
- [setLoanPool(address[] pools, address[] assets)](#setloanpool)
- [setSupportedTokens(address[] addrs, bool[] toggles)](#setsupportedtokens)
- [setLendingFeePercent(uint256 newValue)](#setlendingfeepercent)
- [setTradingFeePercent(uint256 newValue)](#settradingfeepercent)
- [setBorrowingFeePercent(uint256 newValue)](#setborrowingfeepercent)
- [setSwapExternalFeePercent(uint256 newValue)](#setswapexternalfeepercent)
- [setAffiliateFeePercent(uint256 newValue)](#setaffiliatefeepercent)
- [setAffiliateTradingTokenFeePercent(uint256 newValue)](#setaffiliatetradingtokenfeepercent)
- [setLiquidationIncentivePercent(uint256 newValue)](#setliquidationincentivepercent)
- [setMaxDisagreement(uint256 newValue)](#setmaxdisagreement)
- [setSourceBuffer(uint256 newValue)](#setsourcebuffer)
- [setMaxSwapSize(uint256 newValue)](#setmaxswapsize)
- [setFeesController(address newController)](#setfeescontroller)
- [withdrawFees(address[] tokens, address receiver)](#withdrawfees)
- [withdrawLendingFees(address token, address receiver, uint256 amount)](#withdrawlendingfees)
- [withdrawTradingFees(address token, address receiver, uint256 amount)](#withdrawtradingfees)
- [withdrawBorrowingFees(address token, address receiver, uint256 amount)](#withdrawborrowingfees)
- [withdrawProtocolToken(address receiver, uint256 amount)](#withdrawprotocoltoken)
- [depositProtocolToken(uint256 amount)](#depositprotocoltoken)
- [getLoanPoolsList(uint256 start, uint256 count)](#getloanpoolslist)
- [isLoanPool(address loanPool)](#isloanpool)
- [setSovrynSwapContractRegistryAddress(address registryAddress)](#setsovrynswapcontractregistryaddress)
- [setWrbtcToken(address wrbtcTokenAddress)](#setwrbtctoken)
- [setProtocolTokenAddress(address _protocolTokenAddress)](#setprotocoltokenaddress)
- [setRolloverBaseReward(uint256 baseRewardValue)](#setrolloverbasereward)
- [setRebatePercent(uint256 rebatePercent)](#setrebatepercent)
- [setSpecialRebates(address sourceToken, address destToken, uint256 specialRebatesPercent)](#setspecialrebates)
- [getSpecialRebates(address sourceTokenAddress, address destTokenAddress)](#getspecialrebates)
- [getProtocolAddress()](#getprotocoladdress)
- [getSovTokenAddress()](#getsovtokenaddress)
- [getLockedSOVAddress()](#getlockedsovaddress)
- [getFeeRebatePercent()](#getfeerebatepercent)
- [togglePaused(bool paused)](#togglepaused)
- [isProtocolPaused()](#isprotocolpaused)
- [getSwapExternalFeePercent()](#getswapexternalfeepercent)
- [getTradingRebateRewardsBasisPoint()](#gettradingrebaterewardsbasispoint)
- [getDedicatedSOVRebate()](#getdedicatedsovrebate)
- [setRolloverFlexFeePercent(uint256 newRolloverFlexFeePercent)](#setrolloverflexfeepercent)

---    

> ### constructor

Empty public constructor.

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

Fallback function is to react to receiving value (rBTC).

```solidity
function () external nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function() external {
        revert("fallback not allowed");
    }
```
</details>

---    

> ### initialize

Set function selectors on target contract.
     *

```solidity
function initialize(address target) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| target | address | The address of the target contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function initialize(address target) external onlyOwner {
        address prevModuleContractAddress = logicTargets[this.setPriceFeedContract.selector];
        _setTarget(this.setPriceFeedContract.selector, target);
        _setTarget(this.setSwapsImplContract.selector, target);
        _setTarget(this.setLoanPool.selector, target);
        _setTarget(this.setSupportedTokens.selector, target);
        _setTarget(this.setLendingFeePercent.selector, target);
        _setTarget(this.setTradingFeePercent.selector, target);
        _setTarget(this.setBorrowingFeePercent.selector, target);
        _setTarget(this.setSwapExternalFeePercent.selector, target);
        _setTarget(this.setAffiliateFeePercent.selector, target);
        _setTarget(this.setAffiliateTradingTokenFeePercent.selector, target);
        _setTarget(this.setLiquidationIncentivePercent.selector, target);
        _setTarget(this.setMaxDisagreement.selector, target);
        _setTarget(this.setSourceBuffer.selector, target);
        _setTarget(this.setMaxSwapSize.selector, target);
        _setTarget(this.setFeesController.selector, target);
        _setTarget(this.withdrawFees.selector, target);
        _setTarget(this.withdrawLendingFees.selector, target);
        _setTarget(this.withdrawTradingFees.selector, target);
        _setTarget(this.withdrawBorrowingFees.selector, target);
        _setTarget(this.withdrawProtocolToken.selector, target);
        _setTarget(this.depositProtocolToken.selector, target);
        _setTarget(this.getLoanPoolsList.selector, target);
        _setTarget(this.isLoanPool.selector, target);
        _setTarget(this.setSovrynSwapContractRegistryAddress.selector, target);
        _setTarget(this.setWrbtcToken.selector, target);
        _setTarget(this.setProtocolTokenAddress.selector, target);
        _setTarget(this.setRolloverBaseReward.selector, target);
        _setTarget(this.setRebatePercent.selector, target);
        _setTarget(this.setSpecialRebates.selector, target);
        _setTarget(this.setSovrynProtocolAddress.selector, target);
        _setTarget(this.setSOVTokenAddress.selector, target);
        _setTarget(this.setLockedSOVAddress.selector, target);
        _setTarget(this.setMinReferralsToPayoutAffiliates.selector, target);
        _setTarget(this.getSpecialRebates.selector, target);
        _setTarget(this.getProtocolAddress.selector, target);
        _setTarget(this.getSovTokenAddress.selector, target);
        _setTarget(this.getLockedSOVAddress.selector, target);
        _setTarget(this.getFeeRebatePercent.selector, target);
        _setTarget(this.togglePaused.selector, target);
        _setTarget(this.isProtocolPaused.selector, target);
        _setTarget(this.getSwapExternalFeePercent.selector, target);
        _setTarget(this.setTradingRebateRewardsBasisPoint.selector, target);
        _setTarget(this.getTradingRebateRewardsBasisPoint.selector, target);
        _setTarget(this.getDedicatedSOVRebate.selector, target);
        _setTarget(this.setRolloverFlexFeePercent.selector, target);
        emit ProtocolModuleContractReplaced(prevModuleContractAddress, target, "ProtocolSettings");
    }
```
</details>

---    

> ### setSovrynProtocolAddress

```solidity
function setSovrynProtocolAddress(address newProtocolAddress) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newProtocolAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSovrynProtocolAddress(address newProtocolAddress)
        external
        onlyOwner
        whenNotPaused
    {
        address oldProtocolAddress = protocolAddress;
        protocolAddress = newProtocolAddress;

        emit SetProtocolAddress(msg.sender, oldProtocolAddress, newProtocolAddress);
    }
```
</details>

---    

> ### setSOVTokenAddress

```solidity
function setSOVTokenAddress(address newSovTokenAddress) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newSovTokenAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSOVTokenAddress(address newSovTokenAddress) external onlyOwner whenNotPaused {
        require(Address.isContract(newSovTokenAddress), "newSovTokenAddress not a contract");

        address oldTokenAddress = sovTokenAddress;
        sovTokenAddress = newSovTokenAddress;

        emit SetSOVTokenAddress(msg.sender, oldTokenAddress, newSovTokenAddress);
    }
```
</details>

---    

> ### setLockedSOVAddress

```solidity
function setLockedSOVAddress(address newLockedSOVAddress) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newLockedSOVAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setLockedSOVAddress(address newLockedSOVAddress) external onlyOwner whenNotPaused {
        require(Address.isContract(newLockedSOVAddress), "newLockSOVAddress not a contract");

        address oldLockedSOVAddress = lockedSOVAddress;
        lockedSOVAddress = newLockedSOVAddress;

        emit SetLockedSOVAddress(msg.sender, oldLockedSOVAddress, newLockedSOVAddress);
    }
```
</details>

---    

> ### setTradingRebateRewardsBasisPoint

Set the basis point of trading rebate rewards (SOV), max value is 9999 (99.99% liquid, 0.01% vested).
     *

```solidity
function setTradingRebateRewardsBasisPoint(uint256 newBasisPoint) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newBasisPoint | uint256 | Basis point value. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setTradingRebateRewardsBasisPoint(uint256 newBasisPoint)
        external
        onlyOwner
        whenNotPaused
    {
        require(newBasisPoint <= 9999, "value too high");

        uint256 oldBasisPoint = tradingRebateRewardsBasisPoint;
        tradingRebateRewardsBasisPoint = newBasisPoint;

        emit SetTradingRebateRewardsBasisPoint(msg.sender, oldBasisPoint, newBasisPoint);
    }
```
</details>

---    

> ### setMinReferralsToPayoutAffiliates

Update the minimum number of referrals to get affiliates rewards.
     *

```solidity
function setMinReferralsToPayoutAffiliates(uint256 newMinReferrals) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newMinReferrals | uint256 | The new minimum number of referrals. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setMinReferralsToPayoutAffiliates(uint256 newMinReferrals)
        external
        onlyOwner
        whenNotPaused
    {
        uint256 oldMinReferrals = minReferralsToPayout;
        minReferralsToPayout = newMinReferrals;

        emit SetMinReferralsToPayoutAffiliates(msg.sender, oldMinReferrals, newMinReferrals);
    }
```
</details>

---    

> ### setPriceFeedContract

Set the address of the Price Feed instance.
     *

```solidity
function setPriceFeedContract(address newContract) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newContract | address | The address of the Price Feed new instance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setPriceFeedContract(address newContract) external onlyOwner whenNotPaused {
        address oldContract = priceFeeds;
        priceFeeds = newContract;

        emit SetPriceFeedContract(msg.sender, oldContract, newContract);
    }
```
</details>

---    

> ### setSwapsImplContract

Set the address of the asset swapper instance.
     *

```solidity
function setSwapsImplContract(address newContract) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newContract | address | The address of the asset swapper new instance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSwapsImplContract(address newContract) external onlyOwner whenNotPaused {
        address oldContract = swapsImpl;
        swapsImpl = newContract;

        emit SetSwapsImplContract(msg.sender, oldContract, newContract);
    }
```
</details>

---    

> ### setLoanPool

Set a list of loan pools and its tokens.
     *

```solidity
function setLoanPool(address[] pools, address[] assets) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| pools | address[] | The array of addresses of new loan pool instances. | 
| assets | address[] | The array of addresses of the corresponding underlying tokens. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setLoanPool(address[] calldata pools, address[] calldata assets)
        external
        onlyOwner
        whenNotPaused
    {
        require(pools.length == assets.length, "count mismatch");

        for (uint256 i = 0; i < pools.length; i++) {
            require(pools[i] != assets[i], "pool == asset");
            require(pools[i] != address(0), "pool == 0");
            require(
                assets[i] != address(0) || loanPoolToUnderlying[pools[i]] != address(0),
                "pool not exists"
            );
            if (assets[i] == address(0)) {
                underlyingToLoanPool[loanPoolToUnderlying[pools[i]]] = address(0);
                loanPoolToUnderlying[pools[i]] = address(0);
                loanPoolsSet.removeAddress(pools[i]);
            } else {
                loanPoolToUnderlying[pools[i]] = assets[i];
                underlyingToLoanPool[assets[i]] = pools[i];
                loanPoolsSet.addAddress(pools[i]);
            }

            emit SetLoanPool(msg.sender, pools[i], assets[i]);
        }
    }
```
</details>

---    

> ### setSupportedTokens

Set a list of supported tokens by populating the
  storage supportedTokens mapping.
     *

```solidity
function setSupportedTokens(address[] addrs, bool[] toggles) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| addrs | address[] | The array of addresses of the tokens. | 
| toggles | bool[] | The array of flags indicating whether   the corresponding token is supported or not. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSupportedTokens(address[] calldata addrs, bool[] calldata toggles)
        external
        onlyOwner
        whenNotPaused
    {
        require(addrs.length == toggles.length, "count mismatch");

        for (uint256 i = 0; i < addrs.length; i++) {
            supportedTokens[addrs[i]] = toggles[i];

            emit SetSupportedTokens(msg.sender, addrs[i], toggles[i]);
        }
    }
```
</details>

---    

> ### setLendingFeePercent

Set the value of lendingFeePercent storage variable.
     *

```solidity
function setLendingFeePercent(uint256 newValue) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 | The new value for lendingFeePercent. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setLendingFeePercent(uint256 newValue) external onlyOwner whenNotPaused {
        require(newValue <= 10**20, "value too high");
        uint256 oldValue = lendingFeePercent;
        lendingFeePercent = newValue;

        emit SetLendingFeePercent(msg.sender, oldValue, newValue);
    }
```
</details>

---    

> ### setTradingFeePercent

Set the value of tradingFeePercent storage variable.
     *

```solidity
function setTradingFeePercent(uint256 newValue) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 | The new value for tradingFeePercent. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setTradingFeePercent(uint256 newValue) external onlyOwner whenNotPaused {
        require(newValue <= 10**20, "value too high");
        uint256 oldValue = tradingFeePercent;
        tradingFeePercent = newValue;

        emit SetTradingFeePercent(msg.sender, oldValue, newValue);
    }
```
</details>

---    

> ### setBorrowingFeePercent

Set the value of borrowingFeePercent storage variable.
     *

```solidity
function setBorrowingFeePercent(uint256 newValue) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 | The new value for borrowingFeePercent. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setBorrowingFeePercent(uint256 newValue) external onlyOwner whenNotPaused {
        require(newValue <= 10**20, "value too high");
        uint256 oldValue = borrowingFeePercent;
        borrowingFeePercent = newValue;

        emit SetBorrowingFeePercent(msg.sender, oldValue, newValue);
    }
```
</details>

---    

> ### setSwapExternalFeePercent

Set the value of swapExtrernalFeePercent storage variable
     *

```solidity
function setSwapExternalFeePercent(uint256 newValue) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 | the new value for swapExternalFeePercent | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSwapExternalFeePercent(uint256 newValue) external onlyOwner whenNotPaused {
        require(newValue <= 10**20, "value too high");
        uint256 oldValue = swapExtrernalFeePercent;
        swapExtrernalFeePercent = newValue;

        emit SetSwapExternalFeePercent(msg.sender, oldValue, newValue);
    }
```
</details>

---    

> ### setAffiliateFeePercent

Set the value of affiliateFeePercent storage variable.
     *

```solidity
function setAffiliateFeePercent(uint256 newValue) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 | The new value for affiliateFeePercent. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setAffiliateFeePercent(uint256 newValue) external onlyOwner whenNotPaused {
        require(newValue <= 10**20, "value too high");
        uint256 oldValue = affiliateFeePercent;
        affiliateFeePercent = newValue;

        emit SetAffiliateFeePercent(msg.sender, oldValue, newValue);
    }
```
</details>

---    

> ### setAffiliateTradingTokenFeePercent

Set the value of affiliateTradingTokenFeePercent storage variable.
     *

```solidity
function setAffiliateTradingTokenFeePercent(uint256 newValue) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 | The new value for affiliateTradingTokenFeePercent. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setAffiliateTradingTokenFeePercent(uint256 newValue)
        external
        onlyOwner
        whenNotPaused
    {
        require(newValue <= 10**20, "value too high");
        uint256 oldValue = affiliateTradingTokenFeePercent;
        affiliateTradingTokenFeePercent = newValue;

        emit SetAffiliateTradingTokenFeePercent(msg.sender, oldValue, newValue);
    }
```
</details>

---    

> ### setLiquidationIncentivePercent

Set the value of liquidationIncentivePercent storage variable.
     *

```solidity
function setLiquidationIncentivePercent(uint256 newValue) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 | The new value for liquidationIncentivePercent. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setLiquidationIncentivePercent(uint256 newValue) external onlyOwner whenNotPaused {
        require(newValue <= 10**20, "value too high");
        uint256 oldValue = liquidationIncentivePercent;
        liquidationIncentivePercent = newValue;

        emit SetLiquidationIncentivePercent(msg.sender, oldValue, newValue);
    }
```
</details>

---    

> ### setMaxDisagreement

Set the value of the maximum swap spread.
     *

```solidity
function setMaxDisagreement(uint256 newValue) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 | The new value for maxDisagreement. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setMaxDisagreement(uint256 newValue) external onlyOwner whenNotPaused {
        maxDisagreement = newValue;
    }
```
</details>

---    

> ### setSourceBuffer

Set the value of the maximum source buffer.
     *

```solidity
function setSourceBuffer(uint256 newValue) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 | The new value for the maximum source buffer. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSourceBuffer(uint256 newValue) external onlyOwner whenNotPaused {
        sourceBuffer = newValue;
    }
```
</details>

---    

> ### setMaxSwapSize

Set the value of the swap size limit.
     *

```solidity
function setMaxSwapSize(uint256 newValue) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newValue | uint256 | The new value for the maximum swap size. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setMaxSwapSize(uint256 newValue) external onlyOwner whenNotPaused {
        uint256 oldValue = maxSwapSize;
        maxSwapSize = newValue;

        emit SetMaxSwapSize(msg.sender, oldValue, newValue);
    }
```
</details>

---    

> ### setFeesController

Set the address of the feesController instance.
     *

```solidity
function setFeesController(address newController) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newController | address | The new address of the feesController. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setFeesController(address newController) external onlyOwner whenNotPaused {
        address oldController = feesController;
        feesController = newController;

        emit SetFeesController(msg.sender, oldController, newController);
    }
```
</details>

---    

> ### withdrawFees

The feesController calls this function to withdraw fees
from three sources: lending, trading and borrowing.
The fees (except SOV) will be converted to wRBTC.
For SOV, it will be deposited directly to feeSharingProxy from the protocol.
     *

```solidity
function withdrawFees(address[] tokens, address receiver) external nonpayable whenNotPaused 
returns(totalWRBTCWithdrawn uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| tokens | address[] | The array of address of the token instance. | 
| receiver | address | The address of the withdrawal recipient.      * | 

**Returns**

The withdrawn total amount in wRBTC

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawFees(address[] calldata tokens, address receiver)
        external
        whenNotPaused
        returns (uint256 totalWRBTCWithdrawn)
    {
        require(msg.sender == feesController, "unauthorized");

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 lendingBalance = lendingFeeTokensHeld[tokens[i]];
            if (lendingBalance > 0) {
                lendingFeeTokensHeld[tokens[i]] = 0;
                lendingFeeTokensPaid[tokens[i]] = lendingFeeTokensPaid[tokens[i]].add(
                    lendingBalance
                );
            }

            uint256 tradingBalance = tradingFeeTokensHeld[tokens[i]];
            if (tradingBalance > 0) {
                tradingFeeTokensHeld[tokens[i]] = 0;
                tradingFeeTokensPaid[tokens[i]] = tradingFeeTokensPaid[tokens[i]].add(
                    tradingBalance
                );
            }

            uint256 borrowingBalance = borrowingFeeTokensHeld[tokens[i]];
            if (borrowingBalance > 0) {
                borrowingFeeTokensHeld[tokens[i]] = 0;
                borrowingFeeTokensPaid[tokens[i]] = borrowingFeeTokensPaid[tokens[i]].add(
                    borrowingBalance
                );
            }

            uint256 tempAmount = lendingBalance.add(tradingBalance).add(borrowingBalance);

            if (tempAmount == 0) {
                continue;
            }

            uint256 amountConvertedToWRBTC;
            if (tokens[i] == address(sovTokenAddress)) {
                IERC20(tokens[i]).approve(feesController, tempAmount);
                IFeeSharingProxy(feesController).transferTokens(
                    address(sovTokenAddress),
                    uint96(tempAmount)
                );
                amountConvertedToWRBTC = 0;
            } else {
                if (tokens[i] == address(wrbtcToken)) {
                    amountConvertedToWRBTC = tempAmount;

                    IERC20(address(wrbtcToken)).safeTransfer(receiver, amountConvertedToWRBTC);
                } else {
                    IERC20(tokens[i]).approve(protocolAddress, tempAmount);

                    (amountConvertedToWRBTC, ) = ProtocolSwapExternalInterface(protocolAddress)
                        .swapExternal(
                        tokens[i], // source token address
                        address(wrbtcToken), // dest token address
                        feesController, // set feeSharingProxy as receiver
                        protocolAddress, // protocol as the sender
                        tempAmount, // source token amount
                        0, // reqDestToken
                        0, // minReturn
                        "" // loan data bytes
                    );

                    /// Will revert if disagreement found.
                    IPriceFeeds(priceFeeds).checkPriceDisagreement(
                        tokens[i],
                        address(wrbtcToken),
                        tempAmount,
                        amountConvertedToWRBTC,
                        maxDisagreement
                    );
                }

                totalWRBTCWithdrawn = totalWRBTCWithdrawn.add(amountConvertedToWRBTC);
            }

            emit WithdrawFees(
                msg.sender,
                tokens[i],
                receiver,
                lendingBalance,
                tradingBalance,
                borrowingBalance,
                amountConvertedToWRBTC
            );
        }

        return totalWRBTCWithdrawn;
    }
```
</details>

---    

> ### withdrawLendingFees

The feesController calls this function to withdraw fees
accrued from lending operations.
     *

```solidity
function withdrawLendingFees(address token, address receiver, uint256 amount) external nonpayable whenNotPaused 
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address | The address of the token instance. | 
| receiver | address | The address of the withdrawal recipient. | 
| amount | uint256 | The amount of fees to get, ignored if greater than balance.      * | 

**Returns**

Whether withdrawal was successful.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawLendingFees(
        address token,
        address receiver,
        uint256 amount
    ) external whenNotPaused returns (bool) {
        require(msg.sender == feesController, "unauthorized");

        uint256 withdrawAmount = amount;

        uint256 balance = lendingFeeTokensHeld[token];
        if (withdrawAmount > balance) {
            withdrawAmount = balance;
        }
        if (withdrawAmount == 0) {
            return false;
        }

        lendingFeeTokensHeld[token] = balance.sub(withdrawAmount);
        lendingFeeTokensPaid[token] = lendingFeeTokensPaid[token].add(withdrawAmount);

        IERC20(token).safeTransfer(receiver, withdrawAmount);

        emit WithdrawLendingFees(msg.sender, token, receiver, withdrawAmount);

        return true;
    }
```
</details>

---    

> ### withdrawTradingFees

The feesController calls this function to withdraw fees
accrued from trading operations.
     *

```solidity
function withdrawTradingFees(address token, address receiver, uint256 amount) external nonpayable whenNotPaused 
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address | The address of the token instance. | 
| receiver | address | The address of the withdrawal recipient. | 
| amount | uint256 | The amount of fees to get, ignored if greater than balance.      * | 

**Returns**

Whether withdrawal was successful.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawTradingFees(
        address token,
        address receiver,
        uint256 amount
    ) external whenNotPaused returns (bool) {
        require(msg.sender == feesController, "unauthorized");

        uint256 withdrawAmount = amount;

        uint256 balance = tradingFeeTokensHeld[token];
        if (withdrawAmount > balance) {
            withdrawAmount = balance;
        }
        if (withdrawAmount == 0) {
            return false;
        }

        tradingFeeTokensHeld[token] = balance.sub(withdrawAmount);
        tradingFeeTokensPaid[token] = tradingFeeTokensPaid[token].add(withdrawAmount);

        IERC20(token).safeTransfer(receiver, withdrawAmount);

        emit WithdrawTradingFees(msg.sender, token, receiver, withdrawAmount);

        return true;
    }
```
</details>

---    

> ### withdrawBorrowingFees

The feesController calls this function to withdraw fees
accrued from borrowing operations.
     *

```solidity
function withdrawBorrowingFees(address token, address receiver, uint256 amount) external nonpayable whenNotPaused 
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| token | address | The address of the token instance. | 
| receiver | address | The address of the withdrawal recipient. | 
| amount | uint256 | The amount of fees to get, ignored if greater than balance.      * | 

**Returns**

Whether withdrawal was successful.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawBorrowingFees(
        address token,
        address receiver,
        uint256 amount
    ) external whenNotPaused returns (bool) {
        require(msg.sender == feesController, "unauthorized");

        uint256 withdrawAmount = amount;

        uint256 balance = borrowingFeeTokensHeld[token];
        if (withdrawAmount > balance) {
            withdrawAmount = balance;
        }
        if (withdrawAmount == 0) {
            return false;
        }

        borrowingFeeTokensHeld[token] = balance.sub(withdrawAmount);
        borrowingFeeTokensPaid[token] = borrowingFeeTokensPaid[token].add(withdrawAmount);

        IERC20(token).safeTransfer(receiver, withdrawAmount);

        emit WithdrawBorrowingFees(msg.sender, token, receiver, withdrawAmount);

        return true;
    }
```
</details>

---    

> ### withdrawProtocolToken

The owner calls this function to withdraw protocol tokens.
     *

```solidity
function withdrawProtocolToken(address receiver, uint256 amount) external nonpayable onlyOwner whenNotPaused 
returns(address, bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address | The address of the withdrawal recipient. | 
| amount | uint256 | The amount of tokens to get.      * | 

**Returns**

The protocol token address.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawProtocolToken(address receiver, uint256 amount)
        external
        onlyOwner
        whenNotPaused
        returns (address, bool)
    {
        return _withdrawProtocolToken(receiver, amount);
    }
```
</details>

---    

> ### depositProtocolToken

The owner calls this function to deposit protocol tokens.
     *

```solidity
function depositProtocolToken(uint256 amount) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint256 | The tokens of fees to send. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function depositProtocolToken(uint256 amount) external onlyOwner whenNotPaused {
        /// @dev Update local balance
        protocolTokenHeld = protocolTokenHeld.add(amount);

        /// @dev Send the tokens
        IERC20(protocolTokenAddress).safeTransferFrom(msg.sender, address(this), amount);
    }
```
</details>

---    

> ### getLoanPoolsList

Get a list of loan pools.
     *

```solidity
function getLoanPoolsList(uint256 start, uint256 count) external view
returns(bytes32[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| start | uint256 | The offset. | 
| count | uint256 | The limit.      * | 

**Returns**

The array of loan pools.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLoanPoolsList(uint256 start, uint256 count)
        external
        view
        returns (bytes32[] memory)
    {
        return loanPoolsSet.enumerate(start, count);
    }
```
</details>

---    

> ### isLoanPool

Check whether a token is a pool token.
     *

```solidity
function isLoanPool(address loanPool) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| loanPool | address | The token address to check. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function isLoanPool(address loanPool) external view returns (bool) {
        return loanPoolToUnderlying[loanPool] != address(0);
    }
```
</details>

---    

> ### setSovrynSwapContractRegistryAddress

Set the contract registry address of the SovrynSwap network.
     *

```solidity
function setSovrynSwapContractRegistryAddress(address registryAddress) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| registryAddress | address | the address of the registry contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSovrynSwapContractRegistryAddress(address registryAddress)
        external
        onlyOwner
        whenNotPaused
    {
        require(Address.isContract(registryAddress), "registryAddress not a contract");

        address oldSovrynSwapContractRegistryAddress = sovrynSwapContractRegistryAddress;
        sovrynSwapContractRegistryAddress = registryAddress;

        emit SetSovrynSwapContractRegistryAddress(
            msg.sender,
            oldSovrynSwapContractRegistryAddress,
            sovrynSwapContractRegistryAddress
        );
    }
```
</details>

---    

> ### setWrbtcToken

Set the wrBTC contract address.
     *

```solidity
function setWrbtcToken(address wrbtcTokenAddress) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| wrbtcTokenAddress | address | The address of the wrBTC contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setWrbtcToken(address wrbtcTokenAddress) external onlyOwner whenNotPaused {
        require(Address.isContract(wrbtcTokenAddress), "wrbtcTokenAddress not a contract");

        address oldwrbtcToken = address(wrbtcToken);
        wrbtcToken = IWrbtcERC20(wrbtcTokenAddress);

        emit SetWrbtcToken(msg.sender, oldwrbtcToken, wrbtcTokenAddress);
    }
```
</details>

---    

> ### setProtocolTokenAddress

Set the protocol token contract address.
     *

```solidity
function setProtocolTokenAddress(address _protocolTokenAddress) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _protocolTokenAddress | address | The address of the protocol token contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setProtocolTokenAddress(address _protocolTokenAddress)
        external
        onlyOwner
        whenNotPaused
    {
        require(Address.isContract(_protocolTokenAddress), "_protocolTokenAddress not a contract");

        address oldProtocolTokenAddress = protocolTokenAddress;
        protocolTokenAddress = _protocolTokenAddress;

        emit SetProtocolTokenAddress(msg.sender, oldProtocolTokenAddress, _protocolTokenAddress);
    }
```
</details>

---    

> ### setRolloverBaseReward

Set rollover base reward. It should be denominated in wrBTC.
     *

```solidity
function setRolloverBaseReward(uint256 baseRewardValue) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| baseRewardValue | uint256 | The base reward. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setRolloverBaseReward(uint256 baseRewardValue) external onlyOwner whenNotPaused {
        require(baseRewardValue > 0, "Base reward is zero");

        uint256 oldValue = rolloverBaseReward;
        rolloverBaseReward = baseRewardValue;

        emit SetRolloverBaseReward(msg.sender, oldValue, rolloverBaseReward);
    }
```
</details>

---    

> ### setRebatePercent

Set the fee rebate percent.
     *

```solidity
function setRebatePercent(uint256 rebatePercent) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| rebatePercent | uint256 | The fee rebate percent. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setRebatePercent(uint256 rebatePercent) external onlyOwner whenNotPaused {
        require(rebatePercent <= 10**20, "Fee rebate is too high");

        uint256 oldRebatePercent = feeRebatePercent;
        feeRebatePercent = rebatePercent;

        emit SetRebatePercent(msg.sender, oldRebatePercent, rebatePercent);
    }
```
</details>

---    

> ### setSpecialRebates

Set the special fee rebate percent for specific pair
     *

```solidity
function setSpecialRebates(address sourceToken, address destToken, uint256 specialRebatesPercent) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceToken | address |  | 
| destToken | address |  | 
| specialRebatesPercent | uint256 | The new special fee rebate percent. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setSpecialRebates(
        address sourceToken,
        address destToken,
        uint256 specialRebatesPercent
    ) external onlyOwner whenNotPaused {
        // Set max special rebates to 1000%
        require(specialRebatesPercent <= 1000e18, "Special fee rebate is too high");

        uint256 oldSpecialRebatesPercent = specialRebates[sourceToken][destToken];
        specialRebates[sourceToken][destToken] = specialRebatesPercent;

        emit SetSpecialRebates(
            msg.sender,
            sourceToken,
            destToken,
            oldSpecialRebatesPercent,
            specialRebatesPercent
        );
    }
```
</details>

---    

> ### getSpecialRebates

Get a rebate percent of specific pairs.
     *

```solidity
function getSpecialRebates(address sourceTokenAddress, address destTokenAddress) external view
returns(specialRebatesPercent uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sourceTokenAddress | address | The source of pairs. | 
| destTokenAddress | address | The dest of pairs.      * | 

**Returns**

The percent rebates of the pairs.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getSpecialRebates(address sourceTokenAddress, address destTokenAddress)
        external
        view
        returns (uint256 specialRebatesPercent)
    {
        return specialRebates[sourceTokenAddress][destTokenAddress];
    }
```
</details>

---    

> ### getProtocolAddress

```solidity
function getProtocolAddress() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getProtocolAddress() external view returns (address) {
        return protocolAddress;
    }
```
</details>

---    

> ### getSovTokenAddress

```solidity
function getSovTokenAddress() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getSovTokenAddress() external view returns (address) {
        return sovTokenAddress;
    }
```
</details>

---    

> ### getLockedSOVAddress

```solidity
function getLockedSOVAddress() external view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLockedSOVAddress() external view returns (address) {
        return lockedSOVAddress;
    }
```
</details>

---    

> ### getFeeRebatePercent

```solidity
function getFeeRebatePercent() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getFeeRebatePercent() external view returns (uint256) {
        return feeRebatePercent;
    }
```
</details>

---    

> ### togglePaused

```solidity
function togglePaused(bool paused) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| paused | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function togglePaused(bool paused) external onlyOwner {
        require(paused != pause, "Can't toggle");
        pause = paused;
        emit TogglePaused(msg.sender, !paused, paused);
    }
```
</details>

---    

> ### isProtocolPaused

```solidity
function isProtocolPaused() external view
returns(bool)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function isProtocolPaused() external view returns (bool) {
        return pause;
    }
```
</details>

---    

> ### getSwapExternalFeePercent

```solidity
function getSwapExternalFeePercent() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getSwapExternalFeePercent() external view returns (uint256) {
        return swapExtrernalFeePercent;
    }
```
</details>

---    

> ### getTradingRebateRewardsBasisPoint

Get the basis point of trading rebate rewards.
     *

```solidity
function getTradingRebateRewardsBasisPoint() external view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getTradingRebateRewardsBasisPoint() external view returns (uint256) {
        return tradingRebateRewardsBasisPoint;
    }
```
</details>

---    

> ### getDedicatedSOVRebate

If SOV balance is less than the fees held, it will return 0.
     *

```solidity
function getDedicatedSOVRebate() public view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getDedicatedSOVRebate() public view returns (uint256) {
        uint256 sovProtocolBalance = IERC20(sovTokenAddress).balanceOf(address(this));
        uint256 sovFees =
            lendingFeeTokensHeld[sovTokenAddress].add(tradingFeeTokensHeld[sovTokenAddress]).add(
                borrowingFeeTokensHeld[sovTokenAddress]
            );

        return sovProtocolBalance >= sovFees ? sovProtocolBalance.sub(sovFees) : 0;
    }
```
</details>

---    

> ### setRolloverFlexFeePercent

Set rolloverFlexFeePercent (max value is 1%)
     *

```solidity
function setRolloverFlexFeePercent(uint256 newRolloverFlexFeePercent) external nonpayable onlyOwner whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| newRolloverFlexFeePercent | uint256 | uint256 value of new rollover flex fee percentage (0.1 ether = 0.1%) | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setRolloverFlexFeePercent(uint256 newRolloverFlexFeePercent)
        external
        onlyOwner
        whenNotPaused
    {
        require(newRolloverFlexFeePercent <= 1e18, "value too high");
        uint256 oldRolloverFlexFeePercent = rolloverFlexFeePercent;
        rolloverFlexFeePercent = newRolloverFlexFeePercent;

        emit SetRolloverFlexFeePercent(
            msg.sender,
            oldRolloverFlexFeePercent,
            newRolloverFlexFeePercent
        );
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
