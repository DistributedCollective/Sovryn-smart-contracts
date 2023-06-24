# Staking Governance Module contract (StakingGovernanceModule.sol)

View Source: [contracts/governance/Staking/modules/StakingGovernanceModule.sol](../contracts/governance/Staking/modules/StakingGovernanceModule.sol)

**↗ Extends: [IFunctionsList](IFunctionsList.md), [StakingShared](StakingShared.md), [CheckpointsShared](CheckpointsShared.md)**

**StakingGovernanceModule**

Implements voting power and delegation functionality

## Functions

- [getPriorTotalVotingPower(uint32 blockNumber, uint256 time)](#getpriortotalvotingpower)
- [_totalPowerByDate(uint256 date, uint256 startDate, uint256 blockNumber)](#_totalpowerbydate)
- [getCurrentVotes(address account)](#getcurrentvotes)
- [getPriorVotes(address account, uint256 blockNumber, uint256 date)](#getpriorvotes)
- [_totalPowerByDateForDelegatee(address account, uint256 date, uint256 startDate, uint256 blockNumber)](#_totalpowerbydatefordelegatee)
- [getPriorStakeByDateForDelegatee(address account, uint256 date, uint256 blockNumber)](#getpriorstakebydatefordelegatee)
- [_getPriorStakeByDateForDelegatee(address account, uint256 date, uint256 blockNumber)](#_getpriorstakebydatefordelegatee)
- [getPriorTotalStakesForDate(uint256 date, uint256 blockNumber)](#getpriortotalstakesfordate)
- [_getPriorTotalStakesForDate(uint256 date, uint256 blockNumber)](#_getpriortotalstakesfordate)
- [_delegate(address delegator, address delegatee, uint256 lockedTS)](#_delegate)
- [_delegateNext(address delegator, address delegatee, uint256 lockedTS)](#_delegatenext)
- [_moveDelegates(address srcRep, address dstRep, uint96 amount, uint256 lockedTS)](#_movedelegates)
- [_getChainId()](#_getchainid)
- [delegate(address delegatee, uint256 lockDate)](#delegate)
- [getFunctionsList()](#getfunctionslist)

---    

> ### getPriorTotalVotingPower

Compute the total voting power at a given time.

```solidity
function getPriorTotalVotingPower(uint32 blockNumber, uint256 time) public view
returns(totalVotingPower uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| blockNumber | uint32 | The block number, needed for checkpointing. | 
| time | uint256 | The timestamp for which to calculate the total voting power. | 

**Returns**

The total voting power at the given time.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPriorTotalVotingPower(uint32 blockNumber, uint256 time)
        public
        view
        returns (uint96 totalVotingPower)
    {
        /// @dev Start the computation with the exact or previous unlocking date (voting weight remians the same until the next break point).
        uint256 start = _timestampToLockDate(time);
        uint256 end = start + MAX_DURATION;

        /// @dev Max 78 iterations.
        for (uint256 i = start; i <= end; i += TWO_WEEKS) {
            totalVotingPower = add96(
                totalVotingPower,
                _totalPowerByDate(i, start, blockNumber),
                "arrays mismatch"
            ); // WS06
        }
    }
```
</details>

---    

> ### _totalPowerByDate

Compute the voting power for a specific date.
Power = stake * weight

```solidity
function _totalPowerByDate(uint256 date, uint256 startDate, uint256 blockNumber) internal view
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
function _totalPowerByDate(
        uint256 date,
        uint256 startDate,
        uint256 blockNumber
    ) internal view returns (uint96 power) {
        uint96 weight = _computeWeightByDate(date, startDate);
        uint96 staked = _getPriorTotalStakesForDate(date, blockNumber);
        /// @dev weight is multiplied by some factor to allow decimals.
        power = mul96(staked, weight, "mul overflow") / WEIGHT_FACTOR; // WS07
    }
```
</details>

---    

> ### getCurrentVotes

Get the current votes balance for a user account.

```solidity
function getCurrentVotes(address account) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address to get votes balance. | 

**Returns**

The number of current votes for a user account.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getCurrentVotes(address account) external view returns (uint96) {
        return getPriorVotes(account, block.number - 1, block.timestamp);
    }
```
</details>

---    

> ### getPriorVotes

Determine the prior number of votes for a delegatee as of a block number.
Iterate through checkpoints adding up voting power.

```solidity
function getPriorVotes(address account, uint256 blockNumber, uint256 date) public view
returns(votes uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 
| date | uint256 | The staking date to compute the power for. | 

**Returns**

The number of votes the delegatee had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPriorVotes(
        address account,
        uint256 blockNumber,
        uint256 date
    ) public view returns (uint96 votes) {
        /// @dev If date is not an exact break point, start weight computation from the previous break point (alternative would be the next).
        uint256 start = _timestampToLockDate(date);
        uint256 end = start + MAX_DURATION;

        /// @dev Max 78 iterations.
        for (uint256 i = start; i <= end; i += TWO_WEEKS) {
            votes = add96(
                votes,
                _totalPowerByDateForDelegatee(account, i, start, blockNumber),
                "overflow - total VP"
            ); // WS09
        }
    }
```
</details>

---    

> ### _totalPowerByDateForDelegatee

Compute the voting power for a specific date.
Power = stake * weight

```solidity
function _totalPowerByDateForDelegatee(address account, uint256 date, uint256 startDate, uint256 blockNumber) internal view
returns(power uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| date | uint256 | The staking date to compute the power for. | 
| startDate | uint256 | The date for which we need to know the power of the stake. | 
| blockNumber | uint256 | The block number, needed for checkpointing. | 

**Returns**

The stacking power.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _totalPowerByDateForDelegatee(
        address account,
        uint256 date,
        uint256 startDate,
        uint256 blockNumber
    ) internal view returns (uint96 power) {
        uint96 weight = _computeWeightByDate(date, startDate);
        uint96 staked = _getPriorStakeByDateForDelegatee(account, date, blockNumber);
        power = mul96(staked, weight, "mul overflow") / WEIGHT_FACTOR; // WS10
    }
```
</details>

---    

> ### getPriorStakeByDateForDelegatee

Determine the prior number of stake for an account as of a block number.

```solidity
function getPriorStakeByDateForDelegatee(address account, uint256 date, uint256 blockNumber) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| date | uint256 | The staking date to compute the power for. Adjusted to the next valid lock date, if necessary. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

**Returns**

The number of votes the account had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPriorStakeByDateForDelegatee(
        address account,
        uint256 date,
        uint256 blockNumber
    ) external view returns (uint96) {
        date = _adjustDateForOrigin(date);
        return _getPriorStakeByDateForDelegatee(account, date, blockNumber);
    }
```
</details>

---    

> ### _getPriorStakeByDateForDelegatee

Determine the prior number of stake for an account as of a block number.

```solidity
function _getPriorStakeByDateForDelegatee(address account, uint256 date, uint256 blockNumber) internal view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to check. | 
| date | uint256 | The staking date to compute the power for. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

**Returns**

The number of votes the account had as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getPriorStakeByDateForDelegatee(
        address account,
        uint256 date,
        uint256 blockNumber
    ) internal view returns (uint96) {
        require(blockNumber < _getCurrentBlockNumber(), "not determined yet"); // WS11

        uint32 nCheckpoints = numDelegateStakingCheckpoints[account][date];
        if (nCheckpoints == 0) {
            return 0;
        }

        /// @dev First check most recent balance.
        if (delegateStakingCheckpoints[account][date][nCheckpoints - 1].fromBlock <= blockNumber) {
            return delegateStakingCheckpoints[account][date][nCheckpoints - 1].stake;
        }

        /// @dev Next check implicit zero balance.
        if (delegateStakingCheckpoints[account][date][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; /// @dev ceil, avoiding overflow.
            Checkpoint memory cp = delegateStakingCheckpoints[account][date][center];
            if (cp.fromBlock == blockNumber) {
                return cp.stake;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return delegateStakingCheckpoints[account][date][lower].stake;
    }
```
</details>

---    

> ### getPriorTotalStakesForDate

Determine the prior number of stake for an unlocking date as of a block number.

```solidity
function getPriorTotalStakesForDate(uint256 date, uint256 blockNumber) public view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The date to check the stakes for. Adjusted to the next valid lock date, as necessary | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

**Returns**

The total number of votes as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getPriorTotalStakesForDate(uint256 date, uint256 blockNumber)
        public
        view
        returns (uint96)
    {
        date = _adjustDateForOrigin(date);
        return _getPriorTotalStakesForDate(date, blockNumber);
    }
```
</details>

---    

> ### _getPriorTotalStakesForDate

Determine the prior number of stake for an unlocking date as of a block number.

```solidity
function _getPriorTotalStakesForDate(uint256 date, uint256 blockNumber) internal view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| date | uint256 | The date to check the stakes for. | 
| blockNumber | uint256 | The block number to get the vote balance at. | 

**Returns**

The total number of votes as of the given block.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getPriorTotalStakesForDate(uint256 date, uint256 blockNumber)
        internal
        view
        returns (uint96)
    {
        require(blockNumber < _getCurrentBlockNumber(), "not determined"); // WS08

        uint32 nCheckpoints = numTotalStakingCheckpoints[date];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (totalStakingCheckpoints[date][nCheckpoints - 1].fromBlock <= blockNumber) {
            return totalStakingCheckpoints[date][nCheckpoints - 1].stake;
        }

        // Next check implicit zero balance
        if (totalStakingCheckpoints[date][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = totalStakingCheckpoints[date][center];
            if (cp.fromBlock == blockNumber) {
                return cp.stake;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return totalStakingCheckpoints[date][lower].stake;
    }
```
</details>

---    

> ### _delegate

Set new delegatee. Move from user's current delegate to a new
delegatee the stake balance.

```solidity
function _delegate(address delegator, address delegatee, uint256 lockedTS) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delegator | address | The user address to move stake balance from its current delegatee. | 
| delegatee | address | The new delegatee. The address to move stake balance to. | 
| lockedTS | uint256 | The lock date. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _delegate(
        address delegator,
        address delegatee,
        uint256 lockedTS
    ) internal {
        address currentDelegate = delegates[delegator][lockedTS];
        uint96 delegatorBalance = _currentBalance(delegator, lockedTS);

        // vesting contracts will in multiple cases try to delegate a zero balance
        // or to the existing delegatee
        if (_isVestingContract(msg.sender)) {
            if (delegatorBalance == 0 || currentDelegate == delegatee) {
                return;
            }
        } else {
            require(delegatorBalance > 0, "no stake to delegate");
            require(currentDelegate != delegatee, "cannot delegate to the existing delegatee");
        }

        delegates[delegator][lockedTS] = delegatee;

        emit DelegateChanged(delegator, lockedTS, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorBalance, lockedTS);
    }
```
</details>

---    

> ### _delegateNext

```solidity
function _delegateNext(address delegator, address delegatee, uint256 lockedTS) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delegator | address |  | 
| delegatee | address |  | 
| lockedTS | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _delegateNext(
        address delegator,
        address delegatee,
        uint256 lockedTS
    ) internal {
        if (_isVestingContract(msg.sender)) {
            uint256 nextLock = lockedTS.add(TWO_WEEKS);
            address currentDelegate = delegates[delegator][nextLock];
            if (currentDelegate != delegatee) {
                _delegate(delegator, delegatee, nextLock);
            }

            // @dev workaround for the issue with a delegation of the latest stake
            uint256 endDate = IVesting(msg.sender).endDate();
            nextLock = lockedTS.add(FOUR_WEEKS);
            if (nextLock == endDate) {
                currentDelegate = delegates[delegator][nextLock];
                if (currentDelegate != delegatee) {
                    _delegate(delegator, delegatee, nextLock);
                }
            }
        }
    }
```
</details>

---    

> ### _moveDelegates

Move an amount of delegate stake from a source address to a
destination address.

```solidity
function _moveDelegates(address srcRep, address dstRep, uint96 amount, uint256 lockedTS) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| srcRep | address | The address to get the staked amount from. | 
| dstRep | address | The address to send the staked amount to. | 
| amount | uint96 | The staked amount to move. | 
| lockedTS | uint256 | The lock date. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _moveDelegates(
        address srcRep,
        address dstRep,
        uint96 amount,
        uint256 lockedTS
    ) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) _decreaseDelegateStake(srcRep, lockedTS, amount);

            if (dstRep != address(0)) _increaseDelegateStake(dstRep, lockedTS, amount);
        }
    }
```
</details>

---    

> ### _getChainId

Retrieve CHAIN_ID of the executing chain.
     * Chain identifier (chainID) introduced in EIP-155 protects transaction
included into one chain from being included into another chain.
Basically, chain identifier is an integer number being used in the
processes of signing transactions and verifying transaction signatures.
     *

```solidity
function _getChainId() internal pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getChainId() internal pure returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }
```
</details>

---    

> ### delegate

Delegate votes from `msg.sender` which are locked until lockDate to `delegatee`.

```solidity
function delegate(address delegatee, uint256 lockDate) external nonpayable whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delegatee | address | The address to delegate votes to. | 
| lockDate | uint256 | the date if the position to delegate. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function delegate(address delegatee, uint256 lockDate) external whenNotPaused {
        require(delegatee != address(0), "cannot delegate to the zero address");
        _notSameBlockAsStakingCheckpoint(lockDate, msg.sender);

        _delegate(msg.sender, delegatee, lockDate);
        // @dev delegates tokens for lock date 2 weeks later than given lock date
        //		if message sender is a contract
        _delegateNext(msg.sender, delegatee, lockDate);
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
        bytes4[] memory functionsList = new bytes4[](6);
        functionsList[0] = this.getPriorTotalVotingPower.selector;
        functionsList[1] = this.getCurrentVotes.selector;
        functionsList[2] = this.getPriorVotes.selector;
        functionsList[3] = this.getPriorStakeByDateForDelegatee.selector;
        functionsList[4] = this.getPriorTotalStakesForDate.selector;
        functionsList[5] = this.delegate.selector;
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
