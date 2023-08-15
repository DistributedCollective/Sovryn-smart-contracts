# Staking contract staking functionality module (StakingStakeModule.sol)

View Source: [contracts/governance/Staking/modules/StakingStakeModule.sol](../contracts/governance/Staking/modules/StakingStakeModule.sol)

**↗ Extends: [IFunctionsList](IFunctionsList.md), [StakingShared](StakingShared.md), [CheckpointsShared](CheckpointsShared.md), [ApprovalReceiver](ApprovalReceiver.md)**

## **StakingStakeModule** contract

Implements staking functionality*

**Events**

```js
event TokensStaked(address indexed staker, uint256  amount, uint256  lockedUntil, uint256  totalStaked);
event ExtendedStakingDuration(address indexed staker, uint256  previousDate, uint256  newDate, uint256  amountStaked);
```

## Functions

- [stake(uint96 amount, uint256 until, address stakeFor, address delegatee)](#stake)
- [stakeWithApproval(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee)](#stakewithapproval)
- [_stake(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee, bool timeAdjusted)](#_stake)
- [_stakeOptionalTokenTransfer(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee, bool timeAdjusted, bool transferToken)](#_stakeoptionaltokentransfer)
- [extendStakingDuration(uint256 previousLock, uint256 until)](#extendstakingduration)
- [_increaseStake(address sender, uint96 amount, address stakeFor, uint256 until, bool transferToken)](#_increasestake)
- [stakesBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee)](#stakesbyschedule)
- [stakeBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee)](#stakebyschedule)
- [_stakeBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee)](#_stakebyschedule)
- [balanceOf(address account)](#balanceof)
- [getCurrentStakedUntil(uint256 lockedTS)](#getcurrentstakeduntil)
- [getStakes(address account)](#getstakes)
- [_getToken()](#_gettoken)
- [_getSelectors()](#_getselectors)
- [timestampToLockDate(uint256 timestamp)](#timestamptolockdate)
- [getFunctionsList()](#getfunctionslist)

---    

> ### stake

Stake the given amount for the given duration of time.

```solidity
function stake(uint96 amount, uint256 until, address stakeFor, address delegatee) external nonpayable whenNotPaused whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to stake. | 
| until | uint256 | Timestamp indicating the date until which to stake. | 
| stakeFor | address | The address to stake the tokens for or 0x0 if staking for oneself. | 
| delegatee | address | The address of the delegatee or 0x0 if there is none. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function stake(
        uint96 amount,
        uint256 until,
        address stakeFor,
        address delegatee
    ) external whenNotPaused whenNotFrozen {
        _stake(msg.sender, amount, until, stakeFor, delegatee, false);
    }
```
</details>

---    

> ### stakeWithApproval

Stake the given amount for the given duration of time.

```solidity
function stakeWithApproval(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee) external nonpayable onlyThisContract whenNotPaused whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sender | address | The sender of SOV.approveAndCall | 
| amount | uint96 | The number of tokens to stake. | 
| until | uint256 | Timestamp indicating the date until which to stake. | 
| stakeFor | address | The address to stake the tokens for or 0x0 if staking for oneself. | 
| delegatee | address | The address of the delegatee or 0x0 if there is none. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function stakeWithApproval(
        address sender,
        uint96 amount,
        uint256 until,
        address stakeFor,
        address delegatee
    ) external onlyThisContract whenNotPaused whenNotFrozen {
        _stake(sender, amount, until, stakeFor, delegatee, false);
    }
```
</details>

---    

> ### _stake

Send sender's tokens to this contract and update its staked balance.

```solidity
function _stake(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee, bool timeAdjusted) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sender | address | The sender of the tokens. | 
| amount | uint96 | The number of tokens to send. | 
| until | uint256 | The date until which the tokens will be staked. | 
| stakeFor | address | The beneficiary whose stake will be increased. | 
| delegatee | address | The address of the delegatee or stakeFor if default 0x0. | 
| timeAdjusted | bool | Whether fixing date to stacking periods or not. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _stake(
        address sender,
        uint96 amount,
        uint256 until,
        address stakeFor,
        address delegatee,
        bool timeAdjusted
    ) internal {
        _stakeOptionalTokenTransfer(
            sender,
            amount,
            until,
            stakeFor,
            delegatee,
            timeAdjusted,
            true // transfer SOV
        );
    }
```
</details>

---    

> ### _stakeOptionalTokenTransfer

Send sender's tokens to this contract and update its staked balance.

```solidity
function _stakeOptionalTokenTransfer(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee, bool timeAdjusted, bool transferToken) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sender | address | The sender of the tokens. | 
| amount | uint96 | The number of tokens to send. | 
| until | uint256 | The date until which the tokens will be staked. | 
| stakeFor | address | The beneficiary whose stake will be increased. | 
| delegatee | address | The address of the delegatee or stakeFor if default 0x0. | 
| timeAdjusted | bool | Whether fixing date to stacking periods or not. | 
| transferToken | bool | Should transfer SOV - false for multiple iterations like in stakeBySchedule | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _stakeOptionalTokenTransfer(
        address sender,
        uint96 amount,
        uint256 until,
        address stakeFor,
        address delegatee,
        bool timeAdjusted,
        bool transferToken
    ) internal {
        require(amount > 0, "amount needs to be bigger than 0"); // S01

        if (!timeAdjusted) {
            until = _timestampToLockDate(until);
        }
        require(
            until > block.timestamp,
            "Staking::_timestampToLockDate: staking period too short"
        ); // S02

        /// @dev Stake for the sender if not specified otherwise.
        if (stakeFor == address(0)) {
            stakeFor = sender;
        }
        // must wait a block before staking again for that same deadline
        _notSameBlockAsStakingCheckpoint(until, stakeFor);

        /// @dev Delegate for stakeFor if not specified otherwise.
        if (delegatee == address(0)) {
            delegatee = stakeFor;
        }

        /// @dev Do not stake longer than the max duration.
        if (!timeAdjusted) {
            uint256 latest = _timestampToLockDate(block.timestamp + MAX_DURATION);
            if (until > latest) until = latest;
        }

        uint96 previousBalance = _currentBalance(stakeFor, until);

        /// @dev Increase stake.
        _increaseStake(sender, amount, stakeFor, until, transferToken);

        // @dev Previous version wasn't working properly for the following case:
        //		delegate checkpoint wasn't updating for the second and next stakes for the same date
        //		if  first stake was withdrawn completely and stake was delegated to the staker
        //		(no delegation to another address).
        address previousDelegatee = delegates[stakeFor][until];

        if (previousDelegatee != delegatee) {
            // @dev only the user that stakes for himself is allowed to delegate VP to another address
            // which works with vesting stakes and prevents vulnerability of delegating VP to an arbitrary address from
            // any address

            if (delegatee != stakeFor) {
                require(
                    stakeFor == sender,
                    "Only stakeFor account is allowed to change delegatee"
                );
            } else if (sender != stakeFor && previousDelegatee != address(0)) {
                require(stakeFor == sender, "Only sender is allowed to change delegatee");
            }

            /// @dev Update delegatee.
            delegates[stakeFor][until] = delegatee;

            /// @dev Decrease stake on previous balance for previous delegatee.
            _decreaseDelegateStake(previousDelegatee, until, previousBalance);

            /// @dev Add previousBalance to amount.
            amount = add96(previousBalance, amount, "add amounts failed");
        }

        /// @dev Increase stake.
        _increaseDelegateStake(delegatee, until, amount);
        emit DelegateChanged(stakeFor, until, previousDelegatee, delegatee);
    }
```
</details>

---    

> ### extendStakingDuration

Extend the staking duration until the specified date.

```solidity
function extendStakingDuration(uint256 previousLock, uint256 until) external nonpayable whenNotPaused whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| previousLock | uint256 | The old unlocking timestamp. | 
| until | uint256 | The new unlocking timestamp in seconds. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function extendStakingDuration(uint256 previousLock, uint256 until)
        external
        whenNotPaused
        whenNotFrozen
    {
        previousLock = _timestampToLockDate(previousLock);
        until = _timestampToLockDate(until);

        _notSameBlockAsStakingCheckpoint(previousLock, msg.sender);

        /// @dev Do not exceed the max duration, no overflow possible.
        uint256 latest = _timestampToLockDate(block.timestamp + MAX_DURATION);
        if (until > latest) until = latest;

        require(previousLock < until, "must increase staking duration"); // S04

        /// @dev Update checkpoints.
        /// @dev TODO James: Can reading stake at block.number -1 cause trouble with multiple tx in a block?
        uint96 amount = _getPriorUserStakeByDate(msg.sender, previousLock, block.number - 1);
        require(amount > 0, "no stakes till the prev lock date"); // S05
        _decreaseUserStake(msg.sender, previousLock, amount);
        _increaseUserStake(msg.sender, until, amount);

        if (_isVestingContract(msg.sender)) {
            _decreaseVestingStake(previousLock, amount);
            _increaseVestingStake(until, amount);
        }

        _decreaseDailyStake(previousLock, amount);
        _increaseDailyStake(until, amount);

        /// @dev Delegate might change: if there is already a delegate set for the until date, it will remain the delegate for this position
        address delegateFrom = delegates[msg.sender][previousLock];
        delegates[msg.sender][previousLock] = address(0); //the previousLock delegates nullifying before reading that form `until` guards in case delegateTo == until
        address delegateTo = delegates[msg.sender][until];
        if (delegateTo == address(0)) {
            delegateTo = delegateFrom;
            delegates[msg.sender][until] = delegateFrom;
        }
        _decreaseDelegateStake(delegateFrom, previousLock, amount);
        _increaseDelegateStake(delegateTo, until, amount);

        emit ExtendedStakingDuration(msg.sender, previousLock, until, amount);
    }
```
</details>

---    

> ### _increaseStake

Send sender's tokens to this contract and update its staked balance.

```solidity
function _increaseStake(address sender, uint96 amount, address stakeFor, uint256 until, bool transferToken) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sender | address | The sender of the tokens. | 
| amount | uint96 | The number of tokens to send. | 
| stakeFor | address | The beneficiary whose stake will be increased. | 
| until | uint256 | The date until which the tokens will be staked. | 
| transferToken | bool | if false - token transfer should be handled separately | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _increaseStake(
        address sender,
        uint96 amount,
        address stakeFor,
        uint256 until,
        bool transferToken
    ) internal {
        /// @dev Retrieve the SOV tokens.
        if (transferToken)
            require(
                SOVToken.transferFrom(sender, address(this), amount),
                "Should transfer tokens successfully"
            ); // IS10

        /// @dev Increase staked balance.
        uint96 balance = _currentBalance(stakeFor, until);
        balance = add96(balance, amount, "increaseStake: overflow"); // IS20

        /// @dev Update checkpoints.
        _increaseDailyStake(until, amount);
        _increaseUserStake(stakeFor, until, amount);

        if (_isVestingContract(stakeFor)) _increaseVestingStake(until, amount);

        emit TokensStaked(stakeFor, amount, until, balance);
    }
```
</details>

---    

> ### stakesBySchedule

DO NOT USE this misspelled function. Use stakeBySchedule function instead.
This function cannot be deprecated while we have non-upgradeable vesting contracts.

```solidity
function stakesBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee) external nonpayable whenNotPaused whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint256 |  | 
| cliff | uint256 |  | 
| duration | uint256 |  | 
| intervalLength | uint256 |  | 
| stakeFor | address |  | 
| delegatee | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function stakesBySchedule(
        uint256 amount,
        uint256 cliff,
        uint256 duration,
        uint256 intervalLength,
        address stakeFor,
        address delegatee
    ) external whenNotPaused whenNotFrozen {
        _stakeBySchedule(amount, cliff, duration, intervalLength, stakeFor, delegatee);
    }
```
</details>

---    

> ### stakeBySchedule

Stake tokens according to the vesting schedule.

```solidity
function stakeBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee) external nonpayable whenNotPaused whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint256 | The amount of tokens to stake. | 
| cliff | uint256 | The time interval to the first withdraw. | 
| duration | uint256 | The staking duration. | 
| intervalLength | uint256 | The length of each staking interval when cliff passed. | 
| stakeFor | address | The address to stake the tokens for or 0x0 if staking for oneself. | 
| delegatee | address | The address of the delegatee or 0x0 if there is none. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function stakeBySchedule(
        uint256 amount,
        uint256 cliff,
        uint256 duration,
        uint256 intervalLength,
        address stakeFor,
        address delegatee
    ) external whenNotPaused whenNotFrozen {
        _stakeBySchedule(amount, cliff, duration, intervalLength, stakeFor, delegatee);
    }
```
</details>

---    

> ### _stakeBySchedule

Stake tokens according to the vesting schedule.

```solidity
function _stakeBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint256 | The amount of tokens to stake. | 
| cliff | uint256 | The time interval to the first withdraw. | 
| duration | uint256 | The staking duration. | 
| intervalLength | uint256 | The length of each staking interval when cliff passed. | 
| stakeFor | address | The address to stake the tokens for or 0x0 if staking for oneself. | 
| delegatee | address | The address of the delegatee or 0x0 if there is none. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _stakeBySchedule(
        uint256 amount,
        uint256 cliff,
        uint256 duration,
        uint256 intervalLength,
        address stakeFor,
        address delegatee
    ) internal {
        require(amount > 0, "Invalid amount");
        require(duration <= MAX_DURATION, "Invalid duration");
        require(intervalLength > 0, "Invalid interval length");
        require(intervalLength % TWO_WEEKS == 0, "Invalid interval length");
        if (delegatee != stakeFor && delegatee != address(0)) {
            require(
                stakeFor == msg.sender,
                "Only stakeFor account is allowed to change delegatee"
            );
        }
        /**
         * @dev Stake them until lock dates according to the vesting schedule.
         * Note: because staking is only possible in periods of 2 weeks,
         * the total duration might end up a bit shorter than specified
         * depending on the date of staking.
         * */
        uint256 start = _timestampToLockDate(block.timestamp + cliff);
        uint256 end = _timestampToLockDate(block.timestamp + duration);
        require(start <= end, "Invalid schedule");
        uint256 numIntervals;
        if (start < end) {
            numIntervals = (end - start) / intervalLength + 1;
        } else {
            numIntervals = 1;
        }
        uint256 stakedPerInterval = amount / numIntervals;

        /// @dev transferring total SOV amount before staking
        require(
            SOVToken.transferFrom(msg.sender, address(this), amount),
            "Should transfer tokens successfully"
        ); // SS10
        /// @dev stakedPerInterval might lose some dust on rounding. Add it to the first staking date.
        if (numIntervals >= 1) {
            _stakeOptionalTokenTransfer(
                msg.sender,
                uint96(amount - stakedPerInterval * (numIntervals - 1)),
                start,
                stakeFor,
                delegatee,
                true,
                false
            );
        }
        /// @dev Stake the rest in 4 week intervals.
        for (uint256 i = start + intervalLength; i <= end; i += intervalLength) {
            /// @dev Stakes for itself, delegates to the owner.
            _notSameBlockAsStakingCheckpoint(i, stakeFor); // must wait a block before staking again for that same deadline
            _stakeOptionalTokenTransfer(
                msg.sender,
                uint96(stakedPerInterval),
                i,
                stakeFor,
                delegatee,
                true,
                false
            );
        }
    }
```
</details>

---    

> ### balanceOf

Get the number of staked tokens held by the user account.

```solidity
function balanceOf(address account) external view
returns(balance uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address of the account to get the balance of. | 

**Returns**

The number of tokens held.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function balanceOf(address account) external view returns (uint96 balance) {
        for (uint256 i = kickoffTS; i <= block.timestamp + MAX_DURATION; i += TWO_WEEKS) {
            balance = add96(balance, _currentBalance(account, i), "Staking::balanceOf: overflow"); // S12
        }
    }
```
</details>

---    

> ### getCurrentStakedUntil

Get the current number of tokens staked for a day.

```solidity
function getCurrentStakedUntil(uint256 lockedTS) external view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockedTS | uint256 | The timestamp to get the staked tokens for. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getCurrentStakedUntil(uint256 lockedTS) external view returns (uint96) {
        uint32 nCheckpoints = numTotalStakingCheckpoints[lockedTS];
        return nCheckpoints > 0 ? totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake : 0;
    }
```
</details>

---    

> ### getStakes

Get list of stakes for a user account.

```solidity
function getStakes(address account) external view
returns(dates uint256[], stakes uint96[])
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The address to get stakes. | 

**Returns**

The arrays of dates and stakes.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getStakes(address account)
        external
        view
        returns (uint256[] memory dates, uint96[] memory stakes)
    {
        uint256 latest = _timestampToLockDate(block.timestamp + MAX_DURATION);

        /// @dev Calculate stakes.
        uint256 count = 0;
        /// @dev We need to iterate from first possible stake date after deployment to the latest from current time.
        for (uint256 i = kickoffTS + TWO_WEEKS; i <= latest; i += TWO_WEEKS) {
            if (_currentBalance(account, i) > 0) {
                count++;
            }
        }
        dates = new uint256[](count);
        stakes = new uint96[](count);

        /// @dev We need to iterate from first possible stake date after deployment to the latest from current time.
        uint256 j = 0;
        for (uint256 i = kickoffTS + TWO_WEEKS; i <= latest; i += TWO_WEEKS) {
            uint96 balance = _currentBalance(account, i);
            if (balance > 0) {
                dates[j] = i;
                stakes[j] = balance;
                j++;
            }
        }
    }
```
</details>

---    

> ### _getToken

undefined

Overrides default ApprovalReceiver._getToken function to
register SOV token on this contract.

```solidity
function _getToken() internal view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getToken() internal view returns (address) {
        return address(SOVToken);
    }
```
</details>

---    

> ### _getSelectors

undefined

Overrides default ApprovalReceiver._getSelectors function to
register stakeWithApproval selector on this contract.

```solidity
function _getSelectors() internal pure
returns(bytes4[])
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getSelectors() internal pure returns (bytes4[] memory) {
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = this.stakeWithApproval.selector;
        return selectors;
    }
```
</details>

---    

> ### timestampToLockDate

Unstaking is possible every 2 weeks only. This means, to
calculate the key value for the staking checkpoints, we need to
map the intended timestamp to the closest available date.

```solidity
function timestampToLockDate(uint256 timestamp) external view
returns(uint256)
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
function timestampToLockDate(uint256 timestamp) external view returns (uint256) {
        return _timestampToLockDate(timestamp);
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
        bytes4[] memory functionsList = new bytes4[](10);
        functionsList[0] = this.stake.selector;
        functionsList[1] = this.stakeWithApproval.selector;
        functionsList[2] = this.extendStakingDuration.selector;
        functionsList[3] = this.stakesBySchedule.selector;
        functionsList[4] = this.stakeBySchedule.selector;
        functionsList[5] = this.balanceOf.selector;
        functionsList[6] = this.getCurrentStakedUntil.selector;
        functionsList[7] = this.getStakes.selector;
        functionsList[8] = this.timestampToLockDate.selector;
        functionsList[9] = this.receiveApproval.selector;
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
