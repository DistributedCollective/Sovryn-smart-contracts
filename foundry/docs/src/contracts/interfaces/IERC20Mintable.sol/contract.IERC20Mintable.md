# IERC20Mintable
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/interfaces/IERC20Mintable.sol)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.


## State Variables
### name

```solidity
string public name;
```


### decimals

```solidity
uint8 public decimals;
```


### symbol

```solidity
string public symbol;
```


## Functions
### totalSupply


```solidity
function totalSupply() external view returns (uint256);
```

### balanceOf


```solidity
function balanceOf(address _who) external view returns (uint256);
```

### allowance


```solidity
function allowance(address _owner, address _spender) external view returns (uint256);
```

### approve


```solidity
function approve(address _spender, uint256 _value) external returns (bool);
```

### transfer


```solidity
function transfer(address _to, uint256 _value) external returns (bool);
```

### transferFrom


```solidity
function transferFrom(address _from, address _to, uint256 _value) external returns (bool);
```

### mint


```solidity
function mint(address _to, uint256 _value) external;
```

## Events
### Transfer

```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

### Approval

```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```

