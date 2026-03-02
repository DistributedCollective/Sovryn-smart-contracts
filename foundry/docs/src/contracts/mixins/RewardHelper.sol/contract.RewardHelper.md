# RewardHelper
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/mixins/RewardHelper.sol)

**Inherits:**
[State](/contracts/core/State.sol/contract.State.md)

This contract calculates the reward for rollover transactions.
A rollover is a renewal of a deposit. Instead of liquidating a deposit
on maturity, you can roll it over into a new deposit. The outstanding
principal of the old deposit is rolled over with or without the interest
outstanding on it.


## Functions
### _getRolloverReward

Calculate the reward of a rollover transaction.


```solidity
function _getRolloverReward(address collateralToken, address loanToken, uint256 positionSize)
    internal
    view
    returns (uint256 reward);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`collateralToken`|`address`|The address of the collateral token.|
|`loanToken`|`address`|The address of the loan token.|
|`positionSize`|`uint256`|The amount of value of the position.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`reward`|`uint256`|The base fee + the flex fee.|


