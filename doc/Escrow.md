# A holding contract for Sovryn Ethereum Pool to accept SOV Token. (Escrow.sol)

View Source: [contracts/escrow/Escrow.sol](../contracts/escrow/Escrow.sol)

**↘ Derived Contracts: [EscrowReward](EscrowReward.md)**

**Escrow**

You can use this contract for deposit of SOV tokens for some time and withdraw later.

**Enums**

### Status

```js
enum Status {
 Deployed,
 Deposit,
 Holding,
 Withdraw,
 Expired
}
```

## Contract Members

**Constants & Variables**

```js
//public members
uint256 public totalDeposit;
uint256 public releaseTime;
uint256 public depositLimit;
contract IERC20 public SOV;
address public multisig;
enum Escrow.Status public status;

//internal members
mapping(address => uint256) internal userBalances;

```

**Events**

```js
event EscrowActivated();
event EscrowInHoldingState();
event EscrowInWithdrawState();
event EscrowFundExpired();
event NewMultisig(address indexed _initiator, address indexed _newMultisig);
event TokenReleaseUpdated(address indexed _initiator, uint256  _releaseTimestamp);
event TokenDepositLimitUpdated(address indexed _initiator, uint256  _depositLimit);
event TokenDeposit(address indexed _initiator, uint256  _amount);
event DepositLimitReached();
event TokenWithdrawByMultisig(address indexed _initiator, uint256  _amount);
event TokenDepositByMultisig(address indexed _initiator, uint256  _amount);
event TokenWithdraw(address indexed _initiator, uint256  _amount);
```

## Modifiers

- [onlyMultisig](#onlymultisig)
- [checkStatus](#checkstatus)
- [checkRelease](#checkrelease)

### onlyMultisig

```js
modifier onlyMultisig() internal
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### checkStatus

```js
modifier checkStatus(enum Escrow.Status s) internal
```

**Arguments**

| Name | Type               | Description |
| ---- | ------------------ | ----------- |
| s    | enum Escrow.Status |             |

### checkRelease

```js
modifier checkRelease() internal
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

## Functions

- [(address \_SOV, address \_multisig, uint256 \_releaseTime, uint256 \_depositLimit)](#)
- [init()](#init)
- [updateMultisig(address \_newMultisig)](#updatemultisig)
- [updateReleaseTimestamp(uint256 \_newReleaseTime)](#updatereleasetimestamp)
- [updateDepositLimit(uint256 \_newDepositLimit)](#updatedepositlimit)
- [depositTokens(uint256 \_amount)](#deposittokens)
- [changeStateToHolding()](#changestatetoholding)
- [withdrawTokensByMultisig(address \_receiverAddress)](#withdrawtokensbymultisig)
- [depositTokensByMultisig(uint256 \_amount)](#deposittokensbymultisig)
- [withdrawTokens()](#withdrawtokens)
- [getUserBalance(address \_addr)](#getuserbalance)

###

Setup the required parameters.

```js
function (address _SOV, address _multisig, uint256 _releaseTime, uint256 _depositLimit) public nonpayable
```

**Arguments**

| Name           | Type    | Description                                |
| -------------- | ------- | ------------------------------------------ |
| \_SOV          | address | The SOV token address.                     |
| \_multisig     | address | The owner of the tokens & contract.        |
| \_releaseTime  | uint256 | The token release time, zero if undecided. |
| \_depositLimit | uint256 | The amount of tokens we will be accepting. |

### init

This function is called once after deployment for starting the deposit action.

```js
function init() external nonpayable onlyMultisig checkStatus
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### updateMultisig

Update Multisig.

```js
function updateMultisig(address _newMultisig) external nonpayable onlyMultisig
```

**Arguments**

| Name          | Type    | Description                             |
| ------------- | ------- | --------------------------------------- |
| \_newMultisig | address | The new owner of the tokens & contract. |

### updateReleaseTimestamp

Update Release Timestamp.

```js
function updateReleaseTimestamp(uint256 _newReleaseTime) external nonpayable onlyMultisig
```

**Arguments**

| Name             | Type    | Description                                  |
| ---------------- | ------- | -------------------------------------------- |
| \_newReleaseTime | uint256 | The new release timestamp for token release. |

### updateDepositLimit

Update Deposit Limit.

```js
function updateDepositLimit(uint256 _newDepositLimit) external nonpayable onlyMultisig
```

**Arguments**

| Name              | Type    | Description            |
| ----------------- | ------- | ---------------------- |
| \_newDepositLimit | uint256 | The new deposit limit. |

### depositTokens

Deposit tokens to this contract by User.

```js
function depositTokens(uint256 _amount) external nonpayable checkStatus
```

**Arguments**

| Name     | Type    | Description                     |
| -------- | ------- | ------------------------------- |
| \_amount | uint256 | the amount of tokens deposited. |

### changeStateToHolding

Update contract state to Holding.

```js
function changeStateToHolding() external nonpayable onlyMultisig checkStatus
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### withdrawTokensByMultisig

Withdraws all token from the contract by Multisig.

```js
function withdrawTokensByMultisig(address _receiverAddress) external nonpayable onlyMultisig checkStatus
```

**Arguments**

| Name              | Type    | Description                                                                                                 |
| ----------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| \_receiverAddress | address | The address where the tokens has to be transferred. Zero address if the withdraw is to be done in Multisig. |

### depositTokensByMultisig

Deposit tokens to this contract by the Multisig.

```js
function depositTokensByMultisig(uint256 _amount) external nonpayable onlyMultisig checkStatus
```

**Arguments**

| Name     | Type    | Description                     |
| -------- | ------- | ------------------------------- |
| \_amount | uint256 | the amount of tokens deposited. |

### withdrawTokens

Withdraws token from the contract by User.

```js
function withdrawTokens() public nonpayable checkRelease checkStatus
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### getUserBalance

Function to read the current token balance of a particular user.

```js
function getUserBalance(address _addr) external view
returns(balance uint256)
```

**Returns**

\_addr The user address whose balance has to be checked.

**Arguments**

| Name   | Type    | Description |
| ------ | ------- | ----------- |
| \_addr | address |             |

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
