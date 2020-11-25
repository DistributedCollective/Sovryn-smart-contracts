pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../Staking/Staking.sol";

contract Vesting is Ownable{
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
    ///@notice the start date of the vesting
    uint public startDate;
    ///@notice constant used for computing the vesting dates 
    uint constant FOUR_WEEKS = 28 days;
    
    
    /**
     * @dev Throws if called by any account other than the token owner or the contract owner.
     */
    modifier onlyOwners() {
        require(msg.sender == tokenOwner || isOwner(msg.sender), "unauthorized");
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
        require(startDate == 0; "stakeTokens can be called only once.");
        startDate = block.number;
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
    function withdrawTokens(address receiver) public onlyOwners{
        uint stake;
        //withdraw for each unlocked position
        for(uint i = startDate+cliff; i < block.timestamp; i += FOUR_WEEKS){
            //read amount to withdraw
            stake = staking.getPriorUserStakeByDate(address(this), i, block.number - 1);
            //withdraw if > 0
            if(stake > 0)
                staking.withdraw(stake, i, receiver);
        }
    }
    
    function collectDividends() public onlyOwners{
        //invokes the fee sharing proxy
    }
    
    //token owner or owner should be allowed to change the staking contract - in case it ever gets changed and the funds moved
    //might also need a function to move the funds to the new staking contract should the staking contract implement such a function
    
}