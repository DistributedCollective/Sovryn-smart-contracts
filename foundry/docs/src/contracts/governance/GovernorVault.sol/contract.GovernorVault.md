# GovernorVault
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/GovernorVault.sol)

**Inherits:**
[Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

This contract stores tokens and rBTC only transfereble by owner,
i.e. Sovryn governance.


## Functions
### transferTokens

Transfer tokens.


```solidity
function transferTokens(address _receiver, address _token, uint256 _amount) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_receiver`|`address`|The receiver of tokens.|
|`_token`|`address`|The address of token contract.|
|`_amount`|`uint256`|The amount to be transferred.|


### transferRbtc

Transfer RBTC.


```solidity
function transferRbtc(address payable _receiver, uint256 _amount) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_receiver`|`address payable`|The receiver of RBTC.|
|`_amount`|`uint256`|The amount to be transferred.|


### function

Fallback function is to react to receiving value (rBTC).


```solidity
function() external payable;
```

## Events
### Deposited

```solidity
event Deposited(address indexed sender, uint256 amount);
```

### TokensTransferred

```solidity
event TokensTransferred(address indexed receiver, address indexed token, uint256 amount);
```

### RbtcTransferred

```solidity
event RbtcTransferred(address indexed receiver, uint256 amount);
```

