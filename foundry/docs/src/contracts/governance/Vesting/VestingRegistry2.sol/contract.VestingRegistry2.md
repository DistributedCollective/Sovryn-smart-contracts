# VestingRegistry2
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/VestingRegistry2.sol)

**Inherits:**
[Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

One time contract needed to distribute tokens to origin sales investors.


## State Variables
### FOUR_WEEKS
Constant used for computing the vesting dates.


```solidity
uint256 public constant FOUR_WEEKS = 4 weeks;
```


### CSOV_VESTING_CLIFF

```solidity
uint256 public constant CSOV_VESTING_CLIFF = FOUR_WEEKS;
```


### CSOV_VESTING_DURATION

```solidity
uint256 public constant CSOV_VESTING_DURATION = 10 * FOUR_WEEKS;
```


### vestingFactory

```solidity
IVestingFactory public vestingFactory;
```


### SOV
The SOV token contract.


```solidity
address public SOV;
```


### CSOVtokens
The CSOV token contracts.


```solidity
address[] public CSOVtokens;
```


### priceSats

```solidity
uint256 public priceSats;
```


### staking
The staking contract address.


```solidity
address public staking;
```


### feeSharingCollector
Fee sharing proxy.


```solidity
address public feeSharingCollector;
```


### vestingOwner
The vesting owner (e.g. governance timelock address).


```solidity
address public vestingOwner;
```


### vestingContracts
*TODO: Add to the documentation: address can have only one vesting of each type.*

*user => vesting type => vesting contract*


```solidity
mapping(address => mapping(uint256 => address)) public vestingContracts;
```


### processedList
*Struct can be created to save storage slots, but it doesn't make
sense. We don't have a lot of blacklisted accounts or account with
locked amount.*

*user => flag whether user has already exchange cSOV or got a reimbursement.*


```solidity
mapping(address => bool) public processedList;
```


### blacklist
*user => flag whether user shouldn't be able to exchange or reimburse.*


```solidity
mapping(address => bool) public blacklist;
```


### lockedAmount
*user => amount of tokens should not be processed.*


```solidity
mapping(address => uint256) public lockedAmount;
```


### admins
*user => flag whether user has admin role.*


```solidity
mapping(address => bool) public admins;
```


## Functions
### constructor

Contract deployment settings.

*On Sovryn the vesting owner is Exchequer Multisig.
According to SIP-0007 The Exchequer Multisig is designated to hold
certain funds in the form of rBTC and SOV, in order to allow for
flexible deployment of such funds on:
+ facilitating rBTC redemptions for Genesis pre-sale participants.
+ deploying of SOV for the purposes of exchange listings, market
making, and partnerships with third parties.*


```solidity
constructor(
    address _vestingFactory,
    address _SOV,
    address[] memory _CSOVtokens,
    uint256 _priceSats,
    address _staking,
    address _feeSharingCollector,
    address _vestingOwner
) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vestingFactory`|`address`|The address of vesting factory contract.|
|`_SOV`|`address`|The SOV token address.|
|`_CSOVtokens`|`address[]`|The array of cSOV tokens.|
|`_priceSats`|`uint256`|The price of cSOV tokens in satoshis.|
|`_staking`|`address`|The address of staking contract.|
|`_feeSharingCollector`|`address`|The address of fee sharing proxy contract.|
|`_vestingOwner`|`address`|The address of an owner of vesting contract.|


### onlyAuthorized

*Throws if called by any account other than the owner or admin.*


```solidity
modifier onlyAuthorized();
```

### addAdmin

Add account to ACL.


```solidity
function addAdmin(address _admin) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_admin`|`address`|The addresses of the account to grant permissions.|


### removeAdmin

Remove account from ACL.


```solidity
function removeAdmin(address _admin) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_admin`|`address`|The addresses of the account to revoke permissions.|


### isNotProcessed


```solidity
modifier isNotProcessed();
```

### isNotBlacklisted


```solidity
modifier isNotBlacklisted();
```

### budget

Get contract balance.


```solidity
function budget() external view returns (uint256);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The token balance of the contract.|


### deposit

Deposit function to receiving value (rBTC).


```solidity
function deposit() public payable;
```

### withdrawAll

Send all contract balance to an account.


```solidity
function withdrawAll(address payable to) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`to`|`address payable`|The account address to send the balance to.|


### setVestingFactory

Sets vesting factory address. High level endpoint.

*Splitting code on two functions: high level and low level
is a pattern that makes easy to extend functionality in a readable way,
without accidentally breaking the actual action being performed.
For example, checks should be done on high level endpoint, while core
functionality should be coded on the low level function.*


```solidity
function setVestingFactory(address _vestingFactory) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vestingFactory`|`address`|The address of vesting factory contract.|


### _setVestingFactory

Sets vesting factory address. Low level core function.


```solidity
function _setVestingFactory(address _vestingFactory) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vestingFactory`|`address`|The address of vesting factory contract.|


### setCSOVtokens

Sets cSOV tokens array. High level endpoint.


```solidity
function setCSOVtokens(address[] memory _CSOVtokens) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_CSOVtokens`|`address[]`|The array of cSOV tokens.|


### _setCSOVtokens

Sets cSOV tokens array by looping through input. Low level function.


```solidity
function _setCSOVtokens(address[] memory _CSOVtokens) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_CSOVtokens`|`address[]`|The array of cSOV tokens.|


### setBlacklistFlag

Set blacklist flag (true/false).


```solidity
function setBlacklistFlag(address _account, bool _blacklisted) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_account`|`address`|The address to be blacklisted.|
|`_blacklisted`|`bool`|The flag to add/remove to/from a blacklist.|


### setLockedAmount

Set amount to be subtracted from user token balance.


```solidity
function setLockedAmount(address _account, uint256 _amount) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_account`|`address`|The address with locked amount.|
|`_amount`|`uint256`|The amount to be locked.|


### transferSOV

Transfer SOV tokens to given address.

*This is a wrapper for ERC-20 transfer function w/
additional checks and triggering an event.*


```solidity
function transferSOV(address _receiver, uint256 _amount) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_receiver`|`address`|The address of the SOV receiver.|
|`_amount`|`uint256`|The amount to be transferred.|


### _createVestingForCSOV

cSOV tokens are moved and staked on Vesting contract.


```solidity
function _createVestingForCSOV(uint256 _amount) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_amount`|`uint256`|The amount of tokens to be vested.|


### _validateCSOV

Check a token address is among the cSOV token addresses.


```solidity
function _validateCSOV(address _CSOV) internal view;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_CSOV`|`address`|The cSOV token address.|


### createVesting

Create Vesting contract.


```solidity
function createVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration) public onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|The owner of the tokens.|
|`_amount`|`uint256`|The amount to be staked.|
|`_cliff`|`uint256`|The time interval to the first withdraw in seconds.|
|`_duration`|`uint256`|The total duration in seconds.|


### createTeamVesting

Create Team Vesting contract.


```solidity
function createTeamVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration)
    public
    onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|The owner of the tokens.|
|`_amount`|`uint256`|The amount to be staked.|
|`_cliff`|`uint256`|The time interval to the first withdraw in seconds.|
|`_duration`|`uint256`|The total duration in seconds.|


### stakeTokens

Stake tokens according to the vesting schedule


```solidity
function stakeTokens(address _vesting, uint256 _amount) public onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vesting`|`address`|the address of Vesting contract|
|`_amount`|`uint256`|the amount of tokens to stake|


### getVesting

Query the vesting contract for an account.


```solidity
function getVesting(address _tokenOwner) public view returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|The owner of the tokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The vesting contract address for the given token owner.|


### getTeamVesting

Query the team vesting contract for an account.


```solidity
function getTeamVesting(address _tokenOwner) public view returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|The owner of the tokens.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The team vesting contract address for the given token owner.|


### _getOrCreateVesting

If not exists, deploy a vesting contract through factory.


```solidity
function _getOrCreateVesting(address _tokenOwner, uint256 _cliff, uint256 _duration) internal returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|The owner of the tokens.|
|`_cliff`|`uint256`|The time interval to the first withdraw in seconds.|
|`_duration`|`uint256`|The total duration in seconds.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The vesting contract address for the given token owner whether it existed previously or not.|


### _getOrCreateTeamVesting

If not exists, deploy a team vesting contract through factory.


```solidity
function _getOrCreateTeamVesting(address _tokenOwner, uint256 _cliff, uint256 _duration) internal returns (address);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokenOwner`|`address`|The owner of the tokens.|
|`_cliff`|`uint256`|The time interval to the first withdraw in seconds.|
|`_duration`|`uint256`|The total duration in seconds.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`address`|The team vesting contract address for the given token owner whether it existed previously or not.|


## Events
### CSOVTokensExchanged

```solidity
event CSOVTokensExchanged(address indexed caller, uint256 amount);
```

### SOVTransferred

```solidity
event SOVTransferred(address indexed receiver, uint256 amount);
```

### VestingCreated

```solidity
event VestingCreated(address indexed tokenOwner, address vesting, uint256 cliff, uint256 duration, uint256 amount);
```

### TeamVestingCreated

```solidity
event TeamVestingCreated(address indexed tokenOwner, address vesting, uint256 cliff, uint256 duration, uint256 amount);
```

### TokensStaked

```solidity
event TokensStaked(address indexed vesting, uint256 amount);
```

### AdminAdded

```solidity
event AdminAdded(address admin);
```

### AdminRemoved

```solidity
event AdminRemoved(address admin);
```

## Enums
### VestingType

```solidity
enum VestingType {
    TeamVesting,
    Vesting
}
```

