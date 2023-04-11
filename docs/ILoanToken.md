# The FeeSharingCollector contract. (ILoanToken.sol)

View Source: [contracts/governance/FeeSharingCollector/FeeSharingCollector.sol](../contracts/governance/FeeSharingCollector/FeeSharingCollector.sol)

**↗ Extends: [SafeMath96](SafeMath96.md), [IFeeSharingCollector](IFeeSharingCollector.md), [Ownable](Ownable.md), [FeeSharingCollectorStorage](FeeSharingCollectorStorage.md)**

**ILoanToken**

This contract withdraws fees to be paid to SOV Stakers from the protocol.
Stakers call withdraw() to get their share of the fees.
 *

## Contract Members
**Constants & Variables**

```js
//internal members
address internal constant ZERO_ADDRESS;

//public members
address public constant RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT;

```

**Events**

```js
event FeeWithdrawnInRBTC(address indexed sender, uint256  amount);
event TokensTransferred(address indexed sender, address indexed token, uint256  amount);
event CheckpointAdded(address indexed sender, address indexed token, uint256  amount);
event UserFeeWithdrawn(address indexed sender, address indexed receiver, address indexed token, uint256  amount);
event FeeAMMWithdrawn(address indexed sender, address indexed converter, uint256  amount);
event WhitelistedConverter(address indexed sender, address  converter);
event UnwhitelistedConverter(address indexed sender, address  converter);
event RBTCWithdrawn(address indexed sender, address indexed receiver, uint256  amount);
```

## Functions

- [constructor()](#constructor)
- [withdrawFees(address[] _tokens)](#withdrawfees)
- [withdrawFeesAMM(address[] _converters)](#withdrawfeesamm)
- [transferTokens(address _token, uint96 _amount)](#transfertokens)
- [transferRBTC()](#transferrbtc)
- [_addCheckpoint(address _token, uint96 _amount)](#_addcheckpoint)
- [withdraw(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver)](#withdraw)
- [withdrawRBTC(uint32 _maxCheckpoints, address _receiver)](#withdrawrbtc)
- [getAccumulatedFees(address _user, address _loanPoolToken)](#getaccumulatedfees)
- [_getAccumulatedFees(address _user, address _loanPoolToken, uint32 _maxCheckpoints)](#_getaccumulatedfees)
- [_getEndOfRange(uint256 start, address _loanPoolToken, uint32 _maxCheckpoints)](#_getendofrange)
- [_writeTokenCheckpoint(address _token, uint96 _numTokens)](#_writetokencheckpoint)
- [_getVoluntaryWeightedStake(uint32 blockNumber, uint256 timestamp)](#_getvoluntaryweightedstake)
- [addWhitelistedConverterAddress(address converterAddress)](#addwhitelistedconverteraddress)
- [removeWhitelistedConverterAddress(address converterAddress)](#removewhitelistedconverteraddress)
- [getWhitelistedConverterList()](#getwhitelistedconverterlist)
- [_validateWhitelistedConverter(address[] converterAddresses)](#_validatewhitelistedconverter)
- [withdrawWRBTC(address receiver, uint256 wrbtcAmount)](#withdrawwrbtc)
- [getAccumulatedRBTCFeeBalances(address _user)](#getaccumulatedrbtcfeebalances)
- [_getRBTCBalances(address _user, uint32 _maxCheckpoints)](#_getrbtcbalances)
- [_getAndValidateLoanPoolWRBTC(address _wRBTCAddress)](#_getandvalidateloanpoolwrbtc)
- [mint(address receiver, uint256 depositAmount)](#mint)
- [burnToBTC(address receiver, uint256 burnAmount, bool useLM)](#burntobtc)
- [tokenPrice()](#tokenprice)

---    

> ### constructor

fallback function to support rbtc transfer when unwrap the wrbtc.

```solidity
function () external payable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on() external payable {}

```
</details>

---    

> ### withdrawFees

⤾ overrides [IFeeSharingCollector.withdrawFees](IFeeSharingCollector.md#withdrawfees)

Withdraw fees for the given token:
lendingFee + tradingFee + borrowingFee
the fees (except SOV) will be converted in wRBTC form, and then will be transferred to wRBTC loan pool.
For SOV, it will be directly deposited into the feeSharingCollector from the protocol.
     *

```solidity
function withdrawFees(address[] _tokens) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokens | address[] | array address of the token | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on withdrawFees(address[] memory _tokens) public {
        for (uint256 i = 0; i < _tokens.length; i++) {
            require(
                Address.isContract(_tokens[i]),
                "FeeSharingCollector::withdrawFees: token is not a contract"
            );
        }

        uint256 wrbtcAmountWithdrawn = protocol.withdrawFees(_tokens, address(this));

        IWrbtcERC20 wRBTCToken = protocol.wrbtcToken();

        if (wrbtcAmountWithdrawn > 0) {
            // unwrap the wrbtc to rbtc, and hold the rbtc.
            wRBTCToken.withdraw(wrbtcAmountWithdrawn);

            /// @notice Update unprocessed amount of tokens
            uint96 amount96 =
                safe96(
                    wrbtcAmountWithdrawn,
                    "FeeSharingCollector::withdrawFees: wrbtc token amount exceeds 96 bits"
                );

            _addCheckpoint(RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, amount96);
        }

        // note deprecated event since we unify the wrbtc & rbtc
        // emit FeeWithdrawn(msg.sender, RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, poolTokenAmount);

        // note new emitted event
        emit FeeWithdrawnInRBTC(msg.sender, wrbtcAmountWithdrawn);
    }

```
</details>

---    

> ### withdrawFeesAMM

Withdraw amm fees for the given converter addresses:
protocolFee from the conversion
the fees will be converted in wRBTC form, and then will be transferred to wRBTC loan pool
     *

```solidity
function withdrawFeesAMM(address[] _converters) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _converters | address[] | array addresses of the converters | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on withdrawFeesAMM(address[] memory _converters) public {
        IWrbtcERC20 wRBTCToken = protocol.wrbtcToken();

        // Validate
        _validateWhitelistedConverter(_converters);

        uint96 totalPoolTokenAmount;
        for (uint256 i = 0; i < _converters.length; i++) {
            uint256 wrbtcAmountWithdrawn =
                IConverterAMM(_converters[i]).withdrawFees(address(this));

            if (wrbtcAmountWithdrawn > 0) {
                // unwrap wrbtc to rbtc, and hold the rbtc
                wRBTCToken.withdraw(wrbtcAmountWithdrawn);

                /// @notice Update unprocessed amount of tokens
                uint96 amount96 =
                    safe96(
                        wrbtcAmountWithdrawn,
                        "FeeSharingCollector::withdrawFeesAMM: wrbtc token amount exceeds 96 bits"
                    );

                totalPoolTokenAmount = add96(
                    totalPoolTokenAmount,
                    amount96,
                    "FeeSharingCollector::withdrawFeesAMM: total wrbtc token amount exceeds 96 bits"
                );

                emit FeeAMMWithdrawn(msg.sender, _converters[i], wrbtcAmountWithdrawn);
            }
        }

        if (totalPoolTokenAmount > 0) {
            _addCheckpoint(RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, totalPoolTokenAmount);
        }
    }

```
</details>

---    

> ### transferTokens

⤾ overrides [IFeeSharingCollector.transferTokens](IFeeSharingCollector.md#transfertokens)

Transfer tokens to this contract.

```solidity
function transferTokens(address _token, uint96 _amount) public nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _token | address | Address of the token. | 
| _amount | uint96 | Amount to be transferred. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on transferTokens(address _token, uint96 _amount) public {
        require(_token != ZERO_ADDRESS, "FeeSharingCollector::transferTokens: invalid address");
        require(_amount > 0, "FeeSharingCollector::transferTokens: invalid amount");

        /// @notice Transfer tokens from msg.sender
        bool success = IERC20(_token).transferFrom(address(msg.sender), address(this), _amount);
        require(success, "Staking::transferTokens: token transfer failed");

        // if _token is wrbtc, need to unwrap it to rbtc
        IWrbtcERC20 wrbtcToken = protocol.wrbtcToken();
        if (_token == address(wrbtcToken)) {
            wrbtcToken.withdraw(_amount);
            _token = RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT;
        }

        _addCheckpoint(_token, _amount);

        emit TokensTransferred(msg.sender, _token, _amount);
    }

```
</details>

---    

> ### transferRBTC

Transfer RBTC / native tokens to this contract.

```solidity
function transferRBTC() external payable
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on transferRBTC() external payable {
        uint96 _amount = uint96(msg.value);
        require(_amount > 0, "FeeSharingCollector::transferRBTC: invalid value");

        _addCheckpoint(RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, _amount);

        emit TokensTransferred(msg.sender, ZERO_ADDRESS, _amount);
    }

```
</details>

---    

> ### _addCheckpoint

Add checkpoint with accumulated amount by function invocation.

```solidity
function _addCheckpoint(address _token, uint96 _amount) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _token | address | Address of the token. | 
| _amount | uint96 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on _addCheckpoint(address _token, uint96 _amount) internal {
        if (block.timestamp - lastFeeWithdrawalTime[_token] >= FEE_WITHDRAWAL_INTERVAL) {
            lastFeeWithdrawalTime[_token] = block.timestamp;
            uint96 amount =
                add96(
                    unprocessedAmount[_token],
                    _amount,
                    "FeeSharingCollector::_addCheckpoint: amount exceeds 96 bits"
                );

            /// @notice Reset unprocessed amount of tokens to zero.
            unprocessedAmount[_token] = 0;

            /// @notice Write a regular checkpoint.
            _writeTokenCheckpoint(_token, amount);
        } else {
            unprocessedAmount[_token] = add96(
                unprocessedAmount[_token],
                _amount,
                "FeeSharingCollector::_addCheckpoint: unprocessedAmount exceeds 96 bits"
            );
        }
    }

```
</details>

---    

> ### withdraw

⤾ overrides [IFeeSharingCollector.withdraw](IFeeSharingCollector.md#withdraw)

Withdraw accumulated fee to the message sender.
     * The Sovryn protocol collects fees on every trade/swap and loan.
These fees will be distributed to SOV stakers based on their voting
power as a percentage of total voting power. Therefore, staking more
SOV and/or staking for longer will increase your share of the fees
generated, meaning you will earn more from staking.
     * This function will directly burnToBTC and use the msg.sender (user) as the receiver
     *

```solidity
function withdraw(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver) public nonpayable nonReentrant 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _loanPoolToken | address | Address of the pool token. | 
| _maxCheckpoints | uint32 | Maximum number of checkpoints to be processed. | 
| _receiver | address | The receiver of tokens or msg.sender | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on withdraw(
        address _loanPoolToken,
        uint32 _maxCheckpoints,
        address _receiver
    ) public nonReentrant {
        /// @dev Prevents checkpoints processing block gas limit
        require(
            _maxCheckpoints > 0,
            "FeeSharingCollector::withdraw: _maxCheckpoints should be positive"
        );

        address wRBTCAddress = address(protocol.wrbtcToken());
        address loanPoolTokenWRBTC = _getAndValidateLoanPoolWRBTC(wRBTCAddress);

        address user = msg.sender;
        if (_receiver == ZERO_ADDRESS) {
            _receiver = msg.sender;
        }

        (uint256 amount, uint256 end) = _getAccumulatedFees(user, _loanPoolToken, _maxCheckpoints);
        require(amount > 0, "FeeSharingCollector::withdrawFees: no tokens for a withdrawal");

        processedCheckpoints[user][_loanPoolToken] = end;

        if (loanPoolTokenWRBTC == _loanPoolToken) {
            // We will change, so that feeSharingCollector will directly burn then loanToken (IWRBTC) to rbtc and send to the user --- by call burnToBTC function
            uint256 loanAmountPaid =
                ILoanTokenWRBTC(_loanPoolToken).burnToBTC(_receiver, amount, false);
        } else {
            // Previously it directly send the loanToken to the user
            require(
                IERC20(_loanPoolToken).transfer(_receiver, amount),
                "FeeSharingCollector::withdraw: withdrawal failed"
            );
        }

        emit UserFeeWithdrawn(msg.sender, _receiver, _loanPoolToken, amount);
    }

```
</details>

---    

> ### withdrawRBTC

withdraw all of the RBTC balance based on particular checkpoints
     * RBTC balance consists of:
- rbtc balance
- wrbtc balance which will be unwrapped to rbtc
- iwrbtc balance which will be unwrapped to rbtc

```solidity
function withdrawRBTC(uint32 _maxCheckpoints, address _receiver) external nonpayable nonReentrant 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _maxCheckpoints | uint32 |  | 
| _receiver | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on withdrawRBTC(uint32 _maxCheckpoints, address _receiver) external nonReentrant {
        uint256 wrbtcAmount;
        uint256 rbtcAmount;
        uint256 iWrbtcAmount;
        uint256 endRBTC;
        uint256 endWRBTC;
        uint256 endIWRBTC;
        uint256 iWRBTCloanAmountPaid;
        address user = msg.sender;

        IWrbtcERC20 wrbtcToken = protocol.wrbtcToken();

        address loanPoolTokenWRBTC = _getAndValidateLoanPoolWRBTC(address(wrbtcToken));

        if (_receiver == ZERO_ADDRESS) {
            _receiver = msg.sender;
        }

        (rbtcAmount, wrbtcAmount, iWrbtcAmount, endRBTC, endWRBTC, endIWRBTC) = _getRBTCBalances(
            user,
            _maxCheckpoints
        );

        if (rbtcAmount > 0) {
            processedCheckpoints[user][RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT] = endRBTC;
        }

        // unwrap the wrbtc
        if (wrbtcAmount > 0) {
            processedCheckpoints[user][address(wrbtcToken)] = endWRBTC;
            wrbtcToken.withdraw(wrbtcAmount);
        }

        // pull out the iWRBTC to rbtc to this feeSharingCollector contract
        if (iWrbtcAmount > 0) {
            processedCheckpoints[user][loanPoolTokenWRBTC] = endIWRBTC;
            iWRBTCloanAmountPaid = ILoanTokenWRBTC(loanPoolTokenWRBTC).burnToBTC(
                address(this),
                iWrbtcAmount,
                false
            );
        }

        uint256 totalAmount = rbtcAmount.add(wrbtcAmount).add(iWRBTCloanAmountPaid);
        require(totalAmount > 0, "FeeSharingCollector::withdrawFees: no rbtc for a withdrawal");

        // withdraw everything
        (bool success, ) = _receiver.call.value(totalAmount)("");
        require(success, "FeeSharingCollector::withdrawRBTC: Withdrawal failed");

        emit RBTCWithdrawn(user, _receiver, totalAmount);
    }

```
</details>

---    

> ### getAccumulatedFees

Get the accumulated loan pool fee of the message sender.

```solidity
function getAccumulatedFees(address _user, address _loanPoolToken) public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | The address of the user or contract. | 
| _loanPoolToken | address | Address of the pool token. | 

**Returns**

The accumulated fee for the message sender.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on getAccumulatedFees(address _user, address _loanPoolToken)
        public
        view
        returns (uint256)
    {
        uint256 amount;
        (amount, ) = _getAccumulatedFees(_user, _loanPoolToken, 0);
        return amount;
    }

```
</details>

---    

> ### _getAccumulatedFees

Whenever fees are withdrawn, the staking contract needs to
checkpoint the block number, the number of pool tokens and the
total voting power at that time (read from the staking contract).
While the total voting power would not necessarily need to be
checkpointed, it makes sense to save gas cost on withdrawal.
     * When the user wants to withdraw its share of tokens, we need
to iterate over all of the checkpoints since the users last
withdrawal (note: remember last withdrawal block), query the
user’s balance at the checkpoint blocks from the staking contract,
compute his share of the checkpointed tokens and add them up.
The maximum number of checkpoints to process at once should be limited.
     *

```solidity
function _getAccumulatedFees(address _user, address _loanPoolToken, uint32 _maxCheckpoints) internal view
returns(uint256, uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | Address of the user's account. | 
| _loanPoolToken | address | Loan pool token address. | 
| _maxCheckpoints | uint32 | Checkpoint index incremental.      * | 

**Returns**

accumulated fees amount

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 _getAccumulatedFees(
        address _user,
        address _loanPoolToken,
        uint32 _maxCheckpoints
    ) internal view returns (uint256, uint256) {
        if (staking.isVestingContract(_user)) {
            return (0, 0);
        }

        uint256 processedUserCheckpoints = processedCheckpoints[_user][_loanPoolToken];
        uint256 end;

        if (processedUserCheckpoints >= numTokenCheckpoints[_loanPoolToken]) {
            return (0, _maxCheckpoints > 0 ? 0 : numTokenCheckpoints[_loanPoolToken]);
        }

        end = _maxCheckpoints > 0
            ? _getEndOfRange(processedUserCheckpoints, _loanPoolToken, _maxCheckpoints)
            : numTokenCheckpoints[_loanPoolToken];

        uint256 amount = 0;
        uint256 cachedLockDate = 0;
        uint96 cachedWeightedStake = 0;
        for (uint256 i = processedUserCheckpoints; i < end; i++) {
            Checkpoint storage checkpoint = tokenCheckpoints[_loanPoolToken][i];
            uint256 lockDate = staking.timestampToLockDate(checkpoint.timestamp);
            uint96 weightedStake;
            if (lockDate == cachedLockDate) {
                weightedStake = cachedWeightedStake;
            } else {
                /// @dev We need to use "checkpoint.blockNumber - 1" here to calculate weighted stake
                /// For the same block like we did for total voting power in _writeTokenCheckpoint
                weightedStake = staking.getPriorWeightedStake(
                    _user,
                    checkpoint.blockNumber - 1,
                    checkpoint.timestamp
                );
                cachedWeightedStake = weightedStake;
                cachedLockDate = lockDate;
            }
            uint256 share =
                uint256(checkpoint.numTokens).mul(weightedStake).div(
                    uint256(checkpoint.totalWeightedStake)
                );
            amount = amount.add(share);
        }
        return (amount, end);
    }

    /*
```
</details>

---    

> ### _getEndOfRange

Withdrawal should only be possible for blocks which were already
mined. If the fees are withdrawn in the same block as the user withdrawal
they are not considered by the withdrawing logic (to avoid inconsistencies).
     *

```solidity
function _getEndOfRange(uint256 start, address _loanPoolToken, uint32 _maxCheckpoints) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| start | uint256 | Start of the range. | 
| _loanPoolToken | address | Loan pool token address. | 
| _maxCheckpoints | uint32 | Checkpoint index incremental. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 _getEndOfRange(
        uint256 start,
        address _loanPoolToken,
        uint32 _maxCheckpoints
    ) internal view returns (uint256) {
        uint256 nCheckpoints = numTokenCheckpoints[_loanPoolToken];
        uint256 end;
        if (_maxCheckpoints == 0) {
            /// @dev All checkpoints will be processed (only for getter outside of a transaction).
            end = nCheckpoints;
        } else {
            if (_maxCheckpoints > MAX_CHECKPOINTS) {
                _maxCheckpoints = MAX_CHECKPOINTS;
            }
            end = safe32(
                start + _maxCheckpoints,
                "FeeSharingCollector::withdraw: checkpoint index exceeds 32 bits"
            );
            if (end > nCheckpoints) {
                end = nCheckpoints;
            }
        }

        /// @dev Withdrawal should only be possible for blocks which were already mined.
        uint32 lastBlockNumber = tokenCheckpoints[_loanPoolToken][end - 1].blockNumber;
        if (block.number == lastBlockNumber) {
            end--;
        }
        return end;
    }

    /*
```
</details>

---    

> ### _writeTokenCheckpoint

Write a regular checkpoint w/ the foolowing data:
block number, block timestamp, total weighted stake and num of tokens.

```solidity
function _writeTokenCheckpoint(address _token, uint96 _numTokens) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _token | address | The pool token address. | 
| _numTokens | uint96 | The amount of pool tokens. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 _writeTokenCheckpoint(address _token, uint96 _numTokens) internal {
        uint32 blockNumber =
            safe32(
                block.number,
                "FeeSharingCollector::_writeCheckpoint: block number exceeds 32 bits"
            );
        uint32 blockTimestamp =
            safe32(
                block.timestamp,
                "FeeSharingCollector::_writeCheckpoint: block timestamp exceeds 32 bits"
            );
        uint256 nCheckpoints = numTokenCheckpoints[_token];

        uint96 totalWeightedStake = _getVoluntaryWeightedStake(blockNumber - 1, block.timestamp);
        require(totalWeightedStake > 0, "Invalid totalWeightedStake");
        if (
            nCheckpoints > 0 &&
            tokenCheckpoints[_token][nCheckpoints - 1].blockNumber == blockNumber
        ) {
            tokenCheckpoints[_token][nCheckpoints - 1].totalWeightedStake = totalWeightedStake;
            tokenCheckpoints[_token][nCheckpoints - 1].numTokens = _numTokens;
        } else {
            tokenCheckpoints[_token][nCheckpoints] = Checkpoint(
                blockNumber,
                blockTimestamp,
                totalWeightedStake,
                _numTokens
            );
            numTokenCheckpoints[_token] = nCheckpoints + 1;
        }
        emit CheckpointAdded(msg.sender, _token, _numTokens);
    }

    /*
```
</details>

---    

> ### _getVoluntaryWeightedStake

```solidity
function _getVoluntaryWeightedStake(uint32 blockNumber, uint256 timestamp) internal view
returns(totalWeightedStake uint96)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| blockNumber | uint32 | the blocknumber | 
| timestamp | uint256 | the timestamp | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 _getVoluntaryWeightedStake(uint32 blockNumber, uint256 timestamp)
        internal
        view
        returns (uint96 totalWeightedStake)
    {
        uint96 vestingWeightedStake = staking.getPriorVestingWeightedStake(blockNumber, timestamp);
        totalWeightedStake = staking.getPriorTotalVotingPower(blockNumber, timestamp);
        totalWeightedStake = sub96(
            totalWeightedStake,
            vestingWeightedStake,
            "FeeSharingCollector::_getTotalVoluntaryWeightedStake: vested stake exceeds total stake"
        );
    }

    /*
```
</details>

---    

> ### addWhitelistedConverterAddress

Whitelisting converter address.
     *

```solidity
function addWhitelistedConverterAddress(address converterAddress) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| converterAddress | address | converter address to be whitelisted. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 addWhitelistedConverterAddress(address converterAddress) external onlyOwner {
        require(Address.isContract(converterAddress), "Non contract address given");
        whitelistedConverterList.add(converterAddress);
        emit WhitelistedConverter(msg.sender, converterAddress);
    }

    /*
```
</details>

---    

> ### removeWhitelistedConverterAddress

Removing converter address from whitelist.
     *

```solidity
function removeWhitelistedConverterAddress(address converterAddress) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| converterAddress | address | converter address to be removed from whitelist. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 removeWhitelistedConverterAddress(address converterAddress) external onlyOwner {
        whitelistedConverterList.remove(converterAddress);
        emit UnwhitelistedConverter(msg.sender, converterAddress);
    }

    /*
```
</details>

---    

> ### getWhitelistedConverterList

Getter to query all of the whitelisted converter.

```solidity
function getWhitelistedConverterList() external view
returns(converterList address[])
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 getWhitelistedConverterList() external view returns (address[] memory converterList) {
        converterList = whitelistedConverterList.enumerate();
    }

    /*
```
</details>

---    

> ### _validateWhitelistedConverter

validate array of given address whether is whitelisted or not.

```solidity
function _validateWhitelistedConverter(address[] converterAddresses) private view
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| converterAddresses | address[] | array of converter addresses. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 _validateWhitelistedConverter(address[] memory converterAddresses) private view {
        for (uint256 i = 0; i < converterAddresses.length; i++) {
            require(whitelistedConverterList.contains(converterAddresses[i]), "Invalid Converter");
        }
    }

    fu
```
</details>

---    

> ### withdrawWRBTC

```solidity
function withdrawWRBTC(address receiver, uint256 wrbtcAmount) external nonpayable onlyOwner 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| wrbtcAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 withdrawWRBTC(address receiver, uint256 wrbtcAmount) external onlyOwner {
        address wRBTCAddress = address(protocol.wrbtcToken());

        uint256 balance = IERC20(wRBTCAddress).balanceOf(address(this));
        require(wrbtcAmount <= balance, "Insufficient balance");

        IERC20(wRBTCAddress).safeTransfer(receiver, wrbtcAmount);
    }

    /*
```
</details>

---    

> ### getAccumulatedRBTCFeeBalances

view function that calculate the total RBTC that includes:
- RBTC
- WRBTC
- iWRBTC * iWRBTC.tokenPrice()

```solidity
function getAccumulatedRBTCFeeBalances(address _user) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | address of the user. | 

**Returns**

rbtc balance of the given user's address.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 getAccumulatedRBTCFeeBalances(address _user) external view returns (uint256) {
        uint256 _rbtcAmount;
        uint256 _wrbtcAmount;
        uint256 _iWrbtcAmount;
        (_rbtcAmount, _wrbtcAmount, _iWrbtcAmount, , , ) = _getRBTCBalances(_user, 0);
        return _rbtcAmount.add(_wrbtcAmount).add(_iWrbtcAmount);
    }

    /*
```
</details>

---    

> ### _getRBTCBalances

private function that responsible to calculate the user's token that has RBTC as underlying token (rbtc, wrbtc, iWrbtc)
     *

```solidity
function _getRBTCBalances(address _user, uint32 _maxCheckpoints) private view
returns(_rbtcAmount uint256, _wrbtcAmount uint256, _iWrbtcAmount uint256, _endRBTC uint256, _endWRBTC uint256, _endIWRBTC uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | address of the user. | 
| _maxCheckpoints | uint32 | maximum checkpoints.      * | 

**Returns**

_rbtcAmount rbtc amount

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 _getRBTCBalances(address _user, uint32 _maxCheckpoints)
        private
        view
        returns (
            uint256 _rbtcAmount,
            uint256 _wrbtcAmount,
            uint256 _iWrbtcAmount,
            uint256 _endRBTC,
            uint256 _endWRBTC,
            uint256 _endIWRBTC
        )
    {
        IWrbtcERC20 wrbtcToken = protocol.wrbtcToken();

        address loanPoolTokenWRBTC = _getAndValidateLoanPoolWRBTC(address(wrbtcToken));

        (_rbtcAmount, _endRBTC) = _getAccumulatedFees(
            _user,
            RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
            _maxCheckpoints
        );
        (_wrbtcAmount, _endWRBTC) = _getAccumulatedFees(
            _user,
            address(wrbtcToken),
            _maxCheckpoints
        );
        (_iWrbtcAmount, _endIWRBTC) = _getAccumulatedFees(
            _user,
            loanPoolTokenWRBTC,
            _maxCheckpoints
        );

        _iWrbtcAmount = _iWrbtcAmount.mul(ILoanTokenWRBTC(loanPoolTokenWRBTC).tokenPrice()).div(
            1e18
        );
    }

    /*
```
</details>

---    

> ### _getAndValidateLoanPoolWRBTC

private function to get and validate the wrbtc loan pool token address based on the wrbtc token address.

```solidity
function _getAndValidateLoanPoolWRBTC(address _wRBTCAddress) private view
returns(address)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _wRBTCAddress | address | wrbtc token address.      * | 

**Returns**

wrbtc loan pool wrbtc token address

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 _getAndValidateLoanPoolWRBTC(address _wRBTCAddress) private view returns (address) {
        address loanPoolTokenWRBTC = protocol.underlyingToLoanPool(_wRBTCAddress);
        require(
            loanPoolTokenWRBTC != ZERO_ADDRESS,
            "FeeSharingCollector::withdraw: loan wRBTC not found"
        );

        return loanPoolTokenWRBTC;
    }
}

/* I
```
</details>

---    

> ### mint

```solidity
function mint(address receiver, uint256 depositAmount) external nonpayable
returns(mintAmount uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| depositAmount | uint256 |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 mint(address receiver, uint256 depositAmount) external returns (uint256 mintAmount);
}

inte
```
</details>

---    

> ### burnToBTC

```solidity
function burnToBTC(address receiver, uint256 burnAmount, bool useLM) external nonpayable
returns(loanAmountPaid uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| receiver | address |  | 
| burnAmount | uint256 |  | 
| useLM | bool |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 burnToBTC(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external returns (uint256 loanAmountPaid);

    fu
```
</details>

---    

> ### tokenPrice

```solidity
function tokenPrice() external view
returns(price uint256)
```

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
 tokenPrice() external view returns (uint256 price);
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
