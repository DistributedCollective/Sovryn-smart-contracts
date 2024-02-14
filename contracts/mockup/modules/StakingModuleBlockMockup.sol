pragma solidity ^0.5.17;

import "../../governance/Staking/modules/StakingGovernanceModule.sol";
import "../../governance/Staking/modules/StakingStakeModule.sol";
import "../../governance/Staking/modules/StakingVestingModule.sol";
import "../../governance/Staking/modules/WeightedStakingModule.sol";
import "../../proxy/modules/interfaces/IFunctionsList.sol";
import "../BlockMockUp.sol";

contract StakingModuleBlockMockup is
    IFunctionsList,
    StakingGovernanceModule,
    StakingStakeModule,
    StakingVestingModule,
    WeightedStakingModule
{
    uint96 public priorWeightedStake;
    mapping(uint256 => uint96) public priorWeightedStakeAtBlock;
    ///@notice the block mock up contract
    BlockMockUp public blockMockUp;

    function balanceOf_MultipliedByTwo(address account) external view returns (uint256) {
        return this.balanceOf(account) * 2;
    }

    uint96 priorTotalVotingPower;

    function MOCK_priorTotalVotingPower(uint96 _priorTotalVotingPower) public {
        priorTotalVotingPower = _priorTotalVotingPower;
    }

    function getPriorTotalVotingPower(uint32 blockNumber, uint256 time)
        public
        view
        returns (uint96 totalVotingPower)
    {
        return
            priorTotalVotingPower != 0
                ? priorTotalVotingPower
                : super.getPriorTotalVotingPower(blockNumber, time);
    }

    function MOCK_priorWeightedStake(uint96 _priorWeightedStake) public {
        priorWeightedStake = _priorWeightedStake;
    }

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

    /**
     * @notice Add vesting contract's code hash to a map of code hashes.
     * @param vesting The address of Vesting contract.
     * @dev We need it to use _isVestingContract() function instead of isContract()
     */
    function addContractCodeHash(address vesting) public onlyAuthorized {
        bytes32 codeHash = _getCodeHash(vesting);
        vestingCodeHashes[codeHash] = true;
        emit ContractCodeHashAdded(codeHash);
    }

    /**
     * @notice Remove vesting contract's code hash to a map of code hashes.
     * @param vesting The address of Vesting contract.
     * @dev We need it to use _isVestingContract() function instead of isContract()
     */
    function removeContractCodeHash(address vesting) public onlyAuthorized {
        bytes32 codeHash = _getCodeHash(vesting);
        vestingCodeHashes[codeHash] = false;
        emit ContractCodeHashRemoved(codeHash);
    }

    /**
     * @notice Return hash of contract code
     */
    function _getCodeHash(address _contract) internal view returns (bytes32) {
        bytes32 codeHash;
        assembly {
            codeHash := extcodehash(_contract)
        }
        return codeHash;
    }

    /**
     * @notice Return flag whether the given address is a registered vesting contract.
     * @param stakerAddress the address to check
     */
    function isVestingContract(address stakerAddress) public view returns (bool) {
        bytes32 codeHash = _getCodeHash(stakerAddress);
        return vestingCodeHashes[codeHash];
    }

    function getPriorWeightedStakeAtBlock(uint256 blockNum) public view returns (uint256) {
        return uint256(priorWeightedStakeAtBlock[blockNum]);
    }

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

    function getFunctionsList() external pure returns (bytes4[] memory) {
        // StakingGovernanceModule
        bytes4[] memory functionsList = new bytes4[](31);
        functionsList[0] = this.getPriorTotalVotingPower.selector;
        functionsList[1] = this.getCurrentVotes.selector;
        functionsList[2] = this.getPriorVotes.selector;
        functionsList[3] = this.getPriorStakeByDateForDelegatee.selector;
        functionsList[4] = this.getPriorTotalStakesForDate.selector;
        functionsList[5] = this.delegate.selector;

        // StakingStakeModule
        functionsList[6] = this.stake.selector;
        functionsList[7] = this.stakeWithApproval.selector;
        functionsList[8] = this.extendStakingDuration.selector;
        functionsList[9] = this.stakesBySchedule.selector;
        functionsList[10] = this.stakeBySchedule.selector;
        functionsList[11] = this.balanceOf.selector;
        functionsList[12] = this.getCurrentStakedUntil.selector;
        functionsList[13] = this.getStakes.selector;
        functionsList[14] = this.timestampToLockDate.selector;

        //StakingVestingModule
        functionsList[15] = this.setVestingRegistry.selector;
        functionsList[16] = this.setVestingStakes.selector;
        functionsList[17] = this.getPriorUserStakeByDate.selector;
        functionsList[18] = this.getPriorVestingWeightedStake.selector;
        functionsList[19] = this.getPriorVestingStakeByDate.selector;
        functionsList[20] = this.addContractCodeHash.selector;
        functionsList[21] = this.removeContractCodeHash.selector;
        functionsList[22] = this.isVestingContract.selector;

        //BlockMockup
        functionsList[23] = this.setBlockMockUpAddr.selector;
        functionsList[24] = this.MOCK_priorWeightedStake.selector;
        functionsList[25] = this.MOCK_priorWeightedStakeAtBlock.selector;

        //WeightedStakingModule
        functionsList[26] = this.getPriorWeightedStake.selector;
        functionsList[27] = this.weightedStakeByDate.selector;
        functionsList[28] = this.computeWeightByDate.selector;
        functionsList[29] = this.priorWeightedStakeAtBlock.selector;
        functionsList[30] = this.getPriorWeightedStakeAtBlock.selector;

        return functionsList;
    }
}
