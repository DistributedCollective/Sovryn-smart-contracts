# Address
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/openzeppelin/Address.sol)

*Collection of functions related to the address type*


## Functions
### isContract

*Returns true if `account` is a contract.
[IMPORTANT]
====
It is unsafe to assume that an address for which this function returns
false is an externally-owned account (EOA) and not a contract.
Among others, `isContract` will return false for the following
types of addresses:
- an externally-owned account
- a contract in construction
- an address where a contract will be created
- an address where a contract lived, but was destroyed
====*


```solidity
function isContract(address account) internal view returns (bool);
```

### toPayable

*Converts an `address` into `address payable`. Note that this is
simply a type cast: the actual underlying value is not changed.
_Available since v2.4.0._*


```solidity
function toPayable(address account) internal pure returns (address payable);
```

### sendValue

*Replacement for Solidity's `transfer`: sends `amount` wei to
`recipient`, forwarding all available gas and reverting on errors.
https://eips.ethereum.org/EIPS/eip-1884[EIP1884] increases the gas cost
of certain opcodes, possibly making contracts go over the 2300 gas limit
imposed by `transfer`, making them unable to receive funds via
`transfer`. [sendValue](/contracts/openzeppelin/Address.sol/library.Address.md#sendvalue) removes this limitation.
https://diligence.consensys.net/posts/2019/09/stop-using-soliditys-transfer-now/[Learn more].
IMPORTANT: because control is transferred to `recipient`, care must be
taken to not create reentrancy vulnerabilities. Consider using
{ReentrancyGuard} or the
https://solidity.readthedocs.io/en/v0.5.11/security-considerations.html
#use-the-checks-effects-interactions-pattern[checks-effects-interactions pattern].
_Available since v2.4.0._*


```solidity
function sendValue(address recipient, uint256 amount) internal;
```

