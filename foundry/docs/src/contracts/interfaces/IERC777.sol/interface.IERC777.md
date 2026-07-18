# IERC777
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/interfaces/IERC777.sol)

*Interface of the ERC777Token standard as defined in the EIP.
This contract uses the
https://eips.ethereum.org/EIPS/eip-1820[ERC1820 registry standard] to let
token holders and recipients react to token movements by using setting implementers
for the associated interfaces in said registry. See {IERC1820Registry} and
{ERC1820Implementer}.*


## Functions
### name

*Returns the name of the token.*


```solidity
function name() external view returns (string memory);
```

### symbol

*Returns the symbol of the token, usually a shorter version of the
name.*


```solidity
function symbol() external view returns (string memory);
```

### granularity

*Returns the smallest part of the token that is not divisible. This
means all token operations (creation, movement and destruction) must have
amounts that are a multiple of this number.
For most token contracts, this value will equal 1.*


```solidity
function granularity() external view returns (uint256);
```

### totalSupply

*Returns the amount of tokens in existence.*


```solidity
function totalSupply() external view returns (uint256);
```

### balanceOf

*Returns the amount of tokens owned by an account (`owner`).*


```solidity
function balanceOf(address owner) external view returns (uint256);
```

### send

*Moves `amount` tokens from the caller's account to `recipient`.
If send or receive hooks are registered for the caller and `recipient`,
the corresponding functions will be called with `data` and empty
`operatorData`. See {IERC777Sender} and {IERC777Recipient}.
Emits a {Sent} event.
Requirements
- the caller must have at least `amount` tokens.
- `recipient` cannot be the zero address.
- if `recipient` is a contract, it must implement the {IERC777Recipient}
interface.*


```solidity
function send(address recipient, uint256 amount, bytes calldata data) external;
```

### burn

*Destroys `amount` tokens from the caller's account, reducing the
total supply.
If a send hook is registered for the caller, the corresponding function
will be called with `data` and empty `operatorData`. See {IERC777Sender}.
Emits a {Burned} event.
Requirements
- the caller must have at least `amount` tokens.*


```solidity
function burn(uint256 amount, bytes calldata data) external;
```

### isOperatorFor

*Returns true if an account is an operator of `tokenHolder`.
Operators can send and burn tokens on behalf of their owners. All
accounts are their own operator.
See [operatorSend](/contracts/interfaces/IERC777.sol/interface.IERC777.md#operatorsend) and {operatorBurn}.*


```solidity
function isOperatorFor(address operator, address tokenHolder) external view returns (bool);
```

### authorizeOperator

*Make an account an operator of the caller.
See [isOperatorFor](/contracts/interfaces/IERC777.sol/interface.IERC777.md#isoperatorfor).
Emits an {AuthorizedOperator} event.
Requirements
- `operator` cannot be calling address.*


```solidity
function authorizeOperator(address operator) external;
```

### revokeOperator

*Make an account an operator of the caller.
See [isOperatorFor](/contracts/interfaces/IERC777.sol/interface.IERC777.md#isoperatorfor) and {defaultOperators}.
Emits a {RevokedOperator} event.
Requirements
- `operator` cannot be calling address.*


```solidity
function revokeOperator(address operator) external;
```

### defaultOperators

*Returns the list of default operators. These accounts are operators
for all token holders, even if [authorizeOperator](/contracts/interfaces/IERC777.sol/interface.IERC777.md#authorizeoperator) was never called on
them.
This list is immutable, but individual holders may revoke these via
{revokeOperator}, in which case {isOperatorFor} will return false.*


```solidity
function defaultOperators() external view returns (address[] memory);
```

### operatorSend

*Moves `amount` tokens from `sender` to `recipient`. The caller must
be an operator of `sender`.
If send or receive hooks are registered for `sender` and `recipient`,
the corresponding functions will be called with `data` and
`operatorData`. See {IERC777Sender} and {IERC777Recipient}.
Emits a {Sent} event.
Requirements
- `sender` cannot be the zero address.
- `sender` must have at least `amount` tokens.
- the caller must be an operator for `sender`.
- `recipient` cannot be the zero address.
- if `recipient` is a contract, it must implement the {IERC777Recipient}
interface.*


```solidity
function operatorSend(
    address sender,
    address recipient,
    uint256 amount,
    bytes calldata data,
    bytes calldata operatorData
) external;
```

### operatorBurn

*Destoys `amount` tokens from `account`, reducing the total supply.
The caller must be an operator of `account`.
If a send hook is registered for `account`, the corresponding function
will be called with `data` and `operatorData`. See {IERC777Sender}.
Emits a {Burned} event.
Requirements
- `account` cannot be the zero address.
- `account` must have at least `amount` tokens.
- the caller must be an operator for `account`.*


```solidity
function operatorBurn(address account, uint256 amount, bytes calldata data, bytes calldata operatorData) external;
```

## Events
### Sent

```solidity
event Sent(
    address indexed operator, address indexed from, address indexed to, uint256 amount, bytes data, bytes operatorData
);
```

### Minted

```solidity
event Minted(address indexed operator, address indexed to, uint256 amount, bytes data, bytes operatorData);
```

### Burned

```solidity
event Burned(address indexed operator, address indexed from, uint256 amount, bytes data, bytes operatorData);
```

### AuthorizedOperator

```solidity
event AuthorizedOperator(address indexed operator, address indexed tokenHolder);
```

### RevokedOperator

```solidity
event RevokedOperator(address indexed operator, address indexed tokenHolder);
```

