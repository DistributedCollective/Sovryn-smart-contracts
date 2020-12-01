pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../Staking/Staking.sol";
import "../IFeeSharingProxy.sol";

contract Vesting is Ownable {
    ///@notice the SOV token contract
    IERC20 public SOV; 
    ///@notice the staking contract address
    Staking public staking;
    ///@notice the owner of the vested tokens
    address public tokenOwner;
    //@notice fee sharing Proxy
    IFeeSharingProxy public feeSharingProxy;
    ///@notice the cliff. after this time period the tokens begin to unlock
    uint public cliff;
    ///@notice the duration. after this period all tokens will have been unlocked
    uint public duration;
    ///@notice the start date of the vesting
    uint public startDate;
    ///@notice constant used for computing the vesting dates
    uint constant FOUR_WEEKS = 4 weeks;

    event TokensStaked(address indexed caller, uint amount);
    event TokensWithdrawn(address indexed caller, address receiver);
    event DividendsCollected(address indexed caller, address receiver, uint32 maxCheckpoints);
    event MigratedToNewStakingContract(address indexed caller, address newStakingContract);

    /**
     * @dev Throws if called by any account other than the token owner or the contract owner.
     */
    modifier onlyOwners() {
        require(msg.sender == tokenOwner || isOwner(), "unauthorized");
        _;
    }

    /**
     * @notice setup the vesting schedule
     * @param _SOV the SOV token address
     * @param _tokenOwner the owner of the tokens
     * @param _cliff the cliff in seconds
     * @param _duration the total duration in seconds
     * */
    constructor(address _SOV, address _stakingAddress, address _tokenOwner, uint _cliff, uint _duration, address _feeSharingProxy) public {
        require(_SOV != address(0), "SOV address invalid");
        require(_stakingAddress != address(0), "staking address invalid");
        require(_tokenOwner != address(0), "token owner address invalid");
        require(_duration >= _cliff, "duration must be bigger than or equal to the cliff");
        require(_feeSharingProxy != address(0), "feeSharingProxy address invalid");
        SOV = IERC20(_SOV);
        staking = Staking(_stakingAddress);
        require(_duration <= staking.MAX_DURATION(), "duration may not exceed the max duration");
        tokenOwner = _tokenOwner;
        cliff = _cliff;
        duration = _duration;
        feeSharingProxy = IFeeSharingProxy(_feeSharingProxy);
    }

    /**
     * @notice stakes tokens according to the vesting schedule
     * @param amount the amount of tokens to stake
     * */
    function stakeTokens(uint amount) public {
        //maybe better to allow staking unil the cliff was reached
        require(startDate == 0, "stakeTokens can be called only once.");
        startDate = staking.timestampToLockDate(block.timestamp);
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
        if(numIntervals > 1) {
            staking.stake(uint96(amount - stakedPerInterval * (numIntervals-1)), start, address(this), tokenOwner);
        }
        //stake the rest in 4 week intervals
        for(uint i = start + FOUR_WEEKS; i <= end; i+= FOUR_WEEKS) {
            //stakes for itself, delegates to the owner
            staking.stake(uint96(stakedPerInterval), i, address(this), tokenOwner);
        }

        emit TokensStaked(msg.sender, amount);
    }

    /**
     * @notice withdraws unlocked tokens from the staking contract and forwards them to an address specified by the token owner
     * @param receiver the receiving address
     * */
    function withdrawTokens(address receiver) public onlyOwners {
        uint96 stake;
        //usually we just need to iterate over the possible dates until now
        uint end;
        //in the unlikely case that all tokens have been unlocked early, allow to withdraw all of them.
        if (staking.allUnlocked()) {
            end = startDate + duration;
        } else {
            end = block.timestamp;
        }
        //withdraw for each unlocked position
        for(uint i = startDate+cliff; i < end; i += FOUR_WEEKS){
            //read amount to withdraw
            stake = staking.getPriorUserStakeByDate(address(this), i, block.number - 1);
            //withdraw if > 0
            if(stake > 0) {
                staking.withdraw(stake, i, receiver);
            }
        }

        emit TokensWithdrawn(msg.sender, receiver);
    }

    /**
     * @dev collect dividends from fee sharing proxy
     */
    function collectDividends(address receiver, uint32 maxCheckpoints) public onlyOwners{
        //invokes the fee sharing proxy
        feeSharingProxy.withdrawTokens(address(SOV), maxCheckpoints, receiver);
        emit DividendsCollected(msg.sender, receiver, maxCheckpoints);
    }
    
    /**
     * @notice allows the owners to migrate the positions to a new staking contract
     * */
    function migrateToNewStakingContract() public onlyOwners {
        staking.migrateToNewStakingContract();
        staking = Staking(staking.newStakingContract());
        emit MigratedToNewStakingContract(msg.sender, address(staking));
    }
}