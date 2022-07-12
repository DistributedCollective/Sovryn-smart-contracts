pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../CheckpointsShared.sol";
import "../../../openzeppelin/Address.sol";
import "../StakingShared.sol";
import "../../../proxy/modules/interfaces/IFunctionsList.sol";

/**
 * @title Weighted Staking contract.
 * @notice Computation of power and votes used by FeeSharingProxy and
 * GovernorAlpha and Staking contracts w/ mainly 3 public functions:
 *   + getPriorTotalVotingPower => Total voting power.
 *   + getPriorVotes  => Delegatee voting power.
 *   + getPriorWeightedStake  => User Weighted Stake.
 * Staking contract inherits WeightedStaking.
 * FeeSharingProxy and GovernorAlpha invoke Staking instance functions.
 * */
contract StakingAdminModule is
    StakingShared,
    IFunctionsList /*, Checkpoints */
{
    using Address for address payable;

    event AdminAdded(address admin);

    event AdminRemoved(address admin);

    /// @param pauser address to grant power to pause the contract
    /// @param added true - added, false - removed
    event PauserAddedOrRemoved(address indexed pauser, bool indexed added);

    /// @notice An event emitted when a staking is paused or unpaused
    /// @param setPaused true - pause, false - unpause
    event StakingPaused(bool indexed setPaused);

    /// @notice An event emitted when a staking is frozen or unfrozen
    /// @param setFrozen true - freeze, false - unfreeze
    event StakingFrozen(bool indexed setFrozen);

    /**
     * @notice Add account to Admins ACL.
     * @param _admin The addresses of the account to grant permissions.
     * */
    function addAdmin(address _admin) external onlyOwner whenNotFrozen {
        admins[_admin] = true;
        emit AdminAdded(_admin);
    }

    /**
     * @notice Remove account from Admins ACL.
     * @param _admin The addresses of the account to revoke permissions.
     * */
    function removeAdmin(address _admin) external onlyOwner whenNotFrozen {
        admins[_admin] = false;
        emit AdminRemoved(_admin);
    }

    /**
     * @notice Add account to pausers ACL.
     * @param _pauser The address to grant pauser permissions.
     * */
    function addPauser(address _pauser) external onlyOwner whenNotFrozen {
        pausers[_pauser] = true;
        emit PauserAddedOrRemoved(_pauser, true);
    }

    /**
     * @notice Remove account from pausers ACL.
     * @param _pauser The address to grant pauser permissions.
     * */
    function removePauser(address _pauser) external onlyOwner whenNotFrozen {
        delete pausers[_pauser];
        emit PauserAddedOrRemoved(_pauser, false);
    }

    /**
     * @notice Pause/unpause contract
     * @param _pause true when pausing, false when unpausing
     * */
    function pauseUnpause(bool _pause) public onlyPauserOrOwner whenNotFrozen {
        paused = _pause;
        emit StakingPaused(_pause);
    }

    /**
     * @notice Freeze contract - disable all functions
     * @param _freeze true when freezing, false when unfreezing
     * @dev When freezing, pause is always applied too. When unfreezing, the contract is left in paused stated.
     * */
    //TODO: separate freeze from unfreeze
    function freezeUnfreeze(bool _freeze) external onlyPauserOrOwner {
        require(_freeze != frozen, "WS25");
        if (_freeze) pauseUnpause(true);
        frozen = _freeze;
        emit StakingFrozen(_freeze);
    }

    /**
     * @notice Allow the owner to set a fee sharing proxy contract.
     * We need it for unstaking with slashing.
     * @param _feeSharing The address of FeeSharingProxy contract.
     * */
    function setFeeSharing(address _feeSharing) external onlyOwner whenNotFrozen {
        require(_feeSharing != address(0), "S17"); // FeeSharing address shouldn't be 0
        feeSharing = IFeeSharingProxy(_feeSharing);
    }

    /**
     * @notice Allow the owner to set weight scaling.
     * We need it for unstaking with slashing.
     * @param _weightScaling The weight scaling.
     * */
    function setWeightScaling(uint96 _weightScaling) external onlyOwner whenNotFrozen {
        require(
            MIN_WEIGHT_SCALING <= _weightScaling && _weightScaling <= MAX_WEIGHT_SCALING,
            "S18" /* scaling doesn't belong to range [1, 9] */
        );
        weightScaling = _weightScaling;
    }

    /**
     * @notice Allow the owner to set a new staking contract.
     * As a consequence it allows the stakers to migrate their positions
     * to the new contract.
     * @dev Doesn't have any influence as long as migrateToNewStakingContract
     * is not implemented.
     * @param _newStakingContract The address of the new staking contract.
     * */
    function setNewStakingContract(address _newStakingContract) external onlyOwner whenNotFrozen {
        require(_newStakingContract != address(0), "S16"); // can't reset the new staking contract to 0
        newStakingContract = _newStakingContract;
    }

    /**
     * @notice Allow a staker to migrate his positions to the new staking contract.
     * @dev Staking contract needs to be set before by the owner.
     * Currently not implemented, just needed for the interface.
     *      In case it's needed at some point in the future,
     *      the implementation needs to be changed first.
     * */
    function migrateToNewStakingContract() external whenNotFrozen {
        require(newStakingContract != address(0), "S19"); // there is no new staking contract set
        /// @dev implementation:
        /// @dev Iterate over all possible lock dates from now until now + MAX_DURATION.
        /// @dev Read the stake & delegate of the msg.sender
        /// @dev If stake > 0, stake it at the new contract until the lock date with the current delegate.
    }

    function getFunctionsList() external pure returns (bytes4[] memory) {
        bytes4[] memory functionList = new bytes4[](9);
        functionList[0] = this.addAdmin.selector;
        functionList[1] = this.removeAdmin.selector;
        functionList[2] = this.addPauser.selector;
        functionList[3] = this.removePauser.selector;
        functionList[4] = this.pauseUnpause.selector;
        functionList[5] = this.freezeUnfreeze.selector;
        functionList[6] = this.setFeeSharing.selector;
        functionList[7] = this.setWeightScaling.selector;
        functionList[8] = this.setNewStakingContract.selector;
        return functionList;
    }
}
