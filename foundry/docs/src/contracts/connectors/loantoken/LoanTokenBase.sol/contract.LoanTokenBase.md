# LoanTokenBase
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/LoanTokenBase.sol)

**Inherits:**
[ReentrancyGuard](/contracts/openzeppelin/ReentrancyGuard.sol/contract.ReentrancyGuard.md), [SharedReentrancyGuard](/contracts/reentrancy/SharedReentrancyGuard.sol/contract.SharedReentrancyGuard.md), [Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md), [Pausable](/contracts/connectors/loantoken/Pausable.sol/contract.Pausable.md)

Copyright 2017-2021, bZeroX, LLC. All Rights Reserved.
Licensed under the Apache License, Version 2.0.

This contract code comes from bZx. bZx is a protocol for tokenized margin
trading and lending https://bzx.network similar to the dYdX protocol.
Specific loan related storage for iTokens.
An loan token or iToken is a representation of a user funds in the pool and the
interest they've earned. The redemption value of iTokens continually increase
from the accretion of interest paid into the lending pool by borrowers. The user
can sell iTokens to exit its position. The user might potentially use them as
collateral wherever applicable.
There are three main tokens in the bZx system, iTokens, pTokens, and BZRX tokens.
The bZx system of lending and borrowing depends on iTokens and pTokens, and when
users lend or borrow money on bZx, their crypto assets go into or come out of
global liquidity pools, which are pools of funds shared between many different
exchanges. When lenders supply funds into the global liquidity pools, they
automatically receive iTokens; When users borrow money to open margin trading
positions, they automatically receive pTokens. The system is also designed to
use the BZRX tokens, which are only used to pay fees on the network currently.


## State Variables
### WEI_PRECISION

```solidity
uint256 internal constant WEI_PRECISION = 10 ** 18;
```


### WEI_PERCENT_PRECISION

```solidity
uint256 internal constant WEI_PERCENT_PRECISION = 10 ** 20;
```


### sWEI_PRECISION

```solidity
int256 internal constant sWEI_PRECISION = 10 ** 18;
```


### name
Standard ERC-20 properties


```solidity
string public name;
```


### symbol

```solidity
string public symbol;
```


### decimals

```solidity
uint8 public decimals;
```


### loanTokenAddress
The address of the loan token (asset to lend) instance.


```solidity
address public loanTokenAddress;
```


### baseRate

```solidity
uint256 public baseRate;
```


### rateMultiplier

```solidity
uint256 public rateMultiplier;
```


### lowUtilBaseRate

```solidity
uint256 public lowUtilBaseRate;
```


### lowUtilRateMultiplier

```solidity
uint256 public lowUtilRateMultiplier;
```


### targetLevel

```solidity
uint256 public targetLevel;
```


### kinkLevel

```solidity
uint256 public kinkLevel;
```


### maxScaleRate

```solidity
uint256 public maxScaleRate;
```


### _flTotalAssetSupply

```solidity
uint256 internal _flTotalAssetSupply;
```


### checkpointSupply

```solidity
uint256 public checkpointSupply;
```


### initialPrice

```solidity
uint256 public initialPrice;
```


### lastSettleTime_
uint88 for tight packing -> 8 + 88 + 160 = 256


```solidity
uint88 internal lastSettleTime_;
```


### loanParamsIds
Mapping of keccak256(collateralToken, isTorqueLoan) to loanParamsId.


```solidity
mapping(uint256 => bytes32) public loanParamsIds;
```


### checkpointPrices_
Price of token at last user checkpoint.


```solidity
mapping(address => uint256) internal checkpointPrices_;
```


### transactionLimit

```solidity
mapping(address => uint256) public transactionLimit;
```


