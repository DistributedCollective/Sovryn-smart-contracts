pragma solidity ^0.5.17;

import "../governance/Staking/Staking.sol";
import "./BlockMockUp.sol";

/**
 * Mix mock contract between StakingMock & StakingMockup
 */
contract StakingMockupMix is Staking {
    ///@notice the block mock up contract
    BlockMockUp public blockMockUp;
    uint96 priorTotalVotingPower;
    uint96 priorWeightedStake;
    mapping(uint256 => uint96) priorWeightedStakeAtBlock;

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

    function balanceOf_MultipliedByTwo(address account) external view returns (uint256) {
        return balanceOf(account) * 2;
    }

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
                : super.getPriorWeightedStake(account, blockNumber, date);
        }

        return _priorWeightedStake;
    }

    function calculatePriorWeightedStake(
        address account,
        uint256 blockNumber,
        uint256 date
    ) public {
        super.getPriorWeightedStake(account, blockNumber, date);
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
     * @notice Add vesting contract's code hash to a map of code hashes.
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
}
