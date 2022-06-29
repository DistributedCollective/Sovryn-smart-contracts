# The FeeSharingLogic contract. (ILoanTokenWRBTC.sol)

View Source: [contracts/governance/FeeSharingProxy/FeeSharingLogic.sol](../contracts/governance/FeeSharingProxy/FeeSharingLogic.sol)

**↗ Extends: [SafeMath96](SafeMath96.md), [IFeeSharingProxy](IFeeSharingProxy.md), [Ownable](Ownable.md), [FeeSharingProxyStorage](FeeSharingProxyStorage.md)**

**ILoanTokenWRBTC**

Staking is not only granting voting rights, but also access to fee
sharing according to the own voting power in relation to the total. Whenever
somebody decides to collect the fees from the protocol, they get transferred
to a proxy contract which invests the funds in the lending pool and keeps
the pool tokens.
 * The fee sharing proxy will be set as feesController of the protocol contract.
This allows the fee sharing proxy to withdraw the fees. The fee sharing
proxy holds the pool tokens and keeps track of which user owns how many
tokens. In order to know how many tokens a user owns, the fee sharing proxy
needs to know the user’s weighted stake in relation to the total weighted
stake (aka total voting power).
 * Because both values are subject to change, they may be different on each fee
withdrawal. To be able to calculate a user’s share of tokens when he wants
to withdraw, we need checkpoints.
 * This contract is intended to be set as the protocol fee collector.
Anybody can invoke the withdrawFees function which uses
protocol.withdrawFees to obtain available fees from operations on a
certain token. These fees are deposited in the corresponding loanPool.
Also, the staking contract sends slashed tokens to this contract. When a
user calls the withdraw function, the contract transfers the fee sharing
rewards in proportion to the user’s weighted stake since the last withdrawal.
 * The protocol is collecting fees in all sorts of currencies and then automatically
supplies them to the respective lending pools. Therefore, all fees are
generating interest for the SOV holders. If one of them withdraws fees, it will
get pool tokens. It is planned to add the option to convert anything to rBTC
before withdrawing, but not yet implemented.

**Events**

```js
event FeeWithdrawn(address indexed sender, address indexed token, uint256  amount);
event TokensTransferred(address indexed sender, address indexed token, uint256  amount);
event CheckpointAdded(address indexed sender, address indexed token, uint256  amount);
event UserFeeWithdrawn(address indexed sender, address indexed receiver, address indexed token, uint256  amount);
event FeeAMMWithdrawn(address indexed sender, address indexed converter, uint256  amount);
event WhitelistedConverter(address indexed sender, address  converter);
event UnwhitelistedConverter(address indexed sender, address  converter);
```

## Functions

- [withdrawFees(address[] _tokens)](#withdrawfees)
- [withdrawFeesAMM(address[] _converters)](#withdrawfeesamm)
- [transferTokens(address _token, uint96 _amount)](#transfertokens)
- [_addCheckpoint(address _token, uint96 _amount)](#_addcheckpoint)
- [withdraw(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver)](#withdraw)
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
- [mint(address receiver, uint256 depositAmount)](#mint)
- [burnToBTC(address receiver, uint256 burnAmount, bool useLM)](#burntobtc)

---    

> ### withdrawFees

⤾ overrides [IFeeSharingProxy.withdrawFees](IFeeSharingProxy.md#withdrawfees)

Withdraw fees for the given token:
lendingFee + tradingFee + borrowingFee
the fees (except SOV) will be converted in wRBTC form, and then will be transferred to wRBTC loan pool.
For SOV, it will be directly deposited into the feeSharingProxy from the protocol.
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
                "FeeSharingProxy::withdrawFees: token is not a contract"
            );
        }

        uint256 wrbtcAmountWithdrawn = protocol.withdrawFees(_tokens, address(this));
        uint256 poolTokenAmount;

        address wRBTCAddress = protocol.wrbtcToken();
        require(
            wRBTCAddress != address(0),
            "FeeSharingProxy::withdrawFees: wRBTCAddress is not set"
        );

        address loanPoolToken = protocol.underlyingToLoanPool(wRBTCAddress);
        require(
            loanPoolToken != address(0),
            "FeeSharingProxy::withdrawFees: loan wRBTC not found"
        );

        if (wrbtcAmountWithdrawn > 0) {
            /// @dev TODO can be also used - function addLiquidity(IERC20Token _reserveToken, uint256 _amount, uint256 _minReturn)
            IERC20(wRBTCAddress).approve(loanPoolToken, wrbtcAmountWithdrawn);
            poolTokenAmount = ILoanToken(loanPoolToken).mint(address(this), wrbtcAmountWithdrawn);

            /// @notice Update unprocessed amount of tokens
            uint96 amount96 =
                safe96(
                    poolTokenAmount,
                    "FeeSharingProxy::withdrawFees: pool token amount exceeds 96 bits"
                );

            _addCheckpoint(loanPoolToken, amount96);
        }

        emit FeeWithdrawn(msg.sender, loanPoolToken, poolTokenAmount);
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
        address wRBTCAddress = protocol.wrbtcToken();
        require(
            wRBTCAddress != address(0),
            "FeeSharingProxy::withdrawFees: wRBTCAddress is not set"
        );

        address loanPoolToken = protocol.underlyingToLoanPool(wRBTCAddress);
        require(
            loanPoolToken != address(0),
            "FeeSharingProxy::withdrawFees: loan wRBTC not found"
        );

        // Validate
        _validateWhitelistedConverter(_converters);

        uint96 totalPoolTokenAmount;
        for (uint256 i = 0; i < _converters.length; i++) {
            uint256 wrbtcAmountWithdrawn =
                IConverterAMM(_converters[i]).withdrawFees(address(this));

            if (wrbtcAmountWithdrawn > 0) {
                /// @dev TODO can be also used - function addLiquidity(IERC20Token _reserveToken, uint256 _amount, uint256 _minReturn)
                IERC20(wRBTCAddress).approve(loanPoolToken, wrbtcAmountWithdrawn);
                uint256 poolTokenAmount =
                    ILoanToken(loanPoolToken).mint(address(this), wrbtcAmountWithdrawn);

                /// @notice Update unprocessed amount of tokens
                uint96 amount96 =
                    safe96(
                        poolTokenAmount,
                        "FeeSharingProxy::withdrawFees: pool token amount exceeds 96 bits"
                    );

                totalPoolTokenAmount = add96(
                    totalPoolTokenAmount,
                    amount96,
                    "FeeSharingProxy::withdrawFees: total pool token amount exceeds 96 bits"
                );

                emit FeeAMMWithdrawn(msg.sender, _converters[i], poolTokenAmount);
            }
        }

        if (totalPoolTokenAmount > 0) {
            _addCheckpoint(loanPoolToken, totalPoolTokenAmount);
        }
    }

```
</details>

---    

> ### transferTokens

⤾ overrides [IFeeSharingProxy.transferTokens](IFeeSharingProxy.md#transfertokens)

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
        require(_token != address(0), "FeeSharingProxy::transferTokens: invalid address");
        require(_amount > 0, "FeeSharingProxy::transferTokens: invalid amount");

        /// @notice Transfer tokens from msg.sender
        bool success = IERC20(_token).transferFrom(address(msg.sender), address(this), _amount);
        require(success, "Staking::transferTokens: token transfer failed");

        _addCheckpoint(_token, _amount);

        emit TokensTransferred(msg.sender, _token, _amount);
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
                    "FeeSharingProxy::_addCheckpoint: amount exceeds 96 bits"
                );

            /// @notice Reset unprocessed amount of tokens to zero.
            unprocessedAmount[_token] = 0;

            /// @notice Write a regular checkpoint.
            _writeTokenCheckpoint(_token, amount);
        } else {
            unprocessedAmount[_token] = add96(
                unprocessedAmount[_token],
                _amount,
                "FeeSharingProxy::_addCheckpoint: unprocessedAmount exceeds 96 bits"
            );
        }
    }

```
</details>

---    

> ### withdraw

⤾ overrides [IFeeSharingProxy.withdraw](IFeeSharingProxy.md#withdraw)

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
        /// @dev Prevents processing / checkpoints because of block gas limit.
        require(
            _maxCheckpoints > 0,
            "FeeSharingProxy::withdraw: _maxCheckpoints should be positive"
        );

        address wRBTCAddress = protocol.wrbtcToken();
        require(wRBTCAddress != address(0), "FeeSharingProxy::withdraw: wRBTCAddress is not set");

        address loanPoolTokenWRBTC = protocol.underlyingToLoanPool(wRBTCAddress);
        require(
            loanPoolTokenWRBTC != address(0),
            "FeeSharingProxy::withdraw: loan wRBTC not found"
        );

        address user = msg.sender;
        if (_receiver == address(0)) {
            _receiver = msg.sender;
        }

        uint256 amount;
        uint256 end;
        (amount, end) = _getAccumulatedFees(user, _loanPoolToken, _maxCheckpoints);
        require(amount > 0, "FeeSharingProxy::withdrawFees: no tokens for a withdrawal");

        processedCheckpoints[user][_loanPoolToken] = end;

        if (loanPoolTokenWRBTC == _loanPoolToken) {
            // We will change, so that feeSharingProxy will directly burn then loanToken (IWRBTC) to rbtc and send to the user --- by call burnToBTC function
            uint256 loanAmountPaid =
                ILoanTokenWRBTC(_loanPoolToken).burnToBTC(_receiver, amount, false);
        } else {
            // Previously it directly send the loanToken to the user
            require(
                IERC20(_loanPoolToken).transfer(user, amount),
                "FeeSharingProxy::withdraw: withdrawal failed"
            );
        }

        emit UserFeeWithdrawn(msg.sender, _receiver, _loanPoolToken, amount);
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
| _maxCheckpoints | uint32 | Checkpoint index incremental. | 

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

        uint256 start = processedCheckpoints[_user][_loanPoolToken];
        uint256 end;

        /// @dev Additional bool param can't be used because of stack too deep error.
        if (_maxCheckpoints > 0) {
            /// @dev withdraw -> _getAccumulatedFees
            require(
                start < numTokenCheckpoints[_loanPoolToken],
                "FeeSharingProxy::withdrawFees: no tokens for a withdrawal"
            );
            end = _getEndOfRange(start, _loanPoolToken, _maxCheckpoints);
        } else {
            /// @dev getAccumulatedFees -> _getAccumulatedFees
            /// Don't throw error for getter invocation outside of transaction.
            if (start >= numTokenCheckpoints[_loanPoolToken]) {
                return (0, numTokenCheckpoints[_loanPoolToken]);
            }
            end = numTokenCheckpoints[_loanPoolToken];
        }

        uint256 amount = 0;
        uint256 cachedLockDate = 0;
        uint96 cachedWeightedStake = 0;
        for (uint256 i = start; i < end; i++) {
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
                "FeeSharingProxy::withdraw: checkpoint index exceeds 32 bits"
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
                "FeeSharingProxy::_writeCheckpoint: block number exceeds 32 bits"
            );
        uint32 blockTimestamp =
            safe32(
                block.timestamp,
                "FeeSharingProxy::_writeCheckpoint: block timestamp exceeds 32 bits"
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
            "FeeSharingProxy::_getTotalVoluntaryWeightedStake: vested stake exceeds total stake"
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
        address wRBTCAddress = protocol.wrbtcToken();
        require(
            wRBTCAddress != address(0),
            "FeeSharingProxy::withdrawFees: wRBTCAddress is not set"
        );

        uint256 balance = IERC20(wRBTCAddress).balanceOf(address(this));
        require(wrbtcAmount <= balance, "Insufficient balance");

        IERC20(wRBTCAddress).safeTransfer(receiver, wrbtcAmount);
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
