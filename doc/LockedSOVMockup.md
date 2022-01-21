# An mockup for the Locked SOV Contract. (LockedSOVMockup.sol)

View Source: [contracts/mockup/LockedSOVMockup.sol](../contracts/mockup/LockedSOVMockup.sol)

**LockedSOVMockup**

This is not a complete mockup of the Locked SOV Contract.

## Contract Members

**Constants & Variables**

```js
//public members
contract IERC20 public SOV;

//internal members
mapping(address => uint256) internal lockedBalances;
mapping(address => uint256) internal unlockedBalances;
mapping(address => bool) internal isAdmin;

```

**Events**

```js
event AdminAdded(address indexed _initiator, address indexed _newAdmin);
event AdminRemoved(address indexed _initiator, address indexed _removedAdmin);
event Deposited(address indexed _initiator, address indexed _userAddress, uint256  _sovAmount, uint256  _basisPoint);
event Withdrawn(address indexed _initiator, address indexed _userAddress, uint256  _sovAmount);
event TokensStaked(address indexed _initiator, address indexed _vesting, uint256  _amount);
```

## Modifiers

- [onlyAdmin](#onlyadmin)

### onlyAdmin

```js
modifier onlyAdmin() internal
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

## Functions

- [(address \_SOV, address[] \_admins)](#)
- [addAdmin(address \_newAdmin)](#addadmin)
- [removeAdmin(address \_adminToRemove)](#removeadmin)
- [deposit(address \_userAddress, uint256 \_sovAmount, uint256 \_basisPoint)](#deposit)
- [depositSOV(address \_userAddress, uint256 \_sovAmount)](#depositsov)
- [\_deposit(address \_userAddress, uint256 \_sovAmount, uint256 \_basisPoint)](#_deposit)
- [withdrawAndStakeTokensFrom(address \_userAddress)](#withdrawandstaketokensfrom)
- [\_withdraw(address \_sender, address \_receiverAddress)](#_withdraw)
- [\_createVestingAndStake(address \_sender)](#_createvestingandstake)
- [getLockedBalance(address \_addr)](#getlockedbalance)
- [getUnlockedBalance(address \_addr)](#getunlockedbalance)

###

Setup the required parameters.

```js
function (address _SOV, address[] _admins) public nonpayable
```

**Arguments**

| Name     | Type      | Description                     |
| -------- | --------- | ------------------------------- |
| \_SOV    | address   | The SOV token address.          |
| \_admins | address[] | The list of admins to be added. |

### addAdmin

The function to add a new admin.

```js
function addAdmin(address _newAdmin) public nonpayable onlyAdmin
```

**Arguments**

| Name       | Type    | Description                   |
| ---------- | ------- | ----------------------------- |
| \_newAdmin | address | The address of the new admin. |

### removeAdmin

The function to remove an admin.

```js
function removeAdmin(address _adminToRemove) public nonpayable onlyAdmin
```

**Arguments**

| Name            | Type    | Description                                       |
| --------------- | ------- | ------------------------------------------------- |
| \_adminToRemove | address | The address of the admin which should be removed. |

### deposit

Adds SOV to the user balance (Locked and Unlocked Balance based on `_basisPoint`).

```js
function deposit(address _userAddress, uint256 _sovAmount, uint256 _basisPoint) external nonpayable
```

**Arguments**

| Name          | Type    | Description                                                                   |
| ------------- | ------- | ----------------------------------------------------------------------------- |
| \_userAddress | address | The user whose locked balance has to be updated with `_sovAmount`.            |
| \_sovAmount   | uint256 | The amount of SOV to be added to the locked and/or unlocked balance.          |
| \_basisPoint  | uint256 | The % (in Basis Point)which determines how much will be unlocked immediately. |

### depositSOV

Adds SOV to the locked balance of a user.

```js
function depositSOV(address _userAddress, uint256 _sovAmount) external nonpayable
```

**Arguments**

| Name          | Type    | Description                                                       |
| ------------- | ------- | ----------------------------------------------------------------- |
| \_userAddress | address | The user whose locked balance has to be updated with \_sovAmount. |
| \_sovAmount   | uint256 | The amount of SOV to be added to the locked balance.              |

### \_deposit

```js
function _deposit(address _userAddress, uint256 _sovAmount, uint256 _basisPoint) private nonpayable
```

**Arguments**

| Name          | Type    | Description |
| ------------- | ------- | ----------- |
| \_userAddress | address |             |
| \_sovAmount   | uint256 |             |
| \_basisPoint  | uint256 |             |

### withdrawAndStakeTokensFrom

Withdraws unlocked tokens and Stakes Locked tokens for a user who already have a vesting created.

```js
function withdrawAndStakeTokensFrom(address _userAddress) external nonpayable
```

**Arguments**

| Name          | Type    | Description                                   |
| ------------- | ------- | --------------------------------------------- |
| \_userAddress | address | The address of user tokens will be withdrawn. |

### \_withdraw

```js
function _withdraw(address _sender, address _receiverAddress) private nonpayable
```

**Arguments**

| Name              | Type    | Description |
| ----------------- | ------- | ----------- |
| \_sender          | address |             |
| \_receiverAddress | address |             |

### \_createVestingAndStake

```js
function _createVestingAndStake(address _sender) private nonpayable
```

**Arguments**

| Name     | Type    | Description |
| -------- | ------- | ----------- |
| \_sender | address |             |

### getLockedBalance

The function to get the locked balance of a user.

```js
function getLockedBalance(address _addr) public view
returns(_balance uint256)
```

**Returns**

\_balance The locked balance of the address `_addr`.

**Arguments**

| Name   | Type    | Description                                          |
| ------ | ------- | ---------------------------------------------------- |
| \_addr | address | The address of the user to check the locked balance. |

### getUnlockedBalance

The function to get the unlocked balance of a user.

```js
function getUnlockedBalance(address _addr) external view
returns(_balance uint256)
```

**Returns**

\_balance The unlocked balance of the address `_addr`.

**Arguments**

| Name   | Type    | Description                                            |
| ------ | ------- | ------------------------------------------------------ |
| \_addr | address | The address of the user to check the unlocked balance. |

## Contracts

- [Address](Address.md)
- [Administered](Administered.md)
- [AdminRole](AdminRole.md)
- [AdvancedToken](AdvancedToken.md)
- [AdvancedTokenStorage](AdvancedTokenStorage.md)
- [Affiliates](Affiliates.md)
- [AffiliatesEvents](AffiliatesEvents.md)
- [ApprovalReceiver](ApprovalReceiver.md)
- [BlockMockUp](BlockMockUp.md)
- [BProPriceFeed](BProPriceFeed.md)
- [BProPriceFeedMockup](BProPriceFeedMockup.md)
- [Checkpoints](Checkpoints.md)
- [Context](Context.md)
- [DevelopmentFund](DevelopmentFund.md)
- [DummyContract](DummyContract.md)
- [ECDSA](ECDSA.md)
- [EnumerableAddressSet](EnumerableAddressSet.md)
- [EnumerableBytes32Set](EnumerableBytes32Set.md)
- [EnumerableBytes4Set](EnumerableBytes4Set.md)
- [ERC20](ERC20.md)
- [ERC20Detailed](ERC20Detailed.md)
- [ErrorDecoder](ErrorDecoder.md)
- [Escrow](Escrow.md)
- [EscrowReward](EscrowReward.md)
- [FeedsLike](FeedsLike.md)
- [FeesEvents](FeesEvents.md)
- [FeeSharingLogic](FeeSharingLogic.md)
- [FeeSharingProxy](FeeSharingProxy.md)
- [FeeSharingProxyMockup](FeeSharingProxyMockup.md)
- [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
- [FeesHelper](FeesHelper.md)
- [FlashLoanerTest](FlashLoanerTest.md)
- [GenericTokenSender](GenericTokenSender.md)
- [GovernorAlpha](GovernorAlpha.md)
- [GovernorAlphaMockup](GovernorAlphaMockup.md)
- [GovernorVault](GovernorVault.md)
- [IApproveAndCall](IApproveAndCall.md)
- [IChai](IChai.md)
- [IContractRegistry](IContractRegistry.md)
- [IConverterAMM](IConverterAMM.md)
- [IERC20\_](IERC20_.md)
- [IERC20](IERC20.md)
- [IFeeSharingProxy](IFeeSharingProxy.md)
- [ILiquidityMining](ILiquidityMining.md)
- [ILiquidityPoolV1Converter](ILiquidityPoolV1Converter.md)
- [ILoanPool](ILoanPool.md)
- [ILoanToken](ILoanToken.md)
- [ILoanTokenLogicBeacon](ILoanTokenLogicBeacon.md)
- [ILoanTokenLogicModules](ILoanTokenLogicModules.md)
- [ILoanTokenLogicProxy](ILoanTokenLogicProxy.md)
- [ILoanTokenModules](ILoanTokenModules.md)
- [ILoanTokenModulesMock](ILoanTokenModulesMock.md)
- [ILoanTokenWRBTC](ILoanTokenWRBTC.md)
- [ILockedSOV](ILockedSOV.md)
- [IMoCState](IMoCState.md)
- [ImplementationMockup](ImplementationMockup.md)
- [Initializable](Initializable.md)
- [InterestUser](InterestUser.md)
- [IPot](IPot.md)
- [IPriceFeeds](IPriceFeeds.md)
- [IPriceFeedsExt](IPriceFeedsExt.md)
- [IProtocol](IProtocol.md)
- [IRSKOracle](IRSKOracle.md)
- [ISovryn](ISovryn.md)
- [ISovrynSwapNetwork](ISovrynSwapNetwork.md)
- [IStaking](IStaking.md)
- [ISwapsImpl](ISwapsImpl.md)
- [ITeamVesting](ITeamVesting.md)
- [ITimelock](ITimelock.md)
- [ITokenFlashLoanTest](ITokenFlashLoanTest.md)
- [IV1PoolOracle](IV1PoolOracle.md)
- [IVesting](IVesting.md)
- [IVestingFactory](IVestingFactory.md)
- [IVestingRegistry](IVestingRegistry.md)
- [IWrbtc](IWrbtc.md)
- [IWrbtcERC20](IWrbtcERC20.md)
- [LenderInterestStruct](LenderInterestStruct.md)
- [LiquidationHelper](LiquidationHelper.md)
- [LiquidityMining](LiquidityMining.md)
- [LiquidityMiningConfigToken](LiquidityMiningConfigToken.md)
- [LiquidityMiningMockup](LiquidityMiningMockup.md)
- [LiquidityMiningProxy](LiquidityMiningProxy.md)
- [LiquidityMiningStorage](LiquidityMiningStorage.md)
- [LiquidityPoolV1ConverterMockup](LiquidityPoolV1ConverterMockup.md)
- [LoanClosingsEvents](LoanClosingsEvents.md)
- [LoanClosingsLiquidation](LoanClosingsLiquidation.md)
- [LoanClosingsRollover](LoanClosingsRollover.md)
- [LoanClosingsShared](LoanClosingsShared.md)
- [LoanClosingsWith](LoanClosingsWith.md)
- [LoanInterestStruct](LoanInterestStruct.md)
- [LoanMaintenance](LoanMaintenance.md)
- [LoanMaintenanceEvents](LoanMaintenanceEvents.md)
- [LoanOpenings](LoanOpenings.md)
- [LoanOpeningsEvents](LoanOpeningsEvents.md)
- [LoanParamsStruct](LoanParamsStruct.md)
- [LoanSettings](LoanSettings.md)
- [LoanSettingsEvents](LoanSettingsEvents.md)
- [LoanStruct](LoanStruct.md)
- [LoanToken](LoanToken.md)
- [LoanTokenBase](LoanTokenBase.md)
- [LoanTokenLogicBeacon](LoanTokenLogicBeacon.md)
- [LoanTokenLogicLM](LoanTokenLogicLM.md)
- [LoanTokenLogicLMMockup](LoanTokenLogicLMMockup.md)
- [LoanTokenLogicLMV1Mockup](LoanTokenLogicLMV1Mockup.md)
- [LoanTokenLogicLMV2Mockup](LoanTokenLogicLMV2Mockup.md)
- [LoanTokenLogicProxy](LoanTokenLogicProxy.md)
- [LoanTokenLogicStandard](LoanTokenLogicStandard.md)
- [LoanTokenLogicStorage](LoanTokenLogicStorage.md)
- [LoanTokenLogicTest](LoanTokenLogicTest.md)
- [LoanTokenLogicWrbtc](LoanTokenLogicWrbtc.md)
- [LoanTokenSettingsLowerAdmin](LoanTokenSettingsLowerAdmin.md)
- [LockedSOV](LockedSOV.md)
- [LockedSOVFailedMockup](LockedSOVFailedMockup.md)
- [LockedSOVMockup](LockedSOVMockup.md)
- [Medianizer](Medianizer.md)
- [MockAffiliates](MockAffiliates.md)
- [MockLoanTokenLogic](MockLoanTokenLogic.md)
- [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
- [ModulesCommonEvents](ModulesCommonEvents.md)
- [MultiSigKeyHolders](MultiSigKeyHolders.md)
- [MultiSigWallet](MultiSigWallet.md)
- [Objects](Objects.md)
- [OrderStruct](OrderStruct.md)
- [OrigingVestingCreator](OrigingVestingCreator.md)
- [OriginInvestorsClaim](OriginInvestorsClaim.md)
- [Ownable](Ownable.md)
- [Pausable](Pausable.md)
- [PausableOz](PausableOz.md)
- [PreviousLoanToken](PreviousLoanToken.md)
- [PreviousLoanTokenSettingsLowerAdmin](PreviousLoanTokenSettingsLowerAdmin.md)
- [PriceFeedRSKOracle](PriceFeedRSKOracle.md)
- [PriceFeedRSKOracleMockup](PriceFeedRSKOracleMockup.md)
- [PriceFeeds](PriceFeeds.md)
- [PriceFeedsConstants](PriceFeedsConstants.md)
- [PriceFeedsMoC](PriceFeedsMoC.md)
- [PriceFeedsMoCMockup](PriceFeedsMoCMockup.md)
- [PriceFeedV1PoolOracle](PriceFeedV1PoolOracle.md)
- [ProtocolAffiliatesInterface](ProtocolAffiliatesInterface.md)
- [ProtocolLike](ProtocolLike.md)
- [ProtocolSettings](ProtocolSettings.md)
- [ProtocolSettingsEvents](ProtocolSettingsEvents.md)
- [ProtocolSettingsLike](ProtocolSettingsLike.md)
- [ProtocolSettingsMockup](ProtocolSettingsMockup.md)
- [ProtocolSwapExternalInterface](ProtocolSwapExternalInterface.md)
- [ProtocolTokenUser](ProtocolTokenUser.md)
- [Proxy](Proxy.md)
- [ProxyMockup](ProxyMockup.md)
- [RBTCWrapperProxyMockup](RBTCWrapperProxyMockup.md)
- [ReentrancyGuard](ReentrancyGuard.md)
- [RewardHelper](RewardHelper.md)
- [RSKAddrValidator](RSKAddrValidator.md)
- [SafeERC20](SafeERC20.md)
- [SafeMath](SafeMath.md)
- [SafeMath96](SafeMath96.md)
- [setGet](setGet.md)
- [SignedSafeMath](SignedSafeMath.md)
- [SOV](SOV.md)
- [sovrynProtocol](sovrynProtocol.md)
- [Staking](Staking.md)
- [StakingInterface](StakingInterface.md)
- [StakingMock](StakingMock.md)
- [StakingMockup](StakingMockup.md)
- [StakingProxy](StakingProxy.md)
- [StakingRewards](StakingRewards.md)
- [StakingRewardsMockUp](StakingRewardsMockUp.md)
- [StakingRewardsProxy](StakingRewardsProxy.md)
- [StakingRewardsStorage](StakingRewardsStorage.md)
- [StakingStorage](StakingStorage.md)
- [State](State.md)
- [StorageMockup](StorageMockup.md)
- [SVR](SVR.md)
- [SwapsEvents](SwapsEvents.md)
- [SwapsExternal](SwapsExternal.md)
- [SwapsImplLocal](SwapsImplLocal.md)
- [SwapsImplSovrynSwap](SwapsImplSovrynSwap.md)
- [SwapsUser](SwapsUser.md)
- [TeamVesting](TeamVesting.md)
- [TestCoverage](TestCoverage.md)
- [TestLibraries](TestLibraries.md)
- [TestSovrynSwap](TestSovrynSwap.md)
- [TestToken](TestToken.md)
- [TestWrbtc](TestWrbtc.md)
- [Timelock](Timelock.md)
- [TimelockHarness](TimelockHarness.md)
- [TimelockInterface](TimelockInterface.md)
- [TimelockTest](TimelockTest.md)
- [TokenSender](TokenSender.md)
- [UpgradableProxy](UpgradableProxy.md)
- [USDTPriceFeed](USDTPriceFeed.md)
- [VaultController](VaultController.md)
- [Vesting](Vesting.md)
- [VestingCreator](VestingCreator.md)
- [VestingFactory](VestingFactory.md)
- [VestingLogic](VestingLogic.md)
- [VestingLogicMockup](VestingLogicMockup.md)
- [VestingRegistry](VestingRegistry.md)
- [VestingRegistry2](VestingRegistry2.md)
- [VestingRegistry3](VestingRegistry3.md)
- [VestingRegistryLogic](VestingRegistryLogic.md)
- [VestingRegistryLogicMockup](VestingRegistryLogicMockup.md)
- [VestingRegistryProxy](VestingRegistryProxy.md)
- [VestingRegistryStorage](VestingRegistryStorage.md)
- [VestingStorage](VestingStorage.md)
- [WeightedStaking](WeightedStaking.md)
- [WRBTC](WRBTC.md)
