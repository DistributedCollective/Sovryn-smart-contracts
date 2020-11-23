pragma solidity ^0.5.17;

import "./Staking/SafeMath96.sol";
import "../openzeppelin/SafeMath.sol";
import "../openzeppelin/SafeERC20.sol";

contract FeeSharingProxy is SafeMath96 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    
    //TODO reorder storage structure
    
    //TODO add comments
    
    IProtocol public protocol;
    IStaking public staking;
    address public loanToken;
    
    /// checkpoints by index per pool token address
    mapping(address => mapping(uint => Checkpoint)) tokenCheckpoints;
    /// @notice The number of checkpoints for each pool token address
    mapping(address => uint32) public numTokenCheckpoints;
    
    /// user => token => processed checkpoint
    mapping(address => mapping(address => uint32)) public processedCheckpoints;
    
    uint constant FEE_WITHDRAWAL_INTERVAL = 86400;
    uint lastFeeWithdrawalTime;
    
    uint32 constant MAX_CHECKPOINTS = 100; //TODO ?
    
    struct Checkpoint {
        uint32 blockNumber;
        uint96 totalWeightedStake;
        uint128 numTokens;
    }
    
    /// @notice An event that emitted when fee get withdrawn
    event FeeWithdrawn(address indexed sender, address indexed token, uint amount);
    
    /// @notice An event that emitted when user fee get withdrawn
    event UserFeeWithdrawn(address indexed sender, address indexed receiver, address indexed token, uint amount);
    
    constructor(IProtocol _protocol, IStaking _staking, address _loanToken) public {
        protocol = _protocol;
        staking = _staking;
        loanToken = _loanToken;
    }
    
    function withdrawFees(address _token) public {
        require(_token != address(0), "FeeSharingProxy::withdrawFees: invalid address");
        require(
            block.timestamp - lastFeeWithdrawalTime >= FEE_WITHDRAWAL_INTERVAL,
            "FeeSharingProxy::withdrawFees: the last withdrawal was recently"
        );
    
        address loanPoolToken = protocol.underlyingToLoanPool(_token);
        require(loanPoolToken != address(0), "FeeSharingProxy::withdrawFees: loan token not found");

        //TODO MOCK
//        uint amount = protocol.withdrawFees(_token, address(this));
        uint amount = 123;
        require(amount > 0, "FeeSharingProxy::withdrawFees: no tokens to withdraw");

        //TODO Method can be also used - function addLiquidity(IERC20Token _reserveToken, uint256 _amount, uint256 _minReturn)
        IERC20(_token).approve(loanToken, amount);
        uint poolTokenAmount = ILoanToken(loanPoolToken).mint(address(this), amount);
        _writeTokenCheckpoint(_token, uint128(poolTokenAmount));

        lastFeeWithdrawalTime = block.timestamp;
        
        emit FeeWithdrawn(msg.sender, _token, amount);
    }

    //TODO check gas
    //TODO Withdrawal should only be possible for blocks which were already mined.
    function withdraw(address _token, uint32 _maxCheckpoints, address _receiver) public returns (uint) {
        address user = msg.sender;
        if (_receiver == address(0)) {
            _receiver = msg.sender;
        }
        uint32 start = processedCheckpoints[user][_token];
        uint32 nCheckpoints = numTokenCheckpoints[_token];
        require(start < nCheckpoints, "FeeSharingProxy::withdrawFees: no tokens for a withdrawal");

        if (_maxCheckpoints > MAX_CHECKPOINTS) {
            _maxCheckpoints = MAX_CHECKPOINTS;
        }
        uint32 end = start + _maxCheckpoints; //overflow doesn't matter here //TODO check
        if (end > nCheckpoints) {
            end = nCheckpoints;
        }
        uint256 amount = 0;
        for (uint32 i = start; i < end; i++) {
            Checkpoint storage checkpoint = tokenCheckpoints[_token][i];
            //uint96 weightedStake = staking.getPriorWeightedStake(user, checkpoint.blockNumber, date); //TODO [9]: we don't have date here
            uint weightedStake = 1;
            uint share = uint(checkpoint.numTokens).mul(weightedStake).div(uint(checkpoint.totalWeightedStake));
            amount = amount.add(share);
        }
        processedCheckpoints[user][_token] = end;
        
//        IERC20(_token).safeTransfer(user, amount);
        require(IERC20(_token).transfer(user, amount), "FeeSharingProxy::withdraw: withdrawal failed");
    
        emit UserFeeWithdrawn(msg.sender, _receiver, _token, amount);
        
        return nCheckpoints - end;
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
    function withdrawFees(address token, address receiver) external returns (uint);
    function underlyingToLoanPool(address token) external returns (address);
}

interface ILoanToken {
    function mint(address receiver, uint256 depositAmount) external returns (uint256 mintAmount);
}

interface IStaking {
    function getPriorTotalVotingPower(uint32 blockNumber, uint time) view external returns (uint96);
    function getPriorWeightedStake(address account, uint blockNumber, uint date) external view returns (uint96);
}
