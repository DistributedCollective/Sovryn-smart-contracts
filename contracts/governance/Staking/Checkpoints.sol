pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./StakingStorage.sol";
import "./SafeMath96.sol";

contract Checkpoints is StakingStorage, SafeMath96{
    
    /// @notice An event thats emitted when an account changes its delegate
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    
    /// @notice An event thats emitted when a delegate account's stake balance changes
    event DelegateStakeChanged(address indexed delegate, uint lockedUntil, uint previousBalance, uint newBalance);
    
    /// @notice An event thats emitted when tokens get staked
    event TokensStaked(address indexed staker, uint amount, uint lockedUntil, uint totalStaked);
    
    /// @notice An event thats emitted when tokens get withdrawn
    event TokensWithdrawn(address indexed staker, address receiver, uint amount);
    
    /// @notice An event thats emitted when the owner unlocks all tokens
    event TokensUnlocked(uint amount);
    
    /// @notice An event thats emitted when a staking period gets extended
    event ExtendedStakingDuration(address indexed staker, uint previousDate, uint newDate);
    
    function _writeUserCheckpoint(address user,  uint96 newStake, uint96 lockedTS) internal {
      uint32 blockNumber = safe32(block.number, "Staking::_writeUserCheckpoint: block number exceeds 32 bits");
      uint32 nCheckpoints = numUserCheckpoints[user];

      if (nCheckpoints > 0 && userCheckpoints[user][nCheckpoints - 1].fromBlock == blockNumber) {
          userCheckpoints[user][nCheckpoints - 1].stake = newStake;
          userCheckpoints[user][nCheckpoints - 1].lockedUntil = lockedTS;
      } else {
          userCheckpoints[user][nCheckpoints] = UserCheckpoint(blockNumber, newStake, lockedTS);
          numUserCheckpoints[user] = nCheckpoints + 1;
      }
    }
    
    /**
     * @notice increases the delegatee's stake for a giving lock date and writes a checkpoint
     * @param delegatee the delegatee
     * @param lockedTS the lock date
     * @param value the value to add to the staked balance
     * */
    function _increaseDelegateStake(address delegatee, uint lockedTS, uint96 value) internal{
        uint32 nCheckpoints = numDelegateStakingCheckpoints[delegatee][lockedTS];
        uint96 staked = delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake;
        uint96 newStake = add96(staked, value, "Staking::_increaseDelegateeStake: stakedUntil overflow");
        _writeDelegateCheckpoint(delegatee, lockedTS, nCheckpoints, newStake);
    }
    
    /**
     * @notice decreases the delegatee's stake for a giving lock date and writes a checkpoint
     * @param delegatee the delegatee
     * @param lockedTS the lock date
     * @param value the value to add to the staked balance
     * */
    function _decreaseDelegateStake(address delegatee, uint lockedTS, uint96 value) internal{
        uint32 nCheckpoints = numDelegateStakingCheckpoints[delegatee][lockedTS];
        uint96 staked = delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake;
        uint96 newStake = sub96(staked, value, "Staking::_decreaseDailyStake: stakedUntil underflow");
        _writeDelegateCheckpoint(delegatee, lockedTS, nCheckpoints, newStake);
    }
    
    function _writeDelegateCheckpoint(address delegatee, uint lockedTS, uint32 nCheckpoints, uint96 newStake) internal {
      uint32 blockNumber = safe32(block.number, "Staking::_writeStakingCheckpoint: block number exceeds 32 bits");
      uint96 oldStake = delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake;
        
        if (nCheckpoints > 0 && delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].fromBlock == blockNumber) {
            delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints - 1].stake = newStake;
        } else {
            delegateStakingCheckpoints[delegatee][lockedTS][nCheckpoints] = Checkpoint(blockNumber, newStake);
            numDelegateStakingCheckpoints[delegatee][lockedTS] = nCheckpoints + 1;
        }
        emit DelegateStakeChanged(delegatee, lockedTS, oldStake, newStake);
    }
    
    
    
    function _increaseDailyStake(uint lockedTS, uint96 value) internal{
        uint32 nCheckpoints = numTotalStakingCheckpoints[lockedTS];
        uint96 staked = totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake;
        uint96 newStake = add96(staked, value, "Staking::_increaseDailyStake: stakedUntil overflow");
        _writeStakingCheckpoint(lockedTS, nCheckpoints, newStake);
    }
    
    function _decreaseDailyStake(uint lockedTS, uint96 value) internal{
        uint32 nCheckpoints = numTotalStakingCheckpoints[lockedTS];
        uint96 staked = totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake;
        uint96 newStake = sub96(staked, value, "Staking::_decreaseDailyStake: stakedUntil underflow");
        _writeStakingCheckpoint(lockedTS, nCheckpoints, newStake);
    }
    
    function _writeStakingCheckpoint(uint lockedTS, uint32 nCheckpoints, uint96 newStake) internal{
        uint32 blockNumber = safe32(block.number, "Staking::_writeStakingCheckpoint: block number exceeds 32 bits");
        
        if (nCheckpoints > 0 && totalStakingCheckpoints[lockedTS][nCheckpoints - 1].fromBlock == blockNumber) {
            totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake = newStake;
        } else {
            totalStakingCheckpoints[lockedTS][nCheckpoints] = Checkpoint(blockNumber, newStake);
            numTotalStakingCheckpoints[lockedTS] = nCheckpoints + 1;
        }
    }
    
}