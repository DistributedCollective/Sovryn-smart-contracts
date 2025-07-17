# ERC20Detailed
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/openzeppelin/ERC20Detailed.sol)

**Inherits:**
[IERC20_](/contracts/openzeppelin/IERC20_.sol/interface.IERC20_.md)

*Optional functions from the ERC20 standard.*


## State Variables
### _name

```solidity
string private _name;
```


### _symbol

```solidity
string private _symbol;
```


### _decimals

```solidity
uint8 private _decimals;
```


## Functions
### constructor

*Sets the values for `name`, `symbol`, and `decimals`. All three of
these values are immutable: they can only be set once during
construction.*


```solidity
constructor(string memory name, string memory symbol, uint8 decimals) public;
```

### name

*Returns the name of the token.*


```solidity
function name() public view returns (string memory);
```

### symbol

*Returns the symbol of the token, usually a shorter version of the
name.*


```solidity
function symbol() public view returns (string memory);
```

### decimals

*Returns the number of decimals used to get its user representation.
For example, if `decimals` equals `2`, a balance of `505` tokens should
be displayed to a user as `5,05` (`505 / 10 ** 2`).
Tokens usually opt for a value of 18, imitating the relationship between
Ether and Wei.
NOTE: This information is only used for _display_ purposes: it in
no way affects any of the arithmetic of the contract, including
[IERC20-balanceOf](/contracts/interfaces/IERC20.sol/contract.IERC20.md#balanceof) and {IERC20-transfer}.*


```solidity
function decimals() public view returns (uint8);
```

