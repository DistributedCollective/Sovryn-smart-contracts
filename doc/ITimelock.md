# ITimelock.sol

View Source: [contracts/governance/Timelock.sol](../contracts/governance/Timelock.sol)

**↗ Extends: [ErrorDecoder](ErrorDecoder.md), [ITimelock](ITimelock.md)**
**↘ Derived Contracts: [ITimelock](ITimelock.md), [Timelock](Timelock.md)**

**ITimelock**

## Contract Members

**Constants & Variables**

```js
uint256 public constant GRACE_PERIOD;
uint256 public constant MINIMUM_DELAY;
uint256 public constant MAXIMUM_DELAY;
address public admin;
address public pendingAdmin;
uint256 public delay;
mapping(bytes32 => bool) public queuedTransactions;

```

**Events**

```js
event NewAdmin(address indexed newAdmin);
event NewPendingAdmin(address indexed newPendingAdmin);
event NewDelay(uint256 indexed newDelay);
event CancelTransaction(bytes32 indexed txHash, address indexed target, uint256  value, string  signature, bytes  data, uint256  eta);
event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint256  value, string  signature, bytes  data, uint256  eta);
event QueueTransaction(bytes32 indexed txHash, address indexed target, uint256  value, string  signature, bytes  data, uint256  eta);
```

## Functions

- [delay()](#delay)
- [GRACE_PERIOD()](#grace_period)
- [acceptAdmin()](#acceptadmin)
- [queuedTransactions(bytes32 hash)](#queuedtransactions)
- [queueTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)](#queuetransaction)
- [cancelTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)](#canceltransaction)
- [executeTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)](#executetransaction)
- [(address admin*, uint256 delay*)](#)
- [()](#)
- [setDelay(uint256 delay\_)](#setdelay)
- [acceptAdmin()](#acceptadmin)
- [setPendingAdmin(address pendingAdmin\_)](#setpendingadmin)
- [queueTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)](#queuetransaction)
- [cancelTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)](#canceltransaction)
- [executeTransaction(address target, uint256 value, string signature, bytes data, uint256 eta)](#executetransaction)
- [getBlockTimestamp()](#getblocktimestamp)

### delay

```js
function delay() external view
returns(uint256)
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### GRACE_PERIOD

```js
function GRACE_PERIOD() external view
returns(uint256)
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### acceptAdmin

⤿ Overridden Implementation(s): [ITimelock.acceptAdmin](ITimelock.md#acceptadmin),[Timelock.acceptAdmin](Timelock.md#acceptadmin)

```js
function acceptAdmin() external nonpayable
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### queuedTransactions

```js
function queuedTransactions(bytes32 hash) external view
returns(bool)
```

**Arguments**

| Name | Type    | Description |
| ---- | ------- | ----------- |
| hash | bytes32 |             |

### queueTransaction

⤿ Overridden Implementation(s): [ITimelock.queueTransaction](ITimelock.md#queuetransaction),[Timelock.queueTransaction](Timelock.md#queuetransaction)

```js
function queueTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) external nonpayable
returns(bytes32)
```

**Arguments**

| Name      | Type    | Description |
| --------- | ------- | ----------- |
| target    | address |             |
| value     | uint256 |             |
| signature | string  |             |
| data      | bytes   |             |
| eta       | uint256 |             |

### cancelTransaction

⤿ Overridden Implementation(s): [ITimelock.cancelTransaction](ITimelock.md#canceltransaction),[Timelock.cancelTransaction](Timelock.md#canceltransaction)

```js
function cancelTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) external nonpayable
```

**Arguments**

| Name      | Type    | Description |
| --------- | ------- | ----------- |
| target    | address |             |
| value     | uint256 |             |
| signature | string  |             |
| data      | bytes   |             |
| eta       | uint256 |             |

### executeTransaction

⤿ Overridden Implementation(s): [ITimelock.executeTransaction](ITimelock.md#executetransaction),[Timelock.executeTransaction](Timelock.md#executetransaction)

```js
function executeTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) external payable
returns(bytes)
```

**Arguments**

| Name      | Type    | Description |
| --------- | ------- | ----------- |
| target    | address |             |
| value     | uint256 |             |
| signature | string  |             |
| data      | bytes   |             |
| eta       | uint256 |             |

###

Function called on instance deployment of the contract.

```js
function (address admin_, uint256 delay_) public nonpayable
```

**Arguments**

| Name    | Type    | Description                                          |
| ------- | ------- | ---------------------------------------------------- |
| admin\_ | address | Governance contract address.                         |
| delay\_ | uint256 | Time to wait for queued transactions to be executed. |

###

Fallback function is to react to receiving value (rBTC).

```js
function () external payable
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### setDelay

Set a new delay when executing the contract calls.

```js
function setDelay(uint256 delay_) public nonpayable
```

**Arguments**

| Name    | Type    | Description                                 |
| ------- | ------- | ------------------------------------------- |
| delay\_ | uint256 | The amount of time to wait until execution. |

### acceptAdmin

⤾ overrides [ITimelock.acceptAdmin](ITimelock.md#acceptadmin)

Accept a new admin for the timelock.

```js
function acceptAdmin() public nonpayable
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### setPendingAdmin

Set a new pending admin for the timelock.

```js
function setPendingAdmin(address pendingAdmin_) public nonpayable
```

**Arguments**

| Name           | Type    | Description                    |
| -------------- | ------- | ------------------------------ |
| pendingAdmin\_ | address | The new pending admin address. |

### queueTransaction

⤾ overrides [ITimelock.queueTransaction](ITimelock.md#queuetransaction)

Queue a new transaction from the governance contract.

```js
function queueTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) public nonpayable
returns(bytes32)
```

**Arguments**

| Name                                                                  | Type    | Description                                              |
| --------------------------------------------------------------------- | ------- | -------------------------------------------------------- |
| target                                                                | address | The contract to call.                                    |
| value                                                                 | uint256 | The amount to send in the transaction.                   |
| signature                                                             | string  | The stanndard representation of the function called.     |
| data                                                                  | bytes   | The ethereum transaction input data payload.             |
| eta                                                                   | uint256 | Estimated Time of Accomplishment. The timestamp that the |
| proposal will be available for execution, set once the vote succeeds. |

### cancelTransaction

⤾ overrides [ITimelock.cancelTransaction](ITimelock.md#canceltransaction)

Cancel a transaction.

```js
function cancelTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) public nonpayable
```

**Arguments**

| Name                                                                  | Type    | Description                                              |
| --------------------------------------------------------------------- | ------- | -------------------------------------------------------- |
| target                                                                | address | The contract to call.                                    |
| value                                                                 | uint256 | The amount to send in the transaction.                   |
| signature                                                             | string  | The stanndard representation of the function called.     |
| data                                                                  | bytes   | The ethereum transaction input data payload.             |
| eta                                                                   | uint256 | Estimated Time of Accomplishment. The timestamp that the |
| proposal will be available for execution, set once the vote succeeds. |

### executeTransaction

⤾ overrides [ITimelock.executeTransaction](ITimelock.md#executetransaction)

Executes a previously queued transaction from the governance.

```js
function executeTransaction(address target, uint256 value, string signature, bytes data, uint256 eta) public payable
returns(bytes)
```

**Arguments**

| Name                                                                  | Type    | Description                                              |
| --------------------------------------------------------------------- | ------- | -------------------------------------------------------- |
| target                                                                | address | The contract to call.                                    |
| value                                                                 | uint256 | The amount to send in the transaction.                   |
| signature                                                             | string  | The stanndard representation of the function called.     |
| data                                                                  | bytes   | The ethereum transaction input data payload.             |
| eta                                                                   | uint256 | Estimated Time of Accomplishment. The timestamp that the |
| proposal will be available for execution, set once the vote succeeds. |

### getBlockTimestamp

A function used to get the current Block Timestamp.

```js
function getBlockTimestamp() internal view
returns(uint256)
```

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
