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

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### migrationAllowed

```js
modifier migrationAllowed() internal
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

## Functions

- [(address _SOV, address _vestingRegistry, uint256 _cliff, uint256 _duration, address[] _admins)](#)
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

### 

Setup the required parameters.

```js
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

### addAdmin

The function to add a new admin.

```js
function addAdmin(address _newAdmin) public nonpayable onlyAdmin 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newAdmin | address | The address of the new admin. | 

### removeAdmin

The function to remove an admin.

```js
function removeAdmin(address _adminToRemove) public nonpayable onlyAdmin 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _adminToRemove | address | The address of the admin which should be removed. | 

### changeRegistryCliffAndDuration

The function to update the Vesting Registry, Duration and Cliff.

```js
function changeRegistryCliffAndDuration(address _vestingRegistry, uint256 _cliff, uint256 _duration) external nonpayable onlyAdmin 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingRegistry | address | The Vesting Registry Address. | 
| _cliff | uint256 | The time period after which the tokens begin to unlock. | 
| _duration | uint256 | The time period after all tokens will have been unlocked. | 

### deposit

⤾ overrides [ILockedSOV.deposit](ILockedSOV.md#deposit)

Adds SOV to the user balance (Locked and Unlocked Balance based on `_basisPoint`).

```js
function deposit(address _userAddress, uint256 _sovAmount, uint256 _basisPoint) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _userAddress | address | The user whose locked balance has to be updated with `_sovAmount`. | 
| _sovAmount | uint256 | The amount of SOV to be added to the locked and/or unlocked balance. | 
| _basisPoint | uint256 | The % (in Basis Point)which determines how much will be unlocked immediately. | 

### depositSOV

⤾ overrides [ILockedSOV.depositSOV](ILockedSOV.md#depositsov)

Adds SOV to the locked balance of a user.

```js
function depositSOV(address _userAddress, uint256 _sovAmount) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _userAddress | address | The user whose locked balance has to be updated with _sovAmount. | 
| _sovAmount | uint256 | The amount of SOV to be added to the locked balance. | 

### _deposit

```js
function _deposit(address _userAddress, uint256 _sovAmount, uint256 _basisPoint) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _userAddress | address |  | 
| _sovAmount | uint256 |  | 
| _basisPoint | uint256 |  | 

### withdraw

A function to withdraw the unlocked balance.

```js
function withdraw(address _receiverAddress) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiverAddress | address | If specified, the unlocked balance will go to this address, else to msg.sender. | 

### _withdraw

```js
function _withdraw(address _sender, address _receiverAddress) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sender | address |  | 
| _receiverAddress | address |  | 

### createVestingAndStake

Creates vesting if not already created and Stakes tokens for a user.

```js
function createVestingAndStake() public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### _createVestingAndStake

```js
function _createVestingAndStake(address _sender) private nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sender | address |  | 

### createVesting

Creates vesting contract (if it hasn't been created yet) for the calling user.

```js
function createVesting() public nonpayable
returns(_vestingAddress address)
```

**Returns**

_vestingAddress The New Vesting Contract Created.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### stakeTokens

Stakes tokens for a user who already have a vesting created.

```js
function stakeTokens() public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### withdrawAndStakeTokens

Withdraws unlocked tokens and Stakes Locked tokens for a user who already have a vesting created.

```js
function withdrawAndStakeTokens(address _receiverAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _receiverAddress | address | If specified, the unlocked balance will go to this address, else to msg.sender. | 

### withdrawAndStakeTokensFrom

⤾ overrides [ILockedSOV.withdrawAndStakeTokensFrom](ILockedSOV.md#withdrawandstaketokensfrom)

Withdraws unlocked tokens and Stakes Locked tokens for a user who already have a vesting created.

```js
function withdrawAndStakeTokensFrom(address _userAddress) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _userAddress | address | The address of user tokens will be withdrawn. | 

### startMigration

Function to start the process of migration to new contract.

```js
function startMigration(address _newLockedSOV) external nonpayable onlyAdmin 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newLockedSOV | address | The new locked sov contract address. | 

### transfer

Function to transfer the locked balance from this contract to new LockedSOV Contract.

```js
function transfer() external nonpayable migrationAllowed 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|

### _createVesting

Creates a Vesting Contract for a user.

```js
function _createVesting(address _tokenOwner) internal nonpayable
returns(_vestingAddress address)
```

**Returns**

_vestingAddress The Vesting Contract Address.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | The owner of the vesting contract. | 

### _getVesting

Returns the Vesting Contract Address.

```js
function _getVesting(address _tokenOwner) internal view
returns(_vestingAddress address)
```

**Returns**

_vestingAddress The Vesting Contract Address.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokenOwner | address | The owner of the vesting contract. | 

### _stakeTokens

Stakes the tokens in a particular vesting contract.

```js
function _stakeTokens(address _sender, address _vesting) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _sender | address |  | 
| _vesting | address | The Vesting Contract Address. | 

### getLockedBalance

The function to get the locked balance of a user.

```js
function getLockedBalance(address _addr) external view
returns(_balance uint256)
```

**Returns**

_balance The locked balance of the address `_addr`.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _addr | address | The address of the user to check the locked balance. | 

### getUnlockedBalance

The function to get the unlocked balance of a user.

```js
function getUnlockedBalance(address _addr) external view
returns(_balance uint256)
```

**Returns**

_balance The unlocked balance of the address `_addr`.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _addr | address | The address of the user to check the unlocked balance. | 

### adminStatus

The function to check is an address is admin or not.

```js
function adminStatus(address _addr) external view
returns(_status bool)
```

**Returns**

_status True if admin, False otherwise.

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _addr | address | The address of the user to check the admin status. | 

## Contracts

* [Address](Address.md)
* [Administered](Administered.md)
* [AdminRole](AdminRole.md)
* [AdvancedToken](AdvancedToken.md)
* [AdvancedTokenStorage](AdvancedTokenStorage.md)
* [Affiliates](Affiliates.md)
* [AffiliatesEvents](AffiliatesEvents.md)
* [ApprovalReceiver](ApprovalReceiver.md)
* [BlockMockUp](BlockMockUp.md)
* [BProPriceFeed](BProPriceFeed.md)
* [BProPriceFeedMockup](BProPriceFeedMockup.md)
* [Checkpoints](Checkpoints.md)
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
* [FeeSharingProxyMockup](FeeSharingProxyMockup.md)
* [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
* [FeesHelper](FeesHelper.md)
* [FlashLoanerTest](FlashLoanerTest.md)
* [GenericTokenSender](GenericTokenSender.md)
* [GovernorAlpha](GovernorAlpha.md)
* [GovernorAlphaMockup](GovernorAlphaMockup.md)
* [GovernorVault](GovernorVault.md)
* [IApproveAndCall](IApproveAndCall.md)
* [IChai](IChai.md)
* [IContractRegistry](IContractRegistry.md)
* [IConverterAMM](IConverterAMM.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IFeeSharingProxy](IFeeSharingProxy.md)
* [ILiquidityMining](ILiquidityMining.md)
* [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
* [ILoanPool](ILoanPool.md)
* [ILoanToken](ILoanToken.md)
* [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
* [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
* [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
* [ILoanTokenModules](ILoanTokenModules.md)
* [ILoanTokenModulesMock](ILoanTokenModulesMock.md)
* [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
* [ILockedSOV](ILockedSOV.md)
* [IMoCState](IMoCState.md)
* [ImplementationMockup](ImplementationMockup.md)
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
* [ITokenFlashLoanTest](ITokenFlashLoanTest.md)
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
* [LiquidityMiningMockup](LiquidityMiningMockup.md)
* [LiquidityMiningProxy](LiquidityMiningProxy.md)
* [LiquidityMiningStorage](LiquidityMiningStorage.md)
* [LiquidityPoolV1ConverterMockup](LiquidityPoolV1ConverterMockup.md)
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
* [LoanTokenLogicLMMockup](LoanTokenLogicLMMockup.md)
* [LoanTokenLogicLMV1Mockup](LoanTokenLogicLMV1Mockup.md)
* [LoanTokenLogicLMV2Mockup](LoanTokenLogicLMV2Mockup.md)
* [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
* [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
* [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
* [LoanTokenLogicTest](LoanTokenLogicTest.md)
* [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
* [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
* [LockedSOV](LockedSOV.md)
* [LockedSOVFailedMockup](LockedSOVFailedMockup.md)
* [LockedSOVMockup](LockedSOVMockup.md)
* [Medianizer](Medianizer.md)
* [MockAffiliates](MockAffiliates.md)
* [MockLoanTokenLogic](MockLoanTokenLogic.md)
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
* [PriceFeedRSKOracleMockup](PriceFeedRSKOracleMockup.md)
* [PriceFeeds](PriceFeeds.md)
* [PriceFeedsConstants](PriceFeedsConstants.md)
* [PriceFeedsMoC](PriceFeedsMoC.md)
* [PriceFeedsMoCMockup](PriceFeedsMoCMockup.md)
* [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
* [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
* [ProtocolLike](ProtocolLike.md)
* [ProtocolSettings](ProtocolSettings.md)
* [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
* [ProtocolSettingsLike](ProtocolSettingsLike.md)
* [ProtocolSettingsMockup](ProtocolSettingsMockup.md)
* [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
* [ProtocolTokenUser](ProtocolTokenUser.md)
* [Proxy](Proxy.md)
* [ProxyMockup](ProxyMockup.md)
* [RBTCWrapperProxyMockup](RBTCWrapperProxyMockup.md)
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
* [StakingMock](StakingMock.md)
* [StakingMockup](StakingMockup.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsMockUp](StakingRewardsMockUp.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingStorage](StakingStorage.md)
* [State](State.md)
* [StorageMockup](StorageMockup.md)
* [SVR](SVR.md)
* [SwapsEvents](SwapsEvents.md)
* [SwapsExternal](SwapsExternal.md)
* [SwapsImplLocal](SwapsImplLocal.md)
* [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
* [SwapsUser](SwapsUser.md)
* [TeamVesting](TeamVesting.md)
* [TestCoverage](TestCoverage.md)
* [TestLibraries](TestLibraries.md)
* [TestSovrynSwap](TestSovrynSwap.md)
* [TestToken](TestToken.md)
* [TestWrbtc](TestWrbtc.md)
* [Timelock](Timelock.md)
* [TimelockHarness](TimelockHarness.md)
* [TimelockInterface](TimelockInterface.md)
* [TimelockTest](TimelockTest.md)
* [TokenSender](TokenSender.md)
* [UpgradableProxy](UpgradableProxy.md)
* [USDTPriceFeed](USDTPriceFeed.md)
* [VaultController](VaultController.md)
* [Vesting](Vesting.md)
* [VestingCreator](VestingCreator.md)
* [VestingFactory](VestingFactory.md)
* [VestingLogic](VestingLogic.md)
* [VestingLogicMockup](VestingLogicMockup.md)
* [VestingRegistry](VestingRegistry.md)
* [VestingRegistry2](VestingRegistry2.md)
* [VestingRegistry3](VestingRegistry3.md)
* [VestingRegistryLogic](VestingRegistryLogic.md)
* [VestingRegistryLogicMockup](VestingRegistryLogicMockup.md)
* [VestingRegistryProxy](VestingRegistryProxy.md)
* [VestingRegistryStorage](VestingRegistryStorage.md)
* [VestingStorage](VestingStorage.md)
* [WeightedStaking](WeightedStaking.md)
* [WRBTC](WRBTC.md)
