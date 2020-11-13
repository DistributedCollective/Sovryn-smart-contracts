pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./WeightedStaking.sol";

contract Staking is WeightedStaking{
    
    /**
     * @notice stakes the given amount for the given duration of time.
     * @dev only if staked balance is 0.
     * @param amount the number of tokens to stake
     * @param duration the duration in seconds
     * @param stakeFor the address to stake the tokens for or 0x0 if staking for oneself
     * @param delegatee the address of the delegatee or 0x0 if there is none.
     * */
    function stake(uint96 amount, uint duration, address stakeFor, address delegatee) public {
        require(amount > 0, "Staking::stake: amount of tokens to stake needs to be bigger than 0");
    
        //stake for the msg.sender if not specified otherwise
        if(stakeFor == address(0))
            stakeFor = msg.sender;
        require(_currentBalance(stakeFor) == 0, "Staking:stake: use 'increaseStake' to increase an existing staked position");
        
        //do not stake longer than the max duration
        if (duration > MAX_DURATION)
            duration = MAX_DURATION;
            
        //retrieve the SOV tokens
        bool success = SOVToken.transferFrom(msg.sender, address(this), amount);
        require(success);
        
        //lock the tokens and update the balance by updating the user checkpoint
        uint lockedTS = timestampToLockDate(block.timestamp + duration);//no overflow possible
        require(lockedTS > block.timestamp, "Staking::timestampToLockDate: staking period too short");
        _writeUserCheckpoint(stakeFor, amount, uint96(lockedTS));
        
        //increase staked token count until the new locking date
        _increaseDailyStake(lockedTS, amount);
        
        //delegate to self in case no address provided
        if(delegatee == address(0))
            _delegate(stakeFor, stakeFor, lockedTS);
        else
            _delegate(stakeFor, delegatee, lockedTS);
        
        emit TokensStaked(stakeFor, amount, lockedTS, amount);
    }
    
    
    /**
     * @notice extends the staking duration until the specified date
     * @param until the new unlocking timestamp in S
     * */
    function extendStakingDuration(uint until) public{
        uint previousLock = currentLock(msg.sender);
        until = timestampToLockDate(until);
        require(previousLock <= until, "Staking::extendStakingDuration: cannot reduce the staking duration");
        
        //do not exceed the max duration, no overflow possible
        uint latest = block.timestamp + MAX_DURATION;
        if(until > latest)
            until = latest;
        
        //update checkpoints
        uint96 amount = _currentBalance(msg.sender);
        _decreaseDailyStake(previousLock, amount);
        _increaseDailyStake(until, amount);
        _decreaseDelegateStake(delegates[msg.sender], previousLock, amount);
        _increaseDelegateStake(delegates[msg.sender], until, amount);
        _writeUserCheckpoint(msg.sender, amount, uint96(until));
        
        emit ExtendedStakingDuration(msg.sender, previousLock, until);
    }
    
    /**
     * @notice increases a users stake
     * @param amount the amount of SOV tokens
     * @param stakeFor the address for which we want to increase the stake. staking for the sender if 0x0
     * */
    function increaseStake(uint96 amount, address stakeFor) public{
        require(amount > 0, "Staking::increaseStake: amount of tokens to stake needs to be bigger than 0");
        
        //retrieve the SOV tokens
        bool success = SOVToken.transferFrom(msg.sender, address(this), amount);
        require(success);
        
        //stake for the msg.sender if not specified otherwise
        if(stakeFor == address(0))
            stakeFor = msg.sender;
        
        //increase staked balance
        uint96 newBalance = add96(_currentBalance(stakeFor), amount, "Staking::increaseStake: balance overflow");
        
        //update checkpoints
        uint until = currentLock(stakeFor);
        _increaseDailyStake(until, amount);
        _increaseDelegateStake(delegates[stakeFor], until, amount);
        _writeUserCheckpoint(stakeFor, newBalance, uint96(until));
        
        emit TokensStaked(stakeFor, amount, until, newBalance);
    }
    
    /**
     * @notice withdraws the given amount of tokens if they are unlocked
     * @param amount the number of tokens to withdraw
     * @param receiver the receiver of the tokens. If not specified, send to the msg.sender
     * */
    function withdraw(uint96 amount, address receiver) public {
        require(amount > 0, "Staking::withdraw: amount of tokens to be withdrawn needs to be bigger than 0");
        uint96 until = currentLock(msg.sender);
        uint96 balance = _currentBalance(msg.sender);
        require(block.timestamp >= until || allUnlocked, "Staking::withdraw: tokens are still locked.");
        require(amount <= balance, "Staking::withdraw: not enough balance");
        
        //determine the receiver
        if(receiver == address(0))
            receiver = msg.sender;
            
        //reduce staked balance
        uint96 newBalance = sub96(balance, amount, "Staking::withdraw: balance underflow");

        //update the checkpoints
        _decreaseDailyStake(until, amount);
        _writeUserCheckpoint(msg.sender, newBalance, until);
        
        //transferFrom
        bool success = SOVToken.transfer(msg.sender, amount);
        require(success);
        
        emit TokensWithdrawn(msg.sender, amount);
    }
    
    /**
     * @notice allow the owner to unlock all tokens in case the staking contract is going to be replaced
     * note: not reversible on purpose. once unlocked, everything is unlocked. the owner should not be able to just quickly
     * unlock to withdraw his own tokens and lock again.
     * */
    function unlockAllTokens() public onlyOwner{
        allUnlocked = true;
        emit TokensUnlocked(SOVToken.balanceOf(address(this)));
    }
    
    /**
     * @notice returns the current lock of for an account
     * @param account the user address
     * @return the lock date of the last checkpoint
     * */
    function currentLock(address account) public view returns(uint96) {
        return userCheckpoints[account][numUserCheckpoints[account] - 1].lockedUntil;
    }
    
    /**
     * @notice returns the current lock of for an account
     * @param account the user address
     * @return the lock date of the last checkpoint
     * */
    function _currentBalance(address account) internal view returns(uint96) {
        return userCheckpoints[account][numUserCheckpoints[account] - 1].stake;
    }
    
    /**
     * @notice Get the number of staked tokens held by the `account`
     * @param account The address of the account to get the balance of
     * @return The number of tokens held
     */
    function balanceOf(address account) external view returns (uint) {
        return _currentBalance(account);
    }


    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) public {
        return _delegate(msg.sender, delegatee, currentLock(msg.sender));
    }

    /**
     * @notice Delegates votes from signatory to `delegatee`
     * @param delegatee The address to delegate votes to
     * @param nonce The contract state required to match the signature
     * @param expiry The time at which to expire the signature
     * @param v The recovery byte of the signature
     * @param r Half of the ECDSA signature pair
     * @param s Half of the ECDSA signature pair
     */
    function delegateBySig(address delegatee, uint nonce, uint expiry, uint8 v, bytes32 r, bytes32 s) public {
        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), getChainId(), address(this)));
        bytes32 structHash = keccak256(abi.encode(DELEGATION_TYPEHASH, delegatee, nonce, expiry));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signatory = ecrecover(digest, v, r, s);
        require(signatory != address(0), "Staking::delegateBySig: invalid signature");
        require(nonce == nonces[signatory]++, "Staking::delegateBySig: invalid nonce");
        require(now <= expiry, "Staking::delegateBySig: signature expired");
        return _delegate(signatory, delegatee, currentLock(signatory));
    }

    /**
     * @notice Gets the current votes balance for `account`
     * @param account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getCurrentVotes(address account) external view returns (uint96) {
        return getPriorVotes(account, block.number, block.timestamp);
    }
    
    /**
     * @notice gets the current number of tokens staked for a day
     * @param lockedTS the timestamp to get the staked tokens for
     * */
    function getCurrentStakedUntil(uint lockedTS) external view returns (uint96) {
        uint32 nCheckpoints = numTotalStakingCheckpoints[lockedTS];
        return nCheckpoints > 0 ? totalStakingCheckpoints[lockedTS][nCheckpoints - 1].stake : 0;
    }
    

    function _delegate(address delegator, address delegatee, uint lockedTS) internal {
        address currentDelegate = delegates[delegator];
        uint96 delegatorBalance = _currentBalance(delegator);
        delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorBalance, lockedTS);
    }
    

    function _moveDelegates(address srcRep, address dstRep, uint96 amount, uint lockedTS) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0))
                 _decreaseDelegateStake(srcRep, lockedTS, amount);
                 
            if (dstRep != address(0))
                _increaseDelegateStake(dstRep, lockedTS, amount);
        }
    }
    

    function getChainId() internal pure returns (uint) {
        uint256 chainId;
        assembly { chainId := chainid() }
        return chainId;
    }
}