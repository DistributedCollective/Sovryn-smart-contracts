pragma solidity ^0.5.17;

import "../governance/Staking/Staking.sol";
import "./BlockMockUp.sol";

contract StakingMockOld is Staking {
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
	 * @notice Determine the current Block Number from BlockMockUp
	 * */
	function _getCurrentBlockNumber() internal view returns (uint256) {
		return blockMockUp.getBlockNum();
	}

	/**
	 * @dev Calls the updateRewards() function to calculate and update rewards of the staker
	 * when additional staking, withdrawal or extending duration etc.
	 * */
	function _updateRewards() internal {
		//Do Nothing
	}
}
