# Origin investors claim vested cSOV tokens. (OriginInvestorsClaim.sol)

View Source: [contracts/governance/Vesting/OriginInvestorsClaim.sol](../contracts/governance/Vesting/OriginInvestorsClaim.sol)

**↗ Extends: [Ownable](Ownable.md)**

**OriginInvestorsClaim**

// TODO: fund this contract with a total amount of SOV needed to distribute.

## Contract Members

**Constants & Variables**

```js
uint256 public totalAmount;
uint256 public constant SOV_VESTING_CLIFF;
uint256 public kickoffTS;
uint256 public vestingTerm;
uint256 public investorsQty;
bool public investorsListInitialized;
contract VestingRegistry public vestingRegistry;
contract Staking public staking;
contract IERC20 public SOVToken;
mapping(address => bool) public admins;
mapping(address => uint256) public investorsAmountsList;

```

**Events**

```js
event AdminAdded(address  admin);
event AdminRemoved(address  admin);
event InvestorsAmountsListAppended(uint256  qty, uint256  amount);
event ClaimVested(address indexed investor, uint256  amount);
event ClaimTransferred(address indexed investor, uint256  amount);
event InvestorsAmountsListInitialized(uint256  qty, uint256  totalAmount);
```

## Modifiers

- [onlyAuthorized](#onlyauthorized)
- [onlyWhitelisted](#onlywhitelisted)
- [notInitialized](#notinitialized)
- [initialized](#initialized)

### onlyAuthorized

Throws if called by any account other than the owner or admin.

```js
modifier onlyAuthorized() internal
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### onlyWhitelisted

Throws if called by any account not whitelisted.

```js
modifier onlyWhitelisted() internal
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### notInitialized

Throws if called w/ an initialized investors list.

```js
modifier notInitialized() internal
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### initialized

Throws if called w/ an uninitialized investors list.

```js
modifier initialized() internal
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

## Functions

- [(address vestingRegistryAddress)](#)
- [addAdmin(address \_admin)](#addadmin)
- [removeAdmin(address \_admin)](#removeadmin)
- [authorizedBalanceWithdraw(address toAddress)](#authorizedbalancewithdraw)
- [setInvestorsAmountsListInitialized()](#setinvestorsamountslistinitialized)
- [appendInvestorsAmountsList(address[] investors, uint256[] claimAmounts)](#appendinvestorsamountslist)
- [claim()](#claim)
- [createVesting()](#createvesting)
- [transfer()](#transfer)

###

Contract deployment requires one parameter:

```js
function (address vestingRegistryAddress) public nonpayable
```

**Arguments**

| Name                   | Type    | Description                                    |
| ---------------------- | ------- | ---------------------------------------------- |
| vestingRegistryAddress | address | The vestingRegistry contract instance address. |

### addAdmin

Add account to ACL.

```js
function addAdmin(address _admin) public nonpayable onlyOwner
```

**Arguments**

| Name    | Type    | Description                                        |
| ------- | ------- | -------------------------------------------------- |
| \_admin | address | The addresses of the account to grant permissions. |

### removeAdmin

Remove account from ACL.

```js
function removeAdmin(address _admin) public nonpayable onlyOwner
```

**Arguments**

| Name    | Type    | Description                                         |
| ------- | ------- | --------------------------------------------------- |
| \_admin | address | The addresses of the account to revoke permissions. |

### authorizedBalanceWithdraw

In case we have unclaimed tokens or in emergency case
this function transfers all SOV tokens to a given address.

```js
function authorizedBalanceWithdraw(address toAddress) public nonpayable onlyAuthorized
```

**Arguments**

| Name      | Type    | Description                                        |
| --------- | ------- | -------------------------------------------------- |
| toAddress | address | The recipient address of all this contract tokens. |

### setInvestorsAmountsListInitialized

Should be called after the investors list setup completed.
This function checks whether the SOV token balance of the contract is
enough and sets status list to initialized.

```js
function setInvestorsAmountsListInitialized() public nonpayable onlyAuthorized notInitialized
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### appendInvestorsAmountsList

The contract should be approved or transferred necessary
amount of SOV prior to calling the function.

```js
function appendInvestorsAmountsList(address[] investors, uint256[] claimAmounts) external nonpayable onlyAuthorized notInitialized
```

**Arguments**

| Name                                 | Type      | Description                                         |
| ------------------------------------ | --------- | --------------------------------------------------- |
| investors                            | address[] | The list of investors addresses to add to the list. |
| Duplicates will be skipped.          |
| claimAmounts                         | uint256[] | The list of amounts for investors investors[i]      |
| will receive claimAmounts[i] of SOV. |

### claim

Claim tokens from this contract.
If vestingTerm is not yet achieved a vesting is created.
Otherwise tokens are tranferred.

```js
function claim() external nonpayable onlyWhitelisted initialized
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### createVesting

Transfer tokens from this contract to a vestingRegistry contract.
Sender is removed from investor list and all its unvested tokens
are sent to vesting contract.

```js
function createVesting() internal nonpayable
```

**Arguments**

| Name | Type | Description |
| ---- | ---- | ----------- |

### transfer

Transfer tokens from this contract to the sender.
Sender is removed from investor list and all its unvested tokens
are sent to its account.

```js
function transfer() internal nonpayable
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
