# ILockedSOV
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/locked/ILockedSOV.sol)

**Author:**
Franklin Richards - powerhousefrank@protonmail.com

This interface is an incomplete yet useful for future migration of LockedSOV Contract.

*Only use it if you know what you are doing.*


## Functions
### deposit

Adds SOV to the user balance (Locked and Unlocked Balance based on `_basisPoint`).


```solidity
function deposit(address _userAddress, uint256 _sovAmount, uint256 _basisPoint) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_userAddress`|`address`|The user whose locked balance has to be updated with `_sovAmount`.|
|`_sovAmount`|`uint256`|The amount of SOV to be added to the locked and/or unlocked balance.|
|`_basisPoint`|`uint256`|The % (in Basis Point)which determines how much will be unlocked immediately.|


### depositSOV

Adds SOV to the locked balance of a user.


```solidity
function depositSOV(address _userAddress, uint256 _sovAmount) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_userAddress`|`address`|The user whose locked balance has to be updated with _sovAmount.|
|`_sovAmount`|`uint256`|The amount of SOV to be added to the locked balance.|


### withdrawAndStakeTokensFrom

Withdraws unlocked tokens and Stakes Locked tokens for a user who already have a vesting created.


```solidity
function withdrawAndStakeTokensFrom(address _userAddress) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_userAddress`|`address`|The address of user tokens will be withdrawn.|


### cliff


```solidity
function cliff() external view returns (uint256);
```

### duration


```solidity
function duration() external view returns (uint256);
```

### getLockedBalance


```solidity
function getLockedBalance(address _addr) external view returns (uint256 _balance);
```

### getUnlockedBalance


```solidity
function getUnlockedBalance(address _addr) external view returns (uint256 _balance);
```

