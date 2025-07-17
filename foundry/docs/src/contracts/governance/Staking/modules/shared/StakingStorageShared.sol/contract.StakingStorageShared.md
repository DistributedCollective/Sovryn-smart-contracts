# StakingStorageShared
[Git Source](https://github.com/DistributedCollective/Sovryn-smart-contracts/blob/94f13d57265df5aa5e3e27b26f74b7e829502d36/contracts/governance/Staking/modules/shared/StakingStorageShared.sol)

**Inherits:**
[Ownable](/contracts/openzeppelin/Ownable.sol/contract.Ownable.md)

Just the storage part of stacking contract, no functions,
only constant, variables and required structures (mappings).
Used by StackingProxy and Checkpoints contracts.
What is SOV staking?
The purpose of the SOV token is to provide a pseudonymous,
censorship-resistant mechanism for governing the parameters of the Sovryn
protocol, while aligning the incentives of protocol governors with the
long-term success of the protocol. Any SOV token holder can choose to
stake (lock up) their tokens for a fixed period of time in return for
voting rights in the Bitocracy. Stakers are further incentivised through
fee and slashing rewards.


## State Variables
### TWO_WEEKS
2 weeks in seconds.


```solidity
uint256 constant TWO_WEEKS = 1209600;
```


### MAX_VOTING_WEIGHT
The maximum possible voting weight before adding +1 (actually 10, but need 9 for computation).


```solidity
uint96 public constant MAX_VOTING_WEIGHT = 9;
```


### WEIGHT_FACTOR
weight is multiplied with this factor (for allowing decimals, like 1.2x).

*MAX_VOTING_WEIGHT * WEIGHT_FACTOR needs to be < 792, because there are 100,000,000 SOV with 18 decimals*


```solidity
uint96 public constant WEIGHT_FACTOR = 10;
```


### MAX_DURATION
The maximum duration to stake tokens for.


```solidity
uint256 public constant MAX_DURATION = 1092 days;
```


### MAX_DURATION_POW_2
The maximum duration ^2


```solidity
uint96 constant MAX_DURATION_POW_2 = 1092 * 1092;
```


### DEFAULT_WEIGHT_SCALING
Default weight scaling.


```solidity
uint96 constant DEFAULT_WEIGHT_SCALING = 3;
```


### MIN_WEIGHT_SCALING
Range for weight scaling.


```solidity
uint96 constant MIN_WEIGHT_SCALING = 1;
```


### MAX_WEIGHT_SCALING

```solidity
uint96 constant MAX_WEIGHT_SCALING = 9;
```


### kickoffTS
The timestamp of contract creation. Base for the staking period calculation.


```solidity
uint256 public kickoffTS;
```


### name

```solidity
string name = "SOVStaking";
```


### SOVToken
The token to be staked.


```solidity
IERC20 public SOVToken;
```


### delegates
A record of each accounts delegate.


```solidity
mapping(address => mapping(uint256 => address)) public delegates;
```


### allUnlocked
If this flag is set to true, all tokens are unlocked immediately.


```solidity
bool public allUnlocked = false;
```


### DOMAIN_TYPEHASH
The EIP-712 typehash for the contract's domain.


```solidity
bytes32 public constant DOMAIN_TYPEHASH =
    keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");
```


### DELEGATION_TYPEHASH
The EIP-712 typehash for the delegation struct used by the contract.


```solidity
bytes32 public constant DELEGATION_TYPEHASH =
    keccak256("Delegation(address delegatee,uint256 lockDate,uint256 nonce,uint256 expiry)");
```


### newStakingContract
Used for stake migrations to a new staking contract with a different storage structure.


```solidity
address public newStakingContract;
```


### totalStakingCheckpoints
A record of tokens to be unstaked at a given time in total.
For total voting power computation. Voting weights get adjusted bi-weekly.

*totalStakingCheckpoints[date][index] is a checkpoint.*


```solidity
mapping(uint256 => mapping(uint32 => Checkpoint)) public totalStakingCheckpoints;
```


### numTotalStakingCheckpoints
The number of total staking checkpoints for each date.

*numTotalStakingCheckpoints[date] is a number.*


```solidity
mapping(uint256 => uint32) public numTotalStakingCheckpoints;
```


### delegateStakingCheckpoints
A record of tokens to be unstaked at a given time which were delegated to a certain address.
For delegatee voting power computation. Voting weights get adjusted bi-weekly.

*delegateStakingCheckpoints[delegatee][date][index] is a checkpoint.*


```solidity
mapping(address => mapping(uint256 => mapping(uint32 => Checkpoint))) public delegateStakingCheckpoints;
```


### numDelegateStakingCheckpoints
The number of total staking checkpoints for each date per delegate.

*numDelegateStakingCheckpoints[delegatee][date] is a number.*


```solidity
mapping(address => mapping(uint256 => uint32)) public numDelegateStakingCheckpoints;
```


### userStakingCheckpoints
A record of tokens to be unstaked at a given time which per user address (address -> lockDate -> stake checkpoint)

*userStakingCheckpoints[user][date][index] is a checkpoint.*


```solidity
mapping(address => mapping(uint256 => mapping(uint32 => Checkpoint))) public userStakingCheckpoints;
```


### numUserStakingCheckpoints
The number of total staking checkpoints for each date per user.

*numUserStakingCheckpoints[user][date] is a number.*


```solidity
mapping(address => mapping(uint256 => uint32)) public numUserStakingCheckpoints;
```


### nonces
A record of states for signing / validating signatures

*nonces[user] is a number.*


```solidity
mapping(address => uint256) public nonces;
```


### feeSharing
Slashing ******************************

the address of FeeSharingCollectorProxy contract, we need it for unstaking with slashing.


```solidity
IFeeSharingCollector public feeSharing;
```


### weightScaling
used for weight scaling when unstaking with slashing.


```solidity
uint96 public weightScaling = DEFAULT_WEIGHT_SCALING;
```


### vestingWhitelist
List of vesting contracts, tokens for these contracts won't be slashed if unstaked by governance.

*vestingWhitelist[contract] is true/false.*


```solidity
mapping(address => bool) public vestingWhitelist;
```


### admins
*user => flag whether user has admin role.*

*multisig should be an admin, admin can invoke only governanceWithdrawVesting function,
this function works only with Team Vesting contracts*


```solidity
mapping(address => bool) public admins;
```


### vestingCodeHashes
*vesting contract code hash => flag whether it's registered code hash*


```solidity
mapping(bytes32 => bool) public vestingCodeHashes;
```


### vestingCheckpoints
A record of tokens to be unstaked from vesting contract at a given time (lockDate -> vest checkpoint)

*vestingCheckpoints[date][index] is a checkpoint.*


```solidity
mapping(uint256 => mapping(uint32 => Checkpoint)) public vestingCheckpoints;
```


### numVestingCheckpoints
The number of total vesting checkpoints for each date.

*numVestingCheckpoints[date] is a number.*


```solidity
mapping(uint256 => uint32) public numVestingCheckpoints;
```


### vestingRegistryLogic
vesting registry contract


```solidity
IVestingRegistry public vestingRegistryLogic;
```


### pausers
*user => flag whether user has pauser role.*


```solidity
mapping(address => bool) public pausers;
```


### paused
*Staking contract is paused*


```solidity
bool public paused;
```


### frozen
*Staking contract is frozen*


```solidity
bool public frozen;
```


### maxVestingWithdrawIterations
*max iterations that can be supported in 1 tx for the withdrawal*


```solidity
uint256 internal maxVestingWithdrawIterations;
```


## Functions
### constructor


```solidity
constructor() internal;
```

## Structs
### Checkpoint
Checkpoints ******************************

A checkpoint for marking the stakes from a given block


```solidity
struct Checkpoint {
    uint32 fromBlock;
    uint96 stake;
}
```

