# VestingRegistry
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/VestingRegistry.sol)

**Inherits:**
[Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

On January 25, 2020, Sovryn launched the Genesis Reservation system.
Sovryn community members who controlled a special NFT were granted access to
stake BTC or rBTC for cSOV tokens at a rate of 2500 satoshis per cSOV. Per
SIP-0003, up to 2,000,000 cSOV were made available in the Genesis event,
which will be redeemable on a 1:1 basis for cSOV, subject to approval by
existing SOV holders.
On 15 Feb 2021 Sovryn is taking another step in its journey to decentralized
financial sovereignty with the vote on SIP 0005. This proposal will enable
participants of the Genesis Reservation system to redeem their reserved cSOV
tokens for SOV. They will also have the choice to redeem cSOV for rBTC if
they decide to exit the system.
This contract deals with the vesting and redemption of cSOV tokens.


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
The cSOV token contracts.


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

*user => vesting type => vesting contract.*


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
|`_feeSharingCollector`|`address`|The address of fee sharing collector proxy contract.|
|`_vestingOwner`|`address`|The address of an owner of vesting contract.|


### onlyAuthorized

*Throws if called by any account other than the owner or admin.
TODO: This ACL logic should be available on OpenZeppeling Ownable.sol
or on our own overriding sovrynOwnable. This same logic is repeated
on OriginInvestorsClaim.sol, TokenSender.sol and VestingRegistry2.sol*


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

### reImburse

cSOV payout to sender with rBTC currency.
1.- Check holder cSOV balance by adding up every cSOV token balance.
2.- ReImburse rBTC if funds available.
3.- And store holder address in processedList.


```solidity
function reImburse() public isNotProcessed isNotBlacklisted;
```

### budget

Get contract balance.

*Found and fixed the SIP-0007 bug on VestingRegistry::reImburse formula.
More details at Documenting Code issues at point 11 in
https://docs.google.com/document/d/10idTD1K6JvoBmtPKGuJ2Ub_mMh6qTLLlTP693GQKMyU/
Previous buggy code: uint256 reImburseAmount = (CSOVAmountWei.mul(priceSats)).div(10**10);*


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


### exchangeAllCSOV

Exchange cSOV to SOV with 1:1 rate


```solidity
function exchangeAllCSOV() public isNotProcessed isNotBlacklisted;
```

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

Stake tokens according to the vesting schedule.


```solidity
function stakeTokens(address _vesting, uint256 _amount) public onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_vesting`|`address`|The address of Vesting contract.|
|`_amount`|`uint256`|The amount of tokens to stake.|


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

*TODO: Owner of OwnerVesting contracts - the same address as tokenOwner.*


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
### CSOVReImburse

```solidity
event CSOVReImburse(address from, uint256 CSOVamount, uint256 reImburseAmount);
```

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

