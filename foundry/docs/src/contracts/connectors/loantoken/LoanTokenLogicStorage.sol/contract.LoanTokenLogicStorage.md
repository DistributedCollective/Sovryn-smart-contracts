# LoanTokenLogicStorage
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/connectors/loantoken/LoanTokenLogicStorage.sol)

**Inherits:**
[AdvancedToken](/contracts/connectors/loantoken/AdvancedToken.sol/contract.AdvancedToken.md)


## State Variables
### sovrynContractAddress
DO NOT ADD VARIABLES HERE - SEE BELOW

*It is important to maintain the variables order so the delegate
calls can access sovrynContractAddress
------------- MUST BE THE SAME AS IN LoanToken CONTRACT -------------------*


```solidity
address public sovrynContractAddress;
```


### wrbtcTokenAddress

```solidity
address public wrbtcTokenAddress;
```


### target_

```solidity
address public target_;
```


### admin

```solidity
address public admin;
```


### earlyAccessToken
------------- END MUST BE THE SAME AS IN LoanToken CONTRACT -------------------

*Add new variables here on the bottom.*


```solidity
address public earlyAccessToken;
```


### pauser

```solidity
address public pauser;
```


### liquidityMiningAddress
The address of the liquidity mining contract


```solidity
address public liquidityMiningAddress;
```


### stakingContractAddress
The address of the staking contract


```solidity
address public stakingContractAddress;
```


### VERSION
*Used by flashBorrow function.*


```solidity
uint256 public constant VERSION = 6;
```


### arbitraryCaller
*Used by flashBorrow function.*


```solidity
address internal constant arbitraryCaller = 0x000F400e6818158D541C3EBE45FE3AA0d47372FF;
```


### iToken_ProfitSoFar

```solidity
bytes32 internal constant iToken_ProfitSoFar = 0x37aa2b7d583612f016e4a4de4292cb015139b3d7762663d06a53964912ea2fb6;
```


### TINY_AMOUNT

```solidity
uint256 public constant TINY_AMOUNT = 25e13;
```


## Functions
### stringToBytes32


```solidity
function stringToBytes32(string memory source) public pure returns (bytes32 result);
```

### onlyPauserOrOwner


```solidity
modifier onlyPauserOrOwner();
```

