pragma solidity ^0.5.17;

import "./Staking/SafeMath96.sol";
import "../openzeppelin/SafeMath.sol";
import "../openzeppelin/SafeERC20.sol";

contract FeeSharingProxy is SafeMath96 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    
    IProtocol public protocol;
    IStaking public staking;
    address public loanToken;
    
    /// checkpoints by index per pool token address
    mapping(address => mapping(uint => Checkpoint)) public tokenCheckpoints;
    /// @notice The number of checkpoints for each pool token address
    mapping(address => uint32) public numTokenCheckpoints;
    
    /// user => token => processed checkpoint
    mapping(address => mapping(address => uint32)) public processedCheckpoints;
    
    //TODO FEE_WITHDRAWAL_INTERVAL, MAX_CHECKPOINTS
    uint constant FEE_WITHDRAWAL_INTERVAL = 86400;
    uint public lastFeeWithdrawalTime;
    
    uint32 constant MAX_CHECKPOINTS = 100;
    
    struct Checkpoint {
        uint32 blockNumber;
        uint32 timestamp;
        uint96 totalWeightedStake;
        uint96 numTokens;
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
    
    /**
     * @notice withdraw fees for the given token: lendingFee + tradingFee + borrowingFee
     * @param _token address of the token
     * */
    function withdrawFees(address _token) public {
        require(_token != address(0), "FeeSharingProxy::withdrawFees: invalid address");
        require(
            block.timestamp - lastFeeWithdrawalTime >= FEE_WITHDRAWAL_INTERVAL,
            "FeeSharingProxy::withdrawFees: the last withdrawal was recently"
        );
    
        address loanPoolToken = protocol.underlyingToLoanPool(_token);
        require(loanPoolToken != address(0), "FeeSharingProxy::withdrawFees: loan token not found");

        uint amount = protocol.withdrawFees(_token, address(this));
        require(amount > 0, "FeeSharingProxy::withdrawFees: no tokens to withdraw");

        //TODO can be also used - function addLiquidity(IERC20Token _reserveToken, uint256 _amount, uint256 _minReturn)
        IERC20(_token).approve(loanToken, amount);
        uint poolTokenAmount = ILoanToken(loanPoolToken).mint(address(this), amount);
        _writeTokenCheckpoint(loanPoolToken, uint96(poolTokenAmount));

        lastFeeWithdrawalTime = block.timestamp;
        
        emit FeeWithdrawn(msg.sender, loanPoolToken, poolTokenAmount);
    }

    /**
     * @notice withdraw accumulated fee the message sender
     * @param _loanPoolToken address of the pool token
     * @param _maxCheckpoints maximum number of checkpoints to be processed
     * @param _receiver the receiver of tokens or msg.sender
     * */
    function withdraw(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver) public {
        address user = msg.sender;
        if (_receiver == address(0)) {
            _receiver = msg.sender;
        }
        uint32 start = processedCheckpoints[user][_loanPoolToken];
        uint32 nCheckpoints = numTokenCheckpoints[_loanPoolToken];
        require(start < nCheckpoints, "FeeSharingProxy::withdrawFees: no tokens for a withdrawal");

        if (_maxCheckpoints > MAX_CHECKPOINTS) {
            _maxCheckpoints = MAX_CHECKPOINTS;
        }
        uint32 end = safe32(start + _maxCheckpoints, "FeeSharingProxy::withdraw: checkpoint index exceeds 32 bits");
        if (end > nCheckpoints) {
            end = nCheckpoints;
        }
        //Withdrawal should only be possible for blocks which were already mined.
        uint32 lastBlockNumber = tokenCheckpoints[_loanPoolToken][end - 1].blockNumber;
        if (block.number == lastBlockNumber) {
            end--;
        }
        uint256 amount = 0;
        for (uint32 i = start; i < end; i++) {
            Checkpoint storage checkpoint = tokenCheckpoints[_loanPoolToken][i];
            uint96 weightedStake = staking.getPriorWeightedStake(user, checkpoint.blockNumber - 1, checkpoint.timestamp);
            uint share = uint(checkpoint.numTokens).mul(weightedStake).div(uint(checkpoint.totalWeightedStake));
            amount = amount.add(share);
        }
        processedCheckpoints[user][_loanPoolToken] = end;
        
        require(IERC20(_loanPoolToken).transfer(user, amount), "FeeSharingProxy::withdraw: withdrawal failed");
    
        emit UserFeeWithdrawn(msg.sender, _receiver, _loanPoolToken, amount);
    }
    
    function _writeTokenCheckpoint(address _token, uint96 _numTokens) internal {
        uint32 blockNumber = safe32(block.number, "FeeSharingProxy::_writeCheckpoint: block number exceeds 32 bits");
        uint32 blockTimestamp = safe32(block.timestamp, "FeeSharingProxy::_writeCheckpoint: block timestamp exceeds 32 bits");
        uint32 nCheckpoints = numTokenCheckpoints[_token];

        uint96 totalWeightedStake = staking.getPriorTotalVotingPower(blockNumber - 1, block.timestamp);
        if (nCheckpoints > 0 && tokenCheckpoints[_token][nCheckpoints - 1].blockNumber == blockNumber) {
            tokenCheckpoints[_token][nCheckpoints - 1].totalWeightedStake = totalWeightedStake;
            tokenCheckpoints[_token][nCheckpoints - 1].numTokens = _numTokens;
        } else {
            tokenCheckpoints[_token][nCheckpoints] = Checkpoint(blockNumber, blockTimestamp, totalWeightedStake, _numTokens);
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
