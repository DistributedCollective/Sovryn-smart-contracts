pragma solidity ^0.5.17;

import "../../governance/Staking/modules/WeightedStakingModule.sol";

contract WeightedStakingModuleMockup is WeightedStakingModule {
    uint96 priorWeightedStake;

    function MOCK_priorWeightedStake(uint96 _priorWeightedStake) public {
        priorWeightedStake = _priorWeightedStake;
    }

    mapping(uint256 => uint96) priorWeightedStakeAtBlock;

    function MOCK_priorWeightedStakeAtBlock(uint96 _priorWeightedStake, uint256 _block) public {
        priorWeightedStakeAtBlock[_block] = _priorWeightedStake;
    }

    function getPriorWeightedStake(
        address account,
        uint256 blockNumber,
        uint256 date
    ) public view returns (uint96) {
        uint96 _priorWeightedStake;

        if (priorWeightedStakeAtBlock[blockNumber] != 0) {
            _priorWeightedStake = priorWeightedStakeAtBlock[blockNumber];
        } else {
            _priorWeightedStake = priorWeightedStake != 0
                ? priorWeightedStake
                : _getPriorWeightedStake(account, blockNumber, date);
        }

        return _priorWeightedStake;
    }

    function calculatePriorWeightedStake(
        address account,
        uint256 blockNumber,
        uint256 date
    ) public {
        getPriorWeightedStake(account, blockNumber, date);
    }

    /**
     * @dev We need this function to simulate zero delegate checkpoint value.
     */
    function setDelegateStake(
        address delegatee,
        uint256 lockedTS,
        uint96 value
    ) public {
        uint32 nCheckpoints = numDelegateStakingCheckpoints[delegatee][lockedTS];
        uint96 staked = delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake;
        _writeDelegateCheckpoint(delegatee, lockedTS, nCheckpoints, 0);
    }

    function getFunctionsList() external pure returns (bytes4[] memory) {
        bytes4[] memory functionsList = new bytes4[](7);
        functionsList[0] = this.getPriorWeightedStake.selector;
        functionsList[1] = this.weightedStakeByDate.selector;
        functionsList[2] = this.computeWeightByDate.selector;
        functionsList[3] = this.MOCK_priorWeightedStake.selector;
        functionsList[4] = this.MOCK_priorWeightedStakeAtBlock.selector;
        functionsList[5] = this.calculatePriorWeightedStake.selector;
        functionsList[6] = this.setDelegateStake.selector;
        return functionsList;
    }
}
