pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../farm/LiquidityMining.sol";

contract LiquidityMiningMockup is LiquidityMining {

    function getPassedBlocksWithBonusMultiplier(uint256 _from, uint256 _to) public view returns (uint256) {
        return _getPassedBlocksWithBonusMultiplier(_from, _to);
    }

}