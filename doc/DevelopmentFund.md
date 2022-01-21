# A holding contract for Sovryn Development Fund. (DevelopmentFund.sol)

View Source: [contracts/governance/Vesting/DevelopmentFund.sol](../contracts/governance/Vesting/DevelopmentFund.sol)

**DevelopmentFund**

You can use this contract for timed token release from Dev Fund.

**Enums**

### Status

```js
enum Status {
 Deployed,
 Active,
 Expired
}
```

## Contract Members

**Constants & Variables**

```js
contract IERC20 public SOV;
enum DevelopmentFund.Status public status;
address public lockedTokenOwner;
address public unlockedTokenOwner;
address public safeVault;
address public newLockedTokenOwner;
uint256 public lastReleaseTime;
uint256[] public releaseDuration;
uint256[] public releaseTokenAmount;

```

**Events**

```js
event DevelopmentFundActivated();
event DevelopmentFundExpired();
event NewLockedOwnerAdded(address indexed _initiator, address indexed _newLockedOwner);
event NewLockedOwnerApproved(address indexed _initiator, address indexed _oldLockedOwner, address indexed _newLockedOwner);
event UnlockedOwnerUpdated(address indexed _initiator, address indexed _newUnlockedOwner);
event TokenDeposit(address indexed _initiator, uint256  _amount);
event TokenReleaseChanged(address indexed _initiator, uint256  _releaseCount);
event LockedTokenTransferByUnlockedOwner(address indexed _initiator, address indexed _receiver, uint256  _amount);
event UnlockedTokenWithdrawalByUnlockedOwner(address indexed _initiator, uint256  _amount, uint256  _releaseCount);
event LockedTokenTransferByLockedOwner(address indexed _initiator, address indexed _receiver, uint256  _amount);
```

## Modifiers

- [onlyLockedTokenOwner](#onlylockedtokenowner)
- [onlyUnlockedTokenOwner](#onlyunlockedtokenowner)
- [checkStatus](#checkstatus)

### onlyLockedTokenOwner

```js
modifier onlyLockedTokenOwner() internal
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### onlyUnlockedTokenOwner

```js
modifier onlyUnlockedTokenOwner() internal
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### checkStatus

```js
modifier checkStatus(enum DevelopmentFund.Status s) internal
```

**Arguments**

| Name | Type                        | Description |
| ---- | --------------------------- | ----------- |
| s    | enum DevelopmentFund.Status |             |

## Functions

- [(address \_SOV, address \_lockedTokenOwner, address \_safeVault, address \_unlockedTokenOwner, uint256 \_lastReleaseTime, uint256[] \_releaseDuration, uint256[] \_releaseTokenAmount)](#)
- [init()](#init)
- [updateLockedTokenOwner(address \_newLockedTokenOwner)](#updatelockedtokenowner)
- [approveLockedTokenOwner()](#approvelockedtokenowner)
- [updateUnlockedTokenOwner(address \_newUnlockedTokenOwner)](#updateunlockedtokenowner)
- [depositTokens(uint256 \_amount)](#deposittokens)
- [changeTokenReleaseSchedule(uint256 \_newLastReleaseTime, uint256[] \_releaseDuration, uint256[] \_releaseTokenAmount)](#changetokenreleaseschedule)
- [transferTokensByUnlockedTokenOwner()](#transfertokensbyunlockedtokenowner)
- [withdrawTokensByUnlockedTokenOwner(uint256 \_amount)](#withdrawtokensbyunlockedtokenowner)
- [transferTokensByLockedTokenOwner(address \_receiver)](#transfertokensbylockedtokenowner)
- [getReleaseDuration()](#getreleaseduration)
- [getReleaseTokenAmount()](#getreleasetokenamount)

###

Setup the required parameters.

```js
function (address _SOV, address _lockedTokenOwner, address _safeVault, address _unlockedTokenOwner, uint256 _lastReleaseTime, uint256[] _releaseDuration, uint256[] _releaseTokenAmount) public nonpayable
```

**Arguments**

| Name                 | Type      | Description                                                                          |
| -------------------- | --------- | ------------------------------------------------------------------------------------ |
| \_SOV                | address   | The SOV token address.                                                               |
| \_lockedTokenOwner   | address   | The owner of the locked tokens & contract.                                           |
| \_safeVault          | address   | The emergency wallet/contract to transfer token.                                     |
| \_unlockedTokenOwner | address   | The owner of the unlocked tokens.                                                    |
| \_lastReleaseTime    | uint256   | If the last release time is to be changed, zero if no change required.               |
| \_releaseDuration    | uint256[] | The time duration between each release calculated from `lastReleaseTime` in seconds. |
| \_releaseTokenAmount | uint256[] | The amount of token to be released in each duration/interval.                        |

### init

This function is called once after deployment for token transfer based on schedule.

```js
function init() public nonpayable checkStatus
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### updateLockedTokenOwner

Update Locked Token Owner.

```js
function updateLockedTokenOwner(address _newLockedTokenOwner) public nonpayable onlyLockedTokenOwner checkStatus
```

**Arguments**

| Name                  | Type    | Description                                |
| --------------------- | ------- | ------------------------------------------ |
| \_newLockedTokenOwner | address | The owner of the locked tokens & contract. |

### approveLockedTokenOwner

Approve Locked Token Owner.

```js
function approveLockedTokenOwner() public nonpayable onlyUnlockedTokenOwner checkStatus
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### updateUnlockedTokenOwner

Update Unlocked Token Owner.

```js
function updateUnlockedTokenOwner(address _newUnlockedTokenOwner) public nonpayable onlyLockedTokenOwner checkStatus
```

**Arguments**

| Name                    | Type    | Description                   |
| ----------------------- | ------- | ----------------------------- |
| \_newUnlockedTokenOwner | address | The new unlocked token owner. |

### depositTokens

Deposit tokens to this contract.

```js
function depositTokens(uint256 _amount) public nonpayable checkStatus
```

**Arguments**

| Name     | Type    | Description                     |
| -------- | ------- | ------------------------------- |
| \_amount | uint256 | the amount of tokens deposited. |

### changeTokenReleaseSchedule

Change the Token release schedule. It creates a completely new schedule, and does not append on the previous one.

```js
function changeTokenReleaseSchedule(uint256 _newLastReleaseTime, uint256[] _releaseDuration, uint256[] _releaseTokenAmount) public nonpayable onlyLockedTokenOwner checkStatus
```

**Arguments**

| Name                 | Type      | Description                                                                          |
| -------------------- | --------- | ------------------------------------------------------------------------------------ |
| \_newLastReleaseTime | uint256   | If the last release time is to be changed, zero if no change required.               |
| \_releaseDuration    | uint256[] | The time duration between each release calculated from `lastReleaseTime` in seconds. |
| \_releaseTokenAmount | uint256[] | The amount of token to be released in each duration/interval.                        |

### transferTokensByUnlockedTokenOwner

Transfers all of the remaining tokens in an emergency situation.

```js
function transferTokensByUnlockedTokenOwner() public nonpayable onlyUnlockedTokenOwner checkStatus
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### withdrawTokensByUnlockedTokenOwner

Withdraws all unlocked/released token.

```js
function withdrawTokensByUnlockedTokenOwner(uint256 _amount) public nonpayable onlyUnlockedTokenOwner checkStatus
```

**Arguments**

| Name     | Type    | Description                 |
| -------- | ------- | --------------------------- |
| \_amount | uint256 | The amount to be withdrawn. |

### transferTokensByLockedTokenOwner

Transfers all of the remaining tokens by the owner maybe for an upgrade.

```js
function transferTokensByLockedTokenOwner(address _receiver) public nonpayable onlyLockedTokenOwner checkStatus
```

**Arguments**

| Name       | Type    | Description                                     |
| ---------- | ------- | ----------------------------------------------- |
| \_receiver | address | The address which receives this token transfer. |

### getReleaseDuration

Function to read the current token release duration.

```js
function getReleaseDuration() public view
returns(_releaseTokenDuration uint256[])
```

**Returns**

\_currentReleaseDuration The current release duration.

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### getReleaseTokenAmount

Function to read the current token release amount.

```js
function getReleaseTokenAmount() public view
returns(_currentReleaseTokenAmount uint256[])
```

**Returns**

\_currentReleaseTokenAmount The current release token amount.

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

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
