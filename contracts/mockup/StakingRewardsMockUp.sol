
pragma solidity ^0.5.17;

import "../governance/StakingRewards/StakingRewards.sol";
import "./BlockMockUp.sol";

/**
 * @title Staking Rewards Contract MockUp
 * @notice This is used for Testing
 * */
contract StakingRewardsMockUp is StakingRewards {

    ///@notice the block mock up contract
	BlockMockUp public blockMockUp;

	using SafeMath for uint256;

    /**
	 * @notice gets block number from BlockMockUp
	 * @param _blockMockUp the address of BlockMockUp
	 */
	function setBlockMockUpAddr(address _blockMockUp) public onlyOwner {
		require(_blockMockUp != address(0), "block mockup address invalid");
		blockMockUp = BlockMockUp(_blockMockUp);
	}

	/**
	 * @notice Get staker's current accumulated reward
	 */
	function getStakerCurrentReward(bool considerMaxDuration) public view returns (uint256 lastWithdrawalInterval, uint256 amount) {
		uint256 weightedStake;
		uint256 blockNum = blockMockUp.getBlockNum();
		uint256 lastFinalisedBlock = blockNum.sub(1);
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
}
