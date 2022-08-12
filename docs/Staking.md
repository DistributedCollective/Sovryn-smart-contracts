# Staking contract. (Staking.sol)

View Source: [contracts/governance/Staking/Staking.sol](../contracts/governance/Staking/Staking.sol)

**↗ Extends: [IStaking](IStaking.md), [WeightedStaking](WeightedStaking.md)**

**Staking**

Pay-in and pay-out function for staking and withdrawing tokens.
Staking is delegated and vested: To gain voting power, SOV holders must
stake their SOV for a given period of time. Aside from Bitocracy
participation, there's a financially-rewarding reason for staking SOV.
Tokenholders who stake their SOV receive staking rewards, a pro-rata share
of the revenue that the platform generates from various transaction fees
plus revenues from stakers who have a portion of their SOV slashed for
early unstaking.

## Contract Members
**Constants & Variables**

```js
uint256 internal constant FOUR_WEEKS;

```

## Functions

- [stake(uint96 amount, uint256 until, address stakeFor, address delegatee)](#stake)
- [_stake(address sender, uint96 amount, uint256 until, address stakeFor, address delegatee, bool timeAdjusted)](#_stake)
- [extendStakingDuration(uint256 previousLock, uint256 until)](#extendstakingduration)
- [_increaseStake(address sender, uint96 amount, address stakeFor, uint256 until)](#_increasestake)
- [stakesBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee)](#stakesbyschedule)
- [withdraw(uint96 amount, uint256 until, address receiver)](#withdraw)
- [governanceWithdraw(uint96 amount, uint256 until, address receiver)](#governancewithdraw)
- [governanceWithdrawVesting(address vesting, address receiver)](#governancewithdrawvesting)
- [_withdraw(uint96 amount, uint256 until, address receiver, bool isGovernance)](#_withdraw)
- [_withdrawNext(uint256 until, address receiver, bool isGovernance)](#_withdrawnext)
- [getWithdrawAmounts(uint96 amount, uint256 until)](#getwithdrawamounts)
- [_getPunishedAmount(uint96 amount, uint256 until)](#_getpunishedamount)
- [_validateWithdrawParams(uint96 amount, uint256 until)](#_validatewithdrawparams)
- [currentBalance(address account, uint256 lockDate)](#currentbalance)
- [balanceOf(address account)](#balanceof)
- [delegate(address delegatee, uint256 lockDate)](#delegate)
- [delegateBySig(address delegatee, uint256 lockDate, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s)](#delegatebysig)
- [getCurrentVotes(address account)](#getcurrentvotes)
- [getCurrentStakedUntil(uint256 lockedTS)](#getcurrentstakeduntil)
- [_delegate(address delegator, address delegatee, uint256 lockedTS)](#_delegate)
- [_delegateNext(address delegator, address delegatee, uint256 lockedTS)](#_delegatenext)
- [_moveDelegates(address srcRep, address dstRep, uint96 amount, uint256 lockedTS)](#_movedelegates)
- [getChainId()](#getchainid)
- [setNewStakingContract(address _newStakingContract)](#setnewstakingcontract)
- [setFeeSharing(address _feeSharing)](#setfeesharing)
- [setWeightScaling(uint96 _weightScaling)](#setweightscaling)
- [migrateToNewStakingContract()](#migratetonewstakingcontract)
- [unlockAllTokens()](#unlockalltokens)
- [getStakes(address account)](#getstakes)
- [_getToken()](#_gettoken)
- [_notSameBlockAsStakingCheckpoint(uint256 lockDate)](#_notsameblockasstakingcheckpoint)

---    

> ### stake

⤾ overrides [IStaking.stake](IStaking.md#stake)

Stake the given amount for the given duration of time.

```solidity
function stake(uint96 amount, uint256 until, address stakeFor, address delegatee) external nonpayable whenNotPaused 
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
    ) external whenNotPaused {
        _notSameBlockAsStakingCheckpoint(until); // must wait a block before staking again for that same deadline
        _stake(msg.sender, amount, until, stakeFor, delegatee, false);
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
        require(amount > 0, "S01"); // amount needs to be bigger than 0

        if (!timeAdjusted) {
            until = timestampToLockDate(until);
        }
        require(until > block.timestamp, "S02"); // Staking::timestampToLockDate: staking period too short

        /// @dev Stake for the sender if not specified otherwise.
        if (stakeFor == address(0)) {
            stakeFor = sender;
        }

        /// @dev Delegate for stakeFor if not specified otherwise.
        if (delegatee == address(0)) {
            delegatee = stakeFor;
        }

        /// @dev Do not stake longer than the max duration.
        if (!timeAdjusted) {
            uint256 latest = timestampToLockDate(block.timestamp + MAX_DURATION);
            if (until > latest) until = latest;
        }

        uint96 previousBalance = currentBalance(stakeFor, until);

        /// @dev Increase stake.
        _increaseStake(sender, amount, stakeFor, until);

        // @dev Previous version wasn't working properly for the following case:
        //		delegate checkpoint wasn't updating for the second and next stakes for the same date
        //		if  first stake was withdrawn completely and stake was delegated to the staker
        //		(no delegation to another address).
        address previousDelegatee = delegates[stakeFor][until];
        if (previousDelegatee != delegatee) {
            /// @dev Update delegatee.
            delegates[stakeFor][until] = delegatee;

            /// @dev Decrease stake on previous balance for previous delegatee.
            _decreaseDelegateStake(previousDelegatee, until, previousBalance);

            /// @dev Add previousBalance to amount.
            amount = add96(previousBalance, amount, "S03");
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
function extendStakingDuration(uint256 previousLock, uint256 until) public nonpayable whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| previousLock | uint256 | The old unlocking timestamp. | 
| until | uint256 | The new unlocking timestamp in seconds. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function extendStakingDuration(uint256 previousLock, uint256 until) public whenNotPaused {
        until = timestampToLockDate(until);
        require(previousLock < until, "S04"); // must increase staking duration

        _notSameBlockAsStakingCheckpoint(previousLock);

        /// @dev Do not exceed the max duration, no overflow possible.
        uint256 latest = timestampToLockDate(block.timestamp + MAX_DURATION);
        if (until > latest) until = latest;

        /// @dev Update checkpoints.
        /// @dev TODO James: Can reading stake at block.number -1 cause trouble with multiple tx in a block?
        uint96 amount = _getPriorUserStakeByDate(msg.sender, previousLock, block.number - 1);
        require(amount > 0, "S05"); // no stakes till the prev lock date
        _decreaseUserStake(msg.sender, previousLock, amount);
        _increaseUserStake(msg.sender, until, amount);

        if (isVestingContract(msg.sender)) {
            _decreaseVestingStake(previousLock, amount);
            _increaseVestingStake(until, amount);
        }

        _decreaseDailyStake(previousLock, amount);
        _increaseDailyStake(until, amount);

        /// @dev Delegate might change: if there is already a delegate set for the until date, it will remain the delegate for this position
        address delegateFrom = delegates[msg.sender][previousLock];
        address delegateTo = delegates[msg.sender][until];
        if (delegateTo == address(0)) {
            delegateTo = delegateFrom;
            delegates[msg.sender][until] = delegateFrom;
        }
        delegates[msg.sender][previousLock] = address(0);
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
function _increaseStake(address sender, uint96 amount, address stakeFor, uint256 until) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| sender | address | The sender of the tokens. | 
| amount | uint96 | The number of tokens to send. | 
| stakeFor | address | The beneficiary whose stake will be increased. | 
| until | uint256 | The date until which the tokens will be staked. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _increaseStake(
        address sender,
        uint96 amount,
        address stakeFor,
        uint256 until
    ) internal {
        /// @dev Retrieve the SOV tokens.
        bool success = SOVToken.transferFrom(sender, address(this), amount);
        require(success);

        /// @dev Increase staked balance.
        uint96 balance = currentBalance(stakeFor, until);
        balance = add96(balance, amount, "S06"); // increaseStake: overflow

        /// @dev Update checkpoints.
        _increaseDailyStake(until, amount);
        _increaseUserStake(stakeFor, until, amount);

        if (isVestingContract(stakeFor)) _increaseVestingStake(until, amount);

        emit TokensStaked(stakeFor, amount, until, balance);
    }
```
</details>

---    

> ### stakesBySchedule

⤾ overrides [IStaking.stakesBySchedule](IStaking.md#stakesbyschedule)

Stake tokens according to the vesting schedule.

```solidity
function stakesBySchedule(uint256 amount, uint256 cliff, uint256 duration, uint256 intervalLength, address stakeFor, address delegatee) public nonpayable whenNotPaused 
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
function stakesBySchedule(
        uint256 amount,
        uint256 cliff,
        uint256 duration,
        uint256 intervalLength,
        address stakeFor,
        address delegatee
    ) public whenNotPaused {
        /**
         * @dev Stake them until lock dates according to the vesting schedule.
         * Note: because staking is only possible in periods of 2 weeks,
         * the total duration might end up a bit shorter than specified
         * depending on the date of staking.
         * */
        uint256 start = timestampToLockDate(block.timestamp + cliff);
        if (duration > MAX_DURATION) {
            duration = MAX_DURATION;
        }
        uint256 end = timestampToLockDate(block.timestamp + duration);
        uint256 numIntervals = (end - start) / intervalLength + 1;
        uint256 stakedPerInterval = amount / numIntervals;
        /// @dev stakedPerInterval might lose some dust on rounding. Add it to the first staking date.
        if (numIntervals >= 1) {
            _stake(
                msg.sender,
                uint96(amount - stakedPerInterval * (numIntervals - 1)),
                start,
                stakeFor,
                delegatee,
                true
            );
        }
        /// @dev Stake the rest in 4 week intervals.
        for (uint256 i = start + intervalLength; i <= end; i += intervalLength) {
            /// @dev Stakes for itself, delegates to the owner.
            _notSameBlockAsStakingCheckpoint(i); // must wait a block before staking again for that same deadline
            _stake(msg.sender, uint96(stakedPerInterval), i, stakeFor, delegatee, true);
        }
    }
```
</details>

---    

> ### withdraw

Withdraw the given amount of tokens if they are unlocked.

```solidity
function withdraw(uint96 amount, uint256 until, address receiver) public nonpayable whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. | 
| receiver | address | The receiver of the tokens. If not specified, send to the msg.sender | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function withdraw(
        uint96 amount,
        uint256 until,
        address receiver
    ) public whenNotFrozen {
        _notSameBlockAsStakingCheckpoint(until);

        _withdraw(amount, until, receiver, false);
        // @dev withdraws tokens for lock date 2 weeks later than given lock date if sender is a contract
        //		we need to check block.timestamp here
        _withdrawNext(until, receiver, false);
    }
```
</details>

---    

> ### governanceWithdraw

Withdraw the given amount of tokens.

```solidity
function governanceWithdraw(uint96 amount, uint256 until, address receiver) public nonpayable whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. | 
| receiver | address | The receiver of the tokens. If not specified, send to the msg.sender | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function governanceWithdraw(
        uint96 amount,
        uint256 until,
        address receiver
    ) public whenNotFrozen {
        require(vestingWhitelist[msg.sender], "S07"); // unauthorized

        _notSameBlockAsStakingCheckpoint(until);

        _withdraw(amount, until, receiver, true);
        // @dev withdraws tokens for lock date 2 weeks later than given lock date if sender is a contract
        //		we don't need to check block.timestamp here
        _withdrawNext(until, receiver, true);
    }
```
</details>

---    

> ### governanceWithdrawVesting

Withdraw tokens for vesting contract.

```solidity
function governanceWithdrawVesting(address vesting, address receiver) public nonpayable onlyAuthorized whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| vesting | address | The address of Vesting contract. | 
| receiver | address | The receiver of the tokens. If not specified, send to the msg.sender | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function governanceWithdrawVesting(address vesting, address receiver)
        public
        onlyAuthorized
        whenNotFrozen
    {
        vestingWhitelist[vesting] = true;
        ITeamVesting(vesting).governanceWithdrawTokens(receiver);
        vestingWhitelist[vesting] = false;

        emit VestingTokensWithdrawn(vesting, receiver);
    }
```
</details>

---    

> ### _withdraw

Send user' staked tokens to a receiver taking into account punishments.
Sovryn encourages long-term commitment and thinking. When/if you unstake before
the end of the staking period, a percentage of the original staking amount will
be slashed. This amount is also added to the reward pool and is distributed
between all other stakers.
     *

```solidity
function _withdraw(uint96 amount, uint256 until, address receiver, bool isGovernance) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. | 
| receiver | address | The receiver of the tokens. If not specified, send to the msg.sender | 
| isGovernance | bool | Whether all tokens (true) or just unlocked tokens (false). | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _withdraw(
        uint96 amount,
        uint256 until,
        address receiver,
        bool isGovernance
    ) internal {
        // @dev it's very unlikely some one will have 1/10**18 SOV staked in Vesting contract
        //		this check is a part of workaround for Vesting.withdrawTokens issue
        if (amount == 1 && isVestingContract(msg.sender)) {
            return;
        }
        until = _adjustDateForOrigin(until);
        _validateWithdrawParams(amount, until);

        /// @dev Determine the receiver.
        if (receiver == address(0)) receiver = msg.sender;

        /// @dev Update the checkpoints.
        _decreaseDailyStake(until, amount);
        _decreaseUserStake(msg.sender, until, amount);
        if (isVestingContract(msg.sender)) _decreaseVestingStake(until, amount);
        _decreaseDelegateStake(delegates[msg.sender][until], until, amount);

        /// @dev Early unstaking should be punished.
        if (block.timestamp < until && !allUnlocked && !isGovernance) {
            uint96 punishedAmount = _getPunishedAmount(amount, until);
            amount -= punishedAmount;

            /// @dev punishedAmount can be 0 if block.timestamp are very close to 'until'
            if (punishedAmount > 0) {
                require(address(feeSharing) != address(0), "S08"); // FeeSharing address wasn't set
                /// @dev Move punished amount to fee sharing.
                /// @dev Approve transfer here and let feeSharing do transfer and write checkpoint.
                SOVToken.approve(address(feeSharing), punishedAmount);
                feeSharing.transferTokens(address(SOVToken), punishedAmount);
            }
        }

        /// @dev transferFrom
        bool success = SOVToken.transfer(receiver, amount);
        require(success, "S09"); // Token transfer failed

        emit StakingWithdrawn(msg.sender, amount, until, receiver, isGovernance);
    }
```
</details>

---    

> ### _withdrawNext

```solidity
function _withdrawNext(uint256 until, address receiver, bool isGovernance) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| until | uint256 |  | 
| receiver | address |  | 
| isGovernance | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _withdrawNext(
        uint256 until,
        address receiver,
        bool isGovernance
    ) internal {
        if (isVestingContract(msg.sender)) {
            uint256 nextLock = until.add(TWO_WEEKS);
            if (isGovernance || block.timestamp >= nextLock) {
                uint96 stakes = _getPriorUserStakeByDate(msg.sender, nextLock, block.number - 1);
                if (stakes > 0) {
                    _withdraw(stakes, nextLock, receiver, isGovernance);
                }
            }
        }
    }
```
</details>

---    

> ### getWithdrawAmounts

Get available and punished amount for withdrawing.

```solidity
function getWithdrawAmounts(uint96 amount, uint256 until) public view
returns(uint96, uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function getWithdrawAmounts(uint96 amount, uint256 until)
        public
        view
        returns (uint96, uint96)
    {
        _validateWithdrawParams(amount, until);
        uint96 punishedAmount = _getPunishedAmount(amount, until);
        return (amount - punishedAmount, punishedAmount);
    }
```
</details>

---    

> ### _getPunishedAmount

Get punished amount for withdrawing.

```solidity
function _getPunishedAmount(uint96 amount, uint256 until) internal view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _getPunishedAmount(uint96 amount, uint256 until) internal view returns (uint96) {
        uint256 date = timestampToLockDate(block.timestamp);
        uint96 weight = computeWeightByDate(until, date); /// @dev (10 - 1) * WEIGHT_FACTOR
        weight = weight * weightScaling;
        return (amount * weight) / WEIGHT_FACTOR / 100;
    }
```
</details>

---    

> ### _validateWithdrawParams

Validate withdraw parameters.

```solidity
function _validateWithdrawParams(uint96 amount, uint256 until) internal view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| amount | uint96 | The number of tokens to withdraw. | 
| until | uint256 | The date until which the tokens were staked. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function _validateWithdrawParams(uint96 amount, uint256 until) internal view {
        require(amount > 0, "S10"); // Amount of tokens to withdraw must be > 0
        uint96 balance = _getPriorUserStakeByDate(msg.sender, until, block.number - 1);
        require(amount <= balance, "S11"); // Staking::withdraw: not enough balance
    }
```
</details>

---    

> ### currentBalance

Get the current balance of an account locked until a certain date.

```solidity
function currentBalance(address account, uint256 lockDate) internal view
returns(uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| account | address | The user address. | 
| lockDate | uint256 | The lock date. | 

**Returns**

The stake amount.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function currentBalance(address account, uint256 lockDate) internal view returns (uint96) {
        return
            userStakingCheckpoints[account][lockDate][
                numUserStakingCheckpoints[account][lockDate] - 1
            ]
                .stake;
    }
```
</details>

---    

> ### balanceOf

Get the number of staked tokens held by the user account.

```solidity
function balanceOf(address account) public view
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
function balanceOf(address account) public view returns (uint96 balance) {
        for (uint256 i = kickoffTS; i <= block.timestamp + MAX_DURATION; i += TWO_WEEKS) {
            balance = add96(balance, currentBalance(account, i), "S12"); // Staking::balanceOf: overflow
        }
    }
```
</details>

---    

> ### delegate

Delegate votes from `msg.sender` which are locked until lockDate to `delegatee`.

```solidity
function delegate(address delegatee, uint256 lockDate) public nonpayable whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delegatee | address | The address to delegate votes to. | 
| lockDate | uint256 | the date if the position to delegate. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
function delegate(address delegatee, uint256 lockDate) public whenNotPaused {
        _notSameBlockAsStakingCheckpoint(lockDate);

        _delegate(msg.sender, delegatee, lockDate);
        // @dev delegates tokens for lock date 2 weeks later than given lock date
        //		if message sender is a contract
        _delegateNext(msg.sender, delegatee, lockDate);
    }
```
</details>

---    

> ### delegateBySig

Delegates votes from signatory to a delegatee account.
Voting with EIP-712 Signatures.
     * Voting power can be delegated to any address, and then can be used to
vote on proposals. A key benefit to users of by-signature functionality
is that they can create a signed vote transaction for free, and have a
trusted third-party spend rBTC(or ETH) on gas fees and write it to the
blockchain for them.
     * The third party in this scenario, submitting the SOV-holder’s signed
transaction holds a voting power that is for only a single proposal.
The signatory still holds the power to vote on their own behalf in
the proposal if the third party has not yet published the signed
transaction that was given to them.
     *

```solidity
function delegateBySig(address delegatee, uint256 lockDate, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s) public nonpayable whenNotPaused 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| delegatee | address | The address to delegate votes to. | 
| lockDate | uint256 | The date until which the position is locked. | 
| nonce | uint256 | The contract state required to match the signature. | 
| expiry | uint256 | The time at which to expire the signature. | 
| v | uint8 | The recovery byte of the signature. | 
| r | bytes32 | Half of the ECDSA signature pair. | 
| s | bytes32 | Half of the ECDSA signature pair. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction delegateBySig(
        address delegatee,
        uint256 lockDate,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public whenNotPaused {
        _notSameBlockAsStakingCheckpoint(lockDate);

        /**
         * @dev The DOMAIN_SEPARATOR is a hash that uniquely identifies a
         * smart contract. It is built from a string denoting it as an
         * EIP712 Domain, the name of the token contract, the version,
         * the chainId in case it changes, and the address that the
         * contract is deployed at.
         * */
        bytes32 domainSeparator =
            keccak256(
                abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), getChainId(), address(this))
            );

        /// @dev GovernorAlpha uses BALLOT_TYPEHASH, while Staking uses DELEGATION_TYPEHASH
        bytes32 structHash =
            keccak256(abi.encode(DELEGATION_TYPEHASH, delegatee, lockDate, nonce, expiry));

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signatory = ecrecover(digest, v, r, s);

        /// @dev Verify address is not null and PK is not null either.
        require(RSKAddrValidator.checkPKNotZero(signatory), "S13"); // Staking::delegateBySig: invalid signature
        require(nonce == nonces[signatory]++, "S14"); // Staking::delegateBySig: invalid nonce
        require(now <= expiry, "S15"); // Staking::delegateBySig: signature expired
        _delegate(signatory, delegatee, lockDate);
        // @dev delegates tokens for lock date 2 weeks later than given lock date
        //		if message sender is a contract
        _delegateNext(signatory, delegatee, lockDate);
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
nction getCurrentVotes(address account) external view returns (uint96) {
        return getPriorVotes(account, block.number - 1, block.timestamp);
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
nction getCurrentStakedUntil(uint256 lockedTS) external view returns (uint96) {
        uint32 nCheckpoints = numTotalStakingCheckpoints[lockedTS];
        return nCheckpoints > 0 ? totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake : 0;
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
nction _delegate(
        address delegator,
        address delegatee,
        uint256 lockedTS
    ) internal {
        address currentDelegate = delegates[delegator][lockedTS];
        uint96 delegatorBalance = currentBalance(delegator, lockedTS);
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
nction _delegateNext(
        address delegator,
        address delegatee,
        uint256 lockedTS
    ) internal {
        if (isVestingContract(msg.sender)) {
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
nction _moveDelegates(
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

> ### getChainId

Retrieve CHAIN_ID of the executing chain.
     * Chain identifier (chainID) introduced in EIP-155 protects transaction
included into one chain from being included into another chain.
Basically, chain identifier is an integer number being used in the
processes of signing transactions and verifying transaction signatures.
     *

```solidity
function getChainId() internal pure
returns(uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction getChainId() internal pure returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }

```
</details>

---    

> ### setNewStakingContract

Allow the owner to set a new staking contract.
As a consequence it allows the stakers to migrate their positions
to the new contract.

```solidity
function setNewStakingContract(address _newStakingContract) public nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _newStakingContract | address | The address of the new staking contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction setNewStakingContract(address _newStakingContract) public onlyOwner whenNotFrozen {
        require(_newStakingContract != address(0), "S16"); // can't reset the new staking contract to 0
        newStakingContract = _newStakingContract;
    }

```
</details>

---    

> ### setFeeSharing

Allow the owner to set a fee sharing proxy contract.
We need it for unstaking with slashing.

```solidity
function setFeeSharing(address _feeSharing) public nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _feeSharing | address | The address of FeeSharingProxy contract. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction setFeeSharing(address _feeSharing) public onlyOwner whenNotFrozen {
        require(_feeSharing != address(0), "S17"); // FeeSharing address shouldn't be 0
        feeSharing = IFeeSharingProxy(_feeSharing);
    }

```
</details>

---    

> ### setWeightScaling

Allow the owner to set weight scaling.
We need it for unstaking with slashing.

```solidity
function setWeightScaling(uint96 _weightScaling) public nonpayable onlyOwner whenNotFrozen 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _weightScaling | uint96 | The weight scaling. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction setWeightScaling(uint96 _weightScaling) public onlyOwner whenNotFrozen {
        require(
            MIN_WEIGHT_SCALING <= _weightScaling && _weightScaling <= MAX_WEIGHT_SCALING,
            "S18" /* scaling doesn't belong to range [1, 9] */
        );
        weightScaling = _weightScaling;
    }

```
</details>

---    

> ### migrateToNewStakingContract

Allow a staker to migrate his positions to the new staking contract.

```solidity
function migrateToNewStakingContract() public nonpayable whenNotFrozen 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction migrateToNewStakingContract() public whenNotFrozen {
        require(newStakingContract != address(0), "S19"); // there is no new staking contract set
        /// @dev implementation:
        /// @dev Iterate over all possible lock dates from now until now + MAX_DURATION.
        /// @dev Read the stake & delegate of the msg.sender
        /// @dev If stake > 0, stake it at the new contract until the lock date with the current delegate.
    }

```
</details>

---    

> ### unlockAllTokens

Allow the owner to unlock all tokens in case the staking contract
is going to be replaced
Note: Not reversible on purpose. once unlocked, everything is unlocked.
The owner should not be able to just quickly unlock to withdraw his own
tokens and lock again.

```solidity
function unlockAllTokens() public nonpayable onlyOwner whenNotFrozen 
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction unlockAllTokens() public onlyOwner whenNotFrozen {
        allUnlocked = true;
        emit TokensUnlocked(SOVToken.balanceOf(address(this)));
    }

```
</details>

---    

> ### getStakes

Get list of stakes for a user account.

```solidity
function getStakes(address account) public view
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
nction getStakes(address account)
        public
        view
        returns (uint256[] memory dates, uint96[] memory stakes)
    {
        uint256 latest = timestampToLockDate(block.timestamp + MAX_DURATION);

        /// @dev Calculate stakes.
        uint256 count = 0;
        /// @dev We need to iterate from first possible stake date after deployment to the latest from current time.
        for (uint256 i = kickoffTS + TWO_WEEKS; i <= latest; i += TWO_WEEKS) {
            if (currentBalance(account, i) > 0) {
                count++;
            }
        }
        dates = new uint256[](count);
        stakes = new uint96[](count);

        /// @dev We need to iterate from first possible stake date after deployment to the latest from current time.
        uint256 j = 0;
        for (uint256 i = kickoffTS + TWO_WEEKS; i <= latest; i += TWO_WEEKS) {
            uint96 balance = currentBalance(account, i);
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

Overrides default ApprovalReceiver._getToken function to
register SOV token on this contract.

```solidity
function _getToken() internal view
returns(address)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction _getToken() internal view returns (address) {
        return address(SOVToken);
    }

```
</details>

---    

> ### _notSameBlockAsStakingCheckpoint

Overrides default ApprovalReceiver._getSelectors function to
register stakeWithApproval selector on this contract.

```solidity
function _notSameBlockAsStakingCheckpoint(uint256 lockDate) internal view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| lockDate | uint256 |  | 

**Returns**

The array of registered selectors on this contract.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
nction _notSameBlockAsStakingCheckpoint(uint256 lockDate) internal view {
        uint32 nCheckpoints = numUserStakingCheckpoints[msg.sender][lockDate];
        bool notSameBlock =
            userStakingCheckpoints[msg.sender][lockDate][nCheckpoints - 1].fromBlock !=
                block.number;
        require(notSameBlock, "S20"); //S20 : "cannot be mined in the same block as last stake"
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
