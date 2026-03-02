# SOV
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/token/SOV.sol)

**Inherits:**
[ERC20](/contracts/openzeppelin/ERC20.sol/contract.ERC20.md), [ERC20Detailed](/contracts/openzeppelin/ERC20Detailed.sol/contract.ERC20Detailed.md), [Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

This contract accounts for all holders' balances.

*This contract represents a token with dynamic supply.
The owner of the token contract can mint/burn tokens to/from any account
based upon previous governance voting and approval.*


## State Variables
### NAME

```solidity
string constant NAME = "Sovryn Token";
```


### SYMBOL

```solidity
string constant SYMBOL = "SOV";
```


### DECIMALS

```solidity
uint8 constant DECIMALS = 18;
```


## Functions
### constructor

Constructor called on deployment, initiates the contract.

*On deployment, some amount of tokens will be minted for the owner.*


```solidity
constructor(uint256 _initialAmount) public ERC20Detailed(NAME, SYMBOL, DECIMALS);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_initialAmount`|`uint256`|The amount of tokens to be minted on contract creation.|


### mint

Creates new tokens and sends them to the recipient.

*Don't create more than 2^96/10 tokens before updating the governance first.*


```solidity
function mint(address _account, uint256 _amount) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_account`|`address`|The recipient address to get the minted tokens.|
|`_amount`|`uint256`|The amount of tokens to be minted.|


### approveAndCall

Approves and then calls the receiving contract.
Useful to encapsulate sending tokens to a contract in one call.
Solidity has no native way to send tokens to contracts.
ERC-20 tokens require approval to be spent by third parties, such as a contract in this case.


```solidity
function approveAndCall(address _spender, uint256 _amount, bytes memory _data) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_spender`|`address`|The contract address to spend the tokens.|
|`_amount`|`uint256`|The amount of tokens to be sent.|
|`_data`|`bytes`|Parameters for the contract call, such as endpoint signature.|


