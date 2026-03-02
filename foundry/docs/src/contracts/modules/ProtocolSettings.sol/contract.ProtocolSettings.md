# ProtocolSettings
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/modules/ProtocolSettings.sol)

**Inherits:**
[State](/contracts/core/State.sol/contract.State.md), [ProtocolTokenUser](/contracts/mixins/ProtocolTokenUser.sol/contract.ProtocolTokenUser.md), [ProtocolSettingsEvents](/contracts/events/ProtocolSettingsEvents.sol/contract.ProtocolSettingsEvents.md), [ModuleCommonFunctionalities](/contracts/mixins/ModuleCommonFunctionalities.sol/contract.ModuleCommonFunctionalities.md)

Copyright 2017-2020, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized
margin trading and lending https://bzx.network similar to the dYdX protocol.
This contract contains functions to customize protocol settings.


## Functions
### constructor

Empty public constructor.


```solidity
constructor() public;
```

### function

Fallback function is to react to receiving value (rBTC).


```solidity
function() external;
```

### initialize

Set function selectors on target contract.


```solidity
function initialize(address target) external onlyAdminOrOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`target`|`address`|The address of the target contract.|


### setSovrynProtocolAddress

setting wrong address will break inter module functions calling
should be set once


```solidity
function setSovrynProtocolAddress(address newProtocolAddress) external onlyAdminOrOwner whenNotPaused;
```

### setSOVTokenAddress


```solidity
function setSOVTokenAddress(address newSovTokenAddress) external onlyAdminOrOwner whenNotPaused;
```

### setLockedSOVAddress


```solidity
function setLockedSOVAddress(address newLockedSOVAddress) external onlyAdminOrOwner whenNotPaused;
```

### setTradingRebateRewardsBasisPoint

Set the basis point of trading rebate rewards (SOV), max value is 9999 (99.99% liquid, 0.01% vested).


```solidity
function setTradingRebateRewardsBasisPoint(uint256 newBasisPoint) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newBasisPoint`|`uint256`|Basis point value.|


### setMinReferralsToPayoutAffiliates

Update the minimum number of referrals to get affiliates rewards.


```solidity
function setMinReferralsToPayoutAffiliates(uint256 newMinReferrals) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newMinReferrals`|`uint256`|The new minimum number of referrals.|


### setPriceFeedContract

Set the address of the Price Feed instance.


```solidity
function setPriceFeedContract(address newContract) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newContract`|`address`|The address of the Price Feed new instance.|


### setSwapsImplContract

Set the address of the asset swapper instance.


```solidity
function setSwapsImplContract(address newContract) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newContract`|`address`|The address of the asset swapper new instance.|


### setLoanPool

Set a list of loan pools and its tokens.


```solidity
function setLoanPool(address[] calldata pools, address[] calldata assets) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`pools`|`address[]`|The array of addresses of new loan pool instances.|
|`assets`|`address[]`|The array of addresses of the corresponding underlying tokens.|


### setSupportedTokens

Set a list of supported tokens by populating the
storage supportedTokens mapping.


```solidity
function setSupportedTokens(address[] calldata addrs, bool[] calldata toggles)
    external
    onlyAdminOrOwner
    whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`addrs`|`address[]`|The array of addresses of the tokens.|
|`toggles`|`bool[]`|The array of flags indicating whether the corresponding token is supported or not.|


### setLendingFeePercent

Set the value of lendingFeePercent storage variable.


```solidity
function setLendingFeePercent(uint256 newValue) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newValue`|`uint256`|The new value for lendingFeePercent.|


### setTradingFeePercent

Set the value of tradingFeePercent storage variable.


```solidity
function setTradingFeePercent(uint256 newValue) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newValue`|`uint256`|The new value for tradingFeePercent.|


### setBorrowingFeePercent

Set the value of borrowingFeePercent storage variable.


```solidity
function setBorrowingFeePercent(uint256 newValue) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newValue`|`uint256`|The new value for borrowingFeePercent.|


### setSwapExternalFeePercent

Set the value of swapExtrernalFeePercent storage variable


```solidity
function setSwapExternalFeePercent(uint256 newValue) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newValue`|`uint256`|the new value for swapExternalFeePercent|


### setAffiliateFeePercent

Set the value of affiliateFeePercent storage variable.


```solidity
function setAffiliateFeePercent(uint256 newValue) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newValue`|`uint256`|The new value for affiliateFeePercent.|


### setAffiliateTradingTokenFeePercent

Set the value of affiliateTradingTokenFeePercent storage variable.


```solidity
function setAffiliateTradingTokenFeePercent(uint256 newValue) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newValue`|`uint256`|The new value for affiliateTradingTokenFeePercent.|


### setLiquidationIncentivePercent

Set the value of liquidationIncentivePercent storage variable.


```solidity
function setLiquidationIncentivePercent(uint256 newValue) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newValue`|`uint256`|The new value for liquidationIncentivePercent.|


### setMaxDisagreement

Set the value of the maximum swap spread.


```solidity
function setMaxDisagreement(uint256 newValue) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newValue`|`uint256`|The new value for maxDisagreement.|


### setSourceBuffer

Set the value of the maximum source buffer.

*To avoid rounding issues on the swap rate a small buffer is implemented.*


```solidity
function setSourceBuffer(uint256 newValue) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newValue`|`uint256`|The new value for the maximum source buffer.|


### setMaxSwapSize

Set the value of the swap size limit.


```solidity
function setMaxSwapSize(uint256 newValue) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newValue`|`uint256`|The new value for the maximum swap size.|


### setFeesController

Set the address of the feesController instance.

*The fee sharing proxy must be the feesController of the
protocol contract. This allows the fee sharing proxy
to withdraw the fees.*


```solidity
function setFeesController(address newController) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newController`|`address`|The new address of the feesController.|


### setPauser

Set the pauser address of sovryn protocol.
only pauser or owner can perform this action.


```solidity
function setPauser(address newPauser) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newPauser`|`address`|The new address of the pauser.|


### getPauser

*Get pauser address.*


```solidity
function getPauser() external view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|pauser address.|


### setAdmin


```solidity
function setAdmin(address newAdmin) external onlyOwner;
```

### getAdmin

*Get admin address.*


```solidity
function getAdmin() external view returns (address);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|admin address.|


### withdrawFees

The feesController calls this function to withdraw fees
from three sources: lending, trading and borrowing.
The fees (except SOV) will be converted to wRBTC.
For SOV, it will be deposited directly to feeSharingCollector from the protocol.


```solidity
function withdrawFees(address[] calldata tokens, address receiver)
    external
    whenNotPaused
    returns (uint256 totalWRBTCWithdrawn);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokens`|`address[]`|The array of address of the token instance.|
|`receiver`|`address`|The address of the withdrawal recipient.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`totalWRBTCWithdrawn`|`uint256`|The withdrawn total amount in wRBTC|


### withdrawLendingFees

Will revert if disagreement found.

The feesController calls this function to withdraw fees
accrued from lending operations.


```solidity
function withdrawLendingFees(address token, address receiver, uint256 amount) external whenNotPaused returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|The address of the token instance.|
|`receiver`|`address`|The address of the withdrawal recipient.|
|`amount`|`uint256`|The amount of fees to get, ignored if greater than balance.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|Whether withdrawal was successful.|


### withdrawTradingFees

The feesController calls this function to withdraw fees
accrued from trading operations.


```solidity
function withdrawTradingFees(address token, address receiver, uint256 amount) external whenNotPaused returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|The address of the token instance.|
|`receiver`|`address`|The address of the withdrawal recipient.|
|`amount`|`uint256`|The amount of fees to get, ignored if greater than balance.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|Whether withdrawal was successful.|


### withdrawBorrowingFees

The feesController calls this function to withdraw fees
accrued from borrowing operations.


```solidity
function withdrawBorrowingFees(address token, address receiver, uint256 amount) external whenNotPaused returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`token`|`address`|The address of the token instance.|
|`receiver`|`address`|The address of the withdrawal recipient.|
|`amount`|`uint256`|The amount of fees to get, ignored if greater than balance.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bool`|Whether withdrawal was successful.|


### withdrawProtocolToken

The owner calls this function to withdraw protocol tokens.

*Wrapper for ProtocolTokenUser::_withdrawProtocolToken internal function.*


```solidity
function withdrawProtocolToken(address receiver, uint256 amount)
    external
    onlyAdminOrOwner
    whenNotPaused
    returns (address, bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`receiver`|`address`|The address of the withdrawal recipient.|
|`amount`|`uint256`|The amount of tokens to get.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The protocol token address.|
|`<none>`|`bool`|Withdrawal success (true/false).|


### depositProtocolToken

The owner calls this function to deposit protocol tokens.


```solidity
function depositProtocolToken(uint256 amount) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`amount`|`uint256`|The tokens of fees to send.|


### getLoanPoolsList

Get a list of loan pools.

*Update local balance*

*Send the tokens*


```solidity
function getLoanPoolsList(uint256 start, uint256 count) external view returns (bytes32[] memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`start`|`uint256`|The offset.|
|`count`|`uint256`|The limit.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`bytes32[]`|The array of loan pools.|


### isLoanPool

Check whether a token is a pool token.

*By querying its underlying token.*


```solidity
function isLoanPool(address loanPool) external view returns (bool);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`loanPool`|`address`|The token address to check.|


### setSovrynSwapContractRegistryAddress

Set the contract registry address of the SovrynSwap network.


```solidity
function setSovrynSwapContractRegistryAddress(address registryAddress) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`registryAddress`|`address`|the address of the registry contract.|


### setWrbtcToken

Set the wrBTC contract address.


```solidity
function setWrbtcToken(address wrbtcTokenAddress) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`wrbtcTokenAddress`|`address`|The address of the wrBTC contract.|


### setProtocolTokenAddress

Set the protocol token contract address.


```solidity
function setProtocolTokenAddress(address _protocolTokenAddress) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_protocolTokenAddress`|`address`|The address of the protocol token contract.|


### setRolloverBaseReward

Set rollover base reward. It should be denominated in wrBTC.


```solidity
function setRolloverBaseReward(uint256 baseRewardValue) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`baseRewardValue`|`uint256`|The base reward.|


### setRebatePercent

Set the fee rebate percent.


```solidity
function setRebatePercent(uint256 rebatePercent) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`rebatePercent`|`uint256`|The fee rebate percent.|


### setSpecialRebates

Set the special fee rebate percent for specific pair


```solidity
function setSpecialRebates(address sourceToken, address destToken, uint256 specialRebatesPercent)
    external
    onlyAdminOrOwner
    whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceToken`|`address`||
|`destToken`|`address`||
|`specialRebatesPercent`|`uint256`|The new special fee rebate percent.|


### getSpecialRebates

Get a rebate percent of specific pairs.


```solidity
function getSpecialRebates(address sourceTokenAddress, address destTokenAddress)
    external
    view
    returns (uint256 specialRebatesPercent);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceTokenAddress`|`address`|The source of pairs.|
|`destTokenAddress`|`address`|The dest of pairs.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`specialRebatesPercent`|`uint256`|The percent rebates of the pairs.|


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

### togglePaused


```solidity
function togglePaused(bool paused) external onlyPauserOrOwner;
```

### isProtocolPaused


```solidity
function isProtocolPaused() external view returns (bool);
```

### getSwapExternalFeePercent


```solidity
function getSwapExternalFeePercent() external view returns (uint256);
```

### getTradingRebateRewardsBasisPoint

Get the basis point of trading rebate rewards.


```solidity
function getTradingRebateRewardsBasisPoint() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The basis point value.|


### getDedicatedSOVRebate

If SOV balance is less than the fees held, it will return 0.

*Get how much SOV that is dedicated to pay the trading rebate rewards.*


```solidity
function getDedicatedSOVRebate() public view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|total dedicated SOV.|


### setRolloverFlexFeePercent

Set rolloverFlexFeePercent (max value is 1%)


```solidity
function setRolloverFlexFeePercent(uint256 newRolloverFlexFeePercent) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newRolloverFlexFeePercent`|`uint256`|uint256 value of new rollover flex fee percentage (0.1 ether = 0.1%)|


### getDefaultPathConversion

*Get default path conversion for pairs.*


```solidity
function getDefaultPathConversion(address sourceTokenAddress, address destTokenAddress)
    external
    view
    returns (IERC20[] memory);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceTokenAddress`|`address`|source token address.|
|`destTokenAddress`|`address`|destination token address.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`IERC20[]`|default path of the conversion.|


### setDefaultPathConversion

*Set default path conversion for pairs.*


```solidity
function setDefaultPathConversion(IERC20[] calldata defaultPath) external onlyAdminOrOwner whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`defaultPath`|`IERC20[]`|array of addresses for the default path.|


### removeDefaultPathConversion

*Remove the default path conversion for pairs*


```solidity
function removeDefaultPathConversion(address sourceTokenAddress, address destTokenAddress)
    external
    onlyAdminOrOwner
    whenNotPaused;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sourceTokenAddress`|`address`|source token address.|
|`destTokenAddress`|`address`|destination token address|


