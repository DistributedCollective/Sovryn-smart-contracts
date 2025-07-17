# OsSOV
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/token/OsSOV.sol)

**Inherits:**
ERC20Capped, AccessControl, [Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md), [Initializable](/contracts/openzeppelin/Initializable.sol/contract.Initializable.md)

This contract accounts for all holders' balances.

*This contract represents a token with dynamic supply.
The owner of the token contract can mint/burn tokens to/from any account
based upon previous governance voting and approval.*


## State Variables
### _NAME

```solidity
string private constant _NAME = "BitcoinOS Sovryn Transition Token";
```


### _SYMBOL

```solidity
string private constant _SYMBOL = "osSOV";
```


### _DECIMALS

```solidity
uint8 private constant _DECIMALS = 18;
```


### AUTHORISED_MINTER_ROLE

```solidity
bytes32 public constant AUTHORISED_MINTER_ROLE = keccak256("AUTHORISED_MINTER_ROLE");
```


## Functions
### onlyMinter


```solidity
modifier onlyMinter(address _address);
```

### constructor

*_disableInitializers locks the logic contract, preventing any future reinitialization. This cannot be part of an initializer call.
Calling this in the constructor of a contract will prevent that contract from being initialized or reinitialized
to any version. It is recommended to use this to lock implementation contracts that are designed to be called
through proxies.*

*initializing Owner with address(1) because 0 address is not allowed*


```solidity
constructor() ERC20(_NAME, _SYMBOL) ERC20Capped(100_000_000 ether);
```

### initialize


```solidity
function initialize(address _owner, address _defaultAdmin, address _authorizedMinter) external initializer;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_owner`|`address`|Address for AccessControl OWNER_ROLE to use in onlyOwner() modifier|
|`_defaultAdmin`|`address`|Address for AcccessControl DEFAULT_ADMIN_ROLE to manage roles: assign and revoke|
|`_authorizedMinter`|`address`|Address of the minter - Staking Rewards contract|


### setDefaultAdminRole


```solidity
function setDefaultAdminRole(address _adminRole) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_adminRole`|`address`|Address for AcccessControl DEFAULT_ADMIN_ROLE to manage roles: assign and revoke|


### setAuthorisedMinterRole


```solidity
function setAuthorisedMinterRole(address _authorizedMinter) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_authorizedMinter`|`address`|Address of the minter - should be Staking Rewards contract|


### mint

*Creates a `value` amount of tokens and assigns them to `account`, by transferring it from address(0).
Relies on the `_update` mechanism
Emits a {Transfer} event with `from` set to the zero address.
NOTE: This function is not override, {_update} should be overridden instead.*


```solidity
function mint(address _to, uint256 _amount) public onlyMinter(msg.sender);
```

### transfer

*See [IERC20-transfer](/contracts/farm/LiquidityMiningConfigToken.sol/contract.LiquidityMiningConfigToken.md#transfer).
Requirements:
- non-transferable*


```solidity
function transfer(address, uint256) public pure override returns (bool);
```

### approve

*See [IERC20-approve](/contracts/farm/LiquidityMiningConfigToken.sol/contract.LiquidityMiningConfigToken.md#approve).
NOTE: If `value` is the maximum `uint256`, the allowance is not updated on
`transferFrom`. This is semantically equivalent to an infinite approval.
- non-transferable via transferFrom*


```solidity
function approve(address, uint256) public override returns (bool);
```

### receive

*Token is non-receivable*


```solidity
receive() external payable;
```

### name

*Returns the name of the token.*


```solidity
function name() public pure override returns (string memory);
```

### symbol


```solidity
function symbol() public pure override returns (string memory);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`string`|Returns the symbol of the token, usually a shorter version of the name.|


### decimals


```solidity
function decimals() public pure override returns (uint8);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint8`|Returns the number of decimals used to get its user representation. For example, if `decimals` equals `2`, a balance of `505` tokens should be displayed to a user as `5.05` (`505 / 10 ** 2`). Tokens usually opt for a value of 18, imitating the relationship between Ether and Wei. This is the default value returned by this function, unless it's overridden. NOTE: This information is only used for _display_ purposes: it in no way affects any of the arithmetic of the contract, including [IERC20-balanceOf](/contracts/farm/LiquidityMiningConfigToken.sol/contract.LiquidityMiningConfigToken.md#balanceof) and {IERC20-transfer}.|


## Errors
### NonTransferable
*The token is non transferable.*


```solidity
error NonTransferable();
```

### NonApprovable
*The token is non transferable via transferForm - approval is not allowed.*


```solidity
error NonApprovable();
```

### NonReceivable
*The token is non receivable*


```solidity
error NonReceivable();
```

### NotAllowedZeroAddressForParam
*address passed cannot be zero*


```solidity
error NotAllowedZeroAddressForParam(string param);
```

