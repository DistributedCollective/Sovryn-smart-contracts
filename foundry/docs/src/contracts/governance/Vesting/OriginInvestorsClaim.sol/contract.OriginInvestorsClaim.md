# OriginInvestorsClaim
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Vesting/OriginInvestorsClaim.sol)

**Inherits:**
[Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

// TODO: fund this contract with a total amount of SOV needed to distribute.


## State Variables
### totalAmount
VestingRegistry public constant vestingRegistry = VestingRegistry(0x80B036ae59B3e38B573837c01BB1DB95515b7E6B);


```solidity
uint256 public totalAmount;
```


### SOV_VESTING_CLIFF
Constant used for computing the vesting dates.


```solidity
uint256 public constant SOV_VESTING_CLIFF = 6 weeks;
```


### kickoffTS

```solidity
uint256 public kickoffTS;
```


### vestingTerm

```solidity
uint256 public vestingTerm;
```


### investorsQty

```solidity
uint256 public investorsQty;
```


### investorsListInitialized

```solidity
bool public investorsListInitialized;
```


### vestingRegistry

```solidity
VestingRegistry public vestingRegistry;
```


### staking

```solidity
IStaking public staking;
```


### SOVToken

```solidity
IERC20 public SOVToken;
```


### admins
*user => flag : Whether user has admin role.*


```solidity
mapping(address => bool) public admins;
```


### investorsAmountsList
*investor => Amount : Origin investors entitled to claim SOV.*


```solidity
mapping(address => uint256) public investorsAmountsList;
```


## Functions
### onlyAuthorized

*Throws if called by any account other than the owner or admin.*


```solidity
modifier onlyAuthorized();
```

### onlyWhitelisted

*Throws if called by any account not whitelisted.*


```solidity
modifier onlyWhitelisted();
```

### notInitialized

*Throws if called w/ an initialized investors list.*


```solidity
modifier notInitialized();
```

### initialized

*Throws if called w/ an uninitialized investors list.*


```solidity
modifier initialized();
```

### constructor

Contract deployment requires one parameter:


```solidity
constructor(address vestingRegistryAddress) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`vestingRegistryAddress`|`address`|The vestingRegistry contract instance address.|


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


### authorizedBalanceWithdraw

In case we have unclaimed tokens or in emergency case
this function transfers all SOV tokens to a given address.


```solidity
function authorizedBalanceWithdraw(address toAddress) public onlyAuthorized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`toAddress`|`address`|The recipient address of all this contract tokens.|


### setInvestorsAmountsListInitialized

Should be called after the investors list setup completed.
This function checks whether the SOV token balance of the contract is
enough and sets status list to initialized.


```solidity
function setInvestorsAmountsListInitialized() public onlyAuthorized notInitialized;
```

### appendInvestorsAmountsList

The contract should be approved or transferred necessary
amount of SOV prior to calling the function.


```solidity
function appendInvestorsAmountsList(address[] calldata investors, uint256[] calldata claimAmounts)
    external
    onlyAuthorized
    notInitialized;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`investors`|`address[]`|The list of investors addresses to add to the list. Duplicates will be skipped.|
|`claimAmounts`|`uint256[]`|The list of amounts for investors investors[i] will receive claimAmounts[i] of SOV.|


### claim

Claim tokens from this contract.
If vestingTerm is not yet achieved a vesting is created.
Otherwise tokens are tranferred.


```solidity
function claim() external onlyWhitelisted initialized;
```

### createVesting

Transfer tokens from this contract to a vestingRegistry contract.
Sender is removed from investor list and all its unvested tokens
are sent to vesting contract.


```solidity
function createVesting() internal;
```

### transfer

Transfer tokens from this contract to the sender.
Sender is removed from investor list and all its unvested tokens
are sent to its account.


```solidity
function transfer() internal;
```

## Events
### AdminAdded

```solidity
event AdminAdded(address admin);
```

### AdminRemoved

```solidity
event AdminRemoved(address admin);
```

### InvestorsAmountsListAppended

```solidity
event InvestorsAmountsListAppended(uint256 qty, uint256 amount);
```

### ClaimVested

```solidity
event ClaimVested(address indexed investor, uint256 amount);
```

### ClaimTransferred

```solidity
event ClaimTransferred(address indexed investor, uint256 amount);
```

### InvestorsAmountsListInitialized

```solidity
event InvestorsAmountsListInitialized(uint256 qty, uint256 totalAmount);
```

