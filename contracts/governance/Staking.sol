pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../openzeppelin/Ownable.sol";
import "../interfaces/IERC20.sol";

contract Staking is Ownable{
    ///@notice 2 weeks in seconds
    uint constant twoWeeks = 1209600;
    
    ///@notice the maximum possible voting weight
    uint96 constant maxVotingWeight = 100;
    
    /// @notice the maximum duration to stake tokens for
    uint constant maxDuration = 1095 days;
    
    ///@notice the maximum duration ^2
    uint96 constant maxDurationPow2 = 1095 * 1095;
    
    ///@notice the timestamp of contract creation. base for the staking period calculation
    uint public kickoffTS;
    
    string name = "SOVStaking";
    
    /// @notice the token to be staked
    IERC20 public SOVToken;

    /// @notice Total number of tokens in circulation
    uint public constant totalSupply = 0; // increases as more tokens are staked

    /// @notice Official record of staked token balances for each account
    mapping (address => uint96) internal balances;
    
    /// @notice A record of the unlocking timestamps per address
    mapping (address => uint) public lockedUntil;

    /// @notice A record of each accounts delegate
    mapping (address => address) public delegates;
    
    /// @notice if this flag is set to true, all tokens are unlocked immediately
    bool allUnlocked = false;

    /// @notice A checkpoint for marking number of votes from a given block
    struct Checkpoint {
        uint32 fromBlock;
        uint96 stake;
    }
    
    /// @notice A record of tokens to be unstaked at a given time
    /// for voting weight computation. voting weights get adjusted bi-weekly
    mapping (uint => mapping (uint32 => Checkpoint)) public stakingCheckpoints;
    
    ///@notice The number of checkpoints for each date
    mapping (uint => uint32) public numStakingCheckpoints;

    /// @notice A record of votes checkpoints for each account, by index
    mapping (address => mapping (uint32 => Checkpoint)) public checkpoints;
    
    //note: todo add checkpoints for users and delegatees separately -> one for reding voting rights, one for fee sharing

    /// @notice The number of checkpoints for each account
    mapping (address => uint32) public numCheckpoints;

    /// @notice The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    /// @notice The EIP-712 typehash for the delegation struct used by the contract
    bytes32 public constant DELEGATION_TYPEHASH = keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    /// @notice A record of states for signing / validating signatures
    mapping (address => uint) public nonces;

    /// @notice An event thats emitted when an account changes its delegate
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);

    /// @notice An event thats emitted when a delegate account's vote balance changes
    event DelegateVotesChanged(address indexed delegate, uint previousBalance, uint newBalance);

    /// @notice An event thats emitted when tokens get staked
    event TokensStaked(address indexed staker, uint amount, uint lockedUntil, uint totalStaked);
    
    /// @notice An event thats emitted when tokens get withdrawn
    event TokensWithdrawn(address indexed staker, uint amount);
    
    /// @notice An event thats emitted when the owner unlocks all tokens
    event TokensUnlocked(uint amount);
    
    /// @notice An event thats emitted when a staking period gets extended
    event ExtendedStakingDuration(address indexed staker, uint previousDate, uint newDate);

    /**
     * @notice Construct a new staking contract
     * @param SOV The address of the SOV token address
     */
    constructor(address SOV) public {
        SOVToken = IERC20(SOV);
        kickoffTS = block.timestamp;
    }
    
    /**
     * @notice stakes the given amount for the given duration of time.
     * @dev only if staked balance is 0.
     * @param amount the number of tokens to stake
     * @param duration the duration in seconds
     * @param delegatee the address of the delegatee or 0x0 if there is none.
     * */
    function stake(uint96 amount, uint duration, address delegatee) public {
        require(amount > 0, "Staking::stake: amount of tokens to stake needs to be bigger than 0");
        require(balances[msg.sender] == 0, "Staking:stake: use 'increaseStake' to increase an existing staked position");
        
        //do not stake longer than the max duration
        if (duration <= maxDuration)
            duration = maxDuration;
            
        //retrieve the SOV tokens
        bool success = SOVToken.transferFrom(msg.sender, address(this), amount);
        assert(success);
        
        //lock the tokens
        uint lockedTS = timestampToLockDate(block.timestamp + duration);//no overflow possible 
        lockedUntil[msg.sender] = lockedTS;
        
        //increase staked balance
        balances[msg.sender] = amount;
        
        //increase staked token count until the new locking date
        _increaseDailyStake(lockedTS, amount);
        
        //delegate to self in case no address provided
        if(delegatee == address(0))
            _delegate(msg.sender, msg.sender);
        else
            _delegate(msg.sender, delegatee);
        
        emit TokensStaked(msg.sender, amount, lockedTS, amount);
    }
    
    
    /**
     * @notice unstaking is posisble every 2 weeks only. this means, to calculate the key value for the staking
     * checkpoints, we need to map the intended timestamp to the closest available date 
     * @param timestamp the unlocking timestamp
     * @return the actual unlocking date (might be up to 2 weeks shorter than intended)
     * */
    function timestampToLockDate(uint timestamp) public view returns(uint lockDate){
        require(timestamp > kickoffTS, "Staking::timestampToLockDate: timestamp lies before contract creation");
        //if staking timestamp does not match any of the unstaking dates, set the lockDate to the closest one before the timestamp
        //e.g. passed timestamps lies 7 weeks after kickoff -> only stake for 6 weeks
        uint periodFromKickoff = (timestamp - kickoffTS) / twoWeeks;
        lockDate = periodFromKickoff * twoWeeks + kickoffTS;
        require(lockDate > block.timestamp, "Staking::timestampToLockDate: staking period too short");
    }
    
    /**
     * @notice extends the staking duration until the specified date
     * @param until the new unlocking timestamp in S
     * */
    function extendStakingDuration(uint until) public{
        uint previousLock = lockedUntil[msg.sender];
        until = timestampToLockDate(until);
        require(previousLock <= until, "Staking::extendStakingDuration: cannot reduce the staking duration");
        
        //do not exceed the max duration, no overflow possible
        uint latest = block.timestamp + maxDuration;
        if(until > latest)
            until = latest;
        
        lockedUntil[msg.sender] = until;
        
        _decreaseDailyStake(previousLock, balances[msg.sender]);
        _increaseDailyStake(until, balances[msg.sender]);
        
        emit ExtendedStakingDuration(msg.sender, previousLock, until);
    }
    
    /**
     * @notice increases a users stake
     * @param amount the amount of SOV tokens
     * */
    function increaseStake(uint96 amount) public{
        require(amount > 0, "Staking::increaseStake: amount of tokens to stake needs to be bigger than 0");
            
        //retrieve the SOV tokens
        bool success = SOVToken.transferFrom(msg.sender, address(this), amount);
        assert(success);
        
        //increase staked balance
        balances[msg.sender] = add96(balances[msg.sender], amount, "Staking::increaseStake: balance overflow");
        
        //increase staked token count until the locking date
        _increaseDailyStake(lockedUntil[msg.sender], amount);
        
        emit TokensStaked(msg.sender, amount, lockedUntil[msg.sender], balances[msg.sender]);
    }
    
    /**
     * @notice withdraws the given amount of tokens if they are unlocked
     * @param amount the number of tokens to withdraw
     * @param receiver the receiver of the tokens. If not specified, send to the msg.sender
     * */
    function withdraw(uint96 amount, address receiver) public {
        require(amount > 0, "Staking::withdraw: amount of tokens to be withdrawn needs to be bigger than 0");
        require(block.timestamp >= lockedUntil[msg.sender] || allUnlocked, "Staking::withdraw: tokens are still locked.");
        require(amount <= balances[msg.sender], "Staking::withdraw: not enough balance");
        
        //determine the receiver
        if(receiver == address(0))
            receiver = msg.sender;
            
        //reduce staked balance
        balances[msg.sender] = sub96(balances[msg.sender], amount, "Staking::withdraw: balance underflow");
        
        //update the staking checkpoint
        _decreaseDailyStake(lockedUntil[msg.sender], amount); 
        
        //transferFrom
        bool success = SOVToken.transferFrom(address(this), msg.sender, amount);
        assert(success);
        
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
     * @notice computes the voting power for a secific date
     * @param date the staking date to compute the power for
     * @param startDate the date for which we need to know the power of the stake
     * @param blockNumber the block number. needed for checkpointing.
     * */
    function _powerByDate(uint date, uint startDate, uint blockNumber) internal view returns(uint96 power){
        uint96 weight = _computeWeightByDate(date, startDate);
        uint96 staked = getPriorStakesForDate(date, blockNumber);
        power = mul96(staked, weight, "multiplication overflow for voting power");
    }
    
    /**
     * @notice compute the weight for a specific date
     * @param date the unlocking date
     * @param startDate we compute the weight for the tokens staked until 'date' on 'startDate'
     * */
    function _computeWeightByDate(uint date, uint startDate) internal view returns(uint96 weight){
        require(date > startDate, "date needs to be bigger than startDate");
        uint remainingTime = (date - startDate);
        require(maxDuration > remainingTime, "remaining time can't be bigger than max duration");
        // x = max days - remaining days
        uint96 x = uint96(maxDuration - remainingTime)/(1 days);
        weight = sub96(maxDurationPow2, x*x, "underflow on weight calculation") / (maxDurationPow2 / maxVotingWeight);
    }
    
    
    /**
     * @notice computes the total voting power at a given time
     * @param time the timestamp for which to calculate the total voting power
     * @return the total voting power at the given time
     * */
    function getPriorTotalVotingPower(uint32 blockNumber, uint time) view public returns(uint96 totalVotingPower){
        //start the computation with the exact or previous unlocking date (voting weight remians the same until the next break point)
        uint start =  timestampToLockDate(time);
        uint end = start + maxDuration;
        
        //max 76 iterations
        for(uint i = start; i < end; i += twoWeeks){
            totalVotingPower = add96(totalVotingPower, _powerByDate(i, start, blockNumber), "overflow on total voting power computation");
        }
    }
    
    
    /**
     * @notice Get the number of staked tokens held by the `account`
     * @param account The address of the account to get the balance of
     * @return The number of tokens held
     */
    function balanceOf(address account) external view returns (uint) {
        return balances[account];
    }


    /**
     * @notice Delegate votes from `msg.sender` to `delegatee`
     * @param delegatee The address to delegate votes to
     */
    function delegate(address delegatee) public {
        return _delegate(msg.sender, delegatee);
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
        require(signatory != address(0), "Comp::delegateBySig: invalid signature");
        require(nonce == nonces[signatory]++, "Comp::delegateBySig: invalid nonce");
        require(now <= expiry, "Comp::delegateBySig: signature expired");
        return _delegate(signatory, delegatee);
    }

    /**
     * @notice Gets the current votes balance for `account`
     * @param account The address to get votes balance
     * @return The number of current votes for `account`
     */
    function getCurrentVotes(address account) external view returns (uint96) {
        uint32 nCheckpoints = numCheckpoints[account];
        return nCheckpoints > 0 ? checkpoints[account][nCheckpoints - 1].stake : 0;
    }
    
    //todo check if required
    function getCurrentStakedUntil(uint lockedTS) external view returns (uint96) {
        uint32 nCheckpoints = numStakingCheckpoints[lockedTS];
        return nCheckpoints > 0 ? stakingCheckpoints[lockedTS][nCheckpoints - 1].stake : 0;
    }
    
    /**
     * @notice Determine the prior number of stake for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorStake(address account, uint blockNumber) public view returns (uint96) {
        require(blockNumber < block.number, "Staking::getPriorStake: not yet determined");

        uint32 nCheckpoints = numCheckpoints[account];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (checkpoints[account][nCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nCheckpoints - 1].stake;
        }

        // Next check implicit zero balance
        if (checkpoints[account][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = checkpoints[account][center];
            if (cp.fromBlock == blockNumber) {
                return cp.stake;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return checkpoints[account][lower].stake;
    }
    
    /**
     * @notice Determine the prior number of votes for an account as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param account The address of the account to check
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
     function getPriorVotes(address account, uint blockNumber, uint date) public view returns (uint96) {
         //if date is not an exact break point, start weight computation from the previous break point (alternative would be the next)
         uint startDate =  timestampToLockDate(date);
         uint96 staked = getPriorStake(account, blockNumber);
         uint96 weight = _computeWeightByDate(lockedUntil[account], startDate);
         return mul96(staked, weight, "Staking::getPriorVotes: multiplication overflow for voting power");
     }
    
    /**
     * @notice Determine the prior number of stake for an unlocking date as of a block number
     * @dev Block number must be a finalized block or else this function will revert to prevent misinformation.
     * @param date The date to check the stakes for
     * @param blockNumber The block number to get the vote balance at
     * @return The number of votes the account had as of the given block
     */
    function getPriorStakesForDate(uint date, uint blockNumber) public view returns (uint96) {
        require(blockNumber < block.number, "Staking::getPriorVotes: not yet determined");

        uint32 nCheckpoints = numStakingCheckpoints[date];
        if (nCheckpoints == 0) {
            return 0;
        }

        // First check most recent balance
        if (stakingCheckpoints[date][nCheckpoints - 1].fromBlock <= blockNumber) {
            return stakingCheckpoints[date][nCheckpoints - 1].stake;
        }

        // Next check implicit zero balance
        if (stakingCheckpoints[date][0].fromBlock > blockNumber) {
            return 0;
        }

        uint32 lower = 0;
        uint32 upper = nCheckpoints - 1;
        while (upper > lower) {
            uint32 center = upper - (upper - lower) / 2; // ceil, avoiding overflow
            Checkpoint memory cp = stakingCheckpoints[date][center];
            if (cp.fromBlock == blockNumber) {
                return cp.stake;
            } else if (cp.fromBlock < blockNumber) {
                lower = center;
            } else {
                upper = center - 1;
            }
        }
        return stakingCheckpoints[date][lower].stake;
    }

    function _delegate(address delegator, address delegatee) internal {
        address currentDelegate = delegates[delegator];
        uint96 delegatorBalance = balances[delegator];
        delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorBalance);
    }

    function _moveDelegates(address srcRep, address dstRep, uint96 amount) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                uint32 srcRepNum = numCheckpoints[srcRep];
                uint96 srcRepOld = srcRepNum > 0 ? checkpoints[srcRep][srcRepNum - 1].stake : 0;
                uint96 srcRepNew = sub96(srcRepOld, amount, "Comp::_moveVotes: vote amount underflows");
                _writeCheckpoint(srcRep, srcRepNum, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                uint32 dstRepNum = numCheckpoints[dstRep];
                uint96 dstRepOld = dstRepNum > 0 ? checkpoints[dstRep][dstRepNum - 1].stake : 0;
                uint96 dstRepNew = add96(dstRepOld, amount, "Comp::_moveVotes: vote amount overflows");
                _writeCheckpoint(dstRep, dstRepNum, dstRepOld, dstRepNew);
            }
        }
        //todo else write checkpoints because voting power increased
    }

    function _writeCheckpoint(address delegatee, uint32 nCheckpoints, uint96 oldVotes, uint96 newVotes) internal {
      uint32 blockNumber = safe32(block.number, "Staking::_writeCheckpoint: block number exceeds 32 bits");

      if (nCheckpoints > 0 && checkpoints[delegatee][nCheckpoints - 1].fromBlock == blockNumber) {
          checkpoints[delegatee][nCheckpoints - 1].stake = newVotes;
      } else {
          checkpoints[delegatee][nCheckpoints] = Checkpoint(blockNumber, newVotes);
          numCheckpoints[delegatee] = nCheckpoints + 1;
      }

      emit DelegateVotesChanged(delegatee, oldVotes, newVotes);
    }
    
    function _increaseDailyStake(uint lockedTS, uint96 value) internal{
        uint32 nCheckpoints = numStakingCheckpoints[lockedTS];
        uint96 staked = stakingCheckpoints[lockedTS][nCheckpoints - 1].stake;
        uint96 newStake = add96(staked, value, "Staking::_increaseDailyStake: stakedUntil overflow");
        _writeStakingCheckpoint(lockedTS, nCheckpoints, newStake);
    }
    
    function _decreaseDailyStake(uint lockedTS, uint96 value) internal{
        uint32 nCheckpoints = numStakingCheckpoints[lockedTS];
        uint96 staked = stakingCheckpoints[lockedTS][nCheckpoints - 1].stake;
        uint96 newStake = sub96(staked, value, "Staking::_decreaseDailyStake: stakedUntil underflow");
        _writeStakingCheckpoint(lockedTS, nCheckpoints, newStake);
    }
    
    function _writeStakingCheckpoint(uint lockedTS, uint32 nCheckpoints, uint96 newStake) internal{
        uint32 blockNumber = safe32(block.number, "Staking::_writeStakingCheckpoint: block number exceeds 32 bits");
        
        if (nCheckpoints > 0 && stakingCheckpoints[lockedTS][nCheckpoints - 1].fromBlock == blockNumber) {
            stakingCheckpoints[lockedTS][nCheckpoints - 1].stake = newStake;
        } else {
            stakingCheckpoints[lockedTS][nCheckpoints] = Checkpoint(blockNumber, newStake);
            numStakingCheckpoints[lockedTS] = nCheckpoints + 1;
        }
        //todo emit event
    }

    function safe32(uint n, string memory errorMessage) internal pure returns (uint32) {
        require(n < 2**32, errorMessage);
        return uint32(n);
    }

    function safe96(uint n, string memory errorMessage) internal pure returns (uint96) {
        require(n < 2**96, errorMessage);
        return uint96(n);
    }

    function add96(uint96 a, uint96 b, string memory errorMessage) internal pure returns (uint96) {
        uint96 c = a + b;
        require(c >= a, errorMessage);
        return c;
    }

    function sub96(uint96 a, uint96 b, string memory errorMessage) internal pure returns (uint96) {
        require(b <= a, errorMessage);
        return a - b;
    }
    
    function mul96(uint96 a, uint96 b, string memory errorMessage) internal pure returns (uint96) {
        if (a == 0) {
            return 0;
        }

        uint96 c = a * b;
        require(c / a == b, errorMessage);

        return c;
    }

    function getChainId() internal pure returns (uint) {
        uint256 chainId;
        assembly { chainId := chainid() }
        return chainId;
    }
}