pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../interfaces/IERC20.sol";
import "../Staking/Staking.sol";

contract Vesting{
    ///@notice the SOV token contract
    IERC20 public SOV; 
    ///@notice the staking contract address
    Staking staking;
    ///@notice the owner of the vested tokens
    address public tokenOwner;
    ///@notice the cliff. after this time period the tokens begin to unlock
    uint public cliff;
    ///@notice the duration. after this period all tokens will have been unlocked
    uint public duration;
    ///@notice constant used for computing the vesting dates 
    uint constant FOUR_WEEKS = 28 days;
    
    /**
     * @dev Throws if called by any account other than the token owner.
     */
    modifier onlyTokenOwner() {
        require(msg.sender == tokenOwner, "unauthorized");
        _;
    }
    
    /**
     * @notice setup the vesting schedule
     * @param _SOV the SOV token address
     * @param _tokenOwner the owner of the tokens
     * @param _cliff the cliff in seconds
     * @param _duration the total duration in seconds
     * */
    constructor(address _SOV, address _stakingAddress, address _tokenOwner, uint _cliff, uint _duration) public{
        require(_duration <= staking.MAX_DURATION(), "duration may not exceed the max duration");
        require(_duration >= _cliff, "duration must be bigger than or equal to the cliff");
        SOV = IERC20(_SOV);
        staking = Staking(_stakingAddress);
        tokenOwner = _tokenOwner;
        cliff = _cliff;
        duration = _duration;
    }
    
    /**
     * @notice stakes tokens according to the vesting schedule
     * @param amount the amount of tokens to stake
     * */
    function stakeTokens(uint amount) public{
        //transfer the tokens to this contract
        bool success = SOV.transferFrom(msg.sender, address(this), amount);
        require(success);
        //allow the staking contract to access them
        SOV.approve(address(staking), amount);
        //stake them until lock dates according to the vesting schedule
        //note: because staking is only possible in periods of 2 weeks, the total duration might 
        //end up a bit shorter than specified depending on the date of staking.
        uint start = block.timestamp + cliff;
        uint end = block.timestamp + duration;
        uint numIntervals = (end - start)/FOUR_WEEKS + 1;
        uint stakedPerInterval = amount/numIntervals;
        //stakedPerInterval might lose some dust on rounding. add it to the first staking date
        if(numIntervals > 1)
            staking.stake(uint96(amount - stakedPerInterval * (numIntervals-1)), start, address(this), tokenOwner);
        //stake the rest in 4 week intervals
        for(uint i = start + FOUR_WEEKS; i <= end; i+= FOUR_WEEKS){
            //stakes for itself, delegates to the owner
            staking.stake(uint96(stakedPerInterval), i, address(this), tokenOwner);
        }
     
        
        //think: what if there are already tokens staked for that user until that time? --> increaseStake or not allow?
    }
    
    /**
     * @notice withdraws unlocked tokens from the staking contract and forwards them to an address specified by the token owner
     * @param receiver the receiving address
     * */
    function withdrawTokens(address receiver) public onlyTokenOwner{
        //after tokens are unlocked they may be withdrawn
        //withdraws from staking and forwards to the user
        //read amount to withdraw
        //staking.withdraw(amount, receiver)
    }
    
    function collectDividends() public onlyTokenOwner{
        //invokes the fee sharing proxy
    }
    
    //token owner or owner should be allowed to change the staking contract
    
}