pragma solidity 0.5.17;

/**
 * @title Used to get and set mock block number.
 */
contract BlockMockUp {
    uint256 public blockNum;

    /**
     * @notice To get the `blockNum`.
     * @return _blockNum The block number.
     */
    function getBlockNum() public view returns (uint256 _blockNum) {
        return blockNum;
    }

    /**
     * @notice To set the `blockNum`.
     * @param _blockNum The block number.
     */
    function setBlockNum(uint256 _blockNum) public {
        blockNum = _blockNum;
    }
}
