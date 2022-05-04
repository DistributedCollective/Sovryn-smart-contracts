pragma solidity ^0.5.17;

import "../governance/Staking/Staking.sol";

contract StakingMockup is Staking {
    function balanceOf_MultipliedByTwo(address account) external view returns (uint256) {
        return balanceOf(account) * 2;
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

    uint96 priorWeightedStake;

    function MOCK_priorWeightedStake(uint96 _priorWeightedStake) public {
        priorWeightedStake = _priorWeightedStake;
    }

    function getPriorWeightedStake(
        address account,
        uint256 blockNumber,
        uint256 date
    ) public view returns (uint96) {
        return
            priorWeightedStake != 0
                ? priorWeightedStake
                : super.getPriorWeightedStake(account, blockNumber, date);
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
