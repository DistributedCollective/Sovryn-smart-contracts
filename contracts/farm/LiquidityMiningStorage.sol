pragma solidity 0.5.17;

import "../openzeppelin/ERC20.sol";
import "../openzeppelin/SafeERC20.sol";
import "../openzeppelin/SafeMath.sol";
import "../locked/ILockedSOV.sol";
import "../utils/AdminRole.sol";

contract LiquidityMiningStorage is AdminRole {
	// Info of each user.
	struct UserInfo {
		uint256 amount; // How many pool tokens the user has provided.
		mapping(address => UserReward) rewards; // Mapping between reward toekens and the user rewards.
	}

	struct UserReward {
		uint256 rewardDebt; // Reward debt. See explanation below.
		uint256 accumulatedReward; //Reward that's ready to be transferred
		//
		// We do some fancy math here. Basically, any point in time, the amount of reward tokens
		// entitled to a user but is accumulated to be distributed is:
		//
		//   accumulated reward = (user.amount * pool.accumulatedRewardPerShare) - user.rewardDebt
		//
		// Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
		//   1. The pool's `accumulatedRewardPerShare` (and `lastRewardBlock`) gets updated.
		//   2. User receives the accumulated reward sent to his/her address.
		//   3. User's `amount` gets updated.
		//   4. User's `rewardDebt` gets updated.
	}

	// Info of each pool.
	struct PoolInfo {
		IERC20 poolToken; // Address of LP token contract.
		address[] rewardTokens;
	}

	// Info about each token to be rewarded to different stakers
	struct RewardToken {
		// SVR tokens created per block.
		uint256 rewardTokensPerBlock;
		// The block number when reward token mining starts.
		uint256 startBlock;
		// Block number when reward token period ends.
		uint256 endBlock;
		// Total allocation points. Must be the sum of all allocation points in all pools.
		uint256 totalAllocationPoint;
		// Total balance this contract should have to handle withdrawal for all users
		uint256 totalUsersBalance;
	}

	struct PoolInfoRewardToken {
		uint96 allocationPoint; // How many allocation points assigned to this pool. Amount of reward tokens to distribute per block.
		uint256 lastRewardBlock; // Last block number that reward tokens distribution occurs.
		uint256 accumulatedRewardPerShare; // Accumulated amount of reward tokens per share, times 1e12. See below.
	}

	// FIXME: Review this state variable
	//Wrapper contract which will be a proxy between user and LM
	address public wrapper;

	// TODO: check if it's needed or it can just work with an array of addresses
	// Info of each pool.
	PoolInfo[] public poolInfoList;

	// Mapping pool token address => pool id
	mapping(address => uint256) poolIdList;

	// Mapping reward token address => pool info
	mapping(address => RewardToken) rewardTokensMap;

	// Mapping to link a reward pool to a reward token
	// poolId => rewardTokenAddress => PoolInfoRewardToken
	mapping(uint256 => mapping(address => PoolInfoRewardToken)) poolInfoRewardTokensMap;

	// Info of each user that stakes LP tokens.
	mapping(uint256 => mapping(address => UserInfo)) public userInfoMap;

	/// FIXME: This needs to be moved to a separate contract
	/// @dev The locked vault contract to deposit LP's rewards into.
	ILockedSOV public lockedSOV;

	/// FIXME: This needs to be moved somewhere else
	// The % which determines how much will be unlocked immediately.
	/// @dev 10000 is 100%
	uint256 public unlockedImmediatelyPercent;
}
