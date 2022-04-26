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
     * @notice Determine the current Block Number from BlockMockUp
     * */
    function _getCurrentBlockNumber() internal view returns (uint256) {
        return blockMockUp.getBlockNum();
    }
}
