# Checkpoints contract. (Checkpoints.sol)

View Source: [contracts/governance/Staking/Checkpoints.sol](../contracts/governance/Staking/Checkpoints.sol)

**↗ Extends: [StakingStorage](StakingStorage.md), [SafeMath96](SafeMath96.md)**
**↘ Derived Contracts: [WeightedStaking](WeightedStaking.md)**

**Checkpoints**

Increases and decreases storage values for users, delegatees and
total daily stake.

**Events**

```js
event DelegateChanged(address indexed delegator, uint256  lockedUntil, address indexed fromDelegate, address indexed toDelegate);
event DelegateStakeChanged(address indexed delegate, uint256  lockedUntil, uint256  previousBalance, uint256  newBalance);
event TokensStaked(address indexed staker, uint256  amount, uint256  lockedUntil, uint256  totalStaked);
event StakingWithdrawn(address indexed staker, uint256  amount, uint256  until, address indexed receiver, bool  isGovernance);
event VestingTokensWithdrawn(address  vesting, address  receiver);
event TokensUnlocked(uint256  amount);
event ExtendedStakingDuration(address indexed staker, uint256  previousDate, uint256  newDate, uint256  amountStaked);
event AdminAdded(address  admin);
event AdminRemoved(address  admin);
event PauserAddedOrRemoved(address indexed pauser, bool indexed added);
event StakingPaused(bool indexed setPaused);
event StakingFrozen(bool indexed setFrozen);
event ContractCodeHashAdded(bytes32  hash);
event ContractCodeHashRemoved(bytes32  hash);
event VestingStakeSet(uint256  lockedTS, uint96  value);
```

## Functions

- [_increaseVestingStake(uint256 lockedTS, uint96 value)](#_increasevestingstake)
- [_decreaseVestingStake(uint256 lockedTS, uint96 value)](#_decreasevestingstake)
- [_writeVestingCheckpoint(uint256 lockedTS, uint32 nCheckpoints, uint96 newVest)](#_writevestingcheckpoint)
- [_increaseUserStake(address account, uint256 lockedTS, uint96 value)](#_increaseuserstake)
- [_decreaseUserStake(address account, uint256 lockedTS, uint96 value)](#_decreaseuserstake)
- [_writeUserCheckpoint(address account, uint256 lockedTS, uint32 nCheckpoints, uint96 newStake)](#_writeusercheckpoint)
- [_increaseDelegateStake(address delegatee, uint256 lockedTS, uint96 value)](#_increasedelegatestake)
- [_decreaseDelegateStake(address delegatee, uint256 lockedTS, uint96 value)](#_decreasedelegatestake)
- [_writeDelegateCheckpoint(address delegatee, uint256 lockedTS, uint32 nCheckpoints, uint96 newStake)](#_writedelegatecheckpoint)
- [_increaseDailyStake(uint256 lockedTS, uint96 value)](#_increasedailystake)
- [_decreaseDailyStake(uint256 lockedTS, uint96 value)](#_decreasedailystake)
- [_writeStakingCheckpoint(uint256 lockedTS, uint32 nCheckpoints, uint96 newStake)](#_writestakingcheckpoint)

---    

> ### _increaseVestingStake

Increases the user's vesting stake for a giving lock date and writes a checkpoint.

```solidity
function _increaseVestingStake(uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to add to the staked balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _increaseVestingStake(uint256 lockedTS, uint96 value) internal {
        uint32 nCheckpoints = numVestingCheckpoints[lockedTS];
        uint96 vested = vestingCheckpoints[lockedTS][nCheckpoints - 1].stake;
        uint96 newVest = add96(vested, value, "CP01"); // vested overflow
        _writeVestingCheckpoint(lockedTS, nCheckpoints, newVest);
    }
```
</details>

---    

> ### _decreaseVestingStake

Decreases the user's vesting stake for a giving lock date and writes a checkpoint.

```solidity
function _decreaseVestingStake(uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to substract to the staked balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _decreaseVestingStake(uint256 lockedTS, uint96 value) internal {
        uint32 nCheckpoints = numVestingCheckpoints[lockedTS];
        uint96 vested = vestingCheckpoints[lockedTS][nCheckpoints - 1].stake;
        uint96 newVest = sub96(vested, value, "CP02"); // vested underflow
        _writeVestingCheckpoint(lockedTS, nCheckpoints, newVest);
    }
```
</details>

---    

> ### _writeVestingCheckpoint

Writes on storage the user vested amount.

```solidity
function _writeVestingCheckpoint(uint256 lockedTS, uint32 nCheckpoints, uint96 newVest) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The lock date. | 
| nCheckpoints | uint32 | The number of checkpoints, to find out the last one index. | 
| newVest | uint96 | The new vest balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _writeVestingCheckpoint(
        uint256 lockedTS,
        uint32 nCheckpoints,
        uint96 newVest
    ) internal {
        uint32 blockNumber = safe32(block.number, "CP03"); // block num > 32 bits

        if (
            nCheckpoints > 0 &&
            vestingCheckpoints[lockedTS][nCheckpoints - 1].fromBlock == blockNumber
        ) {
            vestingCheckpoints[lockedTS][nCheckpoints - 1].stake = newVest;
        } else {
            vestingCheckpoints[lockedTS][nCheckpoints] = Checkpoint(blockNumber, newVest);
            numVestingCheckpoints[lockedTS] = nCheckpoints + 1;
        }
    }
```
</details>

---    

> ### _increaseUserStake

Increases the user's stake for a giving lock date and writes a checkpoint.

```solidity
function _increaseUserStake(address account, uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The user address. | 
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to add to the staked balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _increaseUserStake(
        address account,
        uint256 lockedTS,
        uint96 value
    ) internal {
        uint32 nCheckpoints = numUserStakingCheckpoints[account][lockedTS];
        uint96 staked = userStakingCheckpoints[account][lockedTS][nCheckpoints - 1].stake;
        uint96 newStake = add96(staked, value, "CP04"); // staked overflow
        _writeUserCheckpoint(account, lockedTS, nCheckpoints, newStake);
    }
```
</details>

---    

> ### _decreaseUserStake

Decreases the user's stake for a giving lock date and writes a checkpoint.

```solidity
function _decreaseUserStake(address account, uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The user address. | 
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to substract to the staked balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _decreaseUserStake(
        address account,
        uint256 lockedTS,
        uint96 value
    ) internal {
        uint32 nCheckpoints = numUserStakingCheckpoints[account][lockedTS];
        uint96 staked = userStakingCheckpoints[account][lockedTS][nCheckpoints - 1].stake;
        uint96 newStake = sub96(staked, value, "CP05"); // staked underflow
        _writeUserCheckpoint(account, lockedTS, nCheckpoints, newStake);
    }
```
</details>

---    

> ### _writeUserCheckpoint

Writes on storage the user stake.

```solidity
function _writeUserCheckpoint(address account, uint256 lockedTS, uint32 nCheckpoints, uint96 newStake) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The user address. | 
| lockedTS | uint256 | The lock date. | 
| nCheckpoints | uint32 | The number of checkpoints, to find out the last one index. | 
| newStake | uint96 | The new staked balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _writeUserCheckpoint(
        address account,
        uint256 lockedTS,
        uint32 nCheckpoints,
        uint96 newStake
    ) internal {
        uint32 blockNumber = safe32(block.number, "CP06"); // block number > 32 bits

        if (
            nCheckpoints > 0 &&
            userStakingCheckpoints[account][lockedTS][nCheckpoints - 1].fromBlock == blockNumber
        ) {
            userStakingCheckpoints[account][lockedTS][nCheckpoints - 1].stake = newStake;
        } else {
            userStakingCheckpoints[account][lockedTS][nCheckpoints] = Checkpoint(
                blockNumber,
                newStake
            );
            numUserStakingCheckpoints[account][lockedTS] = nCheckpoints + 1;
        }
    }
```
</details>

---    

> ### _increaseDelegateStake

Increases the delegatee's stake for a giving lock date and writes a checkpoint.

```solidity
function _increaseDelegateStake(address delegatee, uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delegatee | address | The delegatee address. | 
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to add to the staked balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _increaseDelegateStake(
        address delegatee,
        uint256 lockedTS,
        uint96 value
    ) internal {
        uint32 nCheckpoints = numDelegateStakingCheckpoints[delegatee][lockedTS];
        uint96 staked = delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake;
        uint96 newStake = add96(staked, value, "CP07"); // block number > 32 bits
        _writeDelegateCheckpoint(delegatee, lockedTS, nCheckpoints, newStake);
    }
```
</details>

---    

> ### _decreaseDelegateStake

Decreases the delegatee's stake for a giving lock date and writes a checkpoint.

```solidity
function _decreaseDelegateStake(address delegatee, uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delegatee | address | The delegatee address. | 
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to substract to the staked balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _decreaseDelegateStake(
        address delegatee,
        uint256 lockedTS,
        uint96 value
    ) internal {
        uint32 nCheckpoints = numDelegateStakingCheckpoints[delegatee][lockedTS];
        uint96 staked = delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake;
        uint96 newStake = 0;
        // @dev We need to check delegate checkpoint value here,
        //		because we had an issue in `stake` function:
        //		delegate checkpoint wasn't updating for the second and next stakes for the same date
        //		if first stake was withdrawn completely and stake was delegated to the staker
        //		(no delegation to another address).
        // @dev It can be greater than 0, but inconsistent after 3 transactions
        if (staked > value) {
            newStake = sub96(staked, value, "CP08"); // staked underflow
        }
        _writeDelegateCheckpoint(delegatee, lockedTS, nCheckpoints, newStake);
    }
```
</details>

---    

> ### _writeDelegateCheckpoint

Writes on storage the delegate stake.

```solidity
function _writeDelegateCheckpoint(address delegatee, uint256 lockedTS, uint32 nCheckpoints, uint96 newStake) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delegatee | address | The delegate address. | 
| lockedTS | uint256 | The lock date. | 
| nCheckpoints | uint32 | The number of checkpoints, to find out the last one index. | 
| newStake | uint96 | The new staked balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _writeDelegateCheckpoint(
        address delegatee,
        uint256 lockedTS,
        uint32 nCheckpoints,
        uint96 newStake
    ) internal {
        uint32 blockNumber = safe32(block.number, "CP09"); // block numb > 32 bits
        uint96 oldStake = delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake;

        if (
            nCheckpoints > 0 &&
            delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].fromBlock ==
            blockNumber
        ) {
            delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake = newStake;
        } else {
            delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints] = Checkpoint(
                blockNumber,
                newStake
            );
            numDelegateStakingCheckpoints[delegatee][lockedTS] = nCheckpoints + 1;
        }
        emit DelegateStakeChanged(delegatee, lockedTS, oldStake, newStake);
    }
```
</details>

---    

> ### _increaseDailyStake

Increases the total stake for a giving lock date and writes a checkpoint.

```solidity
function _increaseDailyStake(uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to add to the staked balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _increaseDailyStake(uint256 lockedTS, uint96 value) internal {
        uint32 nCheckpoints = numTotalStakingCheckpoints[lockedTS];
        uint96 staked = totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake;
        uint96 newStake = add96(staked, value, "CP10"); // staked overflow
        _writeStakingCheckpoint(lockedTS, nCheckpoints, newStake);
    }
```
</details>

---    

> ### _decreaseDailyStake

Decreases the total stake for a giving lock date and writes a checkpoint.

```solidity
function _decreaseDailyStake(uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to substract to the staked balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _decreaseDailyStake(uint256 lockedTS, uint96 value) internal {
        uint32 nCheckpoints = numTotalStakingCheckpoints[lockedTS];
        uint96 staked = totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake;
        uint96 newStake = sub96(staked, value, "CP11"); // staked underflow
        _writeStakingCheckpoint(lockedTS, nCheckpoints, newStake);
    }
```
</details>

---    

> ### _writeStakingCheckpoint

Writes on storage the total stake.

```solidity
function _writeStakingCheckpoint(uint256 lockedTS, uint32 nCheckpoints, uint96 newStake) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The lock date. | 
| nCheckpoints | uint32 | The number of checkpoints, to find out the last one index. | 
| newStake | uint96 | The new staked balance. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _writeStakingCheckpoint(
        uint256 lockedTS,
        uint32 nCheckpoints,
        uint96 newStake
    ) internal {
        uint32 blockNumber = safe32(block.number, "CP12"); // block num > 32 bits

        if (
            nCheckpoints > 0 &&
            totalStakingCheckpoints[lockedTS][nCheckpoints - 1].fromBlock == blockNumber
        ) {
            totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake = newStake;
        } else {
            totalStakingCheckpoints[lockedTS][nCheckpoints] = Checkpoint(blockNumber, newStake);
            numTotalStakingCheckpoints[lockedTS] = nCheckpoints + 1;
        }
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
* [Checkpoints](Checkpoints.md)
* [Constants](Constants.md)
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
* [FeeSharingProxyStorage](FeeSharingProxyStorage.md)
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
* [IERC20_](IERC20_.md)
* [IERC20](IERC20.md)
* [IFeeSharingProxy](IFeeSharingProxy.md)
* [IFourYearVesting](IFourYearVesting.md)
* [IFourYearVestingFactory](IFourYearVestingFactory.md)
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
* [Medianizer](Medianizer.md)
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
* [StakingProxy](StakingProxy.md)
* [StakingRewards](StakingRewards.md)
* [StakingRewardsProxy](StakingRewardsProxy.md)
* [StakingRewardsStorage](StakingRewardsStorage.md)
* [StakingStorage](StakingStorage.md)
* [State](State.md)
* [SVR](SVR.md)
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
* [WeightedStaking](WeightedStaking.md)
* [WRBTC](WRBTC.md)
