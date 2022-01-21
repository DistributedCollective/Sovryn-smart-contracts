# VestingRegistryLogic.sol

View Source: [contracts/governance/Vesting/VestingRegistryLogic.sol](../contracts/governance/Vesting/VestingRegistryLogic.sol)

**↗ Extends: [VestingRegistryStorage](VestingRegistryStorage.md)**
**↘ Derived Contracts: [VestingRegistryLogicMockup](VestingRegistryLogicMockup.md)**

**VestingRegistryLogic**

**Events**

```js
event SOVTransferred(address indexed receiver, uint256  amount);
event VestingCreated(address indexed tokenOwner, address  vesting, uint256  cliff, uint256  duration, uint256  amount, uint256  vestingCreationType);
event TeamVestingCreated(address indexed tokenOwner, address  vesting, uint256  cliff, uint256  duration, uint256  amount, uint256  vestingCreationType);
event TokensStaked(address indexed vesting, uint256  amount);
```

## Functions

- [initialize(address \_vestingFactory, address \_SOV, address \_staking, address \_feeSharingProxy, address \_vestingOwner, address \_lockedSOV, address[] \_vestingRegistries)](#initialize)
- [setVestingFactory(address \_vestingFactory)](#setvestingfactory)
- [\_setVestingFactory(address \_vestingFactory)](#_setvestingfactory)
- [transferSOV(address \_receiver, uint256 \_amount)](#transfersov)
- [addDeployedVestings(address[] \_tokenOwners, uint256[] \_vestingCreationTypes)](#adddeployedvestings)
- [createVesting(address \_tokenOwner, uint256 \_amount, uint256 \_cliff, uint256 \_duration)](#createvesting)
- [createVestingAddr(address \_tokenOwner, uint256 \_amount, uint256 \_cliff, uint256 \_duration, uint256 \_vestingCreationType)](#createvestingaddr)
- [createTeamVesting(address \_tokenOwner, uint256 \_amount, uint256 \_cliff, uint256 \_duration, uint256 \_vestingCreationType)](#createteamvesting)
- [stakeTokens(address \_vesting, uint256 \_amount)](#staketokens)
- [getVesting(address \_tokenOwner)](#getvesting)
- [getVestingAddr(address \_tokenOwner, uint256 \_cliff, uint256 \_duration, uint256 \_vestingCreationType)](#getvestingaddr)
- [getTeamVesting(address \_tokenOwner, uint256 \_cliff, uint256 \_duration, uint256 \_vestingCreationType)](#getteamvesting)
- [\_getOrCreateVesting(address \_tokenOwner, uint256 \_cliff, uint256 \_duration, uint256 \_type, uint256 \_vestingCreationType)](#_getorcreatevesting)
- [\_addDeployedVestings(address \_tokenOwner, uint256 \_vestingCreationType)](#_adddeployedvestings)
- [getVestingsOf(address \_tokenOwner)](#getvestingsof)
- [getVestingDetails(address \_vestingAddress)](#getvestingdetails)
- [isVestingAdress(address \_vestingAddress)](#isvestingadress)

### initialize

Replace constructor with initialize function for Upgradable Contracts
This function will be called only once by the owner

```js
function initialize(address _vestingFactory, address _SOV, address _staking, address _feeSharingProxy, address _vestingOwner, address _lockedSOV, address[] _vestingRegistries) external nonpayable onlyOwner initializer
```

**Arguments**

| Name                | Type      | Description |
| ------------------- | --------- | ----------- |
| \_vestingFactory    | address   |             |
| \_SOV               | address   |             |
| \_staking           | address   |             |
| \_feeSharingProxy   | address   |             |
| \_vestingOwner      | address   |             |
| \_lockedSOV         | address   |             |
| \_vestingRegistries | address[] |             |

### setVestingFactory

sets vesting factory address

```js
function setVestingFactory(address _vestingFactory) external nonpayable onlyOwner
```

**Arguments**

| Name             | Type    | Description                             |
| ---------------- | ------- | --------------------------------------- |
| \_vestingFactory | address | the address of vesting factory contract |

### \_setVestingFactory

Internal function that sets vesting factory address

```js
function _setVestingFactory(address _vestingFactory) internal nonpayable
```

**Arguments**

| Name             | Type    | Description                             |
| ---------------- | ------- | --------------------------------------- |
| \_vestingFactory | address | the address of vesting factory contract |

### transferSOV

transfers SOV tokens to given address

```js
function transferSOV(address _receiver, uint256 _amount) external nonpayable onlyOwner
```

**Arguments**

| Name       | Type    | Description                     |
| ---------- | ------- | ------------------------------- |
| \_receiver | address | the address of the SOV receiver |
| \_amount   | uint256 | the amount to be transferred    |

### addDeployedVestings

adds vestings that were deployed in previous vesting registries

```js
function addDeployedVestings(address[] _tokenOwners, uint256[] _vestingCreationTypes) external nonpayable onlyAuthorized
```

**Arguments**

| Name                   | Type      | Description |
| ---------------------- | --------- | ----------- |
| \_tokenOwners          | address[] |             |
| \_vestingCreationTypes | uint256[] |             |

### createVesting

creates Vesting contract

```js
function createVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration) external nonpayable onlyAuthorized
```

**Arguments**

| Name         | Type    | Description                   |
| ------------ | ------- | ----------------------------- |
| \_tokenOwner | address | the owner of the tokens       |
| \_amount     | uint256 | the amount to be staked       |
| \_cliff      | uint256 | the cliff in seconds          |
| \_duration   | uint256 | the total duration in seconds |

### createVestingAddr

creates Vesting contract

```js
function createVestingAddr(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration, uint256 _vestingCreationType) public nonpayable onlyAuthorized
```

**Arguments**

| Name                  | Type    | Description                                               |
| --------------------- | ------- | --------------------------------------------------------- |
| \_tokenOwner          | address | the owner of the tokens                                   |
| \_amount              | uint256 | the amount to be staked                                   |
| \_cliff               | uint256 | the cliff in seconds                                      |
| \_duration            | uint256 | the total duration in seconds                             |
| \_vestingCreationType | uint256 | the type of vesting created(e.g. Origin, Bug Bounty etc.) |

### createTeamVesting

creates Team Vesting contract

```js
function createTeamVesting(address _tokenOwner, uint256 _amount, uint256 _cliff, uint256 _duration, uint256 _vestingCreationType) external nonpayable onlyAuthorized
```

**Arguments**

| Name                  | Type    | Description                                               |
| --------------------- | ------- | --------------------------------------------------------- |
| \_tokenOwner          | address | the owner of the tokens                                   |
| \_amount              | uint256 | the amount to be staked                                   |
| \_cliff               | uint256 | the cliff in seconds                                      |
| \_duration            | uint256 | the total duration in seconds                             |
| \_vestingCreationType | uint256 | the type of vesting created(e.g. Origin, Bug Bounty etc.) |

### stakeTokens

stakes tokens according to the vesting schedule

```js
function stakeTokens(address _vesting, uint256 _amount) external nonpayable onlyAuthorized
```

**Arguments**

| Name      | Type    | Description                     |
| --------- | ------- | ------------------------------- |
| \_vesting | address | the address of Vesting contract |
| \_amount  | uint256 | the amount of tokens to stake   |

### getVesting

returns vesting contract address for the given token owner

```js
function getVesting(address _tokenOwner) public view
returns(address)
```

**Arguments**

| Name         | Type    | Description             |
| ------------ | ------- | ----------------------- |
| \_tokenOwner | address | the owner of the tokens |

### getVestingAddr

public function that returns vesting contract address for the given token owner, cliff, duration

```js
function getVestingAddr(address _tokenOwner, uint256 _cliff, uint256 _duration, uint256 _vestingCreationType) public view
returns(address)
```

**Arguments**

| Name                  | Type    | Description |
| --------------------- | ------- | ----------- |
| \_tokenOwner          | address |             |
| \_cliff               | uint256 |             |
| \_duration            | uint256 |             |
| \_vestingCreationType | uint256 |             |

### getTeamVesting

returns team vesting contract address for the given token owner, cliff, duration

```js
function getTeamVesting(address _tokenOwner, uint256 _cliff, uint256 _duration, uint256 _vestingCreationType) public view
returns(address)
```

**Arguments**

| Name                  | Type    | Description |
| --------------------- | ------- | ----------- |
| \_tokenOwner          | address |             |
| \_cliff               | uint256 |             |
| \_duration            | uint256 |             |
| \_vestingCreationType | uint256 |             |

### \_getOrCreateVesting

Internal function to deploy Vesting/Team Vesting contract

```js
function _getOrCreateVesting(address _tokenOwner, uint256 _cliff, uint256 _duration, uint256 _type, uint256 _vestingCreationType) internal nonpayable
returns(address)
```

**Arguments**

| Name                  | Type    | Description                                               |
| --------------------- | ------- | --------------------------------------------------------- |
| \_tokenOwner          | address | the owner of the tokens                                   |
| \_cliff               | uint256 | the cliff in seconds                                      |
| \_duration            | uint256 | the total duration in seconds                             |
| \_type                | uint256 | the type of vesting                                       |
| \_vestingCreationType | uint256 | the type of vesting created(e.g. Origin, Bug Bounty etc.) |

### \_addDeployedVestings

stores the addresses of Vesting contracts from all three previous versions of Vesting Registry

```js
function _addDeployedVestings(address _tokenOwner, uint256 _vestingCreationType) internal nonpayable
```

**Arguments**

| Name                  | Type    | Description |
| --------------------- | ------- | ----------- |
| \_tokenOwner          | address |             |
| \_vestingCreationType | uint256 |             |

### getVestingsOf

returns all vesting details for the given token owner

```js
function getVestingsOf(address _tokenOwner) external view
returns(struct VestingRegistryStorage.Vesting[])
```

**Arguments**

| Name         | Type    | Description |
| ------------ | ------- | ----------- |
| \_tokenOwner | address |             |

### getVestingDetails

returns cliff and duration for Vesting & TeamVesting contracts

```js
function getVestingDetails(address _vestingAddress) external view
returns(cliff uint256, duration uint256)
```

**Arguments**

| Name             | Type    | Description |
| ---------------- | ------- | ----------- |
| \_vestingAddress | address |             |

### isVestingAdress

⤿ Overridden Implementation(s): [VestingRegistryLogicMockup.isVestingAdress](VestingRegistryLogicMockup.md#isvestingadress)

returns if the address is a vesting address

```js
function isVestingAdress(address _vestingAddress) external view
returns(isVestingAddr bool)
```

**Arguments**

| Name             | Type    | Description |
| ---------------- | ------- | ----------- |
| \_vestingAddress | address |             |

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
