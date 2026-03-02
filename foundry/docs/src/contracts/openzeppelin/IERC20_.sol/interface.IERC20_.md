# IERC20_
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/openzeppelin/IERC20_.sol)

*Interface of the ERC20 standard as defined in the EIP. Does not include
the optional functions; to access them see {ERC20Detailed}.*


## Functions
### totalSupply

*Returns the amount of tokens in existence.*


```solidity
function totalSupply() external view returns (uint256);
```

### balanceOf

*Returns the amount of tokens owned by `account`.*


```solidity
function balanceOf(address account) external view returns (uint256);
```

### transfer

*Moves `amount` tokens from the caller's account to `recipient`.
Returns a boolean value indicating whether the operation succeeded.
Emits a [Transfer](/contracts/openzeppelin/IERC20_.sol/interface.IERC20_.md#transfer) event.*


```solidity
function transfer(address recipient, uint256 amount) external returns (bool);
```

### allowance

*Returns the remaining number of tokens that `spender` will be
allowed to spend on behalf of `owner` through [transferFrom](/contracts/openzeppelin/IERC20_.sol/interface.IERC20_.md#transferfrom). This is
zero by default.
This value changes when {approve} or {transferFrom} are called.*


```solidity
function allowance(address owner, address spender) external view returns (uint256);
```

### approve

*Sets `amount` as the allowance of `spender` over the caller's tokens.
Returns a boolean value indicating whether the operation succeeded.
IMPORTANT: Beware that changing an allowance with this method brings the risk
that someone may use both the old and the new allowance by unfortunate
transaction ordering. One possible solution to mitigate this race
condition is to first reduce the spender's allowance to 0 and set the
desired value afterwards:
https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
Emits an [Approval](/contracts/openzeppelin/IERC20_.sol/interface.IERC20_.md#approval) event.*


```solidity
function approve(address spender, uint256 amount) external returns (bool);
```

### transferFrom

*Moves `amount` tokens from `sender` to `recipient` using the
allowance mechanism. `amount` is then deducted from the caller's
allowance.
Returns a boolean value indicating whether the operation succeeded.
Emits a [Transfer](/contracts/openzeppelin/IERC20_.sol/interface.IERC20_.md#transfer) event.*


```solidity
function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
```

## Events
### Transfer
*Emitted when `value` tokens are moved from one account (`from`) to
another (`to`).
Note that `value` may be zero.*


```solidity
event Transfer(address indexed from, address indexed to, uint256 value);
```

### Approval
*Emitted when the allowance of a `spender` for an `owner` is set by
a call to [approve](/contracts/openzeppelin/IERC20_.sol/interface.IERC20_.md#approve). `value` is the new allowance.*


```solidity
event Approval(address indexed owner, address indexed spender, uint256 value);
```

