# The Locked SOV Contract. (LockedSOV.sol)

View Source: [contracts/locked/LockedSOV.sol](../contracts/locked/LockedSOV.sol)

**↗ Extends: [ILockedSOV](ILockedSOV.md)**

**LockedSOV**

This contract is used to receive reward from other contracts, Create Vesting and Stake Tokens.

## Contract Members
**Constants & Variables**

```js
//public members
uint256 public constant MAX_BASIS_POINT;
uint256 public constant MAX_DURATION;
bool public migration;
uint256 public cliff;
uint256 public duration;
contract IERC20 public SOV;
contract VestingRegistry public vestingRegistry;
contract ILockedSOV public newLockedSOV;

//private members
mapping(address => uint256) private lockedBalances;
mapping(address => uint256) private unlockedBalances;
mapping(address => bool) private isAdmin;

```

**Events**

```js
event AdminAdded(address indexed _initiator, address indexed _newAdmin);
event AdminRemoved(address indexed _initiator, address indexed _removedAdmin);
event RegistryCliffAndDurationUpdated(address indexed _initiator, address indexed _vestingRegistry, uint256  _cliff, uint256  _duration);
event Deposited(address indexed _initiator, address indexed _userAddress, uint256  _sovAmount, uint256  _basisPoint);
event Withdrawn(address indexed _initiator, address indexed _userAddress, uint256  _sovAmount);
event VestingCreated(address indexed _initiator, address indexed _userAddress, address indexed _vesting);
event TokenStaked(address indexed _initiator, address indexed _vesting, uint256  _amount);
event MigrationStarted(address indexed _initiator, address indexed _newLockedSOV);
event UserTransfered(address indexed _initiator, uint256  _amount);
```

## Modifiers

- [onlyAdmin](#onlyadmin)
- [migrationAllowed](#migrationallowed)

### onlyAdmin

```js
modifier onlyAdmin() internal
```

### migrationAllowed

```js
modifier migrationAllowed() internal
```

## Functions

- [constructor(address _SOV, address _vestingRegistry, uint256 _cliff, uint256 _duration, address[] _admins)](#constructor)
- [addAdmin(address _newAdmin)](#addadmin)
- [removeAdmin(address _adminToRemove)](#removeadmin)
- [changeRegistryCliffAndDuration(address _vestingRegistry, uint256 _cliff, uint256 _duration)](#changeregistrycliffandduration)
- [deposit(address _userAddress, uint256 _sovAmount, uint256 _basisPoint)](#deposit)
- [depositSOV(address _userAddress, uint256 _sovAmount)](#depositsov)
- [_deposit(address _userAddress, uint256 _sovAmount, uint256 _basisPoint)](#_deposit)
- [withdraw(address _receiverAddress)](#withdraw)
- [_withdraw(address _sender, address _receiverAddress)](#_withdraw)
- [createVestingAndStake()](#createvestingandstake)
- [_createVestingAndStake(address _sender)](#_createvestingandstake)
- [createVesting()](#createvesting)
- [stakeTokens()](#staketokens)
- [withdrawAndStakeTokens(address _receiverAddress)](#withdrawandstaketokens)
- [withdrawAndStakeTokensFrom(address _userAddress)](#withdrawandstaketokensfrom)
- [startMigration(address _newLockedSOV)](#startmigration)
- [transfer()](#transfer)
- [_createVesting(address _tokenOwner)](#_createvesting)
- [_getVesting(address _tokenOwner)](#_getvesting)
- [_stakeTokens(address _sender, address _vesting)](#_staketokens)
- [getLockedBalance(address _addr)](#getlockedbalance)
- [getUnlockedBalance(address _addr)](#getunlockedbalance)
- [adminStatus(address _addr)](#adminstatus)

---    

> ### constructor

Setup the required parameters.

```solidity
function (address _SOV, address _vestingRegistry, uint256 _cliff, uint256 _duration, address[] _admins) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _SOV | address | The SOV Token Address. | 
| _vestingRegistry | address | The Vesting Registry Address. | 
| _cliff | uint256 | The time period after which the tokens begin to unlock. | 
| _duration | uint256 | The time period after all tokens will have been unlocked. | 
| _admins | address[] | The list of Admins to be added. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor(
        address _SOV,
        address _vestingRegistry,
        uint256 _cliff,
        uint256 _duration,
        address[] memory _admins
    ) public {
        require(_SOV != address(0), "Invalid SOV Address.");
        require(_vestingRegistry != address(0), "Vesting registry address is invalid.");
        require(_duration < MAX_DURATION, "Duration is too long.");

        SOV = IERC20(_SOV);
        vestingRegistry = VestingRegistry(_vestingRegistry);
        cliff = _cliff * 4 weeks;
        duration = _duration * 4 weeks;

        for (uint256 index = 0; index < _admins.length; index++) {
            isAdmin[_admins[index]] = true;
        }
    }
```
</details>

---    

> ### addAdmin

The function to add a new admin.

```solidity
function addAdmin(address _newAdmin) public nonpayable onlyAdmin 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newAdmin | address | The address of the new admin. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addAdmin(address _newAdmin) public onlyAdmin {
        require(_newAdmin != address(0), "Invalid Address.");
        require(!isAdmin[_newAdmin], "Address is already admin.");
        isAdmin[_newAdmin] = true;

        emit AdminAdded(msg.sender, _newAdmin);
    }
```
</details>

---    

> ### removeAdmin

The function to remove an admin.

```solidity
function removeAdmin(address _adminToRemove) public nonpayable onlyAdmin 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _adminToRemove | address | The address of the admin which should be removed. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeAdmin(address _adminToRemove) public onlyAdmin {
        require(isAdmin[_adminToRemove], "Address is not an admin.");
        isAdmin[_adminToRemove] = false;

        emit AdminRemoved(msg.sender, _adminToRemove);
    }
```
</details>

---    

> ### changeRegistryCliffAndDuration

The function to update the Vesting Registry, Duration and Cliff.

```solidity
function changeRegistryCliffAndDuration(address _vestingRegistry, uint256 _cliff, uint256 _duration) external nonpayable onlyAdmin 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingRegistry | address | The Vesting Registry Address. | 
| _cliff | uint256 | The time period after which the tokens begin to unlock. | 
| _duration | uint256 | The time period after all tokens will have been unlocked. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function changeRegistryCliffAndDuration(
        address _vestingRegistry,
        uint256 _cliff,
        uint256 _duration
    ) external onlyAdmin {
        require(
            address(vestingRegistry) != _vestingRegistry,
            "Vesting Registry has to be different for changing duration and cliff."
        );
        /// If duration is also zero, then it is similar to Unlocked SOV.
        require(_duration != 0, "Duration cannot be zero.");
        require(_duration < MAX_DURATION, "Duration is too long.");

        vestingRegistry = VestingRegistry(_vestingRegistry);

        cliff = _cliff * 4 weeks;
        duration = _duration * 4 weeks;

        emit RegistryCliffAndDurationUpdated(msg.sender, _vestingRegistry, _cliff, _duration);
    }
```
</details>

---    

> ### deposit

⤾ overrides [ILockedSOV.deposit](ILockedSOV.md#deposit)

Adds SOV to the user balance (Locked and Unlocked Balance based on `_basisPoint`).

```solidity
function deposit(address _userAddress, uint256 _sovAmount, uint256 _basisPoint) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _userAddress | address | The user whose locked balance has to be updated with `_sovAmount`. | 
| _sovAmount | uint256 | The amount of SOV to be added to the locked and/or unlocked balance. | 
| _basisPoint | uint256 | The % (in Basis Point)which determines how much will be unlocked immediately. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function deposit(
        address _userAddress,
        uint256 _sovAmount,
        uint256 _basisPoint
    ) external {
        _deposit(_userAddress, _sovAmount, _basisPoint);
    }
```
</details>

---    

> ### depositSOV

⤾ overrides [ILockedSOV.depositSOV](ILockedSOV.md#depositsov)

Adds SOV to the locked balance of a user.

```solidity
function depositSOV(address _userAddress, uint256 _sovAmount) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _userAddress | address | The user whose locked balance has to be updated with _sovAmount. | 
| _sovAmount | uint256 | The amount of SOV to be added to the locked balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function depositSOV(address _userAddress, uint256 _sovAmount) external {
        _deposit(_userAddress, _sovAmount, 0);
    }
```
</details>

---    

> ### _deposit

```solidity
function _deposit(address _userAddress, uint256 _sovAmount, uint256 _basisPoint) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _userAddress | address |  | 
| _sovAmount | uint256 |  | 
| _basisPoint | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _deposit(
        address _userAddress,
        uint256 _sovAmount,
        uint256 _basisPoint
    ) private {
        // MAX_BASIS_POINT is not included because if 100% is unlocked, then LockedSOV is not required to be used.
        require(_basisPoint < MAX_BASIS_POINT, "Basis Point has to be less than 10000.");
        bool txStatus = SOV.transferFrom(msg.sender, address(this), _sovAmount);
        require(txStatus, "Token transfer was not successful. Check receiver address.");

        uint256 unlockedBal = _sovAmount.mul(_basisPoint).div(MAX_BASIS_POINT);

        unlockedBalances[_userAddress] = unlockedBalances[_userAddress].add(unlockedBal);
        lockedBalances[_userAddress] = lockedBalances[_userAddress].add(_sovAmount).sub(
            unlockedBal
        );

        emit Deposited(msg.sender, _userAddress, _sovAmount, _basisPoint);
    }
```
</details>

---    

> ### withdraw

A function to withdraw the unlocked balance.

```solidity
function withdraw(address _receiverAddress) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiverAddress | address | If specified, the unlocked balance will go to this address, else to msg.sender. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdraw(address _receiverAddress) public {
        _withdraw(msg.sender, _receiverAddress);
    }
```
</details>

---    

> ### _withdraw

```solidity
function _withdraw(address _sender, address _receiverAddress) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sender | address |  | 
| _receiverAddress | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _withdraw(address _sender, address _receiverAddress) private {
        address userAddr = _receiverAddress;
        if (_receiverAddress == address(0)) {
            userAddr = _sender;
        }

        uint256 amount = unlockedBalances[_sender];
        unlockedBalances[_sender] = 0;

        bool txStatus = SOV.transfer(userAddr, amount);
        require(txStatus, "Token transfer was not successful. Check receiver address.");

        emit Withdrawn(_sender, userAddr, amount);
    }
```
</details>

---    

> ### createVestingAndStake

Creates vesting if not already created and Stakes tokens for a user.

```solidity
function createVestingAndStake() public nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function createVestingAndStake() public {
        _createVestingAndStake(msg.sender);
    }
```
</details>

---    

> ### _createVestingAndStake

```solidity
function _createVestingAndStake(address _sender) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sender | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _createVestingAndStake(address _sender) private {
        address vestingAddr = _getVesting(_sender);

        if (vestingAddr == address(0)) {
            vestingAddr = _createVesting(_sender);
        }

        _stakeTokens(_sender, vestingAddr);
    }
```
</details>

---    

> ### createVesting

Creates vesting contract (if it hasn't been created yet) for the calling user.

```solidity
function createVesting() public nonpayable
returns(_vestingAddress address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function createVesting() public returns (address _vestingAddress) {
        _vestingAddress = _createVesting(msg.sender);
    }
```
</details>

---    

> ### stakeTokens

Stakes tokens for a user who already have a vesting created.

```solidity
function stakeTokens() public nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function stakeTokens() public {
        VestingLogic vesting = VestingLogic(_getVesting(msg.sender));

        require(
            cliff == vesting.cliff() && duration == vesting.duration(),
            "Wrong Vesting Schedule."
        );

        _stakeTokens(msg.sender, address(vesting));
    }
```
</details>

---    

> ### withdrawAndStakeTokens

Withdraws unlocked tokens and Stakes Locked tokens for a user who already have a vesting created.

```solidity
function withdrawAndStakeTokens(address _receiverAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiverAddress | address | If specified, the unlocked balance will go to this address, else to msg.sender. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawAndStakeTokens(address _receiverAddress) external {
        _withdraw(msg.sender, _receiverAddress);
        _createVestingAndStake(msg.sender);
    }
```
</details>

---    

> ### withdrawAndStakeTokensFrom

⤾ overrides [ILockedSOV.withdrawAndStakeTokensFrom](ILockedSOV.md#withdrawandstaketokensfrom)

Withdraws unlocked tokens and Stakes Locked tokens for a user who already have a vesting created.

```solidity
function withdrawAndStakeTokensFrom(address _userAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _userAddress | address | The address of user tokens will be withdrawn. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdrawAndStakeTokensFrom(address _userAddress) external {
        _withdraw(_userAddress, _userAddress);
        _createVestingAndStake(_userAddress);
    }
```
</details>

---    

> ### startMigration

Function to start the process of migration to new contract.

```solidity
function startMigration(address _newLockedSOV) external nonpayable onlyAdmin 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newLockedSOV | address | The new locked sov contract address. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function startMigration(address _newLockedSOV) external onlyAdmin {
        require(_newLockedSOV != address(0), "New Locked SOV Address is Invalid.");
        newLockedSOV = ILockedSOV(_newLockedSOV);
        SOV.approve(_newLockedSOV, SOV.balanceOf(address(this)));
        migration = true;

        emit MigrationStarted(msg.sender, _newLockedSOV);
    }
```
</details>

---    

> ### transfer

Function to transfer the locked balance from this contract to new LockedSOV Contract.

```solidity
function transfer() external nonpayable migrationAllowed 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function transfer() external migrationAllowed {
        uint256 amount = lockedBalances[msg.sender];
        lockedBalances[msg.sender] = 0;

        newLockedSOV.depositSOV(msg.sender, amount);

        emit UserTransfered(msg.sender, amount);
    }
```
</details>

---    

> ### _createVesting

Creates a Vesting Contract for a user.

```solidity
function _createVesting(address _tokenOwner) internal nonpayable
returns(_vestingAddress address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | The owner of the vesting contract. | 

**Returns**

_vestingAddress The Vesting Contract Address.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _createVesting(address _tokenOwner) internal returns (address _vestingAddress) {
        /// Here zero is given in place of amount, as amount is not really used in `vestingRegistry.createVesting()`.
        vestingRegistry.createVesting(_tokenOwner, 0, cliff, duration);
        _vestingAddress = _getVesting(_tokenOwner);
        emit VestingCreated(msg.sender, _tokenOwner, _vestingAddress);
    }
```
</details>

---    

> ### _getVesting

Returns the Vesting Contract Address.

```solidity
function _getVesting(address _tokenOwner) internal view
returns(_vestingAddress address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | The owner of the vesting contract. | 

**Returns**

_vestingAddress The Vesting Contract Address.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getVesting(address _tokenOwner) internal view returns (address _vestingAddress) {
        return vestingRegistry.getVesting(_tokenOwner);
    }
```
</details>

---    

> ### _stakeTokens

Stakes the tokens in a particular vesting contract.

```solidity
function _stakeTokens(address _sender, address _vesting) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sender | address |  | 
| _vesting | address | The Vesting Contract Address. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _stakeTokens(address _sender, address _vesting) internal {
        uint256 amount = lockedBalances[_sender];
        lockedBalances[_sender] = 0;

        require(SOV.approve(_vesting, amount), "Approve failed.");
        VestingLogic(_vesting).stakeTokens(amount);

        emit TokenStaked(_sender, _vesting, amount);
    }
```
</details>

---    

> ### getLockedBalance

The function to get the locked balance of a user.

```solidity
function getLockedBalance(address _addr) external view
returns(_balance uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _addr | address | The address of the user to check the locked balance. | 

**Returns**

_balance The locked balance of the address `_addr`.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getLockedBalance(address _addr) external view returns (uint256 _balance) {
        return lockedBalances[_addr];
    }
```
</details>

---    

> ### getUnlockedBalance

The function to get the unlocked balance of a user.

```solidity
function getUnlockedBalance(address _addr) external view
returns(_balance uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _addr | address | The address of the user to check the unlocked balance. | 

**Returns**

_balance The unlocked balance of the address `_addr`.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getUnlockedBalance(address _addr) external view returns (uint256 _balance) {
        return unlockedBalances[_addr];
    }
```
</details>

---    

> ### adminStatus

The function to check is an address is admin or not.

```solidity
function adminStatus(address _addr) external view
returns(_status bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _addr | address | The address of the user to check the admin status. | 

**Returns**

_status True if admin, False otherwise.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function adminStatus(address _addr) external view returns (bool _status) {
        return isAdmin[_addr];
    }
```
</details>

## Contracts

* [Address](Address.md)
* [Administered](Administered.md)
* [AdminRole](AdminRole.md)
* [AdvancedToken](AdvancedToken.md)
* [AdvancedTokenStorage](AdvancedTokenStorage.md)
* [Affiliates](Affiliates.md)
* [AffiliatesEvents](AffiliatesEvents.md)
* [ApprovalReceiver](ApprovalReceiver.md)
* [BProPriceFeed](BProPriceFeed.md)
* [Checkpoints](Checkpoints.md)
* [Constants](Constants.md)
* [Context](Context.md)
* [DevelopmentFund](DevelopmentFund.md)
* [DummyContract](DummyContract.md)
* [ECDSA](ECDSA.md)
* [EnumerableAddressSet](EnumerableAddressSet.md)
* [EnumerableBytes32Set](EnumerableBytes32Set.md)
* [EnumerableBytes4Set](EnumerableBytes4Set.md)
* [ERC20](ERC20.md)
* [ERC20Detailed](ERC20Detailed.md)
* [ErrorDecoder](ErrorDecoder.md)
* [Escrow](Escrow.md)
* [EscrowReward](EscrowReward.md)
* [FeedsLike](FeedsLike.md)
* [FeesEvents](FeesEvents.md)
* [FeeSharingLogic](FeeSharingLogic.md)
* [FeeSharingProxy](FeeSharingProxy.md)
* [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
* [FeesHelper](FeesHelper.md)
* [FourYearVesting](FourYearVesting.md)
* [FourYearVestingFactory](FourYearVestingFactory.md)
* [FourYearVestingLogic](FourYearVestingLogic.md)
* [FourYearVestingStorage](FourYearVestingStorage.md)
* [GenericTokenSender](GenericTokenSender.md)
* [GovernorAlpha](GovernorAlpha.md)
* [GovernorVault](GovernorVault.md)
* [IApproveAndCall](IApproveAndCall.md)
* [IChai](IChai.md)
* [IContractRegistry](IContractRegistry.md)
* [IConverterAMM](IConverterAMM.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IFeeSharingProxy](IFeeSharingProxy.md)
* [IFourYearVesting](IFourYearVesting.md)
* [IFourYearVestingFactory](IFourYearVestingFactory.md)
* [ILiquidityMining](ILiquidityMining.md)
* [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
* [ILoanPool](ILoanPool.md)
* [ILoanToken](ILoanToken.md)
* [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
* [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
* [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
* [ILoanTokenModules](ILoanTokenModules.md)
* [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
* [ILockedSOV](ILockedSOV.md)
* [IMoCState](IMoCState.md)
* [Initializable](Initializable.md)
* [InterestUser](InterestUser.md)
* [IPot](IPot.md)
* [IPriceFeeds](IPriceFeeds.md)
* [IPriceFeedsExt](IPriceFeedsExt.md)
* [IProtocol](IProtocol.md)
* [IRSKOracle](IRSKOracle.md)
* [ISovryn](ISovryn.md)
* [ISovrynSwapNetwork](ISovrynSwapNetwork.md)
* [IStaking](IStaking.md)
* [ISwapsImpl](ISwapsImpl.md)
* [ITeamVesting](ITeamVesting.md)
* [ITimelock](ITimelock.md)
* [IV1PoolOracle](IV1PoolOracle.md)
* [IVesting](IVesting.md)
* [IVestingFactory](IVestingFactory.md)
* [IVestingRegistry](IVestingRegistry.md)
* [IWrbtc](IWrbtc.md)
* [IWrbtcERC20](IWrbtcERC20.md)
* [LenderInterestStruct](LenderInterestStruct.md)
* [LiquidationHelper](LiquidationHelper.md)
* [LiquidityMining](LiquidityMining.md)
* [LiquidityMiningConfigToken](LiquidityMiningConfigToken.md)
* [LiquidityMiningProxy](LiquidityMiningProxy.md)
* [LiquidityMiningStorage](LiquidityMiningStorage.md)
* [LoanClosingsEvents](LoanClosingsEvents.md)
* [LoanClosingsLiquidation](LoanClosingsLiquidation.md)
* [LoanClosingsRollover](LoanClosingsRollover.md)
* [LoanClosingsShared](LoanClosingsShared.md)
* [LoanClosingsWith](LoanClosingsWith.md)
* [LoanInterestStruct](LoanInterestStruct.md)
* [LoanMaintenance](LoanMaintenance.md)
* [LoanMaintenanceEvents](LoanMaintenanceEvents.md)
* [LoanOpenings](LoanOpenings.md)
* [LoanOpeningsEvents](LoanOpeningsEvents.md)
* [LoanParamsStruct](LoanParamsStruct.md)
* [LoanSettings](LoanSettings.md)
* [LoanSettingsEvents](LoanSettingsEvents.md)
* [LoanStruct](LoanStruct.md)
* [LoanToken](LoanToken.md)
* [LoanTokenBase](LoanTokenBase.md)
* [LoanTokenLogicBeacon](LoanTokenLogicBeacon.md)
* [LoanTokenLogicLM](LoanTokenLogicLM.md)
* [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
* [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
* [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
* [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
* [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
* [LockedSOV](LockedSOV.md)
* [Medianizer](Medianizer.md)
* [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
* [ModulesCommonEvents](ModulesCommonEvents.md)
* [MultiSigKeyHolders](MultiSigKeyHolders.md)
* [MultiSigWallet](MultiSigWallet.md)
* [Objects](Objects.md)
* [OrderStruct](OrderStruct.md)
* [OrigingVestingCreator](OrigingVestingCreator.md)
* [OriginInvestorsClaim](OriginInvestorsClaim.md)
* [Ownable](Ownable.md)
* [Pausable](Pausable.md)
* [PausableOz](PausableOz.md)
* [PreviousLoanToken](PreviousLoanToken.md)
* [PreviousLoanTokenSettingsLowerAdmin](PreviousLoanTokenSettingsLowerAdmin.md)
* [PriceFeedRSKOracle](PriceFeedRSKOracle.md)
* [PriceFeeds](PriceFeeds.md)
* [PriceFeedsLocal](PriceFeedsLocal.md)
* [PriceFeedsMoC](PriceFeedsMoC.md)
* [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
* [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
* [ProtocolLike](ProtocolLike.md)
* [ProtocolSettings](ProtocolSettings.md)
* [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
* [ProtocolSettingsLike](ProtocolSettingsLike.md)
* [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
* [ProtocolTokenUser](ProtocolTokenUser.md)
* [Proxy](Proxy.md)
* [ReentrancyGuard](ReentrancyGuard.md)
* [RewardHelper](RewardHelper.md)
* [RSKAddrValidator](RSKAddrValidator.md)
* [SafeERC20](SafeERC20.md)
* [SafeMath](SafeMath.md)
* [SafeMath96](SafeMath96.md)
* [setGet](setGet.md)
* [SignedSafeMath](SignedSafeMath.md)
* [SOV](SOV.md)
* [sovrynProtocol](sovrynProtocol.md)
* [Staking](Staking.md)
* [StakingInterface](StakingInterface.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingStorage](StakingStorage.md)
* [State](State.md)
* [SVR](SVR.md)
* [SwapsEvents](SwapsEvents.md)
* [SwapsExternal](SwapsExternal.md)
* [SwapsImplLocal](SwapsImplLocal.md)
* [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
* [SwapsUser](SwapsUser.md)
* [TeamVesting](TeamVesting.md)
* [Timelock](Timelock.md)
* [TimelockHarness](TimelockHarness.md)
* [TimelockInterface](TimelockInterface.md)
* [TokenSender](TokenSender.md)
* [UpgradableProxy](UpgradableProxy.md)
* [USDTPriceFeed](USDTPriceFeed.md)
* [VaultController](VaultController.md)
* [Vesting](Vesting.md)
* [VestingCreator](VestingCreator.md)
* [VestingFactory](VestingFactory.md)
* [VestingLogic](VestingLogic.md)
* [VestingRegistry](VestingRegistry.md)
* [VestingRegistry2](VestingRegistry2.md)
* [VestingRegistry3](VestingRegistry3.md)
* [VestingRegistryLogic](VestingRegistryLogic.md)
* [VestingRegistryProxy](VestingRegistryProxy.md)
* [VestingRegistryStorage](VestingRegistryStorage.md)
* [VestingStorage](VestingStorage.md)
* [WeightedStaking](WeightedStaking.md)
* [WRBTC](WRBTC.md)
