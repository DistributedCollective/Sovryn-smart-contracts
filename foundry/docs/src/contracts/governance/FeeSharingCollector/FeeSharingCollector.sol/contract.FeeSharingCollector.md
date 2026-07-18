# FeeSharingCollector
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/FeeSharingCollector/FeeSharingCollector.sol)

**Inherits:**
[SafeMath96](/contracts/governance/Staking/SafeMath96.sol/contract.SafeMath96.md), [IFeeSharingCollector](/contracts/governance/IFeeSharingCollector.sol/interface.IFeeSharingCollector.md), [Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md), [FeeSharingCollectorStorage](/contracts/governance/FeeSharingCollector/FeeSharingCollectorStorage.sol/contract.FeeSharingCollectorStorage.md)

This contract withdraws fees to be paid to SOV Stakers from the protocol.
Stakers call withdraw() to get their share of the fees.

Staking is not only granting voting rights, but also access to fee
sharing according to the own voting power in relation to the total. Whenever
somebody decides to collect the fees from the protocol, they get transferred
to a proxy contract which invests the funds in the lending pool and keeps
the pool tokens.
The fee sharing proxy will be set as feesController of the protocol contract.
This allows the fee sharing proxy to withdraw the fees. The fee sharing
proxy holds the pool tokens and keeps track of which user owns how many
tokens. In order to know how many tokens a user owns, the fee sharing proxy
needs to know the user’s weighted stake in relation to the total weighted
stake (aka total voting power).
Because both values are subject to change, they may be different on each fee
withdrawal. To be able to calculate a user’s share of tokens when he wants
to withdraw, we need checkpoints.
This contract is intended to be set as the protocol fee collector.
Anybody can invoke the withdrawFees function which uses
protocol.withdrawFees to obtain available fees from operations on a
certain token. These fees are deposited in the corresponding loanPool.
Also, the staking contract sends slashed tokens to this contract.
When a user calls the withdraw function, the contract transfers the fee sharing
rewards in proportion to the user’s weighted stake since the last withdrawal.
The protocol initially collects fees in all tokens.
Then the FeeSharingCollector wihtdraws fees from the protocol.
When the fees are withdrawn all the tokens except SOV will be converted to wRBTC
and then transferred to wRBTC loan pool.
For SOV, it will be directly deposited into the feeSharingCollector from the protocol.


## State Variables
### ZERO_ADDRESS

```solidity
address constant ZERO_ADDRESS = address(0);
```


### RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT

```solidity
address public constant RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT =
    address(uint160(uint256(keccak256("RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT"))));
```


## Functions
### oneTimeExecution


```solidity
modifier oneTimeExecution(bytes4 _funcSig);
```

### function

*fallback function to support rbtc transfer when unwrap the wrbtc.*


```solidity
function() external payable;
```

### initialize

*initialize function for fee sharing collector proxy*


```solidity
function initialize(address wrbtcToken, address loanWrbtcToken)
    external
    onlyOwner
    oneTimeExecution(this.initialize.selector);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`wrbtcToken`|`address`|wrbtc token address|
|`loanWrbtcToken`|`address`|address of loan token wrbtc (IWrbtc)|


### setWrbtcToken

Set the wrbtc token address of fee sharing collector.
only owner can perform this action.


```solidity
function setWrbtcToken(address newWrbtcTokenAddress) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newWrbtcTokenAddress`|`address`|The new address of the wrbtc token.|


### setLoanTokenWrbtc

Set the loan wrbtc token address of fee sharing collector.
only owner can perform this action.


```solidity
function setLoanTokenWrbtc(address newLoanTokenWrbtcAddress) public onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`newLoanTokenWrbtcAddress`|`address`|The new address of the loan wrbtc token.|


### withdrawFees

Withdraw fees for the given token:
lendingFee + tradingFee + borrowingFee
the fees (except SOV) will be converted in wRBTC form, and then will be transferred to wRBTC loan pool.
For SOV, it will be directly deposited into the feeSharingCollector from the protocol.


```solidity
function withdrawFees(address[] calldata _tokens) external;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokens`|`address[]`|array address of the token|


### withdrawFeesAMM

Update unprocessed amount of tokens

Withdraw amm fees for the given converter addresses:
protocolFee from the conversion
the fees will be converted in wRBTC form, and then will be transferred to wRBTC loan pool


```solidity
function withdrawFeesAMM(address[] memory _converters) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_converters`|`address[]`|array addresses of the converters|


### transferTokens

Update unprocessed amount of tokens

Transfer tokens to this contract.

*We just update amount of tokens here and write checkpoint in a separate methods
in order to prevent adding checkpoints too often.*


```solidity
function transferTokens(address _token, uint96 _amount) public;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_token`|`address`|Address of the token.|
|`_amount`|`uint96`|Amount to be transferred.|


### transferRBTC

Transfer tokens from msg.sender

Transfer RBTC / native tokens to this contract.

*We just write checkpoint here (based on the rbtc value that is sent) in a separate methods
in order to prevent adding checkpoints too often.*


```solidity
function transferRBTC() external payable;
```

### _addCheckpoint

Add checkpoint with accumulated amount by function invocation.


```solidity
function _addCheckpoint(address _token, uint96 _amount) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_token`|`address`|Address of the token.|
|`_amount`|`uint96`||


### _withdraw

Reset unprocessed amount of tokens to zero.

Write a regular checkpoint.


```solidity
function _withdraw(address _token, uint32 _maxCheckpoints, address _receiver)
    internal
    returns (uint256 totalAmount, uint256 endTokenCheckpoint);
```

### withdraw

Withdraw accumulated fee to the message sender.
The Sovryn protocol collects fees on every trade/swap and loan.
These fees will be distributed to SOV stakers based on their voting
power as a percentage of total voting power. Therefore, staking more
SOV and/or staking for longer will increase your share of the fees
generated, meaning you will earn more from staking.
This function will directly burnToBTC and use the msg.sender (user) as the receiver

*Prevents block gas limit hit when processing checkpoints*


```solidity
function withdraw(address _token, uint32 _maxCheckpoints, address _receiver) public nonReentrant;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_token`|`address`|RBTC dummy to fit into existing data structure or SOV. Former address of the pool token.|
|`_maxCheckpoints`|`uint32`|Maximum number of checkpoints to be processed. Must be positive value.|
|`_receiver`|`address`|The receiver of tokens or msg.sender|


### validFromCheckpointsParam

Validates if the checkpoint is payable for the user


```solidity
function validFromCheckpointsParam(TokenWithSkippedCheckpointsWithdraw[] memory _tokens, address _user) private view;
```

### validRBTCBasedTokens


```solidity
function validRBTCBasedTokens(address[] memory _tokens) private view;
```

### _withdrawStartingFromCheckpoints

Withdraw accumulated fee to the message sender/receiver.
The Sovryn protocol collects fees on every trade/swap and loan.
These fees will be distributed to SOV stakers based on their voting
power as a percentage of total voting power.
This function will directly burnToBTC and use the msg.sender (user) as the receiver

*WARNING! This function skips all the checkpoints before '_fromCheckpoint' irreversibly, use with care*


```solidity
function _withdrawStartingFromCheckpoints(
    TokenWithSkippedCheckpointsWithdraw[] memory _tokens,
    uint32 _maxCheckpoints,
    address _receiver
) internal returns (uint256 totalProcessedCheckpoints);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokens`|`TokenWithSkippedCheckpointsWithdraw[]`|Array of TokenWithSkippedCheckpointsWithdraw struct, which contains the token address, and fromCheckpoiint fromCheckpoints Skips all the checkpoints before '_fromCheckpoint' should be calculated offchain with getNextPositiveUserCheckpoint function|
|`_maxCheckpoints`|`uint32`|Maximum number of checkpoints to be processed.|
|`_receiver`|`address`|The receiver of tokens or msg.sender|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`totalProcessedCheckpoints`|`uint256`|total processed checkpoints|


### claimAllCollectedFees

*Function to wrap:
1. regular withdrawal for both rbtc & non-rbtc token
2. skipped checkpoints withdrawal for both rbtc & non-rbtc token*


```solidity
function claimAllCollectedFees(
    address[] calldata _nonRbtcTokensRegularWithdraw,
    address[] calldata _rbtcTokensRegularWithdraw,
    TokenWithSkippedCheckpointsWithdraw[] calldata _tokensWithSkippedCheckpoints,
    uint32 _maxCheckpoints,
    address _receiver
) external nonReentrant;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_nonRbtcTokensRegularWithdraw`|`address[]`|array of non-rbtc token address with no skipped checkpoints that will be withdrawn|
|`_rbtcTokensRegularWithdraw`|`address[]`|array of rbtc token address with no skipped checkpoints that will be withdrawn|
|`_tokensWithSkippedCheckpoints`|`TokenWithSkippedCheckpointsWithdraw[]`|array of rbtc & non-rbtc TokenWithSkippedCheckpointsWithdraw struct, which has skipped checkpoints that will be withdrawn|
|`_maxCheckpoints`|`uint32`||
|`_receiver`|`address`||


### _withdrawStartingFromCheckpoint

Process normal multiple withdrawal for RBTC based tokens
Process normal non-rbtc token withdrawal


```solidity
function _withdrawStartingFromCheckpoint(
    address _token,
    uint256 _fromCheckpoint,
    uint32 _maxCheckpoints,
    address _receiver
) internal returns (uint256 totalAmount, uint256 endTokenCheckpoint);
```

### _withdrawRbtcToken


```solidity
function _withdrawRbtcToken(address _token, uint32 _maxCheckpoints)
    internal
    returns (uint256 totalAmount, uint256 endTokenCheckpoint);
```

### _withdrawRbtcTokens

*will use the burned result from IWRBTC to RBTC as return total amount*

*withdraw all of the RBTC balance based on particular checkpoints
This function will withdraw RBTC balance which is passed as _token param, so it could be either of these:
- rbtc balance or
- wrbtc balance which will be unwrapped to rbtc or
- iwrbtc balance which will be unwrapped to rbtc or*


```solidity
function _withdrawRbtcTokens(address[] memory _tokens, uint32 _maxCheckpoints, address _receiver)
    internal
    returns (uint256 totalProcessedCheckpoints);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_tokens`|`address[]`|array of either RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT or wrbtc address or iwrbtc address|
|`_maxCheckpoints`|`uint32`| Maximum number of checkpoints to be processed to workaround block gas limit|
|`_receiver`|`address`|An optional tokens receiver (msg.sender used if 0)|


### _withdrawRbtcTokenStartingFromCheckpoint

*Withdraw either specific RBTC related token balance or all RBTC related tokens balances.
RBTC related here means, it could be either rbtc, wrbtc, or iwrbtc, depends on the _token param.*


```solidity
function _withdrawRbtcTokenStartingFromCheckpoint(
    address _token,
    uint256 _fromCheckpoint,
    uint32 _maxCheckpoints,
    address _receiver
) private returns (uint256 totalAmount, uint256 endTokenCheckpoint);
```

### getNextPositiveUserCheckpoint

*Returns first user's checkpoint with weighted stake > 0*


```solidity
function getNextPositiveUserCheckpoint(address _user, address _token, uint256 _startFrom, uint256 _maxCheckpoints)
    external
    view
    returns (uint256 checkpointNum, bool hasSkippedCheckpoints, bool hasFees);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|The address of the user or contract.|
|`_token`|`address`|RBTC dummy to fit into existing data structure or SOV. Former address of the pool token.|
|`_startFrom`|`uint256`|Checkpoint number to start from. If _startFrom < processedUserCheckpoints then starts from processedUserCheckpoints.|
|`_maxCheckpoints`|`uint256`|Max checkpoints to process in a row to avoid timeout error|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`checkpointNum`|`uint256`|[checkpointNum: checkpoint number where user's weighted stake > 0, hasSkippedCheckpoints, hasFees]|
|`hasSkippedCheckpoints`|`bool`||
|`hasFees`|`bool`||


### _getNextPositiveUserCheckpoint

*Returns first user's checkpoint with weighted stake > 0*


```solidity
function _getNextPositiveUserCheckpoint(address _user, address _token, uint256 _startFrom, uint256 _maxCheckpoints)
    internal
    view
    returns (uint256 checkpointNum, bool hasSkippedCheckpoints, bool hasFees);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|The address of the user or contract.|
|`_token`|`address`|RBTC dummy to fit into existing data structure or SOV. Former address of the pool token.|
|`_startFrom`|`uint256`|Checkpoint number to start from. If _startFrom < processedUserCheckpoints then starts from processedUserCheckpoints.|
|`_maxCheckpoints`|`uint256`|Max checkpoints to process in a row to avoid timeout error|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`checkpointNum`|`uint256`|[checkpointNum: checkpoint number where user's weighted stake > 0, hasSkippedCheckpoints, hasFees]|
|`hasSkippedCheckpoints`|`bool`||
|`hasFees`|`bool`||


### getAccumulatedFees

Get the accumulated loan pool fee of the message sender.


```solidity
function getAccumulatedFees(address _user, address _token) public view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|The address of the user or contract.|
|`_token`|`address`|RBTC dummy to fit into existing data structure or SOV. Former address of the pool token.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The accumulated fee for the message sender.|


### getAccumulatedFeesForCheckpointsRange

Get the accumulated fee rewards for the message sender for a checkpoints range

*This function is required to keep consistent with caching of weighted voting power when claiming fees*


```solidity
function getAccumulatedFeesForCheckpointsRange(
    address _user,
    address _token,
    uint256 _startFrom,
    uint32 _maxCheckpoints
) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|The address of a user (staker) or contract.|
|`_token`|`address`|RBTC dummy to fit into existing data structure or SOV. Former address of the pool token.|
|`_startFrom`|`uint256`|Checkpoint to start calculating fees from.|
|`_maxCheckpoints`|`uint32`|maxCheckpoints to get accumulated fees for the _user|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|The accumulated fees rewards for the _user in the given checkpoints interval: [_startFrom, _startFrom + maxCheckpoints].|


### getAllUserFeesPerMaxCheckpoints

*Get all user fees reward per maxCheckpoint starting from latest processed checkpoint*

*e.g: Total user checkpoint for the particualar token = 300,
when we call this function with 50 maxCheckpoint, it will return 6 fee values in array form.
if there is no more fees, it will return empty array.*


```solidity
function getAllUserFeesPerMaxCheckpoints(address _user, address _token, uint256 _startFrom, uint32 _maxCheckpoints)
    external
    view
    returns (uint256[] memory fees);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|The address of a user (staker) or contract.|
|`_token`|`address`|RBTC dummy to fit into existing data structure or SOV. Former address of the pool token.|
|`_startFrom`|`uint256`|Checkpoint to start calculating fees from.|
|`_maxCheckpoints`|`uint32`|maxCheckpoints to get accumulated fees for the _user|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`fees`|`uint256[]`|The next checkpoint num which is the starting point to fetch all of the fees, array of calculated fees.|


### _getAccumulatedFees

Gets accumulated fees for a user starting from a given checkpoint


```solidity
function _getAccumulatedFees(address _user, address _token, uint256 _startFrom, uint32 _maxCheckpoints)
    internal
    view
    returns (uint256 feesAmount, uint256 endCheckpoint);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|Address of the user's account.|
|`_token`|`address`|RBTC dummy to fit into existing data structure or SOV. Former address of the pool token.|
|`_startFrom`|`uint256`|Checkpoint num to start calculations from|
|`_maxCheckpoints`|`uint32`|Max checkpoints to process at once to fit into block gas limit|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`feesAmount`|`uint256`|- accumulated fees amount|
|`endCheckpoint`|`uint256`|- last checkpoint of fees calculation|


### _getEndOfRange

Withdrawal should only be possible for blocks which were already
mined. If the fees are withdrawn in the same block as the user withdrawal
they are not considered by the withdrawing logic (to avoid inconsistencies).

*We need to use "checkpoint.blockNumber - 1" here to calculate weighted stake
For the same block like we did for total voting power in _writeTokenCheckpoint*


```solidity
function _getEndOfRange(uint256 _start, address _token, uint32 _maxCheckpoints) internal view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_start`|`uint256`|Start of the range.|
|`_token`|`address`|RBTC dummy to fit into existing data structure or SOV. Former address of a pool token.|
|`_maxCheckpoints`|`uint32`|Checkpoint index incremental.|


### _writeTokenCheckpoint

Write a regular checkpoint w/ the foolowing data:
block number, block timestamp, total weighted stake and num of tokens.

*All checkpoints will be processed (only for getter outside of a transaction).*

*Withdrawal should only be possible for blocks which were already mined.*


```solidity
function _writeTokenCheckpoint(address _token, uint96 _numTokens) internal;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_token`|`address`|The pool token address.|
|`_numTokens`|`uint96`|The amount of pool tokens.|


### _getVoluntaryWeightedStake

Queries the total weighted stake and the weighted stake of vesting contracts and returns the difference


```solidity
function _getVoluntaryWeightedStake(uint32 blockNumber, uint256 timestamp)
    internal
    view
    returns (uint96 totalWeightedStake);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`blockNumber`|`uint32`|the blocknumber|
|`timestamp`|`uint256`|the timestamp|


### addWhitelistedConverterAddress

*Whitelisting converter address.*


```solidity
function addWhitelistedConverterAddress(address converterAddress) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`converterAddress`|`address`|converter address to be whitelisted.|


### removeWhitelistedConverterAddress

*Removing converter address from whitelist.*


```solidity
function removeWhitelistedConverterAddress(address converterAddress) external onlyOwner;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`converterAddress`|`address`|converter address to be removed from whitelist.|


### getWhitelistedConverterList

Getter to query all of the whitelisted converter.


```solidity
function getWhitelistedConverterList() external view returns (address[] memory converterList);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`converterList`|`address[]`|All of the whitelisted converter list.|


### _validateWhitelistedConverter

*validate array of given address whether is whitelisted or not.*

*if one of them is not whitelisted, then revert.*


```solidity
function _validateWhitelistedConverter(address[] memory converterAddresses) private view;
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`converterAddresses`|`address[]`|array of converter addresses.|


### withdrawWRBTC


```solidity
function withdrawWRBTC(address receiver, uint256 wrbtcAmount) external onlyOwner;
```

### recoverIncorrectAllocatedFees

*This function is dedicated to recover the wrong fee allocation for the 4 year vesting contracts.
This function can only be called once
The affected tokens to be withdrawn
1. RBTC
2. ZUSD
3. SOV
The amount for all of the tokens above is hardcoded
The withdrawn tokens will be sent to the owner.*


```solidity
function recoverIncorrectAllocatedFees()
    external
    oneTimeExecution(this.recoverIncorrectAllocatedFees.selector)
    onlyOwner;
```

### getAccumulatedRBTCFeeBalances

*view function that calculate the total RBTC that includes:
- RBTC
- WRBTC
- iWRBTC * iWRBTC.tokenPrice()*


```solidity
function getAccumulatedRBTCFeeBalances(address _user) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|address of the user.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|rbtc balance of the given user's address.|


### _getRBTCBalances

*private function that responsible to calculate the user's token that has RBTC as underlying token (rbtc, wrbtc, iWrbtc)*


```solidity
function _getRBTCBalances(address _user, uint32 _maxCheckpoints)
    private
    view
    returns (
        uint256 _rbtcAmount,
        uint256 _wrbtcAmount,
        uint256 _iWrbtcAmount,
        uint256 _endRBTC,
        uint256 _endWRBTC,
        uint256 _endIWRBTC
    );
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_user`|`address`|address of the user.|
|`_maxCheckpoints`|`uint32`|maximum checkpoints.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_rbtcAmount`|`uint256`|rbtc amount|
|`_wrbtcAmount`|`uint256`|wrbtc amount|
|`_iWrbtcAmount`|`uint256`|iWrbtc (wrbtc lending pool token) amount * token price|
|`_endRBTC`|`uint256`|end time of accumulated fee calculation for rbtc|
|`_endWRBTC`|`uint256`|end time of accumulated fee calculation for wrbtc|
|`_endIWRBTC`|`uint256`|end time of accumulated fee calculation for iwrbtc|


### _getRBTCBalance

*private function that responsible to calculate the user's token that has RBTC as underlying token (rbtc, wrbtc, iWrbtc)*


```solidity
function _getRBTCBalance(address _token, address _user, uint32 _maxCheckpoints)
    internal
    view
    returns (uint256 _tokenAmount, uint256 _endToken);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_token`|`address`|either RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT or wrbtc address or iwrbtc address|
|`_user`|`address`|address of the user.|
|`_maxCheckpoints`|`uint32`|maximum checkpoints.|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`_tokenAmount`|`uint256`|token (rbtc, or wrbtc, or iwrbtc) amount|
|`_endToken`|`uint256`|end time of accumulated fee calculation for token (rbtc, or wrbtc, or iwrbtc )|


### numTokenCheckpoints

*This getter function `numTokenCheckpoints` is added for backwards compatibility
broken when renamed `numTokenCheckpoints` storage variable to `totalTokenCheckpoints`.*


```solidity
function numTokenCheckpoints(address _token) external view returns (uint256);
```
**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`_token`|`address`|token address to get checkpoints for|

**Returns**

|Name|Type|Description|
|----|----|-----------|
|`<none>`|`uint256`|Total token checkpoints|


## Events
### FeeWithdrawnInRBTC
Deprecated event after the unification between wrbtc & rbtc


```solidity
event FeeWithdrawnInRBTC(address indexed sender, uint256 amount);
```

### TokensTransferred
An event emitted when tokens transferred.


```solidity
event TokensTransferred(address indexed sender, address indexed token, uint256 amount);
```

### CheckpointAdded
An event emitted when checkpoint added.


```solidity
event CheckpointAdded(address indexed sender, address indexed token, uint256 amount);
```

### UserFeeWithdrawn
An event emitted when user fee get withdrawn.


```solidity
event UserFeeWithdrawn(address indexed sender, address indexed receiver, address indexed token, uint256 amount);
```

### UserFeeProcessedNoWithdraw
An event emitted when user fee get withdrawn.


```solidity
event UserFeeProcessedNoWithdraw(
    address indexed sender, address indexed token, uint256 prevProcessedCheckpoints, uint256 newProcessedCheckpoints
);
```

### FeeAMMWithdrawn
An event emitted when fee from AMM get withdrawn.


```solidity
event FeeAMMWithdrawn(address indexed sender, address indexed converter, uint256 amount);
```

**Parameters**

|Name|Type|Description|
|----|----|-----------|
|`sender`|`address`|sender who initiate the withdrawn amm fees.|
|`converter`|`address`|the converter address.|
|`amount`|`uint256`|total amount of fee (Already converted to WRBTC).|

### WhitelistedConverter
An event emitted when converter address has been registered to be whitelisted.


```solidity
event WhitelistedConverter(address indexed sender, address converter);
```

### UnwhitelistedConverter
An event emitted when converter address has been removed from whitelist.


```solidity
event UnwhitelistedConverter(address indexed sender, address converter);
```

### RBTCWithdrawn

```solidity
event RBTCWithdrawn(address indexed sender, address indexed receiver, uint256 amount);
```

### SetWrbtcToken

```solidity
event SetWrbtcToken(address indexed sender, address indexed oldWrbtcToken, address indexed newWrbtcToken);
```

### SetLoanTokenWrbtc

```solidity
event SetLoanTokenWrbtc(address indexed sender, address indexed oldLoanTokenWrbtc, address indexed newLoanTokenWrbtc);
```

