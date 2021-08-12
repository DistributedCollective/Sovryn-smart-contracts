pragma solidity ^0.5.17;

import "./StakingRewardsStorage.sol";
import "../../openzeppelin/Initializable.sol";
import "../../openzeppelin/SafeMath.sol";
import "../../openzeppelin/Address.sol";

/**
 * @title Staking Rewards Contract.
 * @notice This is a trial incentive program.
 * In this, the SOV emitted and becoming liquid from the Adoption Fund could be utilized
 * to offset the higher APY's offered for Liquidity Mining events.
 * Vesting contract stakes are excluded from these rewards.
 * Only wallets which have staked previously liquid SOV are eligible for these rewards.
 * Tokenholders who stake their SOV receive staking rewards, a pro-rata share
 * of the revenue that the platform generates from various transaction fees
 * plus revenues from stakers who have a portion of their SOV slashed for
 * early unstaking.
 * */
contract StakingRewards is StakingRewardsStorage, Initializable {
	using SafeMath for uint256;

	/// @notice Emitted when SOV is withdrawn
	/// @param receiver The address which recieves the SOV
	/// @param amount The amount withdrawn from the Smart Contract
	event RewardWithdrawn(address indexed receiver, uint256 amount);

	/**
	 * @notice Replacement of constructor by initialize function for Upgradable Contracts
	 * This function will be called only once by the owner.
	 * @param _SOV SOV token address
	 * @param _staking StakingProxy address should be passed
	 * */
	function initialize(address _SOV, IStaking _staking) external onlyOwner initializer {
		require(_SOV != address(0), "Invalid SOV Address.");
		require(Address.isContract(_SOV), "_SOV not a contract");
		SOV = IERC20(_SOV);
		staking = _staking;
		startTime = staking.timestampToLockDate(block.timestamp);
		setMaxDuration(15 * TWO_WEEKS);
	}

	/**
	 * @notice Stops the current rewards program.
	 * @dev All stakes existing on the contract at the point in time of
	 * cancellation continue accruing rewards until the end of the staking
	 * period being rewarded
	 * */
	function stop() external onlyOwner {
		require(stopBlock == 0, "Already stopped");
		stopBlock = _getBlockNumber();
	}

	/**
	 * @notice Sets the max duration
	 * @dev Rewards can be collected for a maximum duration at a time. This
	 * is to avoid Block Gas Limit failures. Setting it zero would mean that it will loop
	 * through the entire duration since the start of rewards program.
	 * It should ideally be set to a value, for which the rewards can be easily processed.
	 * @param _duration Max duration for which rewards can be collected at a go (in seconds)
	 * */
	function setMaxDuration(uint256 _duration) public onlyOwner {
		maxDuration = _duration;
	}

	/**
	 * @notice Collect rewards
	 * @dev User calls this function to collect SOV staking rewards as per the SIP-0024 program.
	 * The weighted stake is calculated using getPriorWeightedStake. Block number sent to the functon
	 * must be a finalised block, hence we deduct 1 from the current block. User is only allowed to withdraw
	 * after intervals of 14 days.
	 * */
	function collectReward() external {
		uint256 withdrawalTime;
		uint256 amount;
		(withdrawalTime, amount) = getStakerCurrentReward(true);
		require(withdrawalTime > 0 && amount > 0, "no valid reward");
		withdrawals[msg.sender] = withdrawalTime;
		_payReward(msg.sender, amount);
	}

	/**
	 * @notice Internal function to calculate weighted stake
	 * @dev If the rewards program is stopped, the user will still continue to
	 * earn till the end of staking period based on the stop block.
	 * @param _staker Staker address
	 * @param _block Last finalised block
	 * @param _date The date to compute prior weighted stakes
	 * @return The weighted stake
	 * */
	function _computeRewardForDate(
		address _staker,
		uint256 _block,
		uint256 _date
	) internal view returns (uint256 weightedStake) {
		weightedStake = staking.getPriorWeightedStake(_staker, _block, _date);
		if (stopBlock > 0) {
			uint256 previousWeightedStake = staking.getPriorWeightedStake(_staker, stopBlock, _date);
			if (previousWeightedStake < weightedStake) {
				weightedStake = previousWeightedStake;
			}
		}
	}

	/**
	 * @notice Internal function to pay rewards
	 * @dev Base rate is annual, but we pay interest for 14 days,
	 * which is 1/26 of one staking year (1092 days)
	 * @param _staker User address
	 * @param amount the reward amount
	 * */
	function _payReward(address _staker, uint256 amount) internal {
		require(SOV.balanceOf(address(this)) >= amount, "not enough funds to reward user");
		claimedBalances[_staker] = claimedBalances[_staker].add(amount);
		_transferSOV(_staker, amount);
	}

	/**
	 * @notice Withdraws all token from the contract by Multisig.
	 * @param _receiverAddress The address where the tokens has to be transferred.
	 */
	function withdrawTokensByOwner(address _receiverAddress) external onlyOwner {
		uint256 value = SOV.balanceOf(address(this));
		_transferSOV(_receiverAddress, value);
	}

	/**
	 * @notice transfers SOV tokens to given address
	 * @param _receiver the address of the SOV receiver
	 * @param _amount the amount to be transferred
	 */
	function _transferSOV(address _receiver, uint256 _amount) internal {
		require(_amount != 0, "amount invalid");
		require(SOV.transfer(_receiver, _amount), "transfer failed");
		emit RewardWithdrawn(_receiver, _amount);
	}

	/**
	 * @notice Get staker's current accumulated reward
	 * @dev The collectReward() function internally calls this function to calculate reward amount
	 * @param considerMaxDuration True: Runs for the maximum duration - used in tx not to run out of gas
	 * False - to query total rewards
	 * @return The timestamp of last withdrawal
	 * @return The accumulated reward
	 */
	function getStakerCurrentReward(bool considerMaxDuration) public view returns (uint256 lastWithdrawalInterval, uint256 amount) {
		uint256 weightedStake;
		uint256 lastFinalisedBlock = _getBlockNumber() - 1;
		uint256 currentTS = block.timestamp;
		uint256 addedMaxDuration;
		address staker = msg.sender;
		uint256 referenceBlock;

		uint256 lastStakingInterval = staking.timestampToLockDate(currentTS);
		lastWithdrawalInterval = withdrawals[staker] > 0 ? withdrawals[staker] : startTime;
		if (lastStakingInterval < lastWithdrawalInterval) return (0, 0);

		if (considerMaxDuration) addedMaxDuration = lastWithdrawalInterval.add(maxDuration);
		uint256 duration =
			considerMaxDuration && (addedMaxDuration < currentTS) ? staking.timestampToLockDate(addedMaxDuration) : lastStakingInterval;

		for (uint256 i = lastWithdrawalInterval; i < duration; i += TWO_WEEKS) {
			referenceBlock = lastFinalisedBlock.sub(((currentTS.sub(i)).div(30)));
			weightedStake = weightedStake.add(_computeRewardForDate(staker, referenceBlock, i));
		}

		if (weightedStake == 0) return (0, 0);
		lastWithdrawalInterval = duration;
		amount = weightedStake.mul(BASE_RATE).div(DIVISOR);
	}

	/**
	 * @notice Determine the current Block Number
	 * @dev This is segregated from the _getPriorUserStakeByDate function to better test
	 * advancing blocks functionality using Mock Contracts
	 * */
	function _getBlockNumber() internal view returns (uint256) {
		return block.number;
	}
}
