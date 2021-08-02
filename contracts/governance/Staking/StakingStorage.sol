pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../IFeeSharingProxy.sol";

/**
 * @title Staking Storage contact.
 * @notice Just the storage part of stacking contract, no functions,
 * only constant, variables and required structures (mappings).
 * Used by StackingProxy and Checkpoints contracts.
 *
 * What is SOV staking?
 * The purpose of the SOV token is to provide a pseudonymous,
 * censorship-resistant mechanism for governing the parameters of the Sovryn
 * protocol, while aligning the incentives of protocol governors with the
 * long-term success of the protocol. Any SOV token holder can choose to
 * stake (lock up) their tokens for a fixed period of time in return for
 * voting rights in the Bitocracy. Stakers are further incentivised through
 * fee and slashing rewards.
 * */
contract StakingStorage is Ownable {
	/// @notice 2 weeks in seconds.
	uint256 constant TWO_WEEKS = 1209600;

	/// @notice The maximum possible voting weight before adding +1 (actually 10, but need 9 for computation).
	uint96 public constant MAX_VOTING_WEIGHT = 9;

	/// @notice weight is multiplied with this factor (for allowing decimals, like 1.2x).
	/// @dev MAX_VOTING_WEIGHT * WEIGHT_FACTOR needs to be < 792, because there are 100,000,000 SOV with 18 decimals
	uint96 public constant WEIGHT_FACTOR = 10;

	/// @notice The maximum duration to stake tokens for.
	uint256 public constant MAX_DURATION = 1092 days;

	/// @notice The maximum duration ^2
	uint96 constant MAX_DURATION_POW_2 = 1092 * 1092;

	/// @notice Default weight scaling.
	uint96 constant DEFAULT_WEIGHT_SCALING = 3;

	/// @notice Range for weight scaling.
	uint96 constant MIN_WEIGHT_SCALING = 1;
	uint96 constant MAX_WEIGHT_SCALING = 9;

	/// @notice The timestamp of contract creation. Base for the staking period calculation.
	uint256 public kickoffTS;

	string name = "SOVStaking";

	/// @notice The token to be staked.
	IERC20 public SOVToken;

	/// @notice A record of each accounts delegate.
	mapping(address => mapping(uint256 => address)) public delegates;

	/// @notice If this flag is set to true, all tokens are unlocked immediately.
	bool public allUnlocked = false;

	/// @notice The EIP-712 typehash for the contract's domain.
	bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

	/// @notice The EIP-712 typehash for the delegation struct used by the contract.
	bytes32 public constant DELEGATION_TYPEHASH = keccak256("Delegation(address delegatee,uint256 lockDate,uint256 nonce,uint256 expiry)");

	/// @notice Used for stake migrations to a new staking contract with a different storage structure.
	address public newStakingContract;

	/*************************** Checkpoints *******************************/

	/// @notice A checkpoint for marking the stakes from a given block
	struct Checkpoint {
		uint32 fromBlock;
		uint96 stake;
	}

	/// @notice A record of tokens to be unstaked at a given time in total.
	/// For total voting power computation. Voting weights get adjusted bi-weekly.
	/// @dev totalStakingCheckpoints[date][index] is a checkpoint.
	mapping(uint256 => mapping(uint32 => Checkpoint)) public totalStakingCheckpoints;

	/// @notice The number of total staking checkpoints for each date.
	/// @dev numTotalStakingCheckpoints[date] is a number.
	mapping(uint256 => uint32) public numTotalStakingCheckpoints;

	/// @notice A record of tokens to be unstaked at a given time which were delegated to a certain address.
	/// For delegatee voting power computation. Voting weights get adjusted bi-weekly.
	/// @dev delegateStakingCheckpoints[delegatee][date][index] is a checkpoint.
	mapping(address => mapping(uint256 => mapping(uint32 => Checkpoint))) public delegateStakingCheckpoints;

	/// @notice The number of total staking checkpoints for each date per delegate.
	/// @dev numDelegateStakingCheckpoints[delegatee][date] is a number.
	mapping(address => mapping(uint256 => uint32)) public numDelegateStakingCheckpoints;

	/// @notice A record of tokens to be unstaked at a given time which per user address (address -> lockDate -> stake checkpoint)
	/// @dev userStakingCheckpoints[user][date][index] is a checkpoint.
	mapping(address => mapping(uint256 => mapping(uint32 => Checkpoint))) public userStakingCheckpoints;

	/// @notice The number of total staking checkpoints for each date per user.
	/// @dev numUserStakingCheckpoints[user][date] is a number.
	mapping(address => mapping(uint256 => uint32)) public numUserStakingCheckpoints;

	/// @notice A record of states for signing / validating signatures
	/// @dev nonces[user] is a number.
	mapping(address => uint256) public nonces;

	/*************************** Slashing *******************************/

	/// @notice the address of FeeSharingProxy contract, we need it for unstaking with slashing.
	IFeeSharingProxy public feeSharing;

	/// @notice used for weight scaling when unstaking with slashing.
	uint96 public weightScaling = DEFAULT_WEIGHT_SCALING;

	/// @notice List of vesting contracts, tokens for these contracts won't be slashed if unstaked by governance.
	/// @dev vestingWhitelist[contract] is true/false.
	mapping(address => bool) public vestingWhitelist;

	/// @dev user => flag whether user has admin role.
	/// @dev multisig should be an admin, admin can invoke only governanceWithdrawVesting function,
	/// 	this function works only with Team Vesting contracts
	mapping(address => bool) public admins;

	/// @dev vesting contract code hash => flag whether it's registered code hash
	mapping(bytes32 => bool) public vestingCodeHashes;

	/// @notice A record of tokens to be unstaked from vesting contract at a given time (lockDate -> vest checkpoint)
	/// @dev vestingCheckpoints[date][index] is a checkpoint.
	mapping(uint256 => mapping(uint32 => Checkpoint)) public vestingCheckpoints;

	/// @notice The number of total vesting checkpoints for each date.
	/// @dev numVestingCheckpoints[date] is a number.
	mapping(uint256 => uint32) public numVestingCheckpoints;
}
