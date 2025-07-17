# StakingStorageModule
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Staking/modules/StakingStorageModule.sol)

**Inherits:**
[IFunctionsList](/contracts/proxy/modules/interfaces/IFunctionsList.sol/interface.IFunctionsList.md), [StakingStorageShared](/contracts/governance/Staking/modules/shared/StakingStorageShared.sol/contract.StakingStorageShared.md)

Provides getters for public storage variables


## Functions
### getStorageDefaultWeightScaling


```solidity
function getStorageDefaultWeightScaling() external pure returns (uint256);
```

### getStorageMaxDurationToStakeTokens

The maximum duration to stake tokens


```solidity
function getStorageMaxDurationToStakeTokens() external pure returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|MAX_DURATION to stake tokens|


### getStorageMaxVotingWeight

The maximum possible voting weight before adding +1 (actually 10, but need 9 for computation).


```solidity
function getStorageMaxVotingWeight() external pure returns (uint256);
```

### getStorageWeightFactor

weight is multiplied with this factor (for allowing decimals, like 1.2x).

*MAX_VOTING_WEIGHT * WEIGHT_FACTOR needs to be < 792, because there are 100,000,000 SOV with 18 decimals*


```solidity
function getStorageWeightFactor() external pure returns (uint256);
```

### getStorageDefaulWeightScaling

Default weight scaling.


```solidity
function getStorageDefaulWeightScaling() external pure returns (uint256);
```

### getStorageRangeForWeightScaling


```solidity
function getStorageRangeForWeightScaling() external pure returns (uint256 minWeightScaling, uint256 maxWeightScaling);
```

### getStorageDomainTypehash

The EIP-712 typehash for the contract's domain.


```solidity
function getStorageDomainTypehash() external pure returns (uint256);
```

### getStorageDelegationTypehash

The EIP-712 typehash for the delegation struct used by the contract.


```solidity
function getStorageDelegationTypehash() external pure returns (uint256);
```

### getStorageName


```solidity
function getStorageName() external view returns (string memory);
```

### getMaxVestingWithdrawIterations

Max iteration for direct withdrawal from staking to prevent out of gas issue.


```solidity
function getMaxVestingWithdrawIterations() public view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|max iteration value.|


### getFunctionsList


```solidity
function getFunctionsList() external pure returns (bytes4[] memory);
```

