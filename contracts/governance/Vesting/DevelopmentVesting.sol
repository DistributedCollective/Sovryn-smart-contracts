pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../openzeppelin/SafeMath.sol";
import "../../interfaces/IERC20.sol";
import "./IVesting.sol";

contract DevelopmentVesting is Ownable {
    using SafeMath for uint;

    ///@notice the SOV token contract
    IERC20 public SOV;
    ///@notice the owner of the vested tokens (timelock contract initially)
    address public tokenOwner;
    ///@notice the cliff. after this time period the tokens begin to unlock
    uint public cliff;
    ///@notice the duration. after this period all tokens will have been unlocked
    uint public duration;
    ///@notice the start date of the vesting
    uint public startDate;
    ///@notice the end date of the vesting
    uint public endDate;
    ///@notice constant used for computing the vesting dates
    //TODO should be configurable ? wait for an answer
    //uint public intervalLength;
    uint constant FOUR_WEEKS = 4 weeks;
    ///@notice amount of vested tokens
    uint public amount;
    ///@notice amount of already withdrawn tokens
    uint public withdrawnAmount;
    ///@notice amount of already transferred locked tokens
    uint public transferredLockedAmount;

    event TokensStaked(address indexed caller, uint amount);
    event TokensWithdrawn(address indexed caller, address receiver, uint amount);
    event LockedTokensTransferred(address indexed caller, address vesting, uint amount);

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
     * @param _cliff the cliff in seconds
     * @param _duration the total duration in seconds
     */
    constructor(address _SOV, address _tokenOwner, uint _cliff, uint _duration) public {
        require(_SOV != address(0), "SOV address invalid");
        require(_tokenOwner != address(0), "token owner address invalid");
        _validateSchedule(_cliff, _duration);

        SOV = IERC20(_SOV);
        tokenOwner = _tokenOwner;
        cliff = _cliff;
        duration = _duration;
    }

    //TODO add setTokenOwner

    /**
     * @notice change the vesting schedule
     * @param _cliff the cliff in seconds
     * @param _duration the total duration in seconds
     */
    function changeSchedule(uint _cliff, uint _duration) public onlyOwner {
        _validateSchedule(_cliff, _duration);

        cliff = _cliff;
        duration = _duration;
    }

    function _validateSchedule(uint _cliff, uint _duration) internal pure {
        require(_duration >= _cliff, "duration must be bigger than or equal to the cliff");
        //TODO add checkings

    }

    //TODO add sendTokens - wait for an answer
//    function sendTokens

    /**
     * @notice stakes tokens
     * @param _amount the amount of tokens to stake
     */
    function vestTokens(uint _amount) public {
        //TODO is it possible to vest N times ? - wait for an answer
        require(startDate == 0);
        startDate = block.timestamp;
        endDate = block.timestamp + duration;

        //retrieve the SOV tokens
        bool success = SOV.transferFrom(msg.sender, address(this), _amount);
        require(success);

        //increase balance
//        amount = amount.add(_amount);
        amount = _amount;

        emit TokensStaked(msg.sender, amount);
    }

    //TODO withdrawTokens - onlyOwners - the governance should be able to spend the unlocked tokens
    /**
     * @notice withdraws unlocked tokens and forwards them to an address specified by the token owner
     * @param _receiver the receiving address
     * @dev this operation can be done N times
     */
    function withdrawTokens(address _receiver) public onlyOwners {
        require(_receiver != address(0), "receiver address invalid");

        uint availableAmount = _getAvailableAmount();
        require(availableAmount > 0, "no available tokens");

        withdrawnAmount += availableAmount;
        bool success = SOV.transfer(_receiver, availableAmount);
        require(success);

        emit TokensWithdrawn(msg.sender, _receiver, availableAmount);
    }

    //TODO use this calculation in tests
    //100 - amount
    //80 - unlocked
    //20 - withdrawn
    //60 - available
    //50 - transferred
    //50 - available
    function _getAvailableAmount() internal view returns (uint) {
        uint availableAmount = _getUnlockedAmount() - withdrawnAmount;
        if (availableAmount > amount - transferredLockedAmount) {
            availableAmount = amount - transferredLockedAmount;
        }
        return availableAmount;
    }

    //amount of SOV tokens never hits 2**256 - 1
    function _getUnlockedAmount() internal view returns (uint) {
        uint start = startDate + cliff;
        uint end = endDate;
        uint intervalLength = FOUR_WEEKS;
        if (block.timestamp >= start) {
            uint numIntervals = (end - start) / intervalLength + 1;
            uint amountPerInterval = amount / numIntervals;
            uint256 intervalNumber = (block.timestamp - start) / intervalLength + 1;
            if (intervalNumber > numIntervals) {
                intervalNumber = numIntervals;
            }
            //amountPerInterval might lose some dust on rounding. add it to the first interval
            uint unlockedAmount = amount - amountPerInterval * numIntervals;
            return unlockedAmount + amountPerInterval * intervalNumber;
        } else {
            return 0;
        }
    }

}
