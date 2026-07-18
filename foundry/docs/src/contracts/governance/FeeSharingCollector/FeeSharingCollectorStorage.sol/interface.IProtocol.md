# IProtocol
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/FeeSharingCollector/FeeSharingCollectorStorage.sol)


## Functions
### withdrawFees


```solidity
function withdrawFees(address[] calldata tokens, address receiver) external returns (uint256 totalWRBTCWithdrawn);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`tokens`|`address[]`|The array address of the token instance.|
|`receiver`|`address`|The address of the withdrawal recipient.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`totalWRBTCWithdrawn`|`uint256`|The withdrawn total amount in wRBTC|


### underlyingToLoanPool


```solidity
function underlyingToLoanPool(address token) external view returns (address);
```

### wrbtcToken


```solidity
function wrbtcToken() external view returns (IWrbtcERC20);
```

### getSovTokenAddress


```solidity
function getSovTokenAddress() external view returns (address);
```

