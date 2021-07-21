pragma solidity ^0.5.17;

import "./StakingRewardsStorage.sol";
import "../../openzeppelin/Initializable.sol";
import "../../openzeppelin/SafeMath.sol";

/**
 * @title Staking Rewards contract.
 * @notice This is a trial incentive program
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

	event SOVWithdrawn(address indexed receiver, uint256 amount);

	/**
	 * @notice Replace constructor with initialize function for Upgradable Contracts
	 * This function will be called only once by the owner
	 * */
	function initialize(address _SOV, IStaking _staking) public onlyOwner initializer {
		require(_SOV != address(0), "Invalid SOV Address.");
		SOV = IERC20(_SOV);
		staking = _staking;
		startTime = block.timestamp;
	}

	/**
	 * @notice Stops the current rewards program.
	 * @dev All stakes existing on the contract at the point in time of
	 * cancellation continue accruing rewards until the end of the staking
	 * period being rewarded
	 * */
	function stop() public onlyOwner {
		stopBlock = block.number;
	}

	/**
	 * @notice Sets the base rate and divisor
	 * @dev Base rate and divisor is used to calculate the rewards. The initial base
	 * rate at the start of SIP-0024 is 29.75%. Base rate is annual
	 * but we pay interest for 14 days, which is 1/26 of one staking year (1092 days)
	 * @param _rate the base rate - it is the maximum interest rate(APY)
	 * @param _divisor the amount to be transferred
	 * */
	function setBaseRate(uint256 _rate, uint256 _divisor) external onlyOwner {
		baseRate = _rate;
		divisor = _divisor;
	}

	/**
	 * @notice Collect rewards
	 * @dev User calls this function to collect rewards
	 * */
	function collectReward() public {
		uint256 weightedStake;
		if (withdrawls[msg.sender] == 0) withdrawls[msg.sender] = startTime;
		for (uint256 i = withdrawls[msg.sender]; i < block.timestamp; i += TWO_WEEKS) {
			weightedStake = weightedStake.add(_computeRewardForDate(msg.sender, block.number - 1, i));
		}
		bool success = _payReward(msg.sender, weightedStake);
		if(success) withdrawls[msg.sender] = block.timestamp;
	}

	/**
	 * @notice Internal function to calculate weighted stake
	 * @dev If the rewards program is stopped, the user will still continue to
	 * earn till the end of staking period
	 * */
	function _computeRewardForDate(
		address _sender,
		uint256 _block,
		uint256 _date
	) internal view returns (uint256 weightedStake) {
		weightedStake = staking.getPriorWeightedStake(_sender, _block, _date);
		if (stopBlock > 0) {
			uint256 previousWeightedStake = staking.getPriorWeightedStake(_sender, stopBlock, _date);
			if (previousWeightedStake < weightedStake) {
				weightedStake = previousWeightedStake;
			}
		}
	}

	/**
	 * @notice Internal function to calculate rewards
	 * @dev Base rate is annual, but we pay interest for 14 days,
	 * which is 1/26 of one staking year (1092 days)
	 * @param _sender User address
	 * @param weightedStake the weighted stake
	 * */
	function _payReward(address _sender, uint256 weightedStake) internal returns (bool) {
		uint256 amount = weightedStake.mul(baseRate).div(divisor);
		bool txStatus = SOV.transfer(_sender, amount);
		require(txStatus, "Token transfer was not successful. Check receiver address.");
		return txStatus;
	}

	/**
	 * @notice Withdraws all token from the contract by Multisig.
	 * @param _receiverAddress The address where the tokens has to be transferred. Zero address if the withdraw is to be done in Multisig.
	 * @dev Can only be called after the token state is changed to Holding.
	 */
	function withdrawTokensByMultisig(address _receiverAddress) external onlyOwner {
		require(_receiverAddress != address(0), "receiver address invalid");

		uint256 value = SOV.balanceOf(address(this));
		/// Sending the amount to multisig.
		bool txStatus = SOV.transfer(_receiverAddress, value);
		require(txStatus, "Token transfer was not successful. Check receiver address.");

		emit SOVWithdrawn(_receiverAddress, value);
	}
}
