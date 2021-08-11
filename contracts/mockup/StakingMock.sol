pragma solidity ^0.5.17;

import "../governance/Staking/Staking.sol";
import "./BlockMockUp.sol";

contract StakingMock is Staking {

	///@notice the block mock up contract
	BlockMockUp public blockMockUp;

	/**
	 * @notice gets block number from BlockMockUp
	 * @param _blockMockUp the address of BlockMockUp
	 */
	function setBlockMockUpAddr(address _blockMockUp) public onlyOwner {
		require(_blockMockUp != address(0), "block mockup address invalid");
		blockMockUp = BlockMockUp(_blockMockUp);
	}

	/**
	 * @notice Determine the prior number of stake for an account until a
	 * 		certain lock date as of a block number.
	 * @dev All functions of Staking contract use this internal version,
	 * 		we need to modify public function in order to workaround issue with Vesting.withdrawTokens:
	 * return 1 instead of 0 if message sender is a contract.
	 * */
	function _getPriorUserStakeByDate(
		address account,
		uint256 date,
		uint256 blockNumber
	) internal view returns (uint96) {
		uint256 blockNum = blockMockUp.getBlockNum();
		require(blockNumber < blockNum, "WeightedStaking::getPriorUserStakeAndDate: not yet determined");

		date = _adjustDateForOrigin(date);
		uint32 nCheckpoints = numUserStakingCheckpoints[account][date];
		if (nCheckpoints == 0) {
			return 0;
		}

		/// @dev First check most recent balance.
		if (userStakingCheckpoints[account][date][nCheckpoints - 1].fromBlock <= blockNumber) {
			return userStakingCheckpoints[account][date][nCheckpoints - 1].stake;
		}

		/// @dev Next check implicit zero balance.
		if (userStakingCheckpoints[account][date][0].fromBlock > blockNumber) {
			return 0;
		}

		uint32 lower = 0;
		uint32 upper = nCheckpoints - 1;
		while (upper > lower) {
			uint32 center = upper - (upper - lower) / 2; /// @dev ceil, avoiding overflow.
			Checkpoint memory cp = userStakingCheckpoints[account][date][center];
			if (cp.fromBlock == blockNumber) {
				return cp.stake;
			} else if (cp.fromBlock < blockNumber) {
				lower = center;
			} else {
				upper = center - 1;
			}
		}
		return userStakingCheckpoints[account][date][lower].stake;
	}
}
