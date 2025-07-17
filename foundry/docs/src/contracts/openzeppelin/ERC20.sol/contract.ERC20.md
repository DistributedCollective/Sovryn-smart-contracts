# ERC20
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/openzeppelin/ERC20.sol)

**Inherits:**
[Context](/contracts/openzeppelin/Context.sol/contract.Context.md), [IERC20_](/contracts/openzeppelin/IERC20_.sol/interface.IERC20_.md)

*Implementation of the {IERC20} interface.
This implementation is agnostic to the way tokens are created. This means
that a supply mechanism has to be added in a derived contract using {_mint}.
For a generic mechanism see {ERC20Mintable}.
TIP: For a detailed writeup see our guide
https://forum.zeppelin.solutions/t/how-to-implement-erc20-supply-mechanisms/226[How
to implement supply mechanisms].
We have followed general OpenZeppelin guidelines: functions revert instead
of returning `false` on failure. This behavior is nonetheless conventional
and does not conflict with the expectations of ERC20 applications.
Additionally, an {Approval} event is emitted on calls to {transferFrom}.
This allows applications to reconstruct the allowance for all accounts just
by listening to said events. Other implementations of the EIP may not emit
these events, as it isn't required by the specification.
Finally, the non-standard {decreaseAllowance} and {increaseAllowance}
functions have been added to mitigate the well-known issues around setting
allowances. See {IERC20-approve}.*


## State Variables
### _balances

```solidity
mapping(address => uint256) private _balances;
```


### _allowances

```solidity
mapping(address => mapping(address => uint256)) private _allowances;
```


### _totalSupply

```solidity
uint256 private _totalSupply;
```


## Functions
### totalSupply

*See [IERC20-totalSupply](/contracts/openzeppelin/IERC20_.sol/interface.IERC20_.md#totalsupply).*


```solidity
function totalSupply() public view returns (uint256);
```

### balanceOf

*See [IERC20-balanceOf](/contracts/openzeppelin/IERC20_.sol/interface.IERC20_.md#balanceof).*


```solidity
function balanceOf(address account) public view returns (uint256);
```

### transfer

*See [IERC20-transfer](/contracts/openzeppelin/IERC20_.sol/interface.IERC20_.md#transfer).
Requirements:
- `recipient` cannot be the zero address.
- the caller must have a balance of at least `amount`.*


```solidity
function transfer(address recipient, uint256 amount) public returns (bool);
```

### allowance

*See [IERC20-allowance](/contracts/openzeppelin/IERC20_.sol/interface.IERC20_.md#allowance).*


```solidity
function allowance(address owner, address spender) public view returns (uint256);
```

### approve

*See [IERC20-approve](/contracts/openzeppelin/IERC20_.sol/interface.IERC20_.md#approve).
Requirements:
- `spender` cannot be the zero address.*


```solidity
function approve(address spender, uint256 amount) public returns (bool);
```

### transferFrom

*See [IERC20-transferFrom](/contracts/openzeppelin/IERC20_.sol/interface.IERC20_.md#transferfrom).
Emits an {Approval} event indicating the updated allowance. This is not
required by the EIP. See the note at the beginning of {ERC20};
Requirements:
- `sender` and `recipient` cannot be the zero address.
- `sender` must have a balance of at least `amount`.
- the caller must have allowance for `sender`'s tokens of at least
`amount`.*


```solidity
function transferFrom(address sender, address recipient, uint256 amount) public returns (bool);
```

### increaseAllowance

*Atomically increases the allowance granted to `spender` by the caller.
This is an alternative to [approve](/contracts/openzeppelin/ERC20.sol/contract.ERC20.md#approve) that can be used as a mitigation for
problems described in {IERC20-approve}.
Emits an {Approval} event indicating the updated allowance.
Requirements:
- `spender` cannot be the zero address.*


```solidity
function increaseAllowance(address spender, uint256 addedValue) public returns (bool);
```

### decreaseAllowance

*Atomically decreases the allowance granted to `spender` by the caller.
This is an alternative to [approve](/contracts/openzeppelin/ERC20.sol/contract.ERC20.md#approve) that can be used as a mitigation for
problems described in {IERC20-approve}.
Emits an {Approval} event indicating the updated allowance.
Requirements:
- `spender` cannot be the zero address.
- `spender` must have allowance for the caller of at least
`subtractedValue`.*


```solidity
function decreaseAllowance(address spender, uint256 subtractedValue) public returns (bool);
```

### _transfer

*Moves tokens `amount` from `sender` to `recipient`.
This is internal function is equivalent to [transfer](/contracts/openzeppelin/ERC20.sol/contract.ERC20.md#transfer), and can be used to
e.g. implement automatic token fees, slashing mechanisms, etc.
Emits a {Transfer} event.
Requirements:
- `sender` cannot be the zero address.
- `recipient` cannot be the zero address.
- `sender` must have a balance of at least `amount`.*


```solidity
function _transfer(address sender, address recipient, uint256 amount) internal;
```

### _mint

*Creates `amount` tokens and assigns them to `account`, increasing
the total supply.
Emits a {Transfer} event with `from` set to the zero address.
Requirements
- `to` cannot be the zero address.*


```solidity
function _mint(address account, uint256 amount) internal;
```

### _burn

*Destroys `amount` tokens from `account`, reducing the
total supply.
Emits a {Transfer} event with `to` set to the zero address.
Requirements
- `account` cannot be the zero address.
- `account` must have at least `amount` tokens.*


```solidity
function _burn(address account, uint256 amount) internal;
```

### _approve

*Sets `amount` as the allowance of `spender` over the `owner`s tokens.
This is internal function is equivalent to `approve`, and can be used to
e.g. set automatic allowances for certain subsystems, etc.
Emits an {Approval} event.
Requirements:
- `owner` cannot be the zero address.
- `spender` cannot be the zero address.*


```solidity
function _approve(address owner, address spender, uint256 amount) internal;
```

### _burnFrom

*Destroys `amount` tokens from `account`.`amount` is then deducted
from the caller's allowance.
See [_burn](/contracts/openzeppelin/ERC20.sol/contract.ERC20.md#_burn) and {_approve}.*


```solidity
function _burnFrom(address account, uint256 amount) internal;
```

