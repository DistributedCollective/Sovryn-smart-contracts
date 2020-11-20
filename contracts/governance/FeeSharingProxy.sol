pragma solidity ^0.5.17;

import "./Staking/SafeMath96.sol";
import "../openzeppelin/SafeMath.sol";
import "../openzeppelin/SafeERC20.sol";

contract FeeSharingProxy is SafeMath96 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    
    IProtocol public protocol;
    ILoanToken public loanToken;
    IStaking public staking;
    
    /// checkpoints by index per pool token address
    mapping(address => mapping(uint => Checkpoint)) tokenCheckpoints;
    /// @notice The number of checkpoints for each pool token address
    mapping(address => uint32) public numTokenCheckpoints;
    
    /// user => token => last checkpoint
    mapping(address => mapping(address => uint32)) public passedCheckpoints;
    
    uint FEE_WITHDRAWAL_INTERVAL = 86400;
    uint lastFeeWithdrawalTime;
    
    
    struct Checkpoint {
        uint32 blockNumber;
        uint96 totalWeightedStake;
        uint128 numTokens;
    }
    
    constructor(IProtocol _protocol, ILoanToken _loanToken, IStaking _staking) public {
        protocol = _protocol;
        loanToken = _loanToken;
        staking = _staking;
    }
    
    //TODO add events
    
    //TODO [3]: do we need to pass _amount or withdraw available balance (e.g. protocol.lendingFeeTokensHeld[_token]) ? - add method tp ProtocolSettings - 3 withdrawal
    function withdrawFees(address _token) public {
        //TODO validation
        require(block.timestamp - lastFeeWithdrawalTime >= FEE_WITHDRAWAL_INTERVAL, "FeeSharingProxy::withdrawFees: the last withdrawal was recently");
        
        require(protocol.withdrawFees(_token, address(this), 0), "FeeSharingProxy::withdrawFees: withdrawal failed");

        //TODO [5]: _token -> loanToken: what is the relation ? - underlyingToLoanPool
        uint depositAmount = 0; //TODO return from withdrawFees
        uint numTokens = loanToken.mint(address(this), depositAmount);
        _writeTokenCheckpoint(_token, uint128(numTokens));

        lastFeeWithdrawalTime = block.timestamp;
    }

    function withdraw(address _token, uint8 _maxCheckpoints, address _receiver) public {
        address user = msg.sender;
        if (_receiver == address(0)) {
            _receiver = msg.sender;
        }
        uint32 start = passedCheckpoints[user][_token];
        uint32 nCheckpoints = numTokenCheckpoints[_token];
        require(start < nCheckpoints, "FeeSharingProxy::withdrawFees: no tokens for a withdrawal");
        
        uint32 end = start + _maxCheckpoints; //TODO uint8
        if (end > nCheckpoints) {
            end = nCheckpoints;
        }
        uint256 amount = 0;
        for (uint32 i = start; i < end; i++) {
            Checkpoint storage checkpoint = tokenCheckpoints[_token][i];
            //uint96 weightedStake = staking.getPriorWeightedStake(user, checkpoint.blockNumber, date); //TODO [9]: we don't have date here
            uint96 weightedStake = 1;
//            uint96 share = mul96(checkpoint.numTokens, weightedStake, "multiplication overflow on share computation") / checkpoint.totalWeightedStake;
            uint share = (checkpoint.numTokens * weightedStake) / checkpoint.totalWeightedStake;
            amount = amount.add(share);
        }
        passedCheckpoints[user][_token] = end;
        
//        IERC20(_token).safeTransfer(user, amount);
        require(IERC20(_token).transfer(user, amount), "FeeSharingProxy::withdraw: withdrawal failed");
    }
    
    function _writeTokenCheckpoint(address _token, uint128 _numTokens) internal {
        uint32 blockNumber = safe32(block.number, "FeeSharingProxy::_writeCheckpoint: block number exceeds 32 bits");
        uint32 nCheckpoints = numTokenCheckpoints[_token];
    
        uint96 totalWeightedStake = staking.getPriorTotalVotingPower(blockNumber, block.timestamp);
        if (nCheckpoints > 0 && tokenCheckpoints[_token][nCheckpoints - 1].blockNumber == blockNumber) {
            tokenCheckpoints[_token][nCheckpoints - 1].totalWeightedStake = totalWeightedStake;
            tokenCheckpoints[_token][nCheckpoints - 1].numTokens = _numTokens;
        } else {
            tokenCheckpoints[_token][nCheckpoints] = Checkpoint(blockNumber, totalWeightedStake, _numTokens);
            numTokenCheckpoints[_token] = nCheckpoints + 1;
        }
    }
    
}

interface IProtocol {
    
    function withdrawFees(
        address token,
        address receiver,
        uint256 amount)
    external
    returns (bool);
    
}

interface ILoanToken {
    
    function mint(
        address receiver,
        uint256 depositAmount)
    external
    returns (uint256 mintAmount);
    
    function burn(
        address receiver,
        uint256 burnAmount)
    external
    returns (uint256 loanAmountPaid);
    
}

interface IStaking {
    
    function getPriorTotalVotingPower(uint32 blockNumber, uint time) view external returns (uint96);
    
    function getPriorWeightedStake(address account, uint blockNumber, uint date) external view returns (uint96);
    
}
