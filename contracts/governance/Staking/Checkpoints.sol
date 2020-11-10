pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./StakingStorage.sol";
import "./SafeMath96.sol";

contract Checkpoints is StakingStorage, SafeMath96{
    /// @notice A checkpoint for marking the stakes from a given block 
    struct Checkpoint {
        uint32 fromBlock;
        uint96 stake;
    }
    
    /// @notice A checkpoint for marking the stakes and lock date of an user from a given block 
    struct UserCheckpoint {
        uint32 fromBlock;
        uint96 stake;
        uint96 lockedUntil;
    }
    
    /// @notice A record of tokens to be unstaked at a given time in total
    /// for total voting power computation. voting weights get adjusted bi-weekly
    mapping (uint => mapping (uint32 => Checkpoint)) public totalStakingCheckpoints;
    
    ///@notice The number of total staking checkpoints for each date
    mapping (uint => uint32) public numTotalStakingCheckpoints;
    
    /// @notice A record of tokens to be unstaked at a given time which were delegated to a certain address
    /// for delegatee voting power computation. voting weights get adjusted bi-weekly
    mapping(address => mapping (uint => mapping (uint32 => Checkpoint))) public delegateStakingCheckpoints;
    
    ///@notice The number of total staking checkpoints for each date
    mapping (address => mapping (uint => uint32)) public numDelegateStakingCheckpoints;

    /// @notice A record of stake checkpoints for each account, by index
    mapping (address => mapping (uint32 => UserCheckpoint)) public userCheckpoints;
    
    /// @notice The number of checkpoints for each account
    mapping (address => uint32) public numUserCheckpoints;
    
    
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
        _writeStakingCheckpoint(lockedTS, nCheckpoints, newStake);
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