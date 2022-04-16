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
     * @notice Determine the current Block Number from BlockMockUp
     * */
    function _getCurrentBlockNumber() internal view returns (uint256) {
        return blockMockUp.getBlockNum();
    }
}
