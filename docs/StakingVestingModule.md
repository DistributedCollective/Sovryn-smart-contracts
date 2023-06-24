# Staking Vesting Module contract (StakingVestingModule.sol)

View Source: [contracts/governance/Staking/modules/StakingVestingModule.sol](../contracts/governance/Staking/modules/StakingVestingModule.sol)

**↗ Extends: [IFunctionsList](IFunctionsList.md), [StakingShared](StakingShared.md)**

**StakingVestingModule**

Implements interaction with Vesting functionality: vesting registry, vesting staking

**Events**

```js
event ContractCodeHashAdded(bytes32  hash);
event ContractCodeHashRemoved(bytes32  hash);
event VestingStakeSet(uint256  lockedTS, uint96  value);
```

## Functions

- [setVestingRegistry(address _vestingRegistryProxy)](#setvestingregistry)
- [setVestingStakes(uint256[] lockedDates, uint96[] values)](#setvestingstakes)
- [_setVestingStake(uint256 lockedTS, uint96 value)](#_setvestingstake)
- [getPriorUserStakeByDate(address account, uint256 date, uint256 blockNumber)](#getprioruserstakebydate)
- [getPriorVestingWeightedStake(uint256 blockNumber, uint256 date)](#getpriorvestingweightedstake)
- [weightedVestingStakeByDate(uint256 date, uint256 startDate, uint256 blockNumber)](#weightedvestingstakebydate)
- [_weightedVestingStakeByDate(uint256 date, uint256 startDate, uint256 blockNumber)](#_weightedvestingstakebydate)
- [getPriorVestingStakeByDate(uint256 date, uint256 blockNumber)](#getpriorvestingstakebydate)
- [_getPriorVestingStakeByDate(uint256 date, uint256 blockNumber)](#_getpriorvestingstakebydate)
- [addContractCodeHash(address vesting)](#addcontractcodehash)
- [removeContractCodeHash(address vesting)](#removecontractcodehash)
- [isVestingContract(address stakerAddress)](#isvestingcontract)
- [_getCodeHash(address _contract)](#_getcodehash)
- [getFunctionsList()](#getfunctionslist)

---    

> ### setVestingRegistry

sets vesting registry

```solidity
function setVestingRegistry(address _vestingRegistryProxy) external nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _vestingRegistryProxy | address | the address of vesting registry proxy contract | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setVestingRegistry(address _vestingRegistryProxy) external onlyOwner whenNotFrozen {
        vestingRegistryLogic = IVestingRegistry(_vestingRegistryProxy);
    }
```
</details>

---    

> ### setVestingStakes

Sets the users' vesting stakes for a giving lock dates and writes checkpoints.

```solidity
function setVestingStakes(uint256[] lockedDates, uint96[] values) external nonpayable onlyAuthorized whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedDates | uint256[] | The arrays of lock dates. | 
| values | uint96[] | The array of values to add to the staked balance. TODO: remove - it was designed as a disposable function to initialize vesting checkpoints | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function setVestingStakes(uint256[] calldata lockedDates, uint96[] calldata values)
        external
        onlyAuthorized
        whenNotFrozen
    {
        require(lockedDates.length == values.length, "arrays mismatch"); // WS05

        uint256 length = lockedDates.length;
        for (uint256 i = 0; i < length; i++) {
            _setVestingStake(lockedDates[i], values[i]);
        }
    }
```
</details>

---    

> ### _setVestingStake

Sets the users' vesting stake for a giving lock date and writes a checkpoint.

```solidity
function _setVestingStake(uint256 lockedTS, uint96 value) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The lock date. | 
| value | uint96 | The value to be set. TODO: remove - it was designed as a disposable function to initialize vesting checkpoints | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _setVestingStake(uint256 lockedTS, uint96 value) internal {
        require(
            lockedTS > kickoffTS,
            "Invalid lock dates: must greater than contract creation timestamp"
        );

        // locked date must be multiples of 14 days / TWO_WEEKS
        require(
            (lockedTS - kickoffTS) % TWO_WEEKS == 0,
            "Invalid lock dates: not multiples of 14 days"
        );

        // locked date must not exceed the MAX_DURATION
        if (lockedTS > block.timestamp) {
            require(
                lockedTS - block.timestamp <= MAX_DURATION,
                "Invalid lock dates: exceed max duration"
            );
        }

        // the value must not exceed the total staked at the given locked date
        uint32 nStakeCheckpoints = numTotalStakingCheckpoints[lockedTS];
        uint96 totalStaked = totalStakingCheckpoints[lockedTS][nStakeCheckpoints - 1].stake;
        require(
            value <= totalStaked,
            "Invalid stake amount: greater than the total staked for given date"
        );

        uint32 nCheckpoints = numVestingCheckpoints[lockedTS];
        uint32 blockNumber;

        Checkpoint memory recentCP = vestingCheckpoints[lockedTS][nCheckpoints - 1];
        if (nCheckpoints == 0) blockNumber = uint32(block.number) - 1;
        else blockNumber = recentCP.fromBlock + 1;

        vestingCheckpoints[lockedTS][nCheckpoints] = Checkpoint(blockNumber, value);
        numVestingCheckpoints[lockedTS] = nCheckpoints + 1;

        emit VestingStakeSet(lockedTS, value);
    }
```
</details>

---    

> ### getPriorUserStakeByDate

Determine the prior number of stake for an account until a
certain lock date as of a block number.

```solidity
function getPriorUserStakeByDate(address account, uint256 date, uint256 blockNumber) external view
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
function getPriorUserStakeByDate(
        address account,
        uint256 date,
        uint256 blockNumber
    ) external view returns (uint96) {
        uint96 priorStake = _getPriorUserStakeByDate(account, date, blockNumber);
        // @dev we need to modify function in order to workaround issue with Vesting.withdrawTokens:
        //		return 1 instead of 0 if message sender is a contract.
        if (priorStake == 0 && _isVestingContract(msg.sender)) {
            priorStake = 1;
        }
        return priorStake;
    }
```
</details>

---    

> ### getPriorVestingWeightedStake

Determine the prior weighted vested amount for an account as of a block number.
Iterate through checkpoints adding up voting power.

```solidity
function getPriorVestingWeightedStake(uint256 blockNumber, uint256 date) external view
returns(votes uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| blockNumber | uint256 | The block number to get the vote balance at. | 
| date | uint256 | The staking date to compute the power for. | 

**Returns**

The weighted stake the account had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPriorVestingWeightedStake(uint256 blockNumber, uint256 date)
        external
        view
        returns (uint96 votes)
    {
        /// @dev If date is not an exact break point, start weight computation from the previous break point (alternative would be the next).
        uint256 start = _timestampToLockDate(date);
        uint256 end = start + MAX_DURATION;

        /// @dev Max 78 iterations.
        for (uint256 i = start; i <= end; i += TWO_WEEKS) {
            uint96 weightedStake = _weightedVestingStakeByDate(i, start, blockNumber);
            if (weightedStake > 0) {
                votes = add96(votes, weightedStake, "overflow on total weight"); // WS15
            }
        }
    }
```
</details>

---    

> ### weightedVestingStakeByDate

Compute the voting power for a specific date.
Power = stake * weight

```solidity
function weightedVestingStakeByDate(uint256 date, uint256 startDate, uint256 blockNumber) external view
returns(power uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The staking date to compute the power for. Adjusted to the previous valid lock date, if necessary. | 
| startDate | uint256 | The date for which we need to know the power of the stake. Adjusted to the previous valid lock date, if necessary. | 
| blockNumber | uint256 | The block number, needed for checkpointing. | 

**Returns**

The stacking power.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function weightedVestingStakeByDate(
        uint256 date,
        uint256 startDate,
        uint256 blockNumber
    ) external view returns (uint96 power) {
        date = _timestampToLockDate(date);
        startDate = _timestampToLockDate(startDate);
        power = _weightedVestingStakeByDate(date, startDate, blockNumber);
    }
```
</details>

---    

> ### _weightedVestingStakeByDate

Compute the voting power for a specific date.
Power = stake * weight

```solidity
function _weightedVestingStakeByDate(uint256 date, uint256 startDate, uint256 blockNumber) internal view
returns(power uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The staking date to compute the power for. | 
| startDate | uint256 | The date for which we need to know the power of the stake. | 
| blockNumber | uint256 | The block number, needed for checkpointing. | 

**Returns**

The stacking power.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _weightedVestingStakeByDate(
        uint256 date,
        uint256 startDate,
        uint256 blockNumber
    ) internal view returns (uint96 power) {
        uint96 staked = _getPriorVestingStakeByDate(date, blockNumber);
        if (staked > 0) {
            uint96 weight = _computeWeightByDate(date, startDate);
            power = mul96(staked, weight, "mul oveflow") / WEIGHT_FACTOR; // WS16
        } else {
            power = 0;
        }
    }
```
</details>

---    

> ### getPriorVestingStakeByDate

Determine the prior number of vested stake for an account until a
certain lock date as of a block number.

```solidity
function getPriorVestingStakeByDate(uint256 date, uint256 blockNumber) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The lock date. Adjusted to the next valid lock date, if necessary. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

**Returns**

The number of votes the account had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPriorVestingStakeByDate(uint256 date, uint256 blockNumber)
        external
        view
        returns (uint96)
    {
        date = _adjustDateForOrigin(date);
        return _getPriorVestingStakeByDate(date, blockNumber);
    }
```
</details>

---    

> ### _getPriorVestingStakeByDate

Determine the prior number of vested stake for an account until a
		certain lock date as of a block number.

```solidity
function _getPriorVestingStakeByDate(uint256 date, uint256 blockNumber) internal view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The lock date. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

**Returns**

The number of votes the account had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getPriorVestingStakeByDate(uint256 date, uint256 blockNumber)
        internal
        view
        returns (uint96)
    {
        require(blockNumber < _getCurrentBlockNumber(), "not determined"); // WS17

        uint32 nCheckpoints = numVestingCheckpoints[date];
        if (nCheckpoints == 0) {
            return 0;
        }

        /// @dev First check most recent balance.
        if (vestingCheckpoints[date][nCheckpoints - 1].fromBlock <= blockNumber) {
            return vestingCheckpoints[date][nCheckpoints - 1].stake;
        }

        /// @dev Next check implicit zero balance.
        if (vestingCheckpoints[date][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; /// @dev ceil, avoiding overflow.
            Checkpoint memory cp = vestingCheckpoints[date][center];
            if (cp.fromBlock == blockNumber) {
                return cp.stake;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return vestingCheckpoints[date][lower].stake;
    }
```
</details>

---    

> ### addContractCodeHash

Add vesting contract's code hash to a map of code hashes.

```solidity
function addContractCodeHash(address vesting) external nonpayable onlyAuthorized whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vesting | address | The address of Vesting contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function addContractCodeHash(address vesting) external onlyAuthorized whenNotFrozen {
        bytes32 codeHash = _getCodeHash(vesting);
        vestingCodeHashes[codeHash] = true;
        emit ContractCodeHashAdded(codeHash);
    }
```
</details>

---    

> ### removeContractCodeHash

Remove vesting contract's code hash to a map of code hashes.

```solidity
function removeContractCodeHash(address vesting) external nonpayable onlyAuthorized whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vesting | address | The address of Vesting contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function removeContractCodeHash(address vesting) external onlyAuthorized whenNotFrozen {
        bytes32 codeHash = _getCodeHash(vesting);
        require(vestingCodeHashes[codeHash], "not a registered vesting code hash");
        vestingCodeHashes[codeHash] = false;
        emit ContractCodeHashRemoved(codeHash);
    }
```
</details>

---    

> ### isVestingContract

Return flag whether the given address is a registered vesting contract.

```solidity
function isVestingContract(address stakerAddress) external view
returns(bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| stakerAddress | address | the address to check | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function isVestingContract(address stakerAddress) external view returns (bool) {
        bool isVesting;
        bytes32 codeHash = _getCodeHash(stakerAddress);
        if (address(vestingRegistryLogic) != address(0)) {
            isVesting = vestingRegistryLogic.isVestingAddress(stakerAddress);
        }

        if (isVesting) return true;
        if (vestingCodeHashes[codeHash]) return true;
        return false;
    }
```
</details>

---    

> ### _getCodeHash

Return hash of contract code

```solidity
function _getCodeHash(address _contract) internal view
returns(bytes32)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _contract | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getCodeHash(address _contract) internal view returns (bytes32) {
        bytes32 codeHash;
        assembly {
            codeHash := extcodehash(_contract)
        }
        return codeHash;
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
        bytes4[] memory functionsList = new bytes4[](9);
        functionsList[0] = this.setVestingRegistry.selector;
        functionsList[1] = this.setVestingStakes.selector;
        functionsList[2] = this.getPriorUserStakeByDate.selector;
        functionsList[3] = this.getPriorVestingWeightedStake.selector;
        functionsList[4] = this.getPriorVestingStakeByDate.selector;
        functionsList[5] = this.addContractCodeHash.selector;
        functionsList[6] = this.removeContractCodeHash.selector;
        functionsList[7] = this.isVestingContract.selector;
        functionsList[8] = this.weightedVestingStakeByDate.selector;
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
