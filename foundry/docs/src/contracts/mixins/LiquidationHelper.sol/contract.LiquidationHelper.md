# LiquidationHelper
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/mixins/LiquidationHelper.sol)

**Inherits:**
[State](/contracts/core/State.sol/contract.State.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized margin
trading and lending https://bzx.network similar to the dYdX protocol.
This contract computes the liquidation amount.


## Functions
### _getLiquidationAmounts

Compute how much needs to be liquidated in order to restore the
desired margin (maintenance + 5%).


```solidity
function _getLiquidationAmounts(
    uint256 principal,
    uint256 collateral,
    uint256 currentMargin,
    uint256 maintenanceMargin,
    uint256 collateralToLoanRate
) internal view returns (uint256 maxLiquidatable, uint256 maxSeizable, uint256 incentivePercent);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`principal`|`uint256`|The total borrowed amount (in loan tokens).|
|`collateral`|`uint256`|The collateral (in collateral tokens).|
|`currentMargin`|`uint256`|The current margin.|
|`maintenanceMargin`|`uint256`|The maintenance (minimum) margin.|
|`collateralToLoanRate`|`uint256`|The exchange rate from collateral to loan tokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`maxLiquidatable`|`uint256`|The collateral you can get liquidating.|
|`maxSeizable`|`uint256`|The loan you available for liquidation.|
|`incentivePercent`|`uint256`|The discount on collateral.|


