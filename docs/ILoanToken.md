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
event UserFeeProcessedNoWithdraw(address indexed sender, address indexed token, uint256  prevProcessedCheckpoints, uint256  newProcessedCheckpoints);
event FeeAMMWithdrawn(address indexed sender, address indexed converter, uint256  amount);
event WhitelistedConverter(address indexed sender, address  converter);
event UnwhitelistedConverter(address indexed sender, address  converter);
event RBTCWithdrawn(address indexed sender, address indexed receiver, uint256  amount);
```

## Modifiers

- [validFromCheckpointParam](#validfromcheckpointparam)

### validFromCheckpointParam

Validates if the checkpoint is payable for the user

```js
modifier validFromCheckpointParam(uint256 _fromCheckpoint, address _user, address _token) internal
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _fromCheckpoint | uint256 |  | 
| _user | address |  | 
| _token | address |  | 

## Functions

- [constructor()](#constructor)
- [withdrawFees(address[] _tokens)](#withdrawfees)
- [withdrawFeesAMM(address[] _converters)](#withdrawfeesamm)
- [transferTokens(address _token, uint96 _amount)](#transfertokens)
- [transferRBTC()](#transferrbtc)
- [_addCheckpoint(address _token, uint96 _amount)](#_addcheckpoint)
- [_withdraw(address _token, uint32 _maxCheckpoints, address _receiver)](#_withdraw)
- [withdraw(address _token, uint32 _maxCheckpoints, address _receiver)](#withdraw)
- [withdrawStartingFromCheckpoint(address _token, uint256 _fromCheckpoint, uint32 _maxCheckpoints, address _receiver)](#withdrawstartingfromcheckpoint)
- [_withdrawRBTC(uint32 _maxCheckpoints, address _receiver)](#_withdrawrbtc)
- [withdrawRBTC(uint32 _maxCheckpoints, address _receiver)](#withdrawrbtc)
- [withdrawRBTCStartingFromCheckpoint(uint256 _fromCheckpoint, uint32 _maxCheckpoints, address _receiver)](#withdrawrbtcstartingfromcheckpoint)
- [getNextPositiveUserCheckpoint(address _user, address _token, uint256 _startFrom, uint256 _maxCheckpoints)](#getnextpositiveusercheckpoint)
- [getAccumulatedFees(address _user, address _token)](#getaccumulatedfees)
- [getAccumulatedFeesForCheckpointsRange(address _user, address _token, uint256 _startFrom, uint32 _maxCheckpoints)](#getaccumulatedfeesforcheckpointsrange)
- [_getAccumulatedFees(address _user, address _token, uint256 _startFrom, uint32 _maxCheckpoints)](#_getaccumulatedfees)
- [_getEndOfRange(uint256 _start, address _token, uint32 _maxCheckpoints)](#_getendofrange)
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
- [numTokenCheckpoints(address _token)](#numtokencheckpoints)
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
function withdrawFees(address[] _tokens) external nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _tokens | address[] | array address of the token | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on withdrawFees(address[] calldata _tokens) external {
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

> ### _withdraw

```solidity
function _withdraw(address _token, uint32 _maxCheckpoints, address _receiver) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _token | address |  | 
| _maxCheckpoints | uint32 |  | 
| _receiver | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on _withdraw(
        address _token,
        uint32 _maxCheckpoints,
        address _receiver
    ) internal {
        /// @dev Prevents block gas limit hit when processing checkpoints
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
        uint256 processedUserCheckpoints = processedCheckpoints[user][_token];
        (uint256 amount, uint256 end) =
            _getAccumulatedFees(user, _token, processedUserCheckpoints, _maxCheckpoints);
        if (amount == 0) {
            if (end > processedUserCheckpoints) {
                emit UserFeeProcessedNoWithdraw(msg.sender, _token, processedUserCheckpoints, end);
                processedCheckpoints[user][_token] = end;
                return;
            } else {
                // getting here most likely means smth wrong with the state
                revert("FeeSharingCollector::withdrawFees: no tokens for withdrawal");
            }
        }

        processedCheckpoints[user][_token] = end;
        if (loanPoolTokenWRBTC == _token) {
            // We will change, so that feeSharingCollector will directly burn then loanToken (IWRBTC) to rbtc and send to the user --- by call burnToBTC function
            ILoanTokenWRBTC(_token).burnToBTC(_receiver, amount, false);
        } else {
            // Previously it directly send the loanToken to the user
            require(
                IERC20(_token).transfer(_receiver, amount),
                "FeeSharingCollector::withdraw: withdrawal failed"
            );
        }

        emit UserFeeWithdrawn(msg.sender, _receiver, _token, amount);
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
function withdraw(address _token, uint32 _maxCheckpoints, address _receiver) public nonpayable nonReentrant 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _token | address | RBTC dummy to fit into existing data structure or SOV. Former address of the pool token. | 
| _maxCheckpoints | uint32 | Maximum number of checkpoints to be processed. Must be positive value. | 
| _receiver | address | The receiver of tokens or msg.sender | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on withdraw(
        address _token,
        uint32 _maxCheckpoints,
        address _receiver
    ) public nonReentrant {
        _withdraw(_token, _maxCheckpoints, _receiver);
    }

```
</details>

---    

> ### withdrawStartingFromCheckpoint

Withdraw accumulated fee to the message sender/receiver.
     * The Sovryn protocol collects fees on every trade/swap and loan.
These fees will be distributed to SOV stakers based on their voting
power as a percentage of total voting power.
     * This function will directly burnToBTC and use the msg.sender (user) as the receiver
     *

```solidity
function withdrawStartingFromCheckpoint(address _token, uint256 _fromCheckpoint, uint32 _maxCheckpoints, address _receiver) public nonpayable validFromCheckpointParam nonReentrant 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _token | address | RBTC dummy to fit into existing data structure or SOV. Former address of the pool token. | 
| _fromCheckpoint | uint256 | Skips all the checkpoints before '_fromCheckpoint'        should be calculated offchain with getNextPositiveUserCheckpoint function | 
| _maxCheckpoints | uint32 | Maximum number of checkpoints to be processed. | 
| _receiver | address | The receiver of tokens or msg.sender | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on withdrawStartingFromCheckpoint(
        address _token,
        uint256 _fromCheckpoint,
        uint32 _maxCheckpoints,
        address _receiver
    ) public validFromCheckpointParam(_fromCheckpoint, msg.sender, _token) nonReentrant {
        // @dev e.g. _fromCheckpoint == 10 meaning we should set 9 user's processed checkpoints
        // after _withdraw() the user's processedCheckpoints should be 10
        uint256 prevFromCheckpoint = _fromCheckpoint.sub(1);
        if (prevFromCheckpoint > processedCheckpoints[msg.sender][_token]) {
            processedCheckpoints[msg.sender][_token] = prevFromCheckpoint;
        }
        _withdraw(_token, _maxCheckpoints, _receiver);
    }

```
</details>

---    

> ### _withdrawRBTC

```solidity
function _withdrawRBTC(uint32 _maxCheckpoints, address _receiver) internal nonpayable
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _maxCheckpoints | uint32 |  | 
| _receiver | address |  | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on _withdrawRBTC(uint32 _maxCheckpoints, address _receiver) internal {
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

> ### withdrawRBTC

withdraw all of the RBTC balance based on particular checkpoints
     * RBTC balance consists of:
- rbtc balance
- wrbtc balance which will be unwrapped to rbtc
- iwrbtc balance which will be unwrapped to rbtc
     *

```solidity
function withdrawRBTC(uint32 _maxCheckpoints, address _receiver) external nonpayable nonReentrant 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _maxCheckpoints | uint32 | Maximum number of checkpoints to be processed to workaround block gas limit | 
| _receiver | address | An optional tokens receiver (msg.sender used if 0) | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on withdrawRBTC(uint32 _maxCheckpoints, address _receiver) external nonReentrant {
        _withdrawRBTC(_maxCheckpoints, _receiver);
    }

```
</details>

---    

> ### withdrawRBTCStartingFromCheckpoint

Withdraw all of the RBTC balance based starting from a specific checkpoint
The function was designed to skip checkpoints with no fees for users
     * RBTC balance consists of:
- rbtc balance
- wrbtc balance which will be unwrapped to rbtc
- iwrbtc balance which will be unwrapped to rbtc
     *

```solidity
function withdrawRBTCStartingFromCheckpoint(uint256 _fromCheckpoint, uint32 _maxCheckpoints, address _receiver) external nonpayable validFromCheckpointParam nonReentrant 
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _fromCheckpoint | uint256 | Skips all the checkpoints before '_fromCheckpoint'        should be calculated offchain with getNextPositiveUserCheckpoint function | 
| _maxCheckpoints | uint32 | Maximum number of checkpoints to be processed to workaround block gas limit | 
| _receiver | address | An optional tokens receiver (msg.sender used if 0) | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on withdrawRBTCStartingFromCheckpoint(
        uint256 _fromCheckpoint,
        uint32 _maxCheckpoints,
        address _receiver
    )
        external
        validFromCheckpointParam(_fromCheckpoint, msg.sender, RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT)
        nonReentrant
    {
        // @dev e.g. _fromCheckpoint == 10
        // after _withdraw() user's processedCheckpoints should be 10 =>
        // set processed checkpoints = 9, next maping index = 9 (10th checkpoint)
        uint256 prevFromCheckpoint = _fromCheckpoint.sub(1);
        if (
            prevFromCheckpoint >
            processedCheckpoints[msg.sender][RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT]
        ) {
            processedCheckpoints[msg.sender][
                RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT
            ] = prevFromCheckpoint;
        }
        _withdrawRBTC(_maxCheckpoints, _receiver);
    }

```
</details>

---    

> ### getNextPositiveUserCheckpoint

Returns first user's checkpoint with weighted stake > 0
     *

```solidity
function getNextPositiveUserCheckpoint(address _user, address _token, uint256 _startFrom, uint256 _maxCheckpoints) external view
returns(checkpointNum uint256, hasSkippedCheckpoints bool, hasFees bool)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | The address of the user or contract. | 
| _token | address | RBTC dummy to fit into existing data structure or SOV. Former address of the pool token. | 
| _startFrom | uint256 | Checkpoint number to start from. If _startFrom < processedUserCheckpoints then starts from processedUserCheckpoints. | 
| _maxCheckpoints | uint256 | Max checkpoints to process in a row to avoid timeout error | 

**Returns**

[checkpointNum: checkpoint number where user's weighted stake > 0, hasSkippedCheckpoints, hasFees]

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on getNextPositiveUserCheckpoint(
        address _user,
        address _token,
        uint256 _startFrom,
        uint256 _maxCheckpoints
    )
        external
        view
        returns (
            uint256 checkpointNum,
            bool hasSkippedCheckpoints,
            bool hasFees
        )
    {
        if (staking.isVestingContract(_user)) {
            return (0, false, false);
        }
        require(_maxCheckpoints > 0, "_maxCheckpoints must be > 0");

        uint256 totalCheckpoints = totalTokenCheckpoints[_token];
        uint256 processedUserCheckpoints = processedCheckpoints[_user][_token];

        if (processedUserCheckpoints >= totalCheckpoints || totalCheckpoints == 0) {
            return (totalCheckpoints, false, false);
        }

        uint256 startFrom =
            _startFrom > processedUserCheckpoints ? _startFrom : processedUserCheckpoints;

        uint256 end = startFrom.add(_maxCheckpoints);
        if (end >= totalCheckpoints) {
            end = totalCheckpoints;
        }

        // @note here processedUserCheckpoints is a number of processed checkpoints and
        // also an index for the next checkpoint because an array index starts wtih 0
        for (uint256 i = startFrom; i < end; i++) {
            Checkpoint storage tokenCheckpoint = tokenCheckpoints[_token][i];
            uint96 weightedStake =
                staking.getPriorWeightedStake(
                    _user,
                    tokenCheckpoint.blockNumber - 1,
                    tokenCheckpoint.timestamp
                );
            if (weightedStake > 0) {
                // i is the index and we need to return checkpoint num which is i + 1
                return (i + 1, i > processedUserCheckpoints, true);
            }
        }
        return (end, end > processedUserCheckpoints, false);
    }

```
</details>

---    

> ### getAccumulatedFees

Get the accumulated loan pool fee of the message sender.

```solidity
function getAccumulatedFees(address _user, address _token) public view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | The address of the user or contract. | 
| _token | address | RBTC dummy to fit into existing data structure or SOV. Former address of the pool token. | 

**Returns**

The accumulated fee for the message sender.

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on getAccumulatedFees(address _user, address _token) public view returns (uint256) {
        uint256 amount;
        (amount, ) = _getAccumulatedFees({
            _user: _user,
            _token: _token,
            _startFrom: 0,
            _maxCheckpoints: 0
        });
        return amount;
    }

```
</details>

---    

> ### getAccumulatedFeesForCheckpointsRange

Get the accumulated fee rewards for the message sender for a checkpoints range
     *

```solidity
function getAccumulatedFeesForCheckpointsRange(address _user, address _token, uint256 _startFrom, uint32 _maxCheckpoints) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | The address of a user (staker) or contract. | 
| _token | address | RBTC dummy to fit into existing data structure or SOV. Former address of the pool token. | 
| _startFrom | uint256 | Checkpoint to start calculating fees from. | 
| _maxCheckpoints | uint32 | maxCheckpoints to get accumulated fees for the _user | 

**Returns**

The accumulated fees rewards for the _user in the given checkpoints interval: [_startFrom, _startFrom + maxCheckpoints].

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on getAccumulatedFeesForCheckpointsRange(
        address _user,
        address _token,
        uint256 _startFrom,
        uint32 _maxCheckpoints
    ) external view returns (uint256) {
        uint256 amount;
        (amount, ) = _getAccumulatedFees(_user, _token, _startFrom, _maxCheckpoints);
        return amount;
    }

```
</details>

---    

> ### _getAccumulatedFees

Gets accumulated fees for a user starting from a given checkpoint
     *

```solidity
function _getAccumulatedFees(address _user, address _token, uint256 _startFrom, uint32 _maxCheckpoints) internal view
returns(feesAmount uint256, endCheckpoint uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _user | address | Address of the user's account. | 
| _token | address | RBTC dummy to fit into existing data structure or SOV. Former address of the pool token. | 
| _startFrom | uint256 | Checkpoint num to start calculations from      * | 
| _maxCheckpoints | uint32 | Max checkpoints to process at once to fit into block gas limit | 

**Returns**

feesAmount - accumulated fees amount

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on _getAccumulatedFees(
        address _user,
        address _token,
        uint256 _startFrom,
        uint32 _maxCheckpoints
    ) internal view returns (uint256 feesAmount, uint256 endCheckpoint) {
        if (staking.isVestingContract(_user)) {
            return (0, 0);
        }
        uint256 processedUserCheckpoints = processedCheckpoints[_user][_token];
        uint256 startOfRange =
            _startFrom > processedUserCheckpoints ? _startFrom : processedUserCheckpoints;
        endCheckpoint = _maxCheckpoints > 0
            ? _getEndOfRange(startOfRange, _token, _maxCheckpoints)
            : totalTokenCheckpoints[_token];

        if (startOfRange >= totalTokenCheckpoints[_token]) {
            return (0, endCheckpoint);
        }

        uint256 cachedLockDate = 0;
        uint96 cachedWeightedStake = 0;
        // @note here processedUserCheckpoints is a number of processed checkpoints and
        // also an index for the next checkpoint because an array index starts wtih 0
        for (uint256 i = startOfRange; i < endCheckpoint; i++) {
            Checkpoint memory checkpoint = tokenCheckpoints[_token][i];
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
            feesAmount = feesAmount.add(share);
        }
        return (feesAmount, endCheckpoint);
    }

```
</details>

---    

> ### _getEndOfRange

Withdrawal should only be possible for blocks which were already
mined. If the fees are withdrawn in the same block as the user withdrawal
they are not considered by the withdrawing logic (to avoid inconsistencies).
     *

```solidity
function _getEndOfRange(uint256 _start, address _token, uint32 _maxCheckpoints) internal view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _start | uint256 | Start of the range. | 
| _token | address | RBTC dummy to fit into existing data structure or SOV. Former address of a pool token. | 
| _maxCheckpoints | uint32 | Checkpoint index incremental. | 

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on _getEndOfRange(
        uint256 _start,
        address _token,
        uint32 _maxCheckpoints
    ) internal view returns (uint256) {
        uint256 nextCheckpointIndex = totalTokenCheckpoints[_token];
        if (nextCheckpointIndex == 0) {
            return 0;
        }
        uint256 end;

        if (_maxCheckpoints == 0) {
            /// @dev All checkpoints will be processed (only for getter outside of a transaction).
            end = nextCheckpointIndex;
        } else {
            end = safe32(
                _start + _maxCheckpoints,
                "FeeSharingCollector::withdraw: checkpoint index exceeds 32 bits"
            );
            if (end > nextCheckpointIndex) {
                end = nextCheckpointIndex;
            }
        }

        /// @dev Withdrawal should only be possible for blocks which were already mined.
        uint32 lastBlockNumber = tokenCheckpoints[_token][end - 1].blockNumber;
        if (block.number == lastBlockNumber) {
            end--;
        }
        return end;
    }

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
on _writeTokenCheckpoint(address _token, uint96 _numTokens) internal {
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
        uint256 nextCheckpointsIndex = totalTokenCheckpoints[_token];

        uint96 totalWeightedStake = _getVoluntaryWeightedStake(blockNumber - 1, block.timestamp);
        require(totalWeightedStake > 0, "Invalid totalWeightedStake");
        if (
            nextCheckpointsIndex > 0 &&
            tokenCheckpoints[_token][nextCheckpointsIndex - 1].blockNumber == blockNumber
        ) {
            tokenCheckpoints[_token][nextCheckpointsIndex - 1]
                .totalWeightedStake = totalWeightedStake;
            tokenCheckpoints[_token][nextCheckpointsIndex - 1].numTokens = _numTokens;
        } else {
            tokenCheckpoints[_token][nextCheckpointsIndex] = Checkpoint(
                blockNumber,
                blockTimestamp,
                totalWeightedStake,
                _numTokens
            );
            totalTokenCheckpoints[_token] = nextCheckpointsIndex + 1;
        }
        emit CheckpointAdded(msg.sender, _token, _numTokens);
    }

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
on _getVoluntaryWeightedStake(uint32 blockNumber, uint256 timestamp)
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
on addWhitelistedConverterAddress(address converterAddress) external onlyOwner {
        require(Address.isContract(converterAddress), "Non contract address given");
        whitelistedConverterList.add(converterAddress);
        emit WhitelistedConverter(msg.sender, converterAddress);
    }

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
on removeWhitelistedConverterAddress(address converterAddress) external onlyOwner {
        whitelistedConverterList.remove(converterAddress);
        emit UnwhitelistedConverter(msg.sender, converterAddress);
    }

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
on getWhitelistedConverterList() external view returns (address[] memory converterList) {
        converterList = whitelistedConverterList.enumerate();
    }

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
on _validateWhitelistedConverter(address[] memory converterAddresses) private view {
        for (uint256 i = 0; i < converterAddresses.length; i++) {
            require(whitelistedConverterList.contains(converterAddresses[i]), "Invalid Converter");
        }
    }

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
on withdrawWRBTC(address receiver, uint256 wrbtcAmount) external onlyOwner {
        address wRBTCAddress = address(protocol.wrbtcToken());

        uint256 balance = IERC20(wRBTCAddress).balanceOf(address(this));
        require(wrbtcAmount <= balance, "Insufficient balance");

        IERC20(wRBTCAddress).safeTransfer(receiver, wrbtcAmount);
    }

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
on getAccumulatedRBTCFeeBalances(address _user) external view returns (uint256) {
        (uint256 _rbtcAmount, uint256 _wrbtcAmount, uint256 _iWrbtcAmount, , , ) =
            _getRBTCBalances(_user, 0);
        IWrbtcERC20 wrbtcToken = protocol.wrbtcToken();
        address loanPoolTokenWRBTC = _getAndValidateLoanPoolWRBTC(address(wrbtcToken));
        uint256 iWRBTCAmountInRBTC =
            _iWrbtcAmount.mul(ILoanTokenWRBTC(loanPoolTokenWRBTC).tokenPrice()).div(1e18);
        return _rbtcAmount.add(_wrbtcAmount).add(iWRBTCAmountInRBTC);
    }

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
on _getRBTCBalances(address _user, uint32 _maxCheckpoints)
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

        (_rbtcAmount, _endRBTC) = _getAccumulatedFees({
            _user: _user,
            _token: RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
            _startFrom: 0,
            _maxCheckpoints: _maxCheckpoints
        });

        (_wrbtcAmount, _endWRBTC) = _getAccumulatedFees({
            _user: _user,
            _token: address(wrbtcToken),
            _startFrom: 0,
            _maxCheckpoints: _maxCheckpoints
        });
        (_iWrbtcAmount, _endIWRBTC) = _getAccumulatedFees({
            _user: _user,
            _token: loanPoolTokenWRBTC,
            _startFrom: 0,
            _maxCheckpoints: _maxCheckpoints
        });
    }

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
on _getAndValidateLoanPoolWRBTC(address _wRBTCAddress) private view returns (address) {
        address loanPoolTokenWRBTC = protocol.underlyingToLoanPool(_wRBTCAddress);
        require(
            loanPoolTokenWRBTC != ZERO_ADDRESS,
            "FeeSharingCollector::withdraw: loan wRBTC not found"
        );

        return loanPoolTokenWRBTC;
    }

```
</details>

---    

> ### numTokenCheckpoints

This getter function `numTokenCheckpoints` is added for backwards compatibility
     broken when renamed `numTokenCheckpoints` storage variable to `totalTokenCheckpoints`.
     *

```solidity
function numTokenCheckpoints(address _token) external view
returns(uint256)
```

**Arguments**

| Name        | Type           | Description  |
| ------------- |------------- | -----|
| _token | address | token address to get checkpoints for      * | 

**Returns**

Total token checkpoints

<details>
	<summary><strong>Source Code</strong></summary>

```javascript
on numTokenCheckpoints(address _token) external view returns (uint256) {
        return totalTokenCheckpoints[_token];
    }
}

/*
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
on mint(address receiver, uint256 depositAmount) external returns (uint256 mintAmount);
}

in
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
on burnToBTC(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external returns (uint256 loanAmountPaid);

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
on tokenPrice() external view returns (uint256 price);
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
