# Vesting Logic contract. (VestingLogic.sol)

View Source: [contracts/governance/Vesting/VestingLogic.sol](../contracts/governance/Vesting/VestingLogic.sol)

**↗ Extends: [IVesting](IVesting.md), [VestingStorage](VestingStorage.md), [ApprovalReceiver](ApprovalReceiver.md)**
**↘ Derived Contracts: [VestingLogicMockup](VestingLogicMockup.md)**

**VestingLogic**

Staking, delegating and withdrawal functionality.

**Events**

```js
event TokensStaked(address indexed caller, uint256  amount);
event VotesDelegated(address indexed caller, address  delegatee);
event TokensWithdrawn(address indexed caller, address  receiver);
event DividendsCollected(address indexed caller, address  loanPoolToken, address  receiver, uint32  maxCheckpoints);
event MigratedToNewStakingContract(address indexed caller, address  newStakingContract);
```

## Modifiers

- [onlyOwners](#onlyowners)
- [onlyTokenOwner](#onlytokenowner)

### onlyOwners

Throws if called by any account other than the token owner or the contract owner.

```js
modifier onlyOwners() internal
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### onlyTokenOwner

Throws if called by any account other than the token owner.

```js
modifier onlyTokenOwner() internal
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

## Functions

- [stakeTokens(uint256 \_amount)](#staketokens)
- [stakeTokensWithApproval(address \_sender, uint256 \_amount)](#staketokenswithapproval)
- [\_stakeTokens(address \_sender, uint256 \_amount)](#_staketokens)
- [delegate(address \_delegatee)](#delegate)
- [governanceWithdrawTokens(address receiver)](#governancewithdrawtokens)
- [withdrawTokens(address receiver)](#withdrawtokens)
- [\_withdrawTokens(address receiver, bool isGovernance)](#_withdrawtokens)
- [collectDividends(address \_loanPoolToken, uint32 \_maxCheckpoints, address \_receiver)](#collectdividends)
- [migrateToNewStakingContract()](#migratetonewstakingcontract)
- [\_getToken()](#_gettoken)
- [\_getSelectors()](#_getselectors)

### stakeTokens

⤾ overrides [IVesting.stakeTokens](IVesting.md#staketokens)

Stakes tokens according to the vesting schedule.

```js
function stakeTokens(uint256 _amount) public nonpayable
```

**Arguments**

| Name     | Type    | Description                    |
| -------- | ------- | ------------------------------ |
| \_amount | uint256 | The amount of tokens to stake. |

### stakeTokensWithApproval

Stakes tokens according to the vesting schedule.

```js
function stakeTokensWithApproval(address _sender, uint256 _amount) public nonpayable onlyThisContract
```

**Arguments**

| Name     | Type    | Description                      |
| -------- | ------- | -------------------------------- |
| \_sender | address | The sender of SOV.approveAndCall |
| \_amount | uint256 | The amount of tokens to stake.   |

### \_stakeTokens

Stakes tokens according to the vesting schedule. Low level function.

```js
function _stakeTokens(address _sender, uint256 _amount) internal nonpayable
```

**Arguments**

| Name     | Type    | Description                    |
| -------- | ------- | ------------------------------ |
| \_sender | address | The sender of tokens to stake. |
| \_amount | uint256 | The amount of tokens to stake. |

### delegate

⤿ Overridden Implementation(s): [VestingLogicMockup.delegate](VestingLogicMockup.md#delegate)

Delegate votes from `msg.sender` which are locked until lockDate
to `delegatee`.

```js
function delegate(address _delegatee) public nonpayable onlyTokenOwner
```

**Arguments**

| Name        | Type    | Description                       |
| ----------- | ------- | --------------------------------- |
| \_delegatee | address | The address to delegate votes to. |

### governanceWithdrawTokens

Withdraws all tokens from the staking contract and
forwards them to an address specified by the token owner.

```js
function governanceWithdrawTokens(address receiver) public nonpayable
```

**Arguments**

| Name     | Type    | Description            |
| -------- | ------- | ---------------------- |
| receiver | address | The receiving address. |

### withdrawTokens

Withdraws unlocked tokens from the staking contract and
forwards them to an address specified by the token owner.

```js
function withdrawTokens(address receiver) public nonpayable onlyOwners
```

**Arguments**

| Name     | Type    | Description            |
| -------- | ------- | ---------------------- |
| receiver | address | The receiving address. |

### \_withdrawTokens

Withdraws tokens from the staking contract and forwards them
to an address specified by the token owner. Low level function.

```js
function _withdrawTokens(address receiver, bool isGovernance) internal nonpayable
```

**Arguments**

| Name                             | Type    | Description               |
| -------------------------------- | ------- | ------------------------- |
| receiver                         | address | The receiving address.    |
| isGovernance                     | bool    | Whether all tokens (true) |
| or just unlocked tokens (false). |

### collectDividends

Collect dividends from fee sharing proxy.

```js
function collectDividends(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver) public nonpayable onlyOwners
```

**Arguments**

| Name             | Type    | Description                                    |
| ---------------- | ------- | ---------------------------------------------- |
| \_loanPoolToken  | address | The loan pool token address.                   |
| \_maxCheckpoints | uint32  | Maximum number of checkpoints to be processed. |
| \_receiver       | address | The receiver of tokens or msg.sender           |

### migrateToNewStakingContract

Allows the owners to migrate the positions
to a new staking contract.

```js
function migrateToNewStakingContract() public nonpayable onlyOwners
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### \_getToken

⤾ overrides [ApprovalReceiver.\_getToken](ApprovalReceiver.md#_gettoken)

Overrides default ApprovalReceiver.\_getToken function to
register SOV token on this contract.

```js
function _getToken() internal view
returns(address)
```

**Returns**

The address of SOV token.

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### \_getSelectors

⤾ overrides [ApprovalReceiver.\_getSelectors](ApprovalReceiver.md#_getselectors)

Overrides default ApprovalReceiver.\_getSelectors function to
register stakeTokensWithApproval selector on this contract.

```js
function _getSelectors() internal view
returns(bytes4[])
```

**Returns**

The array of registered selectors on this contract.

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
