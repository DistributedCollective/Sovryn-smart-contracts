# Staking modules shared functionality (StakingShared.sol)

View Source: [contracts/governance/Staking/modules/shared/StakingShared.sol](../contracts/governance/Staking/modules/shared/StakingShared.sol)

**↗ Extends: [StakingStorageShared](StakingStorageShared.md), [SafeMath96](SafeMath96.md)**
**↘ Derived Contracts: [StakingAdminModule](StakingAdminModule.md), [StakingGovernanceModule](StakingGovernanceModule.md), [StakingStakeModule](StakingStakeModule.md), [StakingVestingModule](StakingVestingModule.md), [StakingWithdrawModule](StakingWithdrawModule.md), [WeightedStakingModule](WeightedStakingModule.md)**

**StakingShared**

## Contract Members
**Constants & Variables**

```js
uint256 internal constant FOUR_WEEKS;

```

## Modifiers

- [whenNotPaused](#whennotpaused)
- [onlyAuthorized](#onlyauthorized)
- [onlyPauserOrOwner](#onlypauserorowner)
- [whenNotFrozen](#whennotfrozen)

### whenNotPaused

Throws if paused.

```js
modifier whenNotPaused() internal
```

### onlyAuthorized

Throws if called by any account other than the owner or admin.

```js
modifier onlyAuthorized() internal
```

### onlyPauserOrOwner

Throws if called by any account other than the owner or pauser.

```js
modifier onlyPauserOrOwner() internal
```

### whenNotFrozen

Throws if frozen.

```js
modifier whenNotFrozen() internal
```

## Functions

- [constructor()](#constructor)
- [_notSameBlockAsStakingCheckpoint(uint256 lockDate, address stakeFor)](#_notsameblockasstakingcheckpoint)
- [_timestampToLockDate(uint256 timestamp)](#_timestamptolockdate)
- [_getCurrentBlockNumber()](#_getcurrentblocknumber)
- [_getPriorUserStakeByDate(address account, uint256 date, uint256 blockNumber)](#_getprioruserstakebydate)
- [_adjustDateForOrigin(uint256 date)](#_adjustdatefororigin)
- [_computeWeightByDate(uint256 date, uint256 startDate)](#_computeweightbydate)
- [_isVestingContract(address stakerAddress)](#_isvestingcontract)

---    

> ### constructor

```solidity
function () internal nonpayable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
constructor() internal {
        // abstract
    }
```
</details>

---    

> ### _notSameBlockAsStakingCheckpoint

```solidity
function _notSameBlockAsStakingCheckpoint(uint256 lockDate, address stakeFor) internal view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockDate | uint256 |  | 
| stakeFor | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _notSameBlockAsStakingCheckpoint(uint256 lockDate, address stakeFor) internal view {
        uint32 nCheckpoints = numUserStakingCheckpoints[stakeFor][lockDate];
        bool notSameBlock =
            userStakingCheckpoints[stakeFor][lockDate][nCheckpoints - 1].fromBlock != block.number;
        require(notSameBlock, "cannot be mined in the same block as last stake"); // S20
    }
```
</details>

---    

> ### _timestampToLockDate

Unstaking is possible every 2 weeks only. This means, to
calculate the key value for the staking checkpoints, we need to
map the intended timestamp to the closest available date.

```solidity
function _timestampToLockDate(uint256 timestamp) internal view
returns(lockDate uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| timestamp | uint256 | The unlocking timestamp. | 

**Returns**

The actual unlocking date (might be up to 2 weeks shorter than intended).

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _timestampToLockDate(uint256 timestamp) internal view returns (uint256 lockDate) {
        // Optimize gas costs by reading kickoffTS from storage only once.
        uint256 start = kickoffTS;
        require(timestamp >= start, "timestamp < contract creation"); // WS23
        /**
         * @dev If staking timestamp does not match any of the unstaking dates
         * , set the lockDate to the closest one before the timestamp.
         * E.g. Passed timestamps lies 7 weeks after kickoff -> only stake for 6 weeks.
         * */
        uint256 periodFromKickoff = (timestamp - start) / TWO_WEEKS;
        lockDate = periodFromKickoff * TWO_WEEKS + start;
    }
```
</details>

---    

> ### _getCurrentBlockNumber

Determine the current Block Number

```solidity
function _getCurrentBlockNumber() internal view
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getCurrentBlockNumber() internal view returns (uint256) {
        return block.number;
    }
```
</details>

---    

> ### _getPriorUserStakeByDate

Determine the prior number of stake for an account until a
		certain lock date as of a block number.

```solidity
function _getPriorUserStakeByDate(address account, uint256 date, uint256 blockNumber) internal view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| date | uint256 | The lock date. Adjusted to the next valid lock date, if necessary. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

**Returns**

The number of votes the account had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getPriorUserStakeByDate(
        address account,
        uint256 date,
        uint256 blockNumber
    ) internal view returns (uint96) {
        require(blockNumber < _getCurrentBlockNumber(), "not determined"); // WS14

        date = _adjustDateForOrigin(date);
        uint32 nCheckpoints = numUserStakingCheckpoints[account][date];
        if (nCheckpoints == 0) {
            return 0;
        }

        /// @dev First check most recent balance.
        if (userStakingCheckpoints[account][date][nCheckpoints - 1].fromBlock <= blockNumber) {
            return userStakingCheckpoints[account][date][nCheckpoints - 1].stake;
        }

        /// @dev Next check implicit zero balance.
        if (userStakingCheckpoints[account][date][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; /// @dev ceil, avoiding overflow.
            Checkpoint memory cp = userStakingCheckpoints[account][date][center];
            if (cp.fromBlock == blockNumber) {
                return cp.stake;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return userStakingCheckpoints[account][date][lower].stake;
    }
```
</details>

---    

> ### _adjustDateForOrigin

origin vesting contracts have different dates
we need to add 2 weeks to get end of period (by default, it's start)

```solidity
function _adjustDateForOrigin(uint256 date) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The staking date to compute the power for. | 

**Returns**

unlocking date.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _adjustDateForOrigin(uint256 date) internal view returns (uint256) {
        uint256 adjustedDate = _timestampToLockDate(date);
        //origin vesting contracts have different dates
        //we need to add 2 weeks to get end of period (by default, it's start)
        if (adjustedDate != date) {
            date = adjustedDate + TWO_WEEKS;
        }
        return date;
    }
```
</details>

---    

> ### _computeWeightByDate

Compute the weight for a specific date.

```solidity
function _computeWeightByDate(uint256 date, uint256 startDate) internal pure
returns(weight uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The unlocking date. | 
| startDate | uint256 | We compute the weight for the tokens staked until 'date' on 'startDate'. | 

**Returns**

The weighted stake the account had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _computeWeightByDate(uint256 date, uint256 startDate)
        internal
        pure
        returns (uint96 weight)
    {
        require(date >= startDate, "date < startDate"); // WS18
        uint256 remainingTime = (date - startDate);
        require(MAX_DURATION >= remainingTime, "remaining time > max duration"); // WS19
        /// @dev x = max days - remaining days
        uint96 x = uint96(MAX_DURATION - remainingTime) / (1 days);
        /// @dev w = (m^2 - x^2)/m^2 +1 (multiplied by the weight factor)
        weight = add96(
            WEIGHT_FACTOR,
            mul96(
                MAX_VOTING_WEIGHT * WEIGHT_FACTOR,
                sub96(
                    MAX_DURATION_POW_2,
                    x * x,
                    "weight underflow" // WS20
                ),
                "weight mul overflow" // WS21
            ) / MAX_DURATION_POW_2,
            "overflow on weight" // WS22
        );
    }
```
</details>

---    

> ### _isVestingContract

Return flag whether the given address is a registered vesting contract.

```solidity
function _isVestingContract(address stakerAddress) internal view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| stakerAddress | address | the address to check | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _isVestingContract(address stakerAddress) internal view returns (bool) {
        bool isVesting;
        bytes32 codeHash;

        assembly {
            codeHash := extcodehash(stakerAddress)
        }
        if (address(vestingRegistryLogic) != address(0)) {
            isVesting = vestingRegistryLogic.isVestingAddress(stakerAddress);
        }

        if (isVesting) return true;
        if (vestingCodeHashes[codeHash]) return true;
        return false;
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
