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
    ///@notice the frequency. part of tokens will have been unlocked periodically
    uint public frequency;
    ///@notice the start date of the vesting
    uint public startDate;
    ///@notice the end date of the vesting
    uint public endDate;
    ///@notice amount of vested tokens
    uint public amount;
    ///@notice amount of already withdrawn tokens
    uint public withdrawnAmount;

    ///@notice amount of locked tokens, these tokens can be withdrawn any time by an owner
    uint public lockedAmount;

    event TokensSent(address indexed caller, uint amount);
    event LockedTokensWithdrawn(address indexed caller, address receiver, uint amount);
    event TokensVested(address indexed caller, uint amount);
    event VestedTokensWithdrawn(address indexed caller, address receiver, uint amount);

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
     * @param _frequency the withdrawal interval in seconds
     */
    constructor(address _SOV, address _tokenOwner, uint _cliff, uint _duration, uint _frequency) public {
        require(_SOV != address(0), "SOV address invalid");
        require(_tokenOwner != address(0), "token owner address invalid");

        _setSchedule(_cliff, _duration, _frequency);

        SOV = IERC20(_SOV);
        tokenOwner = _tokenOwner;
    }

    function setTokenOwner(address _tokenOwner) public onlyOwner {
        require(_tokenOwner != address(0), "token owner address invalid");
        tokenOwner = _tokenOwner;
    }

    function sendTokens(uint _amount) public {
        require(_amount > 0, "amount needs to be bigger than 0");

        //retrieve the SOV tokens
        bool success = SOV.transferFrom(msg.sender, address(this), _amount);
        require(success);

        lockedAmount += _amount;

        emit TokensSent(msg.sender, _amount);
    }

    //TODO onlyOwners or onlyOwner ?
    function withdrawLockedTokens(uint _amount, address _receiver) public onlyOwners {
        require(_amount > 0, "amount needs to be bigger than 0");
        require(_amount <= lockedAmount, "amount is not available");
        require(_receiver != address(0), "receiver address invalid");

        bool success = SOV.transfer(_receiver, _amount);
        require(success);

        lockedAmount -= _amount;

        emit LockedTokensWithdrawn(msg.sender, _receiver, _amount);
    }

    /**
     * @notice change the vesting schedule
     * @param _cliff the cliff in seconds
     * @param _duration the total duration in seconds
     * @param _frequency the withdrawal interval in seconds
     */
    function changeSchedule(uint _cliff, uint _duration, uint _frequency) public onlyOwner {
        _setSchedule(_cliff, _duration, _frequency);
    }

    function _setSchedule(uint _cliff, uint _duration, uint _frequency) internal {
        require(_duration >= _cliff, "duration must be bigger than or equal to the cliff");
        require(_duration - cliff / _frequency >= 1, "frequency is bigger than (duration - cliff)");

        cliff = _cliff;
        duration = _duration;
        frequency = _frequency;
    }

    /**
     * @notice stakes tokens
     * @param _amount the amount of tokens to stake
     */
    function vestTokens(uint _amount) public {
        require(startDate == 0);
        startDate = block.timestamp;
        endDate = block.timestamp + duration;

        //retrieve the SOV tokens
        bool success = SOV.transferFrom(msg.sender, address(this), _amount);
        require(success);

        amount = _amount;

        emit TokensVested(msg.sender, amount);
    }

    /**
     * @notice withdraws unlocked tokens and forwards them to an address specified by the token owner
     * @param _receiver the receiving address
     * @dev this operation can be done N times
     */
    function withdrawVestedTokens(address _receiver) public onlyOwners {
        require(_receiver != address(0), "receiver address invalid");

        uint availableAmount = _getAvailableAmount();
        require(availableAmount > 0, "no available tokens");

        withdrawnAmount += availableAmount;
        bool success = SOV.transfer(_receiver, availableAmount);
        require(success);

        emit VestedTokensWithdrawn(msg.sender, _receiver, availableAmount);
    }

    function _getAvailableAmount() internal view returns (uint) {
        return _getUnlockedAmount() - withdrawnAmount;
    }

    //amount of SOV tokens never hits 2**256 - 1
    function _getUnlockedAmount() internal view returns (uint) {
        uint start = startDate + cliff;
        uint end = endDate;
        if (block.timestamp >= start) {
            uint numIntervals = (end - start) / frequency + 1;
            uint amountPerInterval = amount / numIntervals;
            uint256 intervalNumber = (block.timestamp - start) / frequency + 1;
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
