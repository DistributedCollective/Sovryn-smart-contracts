# Staking Storage Module (StakingStorageModule.sol)

View Source: [contracts/governance/Staking/modules/StakingStorageModule.sol](../contracts/governance/Staking/modules/StakingStorageModule.sol)

**↗ Extends: [IFunctionsList](IFunctionsList.md), [StakingStorageShared](StakingStorageShared.md)**

## **StakingStorageModule** contract

Provides getters for public storage variables*

## Functions

- [getStorageDefaultWeightScaling()](#getstoragedefaultweightscaling)
- [getStorageMaxDurationToStakeTokens()](#getstoragemaxdurationtostaketokens)
- [getStorageMaxVotingWeight()](#getstoragemaxvotingweight)
- [getStorageWeightFactor()](#getstorageweightfactor)
- [getStorageDefaulWeightScaling()](#getstoragedefaulweightscaling)
- [getStorageRangeForWeightScaling()](#getstoragerangeforweightscaling)
- [getStorageDomainTypehash()](#getstoragedomaintypehash)
- [getStorageDelegationTypehash()](#getstoragedelegationtypehash)
- [getStorageName()](#getstoragename)
- [getMaxVestingWithdrawIterations()](#getmaxvestingwithdrawiterations)
- [getFunctionsList()](#getfunctionslist)

---    

> ### getStorageDefaultWeightScaling

```solidity
function getStorageDefaultWeightScaling() external pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getStorageDefaultWeightScaling() external pure returns (uint256) {
        return uint256(DEFAULT_WEIGHT_SCALING);
    }
```
</details>

---    

> ### getStorageMaxDurationToStakeTokens

The maximum duration to stake tokens

```solidity
function getStorageMaxDurationToStakeTokens() external pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getStorageMaxDurationToStakeTokens() external pure returns (uint256) {
        return MAX_DURATION;
    }
```
</details>

---    

> ### getStorageMaxVotingWeight

The maximum possible voting weight before adding +1 (actually 10, but need 9 for computation).

```solidity
function getStorageMaxVotingWeight() external pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getStorageMaxVotingWeight() external pure returns (uint256) {
        return uint256(MAX_VOTING_WEIGHT);
    }
```
</details>

---    

> ### getStorageWeightFactor

weight is multiplied with this factor (for allowing decimals, like 1.2x).

```solidity
function getStorageWeightFactor() external pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getStorageWeightFactor() external pure returns (uint256) {
        return uint256(WEIGHT_FACTOR);
    }
```
</details>

---    

> ### getStorageDefaulWeightScaling

Default weight scaling.

```solidity
function getStorageDefaulWeightScaling() external pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getStorageDefaulWeightScaling() external pure returns (uint256) {
        return uint256(DEFAULT_WEIGHT_SCALING);
    }
```
</details>

---    

> ### getStorageRangeForWeightScaling

```solidity
function getStorageRangeForWeightScaling() external pure
returns(minWeightScaling uint256, maxWeightScaling uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getStorageRangeForWeightScaling()
        external
        pure
        returns (uint256 minWeightScaling, uint256 maxWeightScaling)
    {
        return (uint256(MIN_WEIGHT_SCALING), uint256(MAX_WEIGHT_SCALING));
    }
```
</details>

---    

> ### getStorageDomainTypehash

The EIP-712 typehash for the contract's domain.

```solidity
function getStorageDomainTypehash() external pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getStorageDomainTypehash() external pure returns (uint256) {
        return uint256(DOMAIN_TYPEHASH);
    }
```
</details>

---    

> ### getStorageDelegationTypehash

The EIP-712 typehash for the delegation struct used by the contract.

```solidity
function getStorageDelegationTypehash() external pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getStorageDelegationTypehash() external pure returns (uint256) {
        return uint256(DELEGATION_TYPEHASH);
    }
```
</details>

---    

> ### getStorageName

```solidity
function getStorageName() external view
returns(string)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getStorageName() external view returns (string memory) {
        return name;
    }
```
</details>

---    

> ### getMaxVestingWithdrawIterations

Max iteration for direct withdrawal from staking to prevent out of gas issue.
     *

```solidity
function getMaxVestingWithdrawIterations() public view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getMaxVestingWithdrawIterations() public view returns (uint256) {
        return maxVestingWithdrawIterations;
    }
```
</details>

---    

> ### getFunctionsList

⤾ overrides [IFunctionsList.getFunctionsList](IFunctionsList.md#getfunctionslist)

```solidity
function getFunctionsList() external pure
returns(bytes4[])
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getFunctionsList() external pure returns (bytes4[] memory) {
        bytes4[] memory functionsList = new bytes4[](32);
        functionsList[0] = this.getStorageMaxDurationToStakeTokens.selector;
        functionsList[1] = this.getStorageMaxVotingWeight.selector;
        functionsList[2] = this.getStorageWeightFactor.selector;
        functionsList[3] = this.getStorageDefaulWeightScaling.selector;
        functionsList[4] = this.getStorageRangeForWeightScaling.selector;
        functionsList[5] = this.getStorageDomainTypehash.selector;
        functionsList[6] = this.getStorageDelegationTypehash.selector;
        functionsList[7] = this.getStorageName.selector;
        functionsList[8] = this.kickoffTS.selector;
        functionsList[9] = this.SOVToken.selector;
        functionsList[10] = this.delegates.selector;
        functionsList[11] = this.allUnlocked.selector;
        functionsList[12] = this.newStakingContract.selector;
        functionsList[13] = this.totalStakingCheckpoints.selector;
        functionsList[14] = this.numTotalStakingCheckpoints.selector;
        functionsList[15] = this.delegateStakingCheckpoints.selector;
        functionsList[16] = this.numDelegateStakingCheckpoints.selector;
        functionsList[17] = this.userStakingCheckpoints.selector;
        functionsList[18] = this.numUserStakingCheckpoints.selector;
        functionsList[19] = this.nonces.selector;
        functionsList[20] = this.feeSharing.selector;
        functionsList[21] = this.weightScaling.selector;
        functionsList[22] = this.vestingWhitelist.selector;
        functionsList[23] = this.admins.selector;
        functionsList[24] = this.vestingCodeHashes.selector;
        functionsList[25] = this.vestingCheckpoints.selector;
        functionsList[26] = this.numVestingCheckpoints.selector;
        functionsList[27] = this.vestingRegistryLogic.selector;
        functionsList[28] = this.pausers.selector;
        functionsList[29] = this.paused.selector;
        functionsList[30] = this.frozen.selector;
        functionsList[31] = this.getMaxVestingWithdrawIterations.selector;

        return functionsList;
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
* [CheckpointsShared](CheckpointsShared.md)
* [Constants](Constants.md)
* [Context](Context.md)
* [DevelopmentFund](DevelopmentFund.md)
* [DummyContract](DummyContract.md)
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
* [FeeSharingCollector](FeeSharingCollector.md)
* [FeeSharingCollectorProxy](FeeSharingCollectorProxy.md)
* [FeeSharingCollectorStorage](FeeSharingCollectorStorage.md)
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
* [IERC1820Registry](IERC1820Registry.md)
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IERC777](IERC777.md)
* [IERC777Recipient](IERC777Recipient.md)
* [IERC777Sender](IERC777Sender.md)
* [IFeeSharingCollector](IFeeSharingCollector.md)
* [IFourYearVesting](IFourYearVesting.md)
* [IFourYearVestingFactory](IFourYearVestingFactory.md)
* [IFunctionsList](IFunctionsList.md)
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
* [IModulesProxyRegistry](IModulesProxyRegistry.md)
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
* [LoanClosingsWithoutInvariantCheck](LoanClosingsWithoutInvariantCheck.md)
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
* [MarginTradeStructHelpers](MarginTradeStructHelpers.md)
* [Medianizer](Medianizer.md)
* [ModuleCommonFunctionalities](ModuleCommonFunctionalities.md)
* [ModulesCommonEvents](ModulesCommonEvents.md)
* [ModulesProxy](ModulesProxy.md)
* [ModulesProxyRegistry](ModulesProxyRegistry.md)
* [MultiSigKeyHolders](MultiSigKeyHolders.md)
* [MultiSigWallet](MultiSigWallet.md)
* [Mutex](Mutex.md)
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
* [ProxyOwnable](ProxyOwnable.md)
* [ReentrancyGuard](ReentrancyGuard.md)
* [RewardHelper](RewardHelper.md)
* [RSKAddrValidator](RSKAddrValidator.md)
* [SafeERC20](SafeERC20.md)
* [SafeMath](SafeMath.md)
* [SafeMath96](SafeMath96.md)
* [setGet](setGet.md)
* [SharedReentrancyGuard](SharedReentrancyGuard.md)
* [SignedSafeMath](SignedSafeMath.md)
* [SOV](SOV.md)
* [sovrynProtocol](sovrynProtocol.md)
* [StakingAdminModule](StakingAdminModule.md)
* [StakingGovernanceModule](StakingGovernanceModule.md)
* [StakingInterface](StakingInterface.md)
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingShared](StakingShared.md)
* [StakingStakeModule](StakingStakeModule.md)
* [StakingStorageModule](StakingStorageModule.md)
* [StakingStorageShared](StakingStorageShared.md)
* [StakingVestingModule](StakingVestingModule.md)
* [StakingWithdrawModule](StakingWithdrawModule.md)
* [State](State.md)
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
* [Utils](Utils.md)
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
* [WeightedStakingModule](WeightedStakingModule.md)
* [WRBTC](WRBTC.md)
