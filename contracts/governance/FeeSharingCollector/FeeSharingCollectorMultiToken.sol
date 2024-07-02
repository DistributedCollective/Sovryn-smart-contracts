pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../Staking/SafeMath96.sol";
import "../../openzeppelin/SafeMath.sol";
import "../../openzeppelin/SafeERC20.sol";
import "../../openzeppelin/Ownable.sol";
import "../IFeeSharingCollectorMultiToken.sol";
import "../../openzeppelin/Address.sol";
import "./FeeSharingCollectorStorage.sol";
import "../../interfaces/ISovrynDex.sol";

/**
 * @title The FeeSharingCollectorMultiToken contract.
 * @notice Staking is not only granting voting rights, but also access to fee
 * sharing according to the own voting power in relation to the total. Whenever
 * somebody decides to collect the fees from the protocol, they get transferred
 * to a proxy contract which invests the funds in the lending pool and keeps
 * the pool tokens.
 *
 * The fee sharing proxy will be set as feesController of the protocol contract.
 * This allows the fee sharing proxy to withdraw the fees. The fee sharing
 * proxy holds the pool tokens and keeps track of which user owns how many
 * tokens. In order to know how many tokens a user owns, the fee sharing proxy
 * needs to know the user’s weighted stake in relation to the total weighted
 * stake (aka total voting power).
 *
 * Because both values are subject to change, they may be different on each fee
 * withdrawal. To be able to calculate a user’s share of tokens when he wants
 * to withdraw, we need checkpoints.
 *
 * This contract is intended to be set as the protocol fee collector.
 * Anybody can invoke the withdrawFees function which uses
 * protocol.withdrawFees to obtain available fees from operations on a
 * certain token. These fees are deposited in the corresponding loanPool.
 * Also, the staking contract sends slashed tokens to this contract. When a
 * user calls the withdraw function, the contract transfers the fee sharing
 * rewards in proportion to the user’s weighted stake since the last withdrawal.
 *
 * The protocol is collecting fees in all sorts of currencies and then automatically
 * supplies them to the respective lending pools. Therefore, all fees are
 * generating interest for the SOV holders. If one of them withdraws fees, it will
 * get pool tokens. It is planned to add the option to convert anything to native token
 * before withdrawing, but not yet implemented.
 * */
contract FeeSharingCollectorMultiToken is
    SafeMath96,
    IFeeSharingCollectorMultiToken,
    Ownable,
    FeeSharingCollectorStorage
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address constant ZERO_ADDRESS = address(0);
    /** To support backward compatibility, we need to keep this constant variable name as it is (which is derived from rsk network) */
    address public constant RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT =
        address(uint160(uint256(keccak256("RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT"))));
    uint16 public constant SOVRYN_DEX_COLD_PATH_PROXY_IDX = 3;
    uint8 public constant SOVRYN_DEX_CMD_COLLECT_TREASURY_CODE = 40;

    /* Events */

    /// @notice An event emitted when fee get withdrawn.
    event FeeWithdrawn(address indexed sender, address indexed token, uint256 amount);

    /// @notice An event emitted when tokens transferred.
    event TokensTransferred(address indexed sender, address indexed token, uint256 amount);

    /// @notice An event emitted when checkpoint added.
    event CheckpointAdded(address indexed sender, address indexed token, uint256 amount);

    /// @notice An event emitted when user fee get withdrawn.
    event UserFeeWithdrawn(
        address indexed sender,
        address indexed receiver,
        address indexed token,
        uint256 amount
    );

    event SetWrappedNativeToken(
        address indexed sender,
        address indexed oldWrappedNativeToken,
        address indexed newWrappedNativeToken
    );

    event SetProtocolAddress(address indexed sender, address _protocolAddress);

    event SetSovrynDexAddress(
        address indexed sender,
        address indexed oldSovrynDexAddress,
        address indexed newSovrynDexAddress
    );

    /* Functions */
    /// @dev fallback function to support nativeToken transfer when unwrap the wrappedNativeToken.
    function() external payable {}

    /**
     * @dev initialize function for fee sharing collector proxy
     * @param wrappedNativeToken wrappedNativeToken token address
     * @param dexAddress wrappedNativeToken token address
     */
    function initialize(
        address wrappedNativeToken,
        address dexAddress
    ) external onlyOwner oneTimeExecution(this.initialize.selector) {
        setWrappedNativeToken(wrappedNativeToken);
        setSovrynDexAddress(dexAddress);
    }

    /**
     * @notice Set the wrappedNativeToken token address of fee sharing collector.
     *
     * only owner can perform this action.
     *
     * @param newWrappedNativeTokenAddress The new address of the wrappedNativeToken token.
     * */
    function setWrappedNativeToken(address newWrappedNativeTokenAddress) public onlyOwner {
        require(
            Address.isContract(newWrappedNativeTokenAddress),
            "newWrappedNativeTokenAddress not a contract"
        );
        emit SetWrappedNativeToken(
            msg.sender,
            wrappedNativeTokenAddress,
            newWrappedNativeTokenAddress
        );
        wrappedNativeTokenAddress = newWrappedNativeTokenAddress;
    }

    /**
     * @notice Set the Protocol address if not set at initial deployment of the proxy contract
     *
     * only owner can perform this action.
     *
     * @param _protocolAddress Sovryn protocol address.
     * */
    function setProtocolAddress(
        address _protocolAddress
    ) public onlyOwner oneTimeExecution(this.setProtocolAddress.selector) {
        require(Address.isContract(_protocolAddress), "_protocolAddress not a contract");
        require(address(protocol) == address(0x0), "protocol address already set");
        protocol = IProtocol(_protocolAddress);
        emit SetProtocolAddress(msg.sender, _protocolAddress);
    }

    function setSovrynDexAddress(address _sovrynDexAddress) public onlyOwner {
        require(Address.isContract(_sovrynDexAddress), "_sovrynDexAddress not a contract");
        emit SetSovrynDexAddress(msg.sender, sovrynDexAddress, _sovrynDexAddress);
        sovrynDexAddress = _sovrynDexAddress;
    }

    /**
     * @notice Withdraw fees for the given token:
     * lendingFee + tradingFee + borrowingFee
     *
     * @param _tokens array address of the token
     * */
    function withdrawFees(address[] memory _tokens) public {
        for (uint256 i = 0; i < _tokens.length; i++) {
            require(
                Address.isContract(_tokens[i]),
                "FeeSharingCollectorMultiToken::withdrawFees: token is not a contract"
            );
        }

        uint256 wrappedNativeTokenAmountWithdrawn = protocol.withdrawFees(_tokens, address(this));
        uint256 poolTokenAmount;

        require(
            wrappedNativeTokenAddress != address(0),
            "FeeSharingCollectorMultiToken::withdrawFees: wrappedNativeTokenAddress is not set"
        );

        address loanPoolToken = protocol.underlyingToLoanPool(wrappedNativeTokenAddress);
        require(
            loanPoolToken != address(0),
            "FeeSharingCollectorMultiToken::withdrawFees: loan wrappedNativeTokenAddress not found"
        );

        if (wrappedNativeTokenAmountWithdrawn > 0) {
            /// @dev TODO can be also used - function addLiquidity(IERC20Token _reserveToken, uint256 _amount, uint256 _minReturn)
            IERC20(wrappedNativeTokenAddress).approve(
                loanPoolToken,
                wrappedNativeTokenAmountWithdrawn
            );
            poolTokenAmount = ILoanToken(loanPoolToken).mint(
                address(this),
                wrappedNativeTokenAmountWithdrawn
            );

            /// @notice Update unprocessed amount of tokens
            uint96 amount96 = safe96(
                poolTokenAmount,
                "FeeSharingCollectorMultiToken::withdrawFees: pool token amount exceeds 96 bits"
            );

            _addCheckpoint(loanPoolToken, amount96);
        }

        emit FeeWithdrawn(msg.sender, loanPoolToken, poolTokenAmount);
    }

    /**
     * @notice Withdraw fees from Sovryn DEX
     * protocolFee from the conversion
     * the fees will be converted in wrappedNativeToken form, and then will be transferred to wrappedNativeToken loan pool
     *
     * @param _tokens array addresses of the tokens
     * */
    function withdrawFeesFromDex(address[] memory _tokens) public {
        for (uint256 i = 0; i < _tokens.length; i++) {
            require(
                Address.isContract(_tokens[i]),
                "FeeSharingCollector::withdrawFeesFromDex: token is not a contract"
            );
        }

        /** Withdraw from dex */
        bytes memory cmd = abi.encode(SOVRYN_DEX_CMD_COLLECT_TREASURY_CODE, _tokens);
        ISovrynDex(sovrynDexAddress).userCmd(SOVRYN_DEX_COLD_PATH_PROXY_IDX, cmd);
    }

    /**
     * @notice Transfer tokens to this contract.
     * @dev We just update amount of tokens here and write checkpoint in a separate methods
     * in order to prevent adding checkpoints too often.
     * @dev the caller should take care of setting allowance for the token
     * @param _token Address of the token.
     * @param _amount Amount to be transferred.
     * */
    function transferTokens(address _token, uint96 _amount) public {
        require(
            _token != ZERO_ADDRESS,
            "FeeSharingCollectorMultiToken::transferTokens: invalid address"
        );
        require(_amount > 0, "FeeSharingCollectorMultiToken::transferTokens: invalid amount");

        /// @notice Transfer tokens from msg.sender
        bool success = IERC20(_token).transferFrom(address(msg.sender), address(this), _amount);
        require(success, "Staking::transferTokens: token transfer failed");

        // if _token is wrappedNativeToken, need to unwrap it to nativeToken
        IWrappedNativeTokenERC20 wrappedNativeToken = IWrappedNativeTokenERC20(
            wrappedNativeTokenAddress
        );
        if (_token == address(wrappedNativeToken)) {
            wrappedNativeToken.withdraw(_amount);
            _token = RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT;
        }

        _addCheckpoint(_token, _amount);

        emit TokensTransferred(msg.sender, _token, _amount);
    }

    /**
     * @notice Add checkpoint with accumulated amount by function invocation.
     * @param _token Address of the token.
     * */
    function _addCheckpoint(address _token, uint96 _amount) internal {
        if (block.timestamp - lastFeeWithdrawalTime[_token] >= FEE_WITHDRAWAL_INTERVAL) {
            lastFeeWithdrawalTime[_token] = block.timestamp;
            uint96 amount = add96(
                unprocessedAmount[_token],
                _amount,
                "FeeSharingCollectorMultiToken::_addCheckpoint: amount exceeds 96 bits"
            );

            /// @notice Reset unprocessed amount of tokens to zero.
            unprocessedAmount[_token] = 0;

            /// @notice Write a regular checkpoint.
            _writeTokenCheckpoint(_token, amount);
        } else {
            unprocessedAmount[_token] = add96(
                unprocessedAmount[_token],
                _amount,
                "FeeSharingCollectorMultiToken::_addCheckpoint: unprocessedAmount exceeds 96 bits"
            );
        }
    }

    /**
     * @notice Withdraw accumulated fee to the message sender.
     *
     * The Sovryn protocol collects fees on every trade/swap and loan.
     * These fees will be distributed to SOV stakers based on their voting
     * power as a percentage of total voting power. Therefore, staking more
     * SOV and/or staking for longer will increase your share of the fees
     * generated, meaning you will earn more from staking.
     *
     * This function will directly burnToBTC and use the msg.sender (user) as the receiver
     *
     * @param _token  Addresses of the pool token.
     * @param _maxCheckpoint Maximum number of checkpoints to be processed.
     * @param _receiver The receiver of tokens or msg.sender
     * */
    function withdraw(
        address _token,
        uint32 _maxCheckpoint,
        address _receiver
    ) public nonReentrant {
        _withdraw(_token, _maxCheckpoint, _receiver);
    }

    /**
     * @notice Withdraw accumulated fees (multiple token) to the message sender.
     *
     * The Sovryn protocol collects fees on every trade/swap and loan.
     * These fees will be distributed to SOV stakers based on their voting
     * power as a percentage of total voting power. Therefore, staking more
     * SOV and/or staking for longer will increase your share of the fees
     * generated, meaning you will earn more from staking.
     *
     * This function will directly burnToBTC and use the msg.sender (user) as the receiver
     *
     * @param _tokens Array of Addresses of the pool token.
     * @param _maxCheckpoints Array of Maximum number of checkpoints to be processed.
     * @param _receiver The receiver of tokens or msg.sender
     * */
    function withdrawTokens(
        address[] memory _tokens,
        uint32[] memory _maxCheckpoints,
        address _receiver
    ) public nonReentrant {
        require(
            _tokens.length == _maxCheckpoints.length,
            "length mismatch _tokens <> _maxCheckpoints"
        );

        for (uint256 i = 0; i < _tokens.length; i++) {
            address _token = _tokens[i];
            uint32 _maxCheckpoint = _maxCheckpoints[i];

            _withdraw(_token, _maxCheckpoint, _receiver);
        }
    }

    /**
     * @notice Internal function to withdraw accumulated fee to the message sender.
     *
     * The Sovryn protocol collects fees on every trade/swap and loan.
     * These fees will be distributed to SOV stakers based on their voting
     * power as a percentage of total voting power. Therefore, staking more
     * SOV and/or staking for longer will increase your share of the fees
     * generated, meaning you will earn more from staking.
     *
     * This function will directly burnToBTC and use the msg.sender (user) as the receiver
     *
     * @param _token  Address of the pool token.
     * @param _maxCheckpoint Maximum number of checkpoints to be processed.
     * @param _receiver The receiver of tokens or msg.sender
     * */
    function _withdraw(address _token, uint32 _maxCheckpoint, address _receiver) internal {
        /// @dev Prevents processing / checkpoints because of block gas limit.
        require(
            _maxCheckpoint > 0,
            "FeeSharingCollectorMultiToken::withdraw: _maxCheckpoints should be positive"
        );

        address _wrappedNativeTokenAddress = wrappedNativeTokenAddress;
        require(
            _wrappedNativeTokenAddress != address(0),
            "FeeSharingCollectorMultiToken::withdraw: _wrappedNativeTokenAddress is not set"
        );

        address loanWrappedNativeToken = protocol.underlyingToLoanPool(_wrappedNativeTokenAddress);
        require(
            loanWrappedNativeToken != address(0),
            "FeeSharingCollectorMultiToken::withdraw: loan wrapped native token not found"
        );

        address user = msg.sender;
        if (_receiver == address(0)) {
            _receiver = msg.sender;
        }

        uint256 amount;
        uint256 end;
        (amount, end) = _getAccumulatedFees(user, _token, _maxCheckpoint);
        require(
            amount > 0,
            "FeeSharingCollectorMultiToken::withdrawFees: no tokens for a withdrawal"
        );

        processedCheckpoints[user][_token] = end;

        if (loanWrappedNativeToken == _token) {
            // We will change, so that FeeSharingCollectorMultiToken will directly burn then loan wrapped native token to native token and send to the user --- by call burnToBTC function
            ILoanWrappedNativeToken(_token).burnToBTC(_receiver, amount, false);
        } else {
            require(
                IERC20(_token).transfer(_receiver, amount),
                "FeeSharingCollectorMultiToken::withdraw: withdrawal failed"
            );
        }

        emit UserFeeWithdrawn(msg.sender, _receiver, _token, amount);
    }

    /**
     * @notice Get the accumulated loan pool fee of the message sender.
     * @param _user The address of the user or contract.
     * @param _loanPoolToken Address of the pool token.
     * @return The accumulated fee for the message sender.
     * */
    function getAccumulatedFees(
        address _user,
        address _loanPoolToken
    ) public view returns (uint256) {
        uint256 amount;
        (amount, ) = _getAccumulatedFees(_user, _loanPoolToken, 0);
        return amount;
    }

    /**
     * @notice Whenever fees are withdrawn, the staking contract needs to
     * checkpoint the block number, the number of pool tokens and the
     * total voting power at that time (read from the staking contract).
     * While the total voting power would not necessarily need to be
     * checkpointed, it makes sense to save gas cost on withdrawal.
     *
     * When the user wants to withdraw its share of tokens, we need
     * to iterate over all of the checkpoints since the users last
     * withdrawal (note: remember last withdrawal block), query the
     * user’s balance at the checkpoint blocks from the staking contract,
     * compute his share of the checkpointed tokens and add them up.
     * The maximum number of checkpoints to process at once should be limited.
     *
     * @param _user Address of the user's account.
     * @param _loanPoolToken Loan pool token address.
     * @param _maxCheckpoints Checkpoint index incremental.
     * */
    function _getAccumulatedFees(
        address _user,
        address _loanPoolToken,
        uint32 _maxCheckpoints
    ) internal view returns (uint256, uint256) {
        if (staking.isVestingContract(_user)) {
            return (0, 0);
        }

        uint256 start = processedCheckpoints[_user][_loanPoolToken];
        uint256 end;

        /// @dev Additional bool param can't be used because of stack too deep error.
        if (_maxCheckpoints > 0) {
            /// @dev withdraw -> _getAccumulatedFees
            require(
                start < totalTokenCheckpoints[_loanPoolToken],
                "FeeSharingCollectorMultiToken::withdrawFees: no tokens for a withdrawal"
            );
            end = _getEndOfRange(start, _loanPoolToken, _maxCheckpoints);
        } else {
            /// @dev getAccumulatedFees -> _getAccumulatedFees
            /// Don't throw error for getter invocation outside of transaction.
            if (start >= totalTokenCheckpoints[_loanPoolToken]) {
                return (0, totalTokenCheckpoints[_loanPoolToken]);
            }
            end = totalTokenCheckpoints[_loanPoolToken];
        }

        uint256 amount = 0;
        uint256 cachedLockDate = 0;
        uint96 cachedWeightedStake = 0;
        for (uint256 i = start; i < end; i++) {
            Checkpoint storage checkpoint = tokenCheckpoints[_loanPoolToken][i];
            uint256 lockDate = staking.timestampToLockDate(checkpoint.timestamp);
            uint96 weightedStake;
            if (lockDate == cachedLockDate) {
                weightedStake = cachedWeightedStake;
            } else {
                /// @dev We need to use "checkpoint.blockNumber - 1" here to calculate weighted stake
                /// For the same block like we did for total voting power in _writeTokenCheckpoint
                weightedStake = staking.getPriorWeightedStake(
                    _user,
                    checkpoint.blockNumber - 1,
                    checkpoint.timestamp
                );
                cachedWeightedStake = weightedStake;
                cachedLockDate = lockDate;
            }
            uint256 share = uint256(checkpoint.numTokens).mul(weightedStake).div(
                uint256(checkpoint.totalWeightedStake)
            );
            amount = amount.add(share);
        }
        return (amount, end);
    }

    /**
     * @notice Withdrawal should only be possible for blocks which were already
     * mined. If the fees are withdrawn in the same block as the user withdrawal
     * they are not considered by the withdrawing logic (to avoid inconsistencies).
     *
     * @param start Start of the range.
     * @param _loanPoolToken Loan pool token address.
     * @param _maxCheckpoints Checkpoint index incremental.
     * */
    function _getEndOfRange(
        uint256 start,
        address _loanPoolToken,
        uint32 _maxCheckpoints
    ) internal view returns (uint256) {
        uint256 nCheckpoints = totalTokenCheckpoints[_loanPoolToken];
        uint256 end;
        if (_maxCheckpoints == 0) {
            /// @dev All checkpoints will be processed (only for getter outside of a transaction).
            end = nCheckpoints;
        } else {
            if (_maxCheckpoints > MAX_CHECKPOINTS) {
                _maxCheckpoints = MAX_CHECKPOINTS;
            }
            end = safe32(
                start + _maxCheckpoints,
                "FeeSharingCollectorMultiToken::withdraw: checkpoint index exceeds 32 bits"
            );
            if (end > nCheckpoints) {
                end = nCheckpoints;
            }
        }

        /// @dev Withdrawal should only be possible for blocks which were already mined.
        uint32 lastBlockNumber = tokenCheckpoints[_loanPoolToken][end - 1].blockNumber;
        if (block.number == lastBlockNumber) {
            end--;
        }
        return end;
    }

    /**
     * @notice Write a regular checkpoint w/ the foolowing data:
     * block number, block timestamp, total weighted stake and num of tokens.
     * @param _token The pool token address.
     * @param _numTokens The amount of pool tokens.
     * */
    function _writeTokenCheckpoint(address _token, uint96 _numTokens) internal {
        uint32 blockNumber = safe32(
            block.number,
            "FeeSharingCollectorMultiToken::_writeCheckpoint: block number exceeds 32 bits"
        );
        uint32 blockTimestamp = safe32(
            block.timestamp,
            "FeeSharingCollectorMultiToken::_writeCheckpoint: block timestamp exceeds 32 bits"
        );
        uint256 nCheckpoints = totalTokenCheckpoints[_token];

        uint96 totalWeightedStake = _getVoluntaryWeightedStake(blockNumber - 1, block.timestamp);
        require(totalWeightedStake > 0, "Invalid totalWeightedStake");
        if (
            nCheckpoints > 0 &&
            tokenCheckpoints[_token][nCheckpoints - 1].blockNumber == blockNumber
        ) {
            tokenCheckpoints[_token][nCheckpoints - 1].totalWeightedStake = totalWeightedStake;
            tokenCheckpoints[_token][nCheckpoints - 1].numTokens = _numTokens;
        } else {
            tokenCheckpoints[_token][nCheckpoints] = Checkpoint(
                blockNumber,
                blockTimestamp,
                totalWeightedStake,
                _numTokens
            );
            totalTokenCheckpoints[_token] = nCheckpoints + 1;
        }
        emit CheckpointAdded(msg.sender, _token, _numTokens);
    }

    /**
     * Queries the total weighted stake and the weighted stake of vesting contracts and returns the difference
     * @param blockNumber the blocknumber
     * @param timestamp the timestamp
     */
    function _getVoluntaryWeightedStake(
        uint32 blockNumber,
        uint256 timestamp
    ) internal view returns (uint96 totalWeightedStake) {
        uint96 vestingWeightedStake = staking.getPriorVestingWeightedStake(blockNumber, timestamp);
        totalWeightedStake = staking.getPriorTotalVotingPower(blockNumber, timestamp);
        totalWeightedStake = sub96(
            totalWeightedStake,
            vestingWeightedStake,
            "FeeSharingCollectorMultiToken::_getTotalVoluntaryWeightedStake: vested stake exceeds total stake"
        );
    }

    function withdrawWrappedNativeToken(
        address receiver,
        uint256 wrappedNativeTokenAmount
    ) external onlyOwner {
        require(
            wrappedNativeTokenAddress != address(0),
            "FeeSharingCollectorMultiToken::withdrawFees: wrappedNativeTokenAddress is not set"
        );

        uint256 balance = IERC20(wrappedNativeTokenAddress).balanceOf(address(this));
        require(wrappedNativeTokenAmount <= balance, "Insufficient balance");

        IERC20(wrappedNativeTokenAddress).safeTransfer(receiver, wrappedNativeTokenAmount);
    }
}

/* Interfaces */
interface ILoanToken {
    function mint(address receiver, uint256 depositAmount) external returns (uint256 mintAmount);
}

interface ILoanWrappedNativeToken {
    function burnToBTC(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external returns (uint256 loanAmountPaid);

    function tokenPrice() external view returns (uint256 price);
}
