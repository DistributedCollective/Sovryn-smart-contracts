# GenericTokenSender
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/GenericTokenSender.sol)

**Inherits:**
[AdminRole](/contracts/utils/AdminRole.sol/contract.AdminRole.md)

This contract includes functions to transfer tokens
to a recipient or to several recipients in a list. There is
an ACL control check by modifier.


## Functions
### transferTokensUsingList

Transfer given amounts of tokens to the given addresses.


```solidity
function transferTokensUsingList(address _token, address[] calldata _receivers, uint256[] calldata _amounts)
    external
    onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_token`|`address`|The address of the token.|
|`_receivers`|`address[]`|The addresses of the receivers.|
|`_amounts`|`uint256[]`|The amounts to be transferred.|


### function


```solidity
function() external payable;
```

### transferTokens

Transfer tokens to given address.


```solidity
function transferTokens(address _token, address _receiver, uint256 _amount) external onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_token`|`address`|The address of the token.|
|`_receiver`|`address`|The address of the token receiver.|
|`_amount`|`uint256`|The amount to be transferred.|


### _transferTokens


```solidity
function _transferTokens(address _token, address _receiver, uint256 _amount) internal;
```

## Events
### TokensTransferred

```solidity
event TokensTransferred(address indexed token, address indexed receiver, uint256 amount);
```

