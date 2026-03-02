# SafeMath
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/openzeppelin/SafeMath.sol)

*Wrappers over Solidity's arithmetic operations with added overflow
checks.
Arithmetic operations in Solidity wrap on overflow. This can easily result
in bugs, because programmers usually assume that an overflow raises an
error, which is the standard behavior in high level programming languages.
`SafeMath` restores this intuition by reverting the transaction when an
operation overflows.
Using this library instead of the unchecked operations eliminates an entire
class of bugs, so it's recommended to use it always.*


## Functions
### add

*Returns the addition of two unsigned integers, reverting on
overflow.
Counterpart to Solidity's `+` operator.
Requirements:
- Addition cannot overflow.*


```solidity
function add(uint256 a, uint256 b) internal pure returns (uint256);
```

### sub

*Returns the subtraction of two unsigned integers, reverting on
overflow (when the result is negative).
Counterpart to Solidity's `-` operator.
Requirements:
- Subtraction cannot overflow.*


```solidity
function sub(uint256 a, uint256 b) internal pure returns (uint256);
```

### sub

*Returns the subtraction of two unsigned integers, reverting with custom message on
overflow (when the result is negative).
Counterpart to Solidity's `-` operator.
Requirements:
- Subtraction cannot overflow.
_Available since v2.4.0._*


```solidity
function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256);
```

### mul

*Returns the multiplication of two unsigned integers, reverting on
overflow.
Counterpart to Solidity's `*` operator.
Requirements:
- Multiplication cannot overflow.*


```solidity
function mul(uint256 a, uint256 b) internal pure returns (uint256);
```

### div

*Returns the integer division of two unsigned integers. Reverts on
division by zero. The result is rounded towards zero.
Counterpart to Solidity's `/` operator. Note: this function uses a
`revert` opcode (which leaves remaining gas untouched) while Solidity
uses an invalid opcode to revert (consuming all remaining gas).
Requirements:
- The divisor cannot be zero.*


```solidity
function div(uint256 a, uint256 b) internal pure returns (uint256);
```

### div

*Returns the integer division of two unsigned integers. Reverts with custom message on
division by zero. The result is rounded towards zero.
Counterpart to Solidity's `/` operator. Note: this function uses a
`revert` opcode (which leaves remaining gas untouched) while Solidity
uses an invalid opcode to revert (consuming all remaining gas).
Requirements:
- The divisor cannot be zero.
_Available since v2.4.0._*


```solidity
function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256);
```

### divCeil

*Integer division of two numbers, rounding up and truncating the quotient*


```solidity
function divCeil(uint256 a, uint256 b) internal pure returns (uint256);
```

### divCeil

*Integer division of two numbers, rounding up and truncating the quotient*


```solidity
function divCeil(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256);
```

### mod

*Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
Reverts when dividing by zero.
Counterpart to Solidity's `%` operator. This function uses a `revert`
opcode (which leaves remaining gas untouched) while Solidity uses an
invalid opcode to revert (consuming all remaining gas).
Requirements:
- The divisor cannot be zero.*


```solidity
function mod(uint256 a, uint256 b) internal pure returns (uint256);
```

### mod

*Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
Reverts with custom message when dividing by zero.
Counterpart to Solidity's `%` operator. This function uses a `revert`
opcode (which leaves remaining gas untouched) while Solidity uses an
invalid opcode to revert (consuming all remaining gas).
Requirements:
- The divisor cannot be zero.
_Available since v2.4.0._*


```solidity
function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256);
```

### min256


```solidity
function min256(uint256 _a, uint256 _b) internal pure returns (uint256);
```

