pragma solidity ^0.5.17;

import "../Staking/SafeMath96.sol";
import "../../openzeppelin/SafeMath.sol";
import "../../openzeppelin/SafeERC20.sol";
import "../../openzeppelin/Ownable.sol";
import "../IFeeSharingCollector.sol";
import "../../openzeppelin/Address.sol";
import "./FeeSharingCollectorStorage.sol";
import "../../interfaces/IConverterAMM.sol";

/**
 * @title The FeeSharingCollector contract.
 * @notice This contract withdraws fees to be paid to SOV Stakers from the protocol.
 * Stakers call withdraw() to get their share of the fees.
 *
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
 * Also, the staking contract sends slashed tokens to this contract.
 * When a user calls the withdraw function, the contract transfers the fee sharing
 * rewards in proportion to the user’s weighted stake since the last withdrawal.
 *
 * The protocol initially collects fees in all tokens.
 * Then the FeeSharingCollector wihtdraws fees from the protocol.
 * When the fees are withdrawn all the tokens except SOV will be converted to wRBTC
 * and then transferred to wRBTC loan pool.
 * For SOV, it will be directly deposited into the feeSharingCollector from the protocol.
 * */
contract FeeSharingCollector is
    SafeMath96,
    IFeeSharingCollector,
    Ownable,
    FeeSharingCollectorStorage
{
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address constant ZERO_ADDRESS = address(0);
    address public constant RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT =
        address(uint160(uint256(keccak256("RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT"))));

    /* Events */

    /// @notice Deprecated event after the unification between wrbtc & rbtc
    // event FeeWithdrawn(address indexed sender, address indexed token, uint256 amount);
    event FeeWithdrawnInRBTC(address indexed sender, uint256 amount);

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

    /// @notice An event emitted when user fee get withdrawn.
    event UserFeeProcessedNoWithdraw(
        address indexed sender,
        address indexed token,
        uint256 prevProcessedCheckpoints,
        uint256 newProcessedCheckpoints
    );

    /**
     * @notice An event emitted when fee from AMM get withdrawn.
     *
     * @param sender sender who initiate the withdrawn amm fees.
     * @param converter the converter address.
     * @param amount total amount of fee (Already converted to WRBTC).
     */
    event FeeAMMWithdrawn(address indexed sender, address indexed converter, uint256 amount);

    /// @notice An event emitted when converter address has been registered to be whitelisted.
    event WhitelistedConverter(address indexed sender, address converter);

    /// @notice An event emitted when converter address has been removed from whitelist.
    event UnwhitelistedConverter(address indexed sender, address converter);

    event RBTCWithdrawn(address indexed sender, address indexed receiver, uint256 amount);

    /* Functions */

    /// @dev fallback function to support rbtc transfer when unwrap the wrbtc.
    function() external payable {}

    /**
     * @notice Withdraw fees for the given token:
     * lendingFee + tradingFee + borrowingFee
     * the fees (except SOV) will be converted in wRBTC form, and then will be transferred to wRBTC loan pool.
     * For SOV, it will be directly deposited into the feeSharingCollector from the protocol.
     *
     * @param _tokens array address of the token
     * */
    function withdrawFees(address[] calldata _tokens) external {
        for (uint256 i = 0; i < _tokens.length; i++) {
            require(
                Address.isContract(_tokens[i]),
                "FeeSharingCollector::withdrawFees: token is not a contract"
            );
        }

        uint256 wrbtcAmountWithdrawn = protocol.withdrawFees(_tokens, address(this));

        IWrbtcERC20 wRBTCToken = protocol.wrbtcToken();

        if (wrbtcAmountWithdrawn > 0) {
            // unwrap the wrbtc to rbtc, and hold the rbtc.
            wRBTCToken.withdraw(wrbtcAmountWithdrawn);

            /// @notice Update unprocessed amount of tokens
            uint96 amount96 =
                safe96(
                    wrbtcAmountWithdrawn,
                    "FeeSharingCollector::withdrawFees: wrbtc token amount exceeds 96 bits"
                );

            _addCheckpoint(RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, amount96);
        }

        // note deprecated event since we unify the wrbtc & rbtc
        // emit FeeWithdrawn(msg.sender, RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, poolTokenAmount);

        // note new emitted event
        emit FeeWithdrawnInRBTC(msg.sender, wrbtcAmountWithdrawn);
    }

    /**
     * @notice Withdraw amm fees for the given converter addresses:
     * protocolFee from the conversion
     * the fees will be converted in wRBTC form, and then will be transferred to wRBTC loan pool
     *
     * @param _converters array addresses of the converters
     * */
    function withdrawFeesAMM(address[] memory _converters) public {
        IWrbtcERC20 wRBTCToken = protocol.wrbtcToken();

        // Validate
        _validateWhitelistedConverter(_converters);

        uint96 totalPoolTokenAmount;
        for (uint256 i = 0; i < _converters.length; i++) {
            uint256 wrbtcAmountWithdrawn =
                IConverterAMM(_converters[i]).withdrawFees(address(this));

            if (wrbtcAmountWithdrawn > 0) {
                // unwrap wrbtc to rbtc, and hold the rbtc
                wRBTCToken.withdraw(wrbtcAmountWithdrawn);

                /// @notice Update unprocessed amount of tokens
                uint96 amount96 =
                    safe96(
                        wrbtcAmountWithdrawn,
                        "FeeSharingCollector::withdrawFeesAMM: wrbtc token amount exceeds 96 bits"
                    );

                totalPoolTokenAmount = add96(
                    totalPoolTokenAmount,
                    amount96,
                    "FeeSharingCollector::withdrawFeesAMM: total wrbtc token amount exceeds 96 bits"
                );

                emit FeeAMMWithdrawn(msg.sender, _converters[i], wrbtcAmountWithdrawn);
            }
        }

        if (totalPoolTokenAmount > 0) {
            _addCheckpoint(RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, totalPoolTokenAmount);
        }
    }

    /**
     * @notice Transfer tokens to this contract.
     * @dev We just update amount of tokens here and write checkpoint in a separate methods
     * in order to prevent adding checkpoints too often.
     * @param _token Address of the token.
     * @param _amount Amount to be transferred.
     * */
    function transferTokens(address _token, uint96 _amount) public {
        require(_token != ZERO_ADDRESS, "FeeSharingCollector::transferTokens: invalid address");
        require(_amount > 0, "FeeSharingCollector::transferTokens: invalid amount");

        /// @notice Transfer tokens from msg.sender
        bool success = IERC20(_token).transferFrom(address(msg.sender), address(this), _amount);
        require(success, "Staking::transferTokens: token transfer failed");

        // if _token is wrbtc, need to unwrap it to rbtc
        IWrbtcERC20 wrbtcToken = protocol.wrbtcToken();
        if (_token == address(wrbtcToken)) {
            wrbtcToken.withdraw(_amount);
            _token = RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT;
        }

        _addCheckpoint(_token, _amount);

        emit TokensTransferred(msg.sender, _token, _amount);
    }

    /**
     * @notice Transfer RBTC / native tokens to this contract.
     * @dev We just write checkpoint here (based on the rbtc value that is sent) in a separate methods
     * in order to prevent adding checkpoints too often.
     * */
    function transferRBTC() external payable {
        uint96 _amount = uint96(msg.value);
        require(_amount > 0, "FeeSharingCollector::transferRBTC: invalid value");

        _addCheckpoint(RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT, _amount);

        emit TokensTransferred(msg.sender, ZERO_ADDRESS, _amount);
    }

    /**
     * @notice Add checkpoint with accumulated amount by function invocation.
     * @param _token Address of the token.
     * */
    function _addCheckpoint(address _token, uint96 _amount) internal {
        if (block.timestamp - lastFeeWithdrawalTime[_token] >= FEE_WITHDRAWAL_INTERVAL) {
            lastFeeWithdrawalTime[_token] = block.timestamp;
            uint96 amount =
                add96(
                    unprocessedAmount[_token],
                    _amount,
                    "FeeSharingCollector::_addCheckpoint: amount exceeds 96 bits"
                );

            /// @notice Reset unprocessed amount of tokens to zero.
            unprocessedAmount[_token] = 0;

            /// @notice Write a regular checkpoint.
            _writeTokenCheckpoint(_token, amount);
        } else {
            unprocessedAmount[_token] = add96(
                unprocessedAmount[_token],
                _amount,
                "FeeSharingCollector::_addCheckpoint: unprocessedAmount exceeds 96 bits"
            );
        }
    }

    function _withdraw(
        address _token,
        uint32 _maxCheckpoints,
        address _receiver
    ) internal {
        /// @dev Prevents block gas limit hit when processing checkpoints
        require(
            _maxCheckpoints > 0,
            "FeeSharingCollector::withdraw: _maxCheckpoints should be positive"
        );

        address wRBTCAddress = address(protocol.wrbtcToken());
        address loanPoolTokenWRBTC = _getAndValidateLoanPoolWRBTC(wRBTCAddress);

        address user = msg.sender;
        if (_receiver == ZERO_ADDRESS) {
            _receiver = msg.sender;
        }

        (uint256 amount, uint256 end) = _getAccumulatedFees(user, _token, _maxCheckpoints);
        if (amount == 0) {
            if (end > processedCheckpoints[user][_token]) {
                emit UserFeeProcessedNoWithdraw(
                    msg.sender,
                    _token,
                    processedCheckpoints[user][_token],
                    end
                );
                processedCheckpoints[user][_token] = end;
                return;
            } else {
                // getting here most likely means smth wrong with the state
                revert("FeeSharingCollector::withdrawFees: no tokens for withdrawal");
            }
        }

        processedCheckpoints[user][_token] = end;
        if (loanPoolTokenWRBTC == _token) {
            // We will change, so that feeSharingCollector will directly burn then loanToken (IWRBTC) to rbtc and send to the user --- by call burnToBTC function
            ILoanTokenWRBTC(_token).burnToBTC(_receiver, amount, false);
        } else {
            // Previously it directly send the loanToken to the user
            require(
                IERC20(_token).transfer(_receiver, amount),
                "FeeSharingCollector::withdraw: withdrawal failed"
            );
        }

        emit UserFeeWithdrawn(msg.sender, _receiver, _token, amount);
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
     * @param _token RBTC dummy to fit into existing data structure or SOV. Former address of the pool token.
     * @param _maxCheckpoints Maximum number of checkpoints to be processed. Must be positive value.
     * @param _receiver The receiver of tokens or msg.sender
     * */
    function withdraw(
        address _token,
        uint32 _maxCheckpoints,
        address _receiver
    ) public nonReentrant {
        _withdraw(_token, _maxCheckpoints, _receiver);
    }

    /// @notice Validates is the checkpoint is payable for the user
    modifier validFromCheckpointParam(
        uint256 _fromCheckpoint,
        address _user,
        address _token
    ) {
        // _fromCheckppoint is checkpoint number, not array index, so should be > 1
        require(_fromCheckpoint > 1, "_fromCheckpoint param must be > 1");
        uint256 fromCheckpointIndex = _fromCheckpoint - 1;
        require(
            _fromCheckpoint > processedCheckpoints[_user][_token],
            "_fromCheckpoint param must be > userProcessedCheckpoints"
        );
        require(
            _fromCheckpoint <= totalTokenCheckpoints[_token],
            "_fromCheckpoint should be <= totalTokenCheckpoints"
        );

        Checkpoint memory prevCheckpoint = tokenCheckpoints[_token][fromCheckpointIndex - 1];

        uint96 weightedStake =
            staking.getPriorWeightedStake(
                _user,
                prevCheckpoint.blockNumber,
                prevCheckpoint.timestamp
            );
        require(weightedStake == 0, "User weighted stake should be zero at previous checkpoint");

        Checkpoint memory fromCheckpoint = tokenCheckpoints[_token][fromCheckpointIndex];
        weightedStake = staking.getPriorWeightedStake(
            _user,
            fromCheckpoint.blockNumber,
            fromCheckpoint.timestamp
        );
        require(weightedStake > 0, "User weighted stake should be > 0 at  _fromCheckpoint");
        _;
    }

    /**
     * @notice Withdraw accumulated fee to the message sender/receiver.
     *
     * The Sovryn protocol collects fees on every trade/swap and loan.
     * These fees will be distributed to SOV stakers based on their voting
     * power as a percentage of total voting power.
     *
     * This function will directly burnToBTC and use the msg.sender (user) as the receiver
     *
     * @dev WARNING! This function skips all the checkpoints before '_fromCheckpoint' irreversibly, use with care
     *
     * @param _token RBTC dummy to fit into existing data structure or SOV. Former address of the pool token.
     * @param _fromCheckpoint Skips all the checkpoints before '_fromCheckpoint'
     *        should be calculated offchain with getNextPositiveUserCheckpoint function
     * @param _maxCheckpoints Maximum number of checkpoints to be processed.
     * @param _receiver The receiver of tokens or msg.sender
     * */
    function withdrawStartingFromCheckpoint(
        address _token,
        uint256 _fromCheckpoint,
        uint32 _maxCheckpoints,
        address _receiver
    ) public validFromCheckpointParam(_fromCheckpoint, msg.sender, _token) nonReentrant {
        if (_fromCheckpoint > processedCheckpoints[msg.sender][_token]) {
            processedCheckpoints[msg.sender][_token] = _fromCheckpoint.sub(1);
        }
        _withdraw(_token, _maxCheckpoints, _receiver);
    }

    function _withdrawRBTC(uint32 _maxCheckpoints, address _receiver) internal {
        uint256 wrbtcAmount;
        uint256 rbtcAmount;
        uint256 iWrbtcAmount;
        uint256 endRBTC;
        uint256 endWRBTC;
        uint256 endIWRBTC;
        uint256 iWRBTCloanAmountPaid;
        address user = msg.sender;

        IWrbtcERC20 wrbtcToken = protocol.wrbtcToken();

        address loanPoolTokenWRBTC = _getAndValidateLoanPoolWRBTC(address(wrbtcToken));

        if (_receiver == ZERO_ADDRESS) {
            _receiver = msg.sender;
        }

        (rbtcAmount, wrbtcAmount, iWrbtcAmount, endRBTC, endWRBTC, endIWRBTC) = _getRBTCBalances(
            user,
            _maxCheckpoints
        );

        if (rbtcAmount > 0) {
            processedCheckpoints[user][RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT] = endRBTC;
        }

        // unwrap the wrbtc
        if (wrbtcAmount > 0) {
            processedCheckpoints[user][address(wrbtcToken)] = endWRBTC;
            wrbtcToken.withdraw(wrbtcAmount);
        }

        // pull out the iWRBTC to rbtc to this feeSharingCollector contract
        if (iWrbtcAmount > 0) {
            processedCheckpoints[user][loanPoolTokenWRBTC] = endIWRBTC;
            iWRBTCloanAmountPaid = ILoanTokenWRBTC(loanPoolTokenWRBTC).burnToBTC(
                address(this),
                iWrbtcAmount,
                false
            );
        }

        uint256 totalAmount = rbtcAmount.add(wrbtcAmount).add(iWRBTCloanAmountPaid);
        require(totalAmount > 0, "FeeSharingCollector::withdrawFees: no rbtc for a withdrawal");

        // withdraw everything
        (bool success, ) = _receiver.call.value(totalAmount)("");
        require(success, "FeeSharingCollector::withdrawRBTC: Withdrawal failed");

        emit RBTCWithdrawn(user, _receiver, totalAmount);
    }

    /**
     * @dev withdraw all of the RBTC balance based on particular checkpoints
     *
     * RBTC balance consists of:
     * - rbtc balance
     * - wrbtc balance which will be unwrapped to rbtc
     * - iwrbtc balance which will be unwrapped to rbtc
     *
     * @param _maxCheckpoints  Maximum number of checkpoints to be processed to workaround block gas limit
     * @param _receiver An optional tokens receiver (msg.sender used if 0)
     */
    function withdrawRBTC(uint32 _maxCheckpoints, address _receiver) external nonReentrant {
        _withdrawRBTC(_maxCheckpoints, _receiver);
    }

    /**
     * @dev Withdraw all of the RBTC balance based starting from a specific checkpoint
     * The function was designed to skip checkpoints with no fees for users
     *
     * RBTC balance consists of:
     * - rbtc balance
     * - wrbtc balance which will be unwrapped to rbtc
     * - iwrbtc balance which will be unwrapped to rbtc
     *
     * @dev WARNING! This function skips all the checkpoints before '_fromCheckpoint' irreversibly, use with care
     *
     * @param _fromCheckpoint Skips all the checkpoints before '_fromCheckpoint'
     *        should be calculated offchain with getNextPositiveUserCheckpoint function
     * @param _maxCheckpoints  Maximum number of checkpoints to be processed to workaround block gas limit
     * @param _receiver An optional tokens receiver (msg.sender used if 0)
     */
    function withdrawRBTCStartingFromCheckpoint(
        uint256 _fromCheckpoint,
        uint32 _maxCheckpoints,
        address _receiver
    )
        external
        validFromCheckpointParam(_fromCheckpoint, msg.sender, RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT)
        nonReentrant
    {
        if (
            _fromCheckpoint > processedCheckpoints[msg.sender][RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT]
        ) {
            processedCheckpoints[msg.sender][RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT] = _fromCheckpoint
                .sub(1);
        }
        _withdrawRBTC(_maxCheckpoints, _receiver);
    }

    /**
     * @dev Returns first user's checkpoint with weighted stake > 0
     *
     * @param _user The address of the user or contract.
     * @param _token RBTC dummy to fit into existing data structure or SOV. Former address of the pool token.
     * @param _startFrom Checkpoint number to start from. If _startFrom < processedUserCheckpoints then starts from processedUserCheckpoints.
     * @return Checkpoint number where user's weighted stake > 0
     */
    function getNextPositiveUserCheckpoint(
        address _user,
        address _token,
        uint256 _startFrom
    )
        external
        view
        returns (
            uint256 checkpointNum,
            bool hasSkippedCheckpoints,
            bool hasFees
        )
    {
        if (staking.isVestingContract(_user)) {
            return (0, false, false);
        }

        uint256 processedUserCheckpoints = processedCheckpoints[_user][_token];
        uint256 totalCheckpoints = totalTokenCheckpoints[_token];

        if (processedUserCheckpoints >= totalCheckpoints || totalCheckpoints == 0) {
            return (totalCheckpoints, false, false);
        }

        uint256 startFrom =
            _startFrom > processedUserCheckpoints ? _startFrom : processedUserCheckpoints;

        uint256 nextMax = startFrom.add(MAX_NEXT_POSITIVE_CHECKPOINT);
        uint256 end = nextMax < totalCheckpoints ? nextMax : totalCheckpoints;

        // @note here processedUserCheckpoints is a number of processed checkpoints and
        // also an index for the next checkpoint because an array index starts wtih 0
        for (uint256 i = startFrom; i < end; i++) {
            Checkpoint storage tokenCheckpoint = tokenCheckpoints[_token][i];
            uint96 weightedStake =
                staking.getPriorWeightedStake(
                    _user,
                    tokenCheckpoint.blockNumber - 1,
                    tokenCheckpoint.timestamp
                );
            if (weightedStake > 0) {
                // i is the index and we need to return point num which is i + 1
                return (i + 1, i > processedUserCheckpoints, true);
            }
        }
        return (end, end > processedUserCheckpoints, false);
    }

    /**
     * @notice Get the accumulated loan pool fee of the message sender.
     * @param _user The address of the user or contract.
     * @param _token RBTC dummy to fit into existing data structure or SOV. Former address of the pool token.
     * @return The accumulated fee for the message sender.
     * */
    function getAccumulatedFees(address _user, address _token) public view returns (uint256) {
        uint256 amount;
        (amount, ) = _getAccumulatedFees(_user, _token, 0);
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
     * @param _token RBTC dummy to fit into existing data structure or SOV. Former address of the pool token.
     * @param _maxCheckpoints Max checkpoints to process at once to fit into block gas limit
     *
     * @return accumulated fees amount
     * @return end timestamp of fees calculation
     * */
    function _getAccumulatedFees(
        address _user,
        address _token,
        uint32 _maxCheckpoints
    ) internal view returns (uint256, uint256) {
        return _getAccumulatedFeesFromCheckpoint(0, _user, _token, _maxCheckpoints);
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
     * @param _token RBTC dummy to fit into existing data structure or SOV. Former address of the pool token.
     * @param _maxCheckpoints Max checkpoints to process at once to fit into block gas limit
     * @param _fromCheckpoint Skips all the checkpoints before '_fromCheckpoint'
     *
     * @dev WARNING! Validation of _fromCheckpoint should be done in the caller
     *
     * @return accumulated fees amount
     * @return end timestamp of fees calculation
     * */
    function _getAccumulatedFeesFromCheckpoint(
        uint256 _fromCheckpoint,
        address _user,
        address _token,
        uint32 _maxCheckpoints
    ) internal view returns (uint256, uint256) {
        if (staking.isVestingContract(_user)) {
            return (0, 0);
        }

        uint256 processedUserCheckpoints = processedCheckpoints[_user][_token];
        if (_fromCheckpoint > processedUserCheckpoints) {
            processedUserCheckpoints = _fromCheckpoint;
        }
        uint256 end =
            _maxCheckpoints > 0
                ? _getEndOfRange(processedUserCheckpoints, _token, _maxCheckpoints)
                : totalTokenCheckpoints[_token];

        if (processedUserCheckpoints >= totalTokenCheckpoints[_token]) {
            return (0, end);
        }

        uint256 amount = 0;
        uint256 cachedLockDate = 0;
        uint96 cachedWeightedStake = 0;
        // @note here processedUserCheckpoints is a number of processed checkpoints and
        // also an index for the next checkpoint because an array index starts wtih 0
        for (uint256 i = processedUserCheckpoints; i < end; i++) {
            Checkpoint storage checkpoint = tokenCheckpoints[_token][i];
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
            uint256 share =
                uint256(checkpoint.numTokens).mul(weightedStake).div(
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
     * @param _token RBTC dummy to fit into existing data structure or SOV. Former address of a pool token.
     * @param _maxCheckpoints Checkpoint index incremental.
     * */
    function _getEndOfRange(
        uint256 start,
        address _token,
        uint32 _maxCheckpoints
    ) internal view returns (uint256) {
        uint256 nextCheckpointsIndex = totalTokenCheckpoints[_token];
        if (nextCheckpointsIndex == 0) {
            return 0;
        }
        uint256 lastCheckpointsIndex = nextCheckpointsIndex - 1;
        uint256 end;

        if (_maxCheckpoints == 0) {
            /// @dev All checkpoints will be processed (only for getter outside of a transaction).
            end = nextCheckpointsIndex;
        } else {
            end = safe32(
                start + _maxCheckpoints,
                "FeeSharingCollector::withdraw: checkpoint index exceeds 32 bits"
            );
            if (end > nextCheckpointsIndex) {
                end = nextCheckpointsIndex;
            }
        }

        /// @dev Withdrawal should only be possible for blocks which were already mined.
        uint32 lastBlockNumber = tokenCheckpoints[_token][lastCheckpointsIndex].blockNumber;
        if (block.number == lastBlockNumber) {
            end = lastCheckpointsIndex;
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
        uint32 blockNumber =
            safe32(
                block.number,
                "FeeSharingCollector::_writeCheckpoint: block number exceeds 32 bits"
            );
        uint32 blockTimestamp =
            safe32(
                block.timestamp,
                "FeeSharingCollector::_writeCheckpoint: block timestamp exceeds 32 bits"
            );
        uint256 nextCheckpointsIndex = totalTokenCheckpoints[_token];

        uint96 totalWeightedStake = _getVoluntaryWeightedStake(blockNumber - 1, block.timestamp);
        require(totalWeightedStake > 0, "Invalid totalWeightedStake");
        if (
            nextCheckpointsIndex > 0 &&
            tokenCheckpoints[_token][nextCheckpointsIndex - 1].blockNumber == blockNumber
        ) {
            tokenCheckpoints[_token][nextCheckpointsIndex - 1]
                .totalWeightedStake = totalWeightedStake;
            tokenCheckpoints[_token][nextCheckpointsIndex - 1].numTokens = _numTokens;
        } else {
            tokenCheckpoints[_token][nextCheckpointsIndex] = Checkpoint(
                blockNumber,
                blockTimestamp,
                totalWeightedStake,
                _numTokens
            );
            totalTokenCheckpoints[_token] = nextCheckpointsIndex + 1;
        }
        emit CheckpointAdded(msg.sender, _token, _numTokens);
    }

    /**
     * Queries the total weighted stake and the weighted stake of vesting contracts and returns the difference
     * @param blockNumber the blocknumber
     * @param timestamp the timestamp
     */
    function _getVoluntaryWeightedStake(uint32 blockNumber, uint256 timestamp)
        internal
        view
        returns (uint96 totalWeightedStake)
    {
        uint96 vestingWeightedStake = staking.getPriorVestingWeightedStake(blockNumber, timestamp);
        totalWeightedStake = staking.getPriorTotalVotingPower(blockNumber, timestamp);
        totalWeightedStake = sub96(
            totalWeightedStake,
            vestingWeightedStake,
            "FeeSharingCollector::_getTotalVoluntaryWeightedStake: vested stake exceeds total stake"
        );
    }

    /**
     * @dev Whitelisting converter address.
     *
     * @param converterAddress converter address to be whitelisted.
     */
    function addWhitelistedConverterAddress(address converterAddress) external onlyOwner {
        require(Address.isContract(converterAddress), "Non contract address given");
        whitelistedConverterList.add(converterAddress);
        emit WhitelistedConverter(msg.sender, converterAddress);
    }

    /**
     * @dev Removing converter address from whitelist.
     *
     * @param converterAddress converter address to be removed from whitelist.
     */
    function removeWhitelistedConverterAddress(address converterAddress) external onlyOwner {
        whitelistedConverterList.remove(converterAddress);
        emit UnwhitelistedConverter(msg.sender, converterAddress);
    }

    /**
     * @notice Getter to query all of the whitelisted converter.
     * @return All of the whitelisted converter list.
     */
    function getWhitelistedConverterList() external view returns (address[] memory converterList) {
        converterList = whitelistedConverterList.enumerate();
    }

    /**
     * @dev validate array of given address whether is whitelisted or not.
     * @dev if one of them is not whitelisted, then revert.
     *
     * @param converterAddresses array of converter addresses.
     */
    function _validateWhitelistedConverter(address[] memory converterAddresses) private view {
        for (uint256 i = 0; i < converterAddresses.length; i++) {
            require(whitelistedConverterList.contains(converterAddresses[i]), "Invalid Converter");
        }
    }

    function withdrawWRBTC(address receiver, uint256 wrbtcAmount) external onlyOwner {
        address wRBTCAddress = address(protocol.wrbtcToken());

        uint256 balance = IERC20(wRBTCAddress).balanceOf(address(this));
        require(wrbtcAmount <= balance, "Insufficient balance");

        IERC20(wRBTCAddress).safeTransfer(receiver, wrbtcAmount);
    }

    /**
     * @dev view function that calculate the total RBTC that includes:
     * - RBTC
     * - WRBTC
     * - iWRBTC * iWRBTC.tokenPrice()
     * @param _user address of the user.
     * @return rbtc balance of the given user's address.
     */
    function getAccumulatedRBTCFeeBalances(address _user) external view returns (uint256) {
        uint256 _rbtcAmount;
        uint256 _wrbtcAmount;
        uint256 _iWrbtcAmount;
        (_rbtcAmount, _wrbtcAmount, _iWrbtcAmount, , , ) = _getRBTCBalances(_user, 0);
        return _rbtcAmount.add(_wrbtcAmount).add(_iWrbtcAmount);
    }

    /**
     * @dev private function that responsible to calculate the user's token that has RBTC as underlying token (rbtc, wrbtc, iWrbtc)
     *
     * @param _user address of the user.
     * @param _maxCheckpoints maximum checkpoints.
     *
     * @return _rbtcAmount rbtc amount
     * @return _wrbtcAmount wrbtc amount
     * @return _iWrbtcAmount iWrbtc (wrbtc lending pool token) amount * token price
     * @return _endRBTC end time of accumulated fee calculation for rbtc
     * @return _endWRBTC end time of accumulated fee calculation for wrbtc
     * @return _endIWRBTC end time of accumulated fee calculation for iwrbtc
     */
    function _getRBTCBalances(address _user, uint32 _maxCheckpoints)
        private
        view
        returns (
            uint256 _rbtcAmount,
            uint256 _wrbtcAmount,
            uint256 _iWrbtcAmount,
            uint256 _endRBTC,
            uint256 _endWRBTC,
            uint256 _endIWRBTC
        )
    {
        IWrbtcERC20 wrbtcToken = protocol.wrbtcToken();

        address loanPoolTokenWRBTC = _getAndValidateLoanPoolWRBTC(address(wrbtcToken));

        (_rbtcAmount, _endRBTC) = _getAccumulatedFees(
            _user,
            RBTC_DUMMY_ADDRESS_FOR_CHECKPOINT,
            _maxCheckpoints
        );
        (_wrbtcAmount, _endWRBTC) = _getAccumulatedFees(
            _user,
            address(wrbtcToken),
            _maxCheckpoints
        );
        (_iWrbtcAmount, _endIWRBTC) = _getAccumulatedFees(
            _user,
            loanPoolTokenWRBTC,
            _maxCheckpoints
        );

        _iWrbtcAmount = _iWrbtcAmount.mul(ILoanTokenWRBTC(loanPoolTokenWRBTC).tokenPrice()).div(
            1e18
        );
    }

    /**
     * @dev private function to get and validate the wrbtc loan pool token address based on the wrbtc token address.
     * @dev will revert if wrbtc loan pool token does not exist (zero address)
     *
     * @param _wRBTCAddress wrbtc token address.
     *
     * @return wrbtc loan pool wrbtc token address
     */
    function _getAndValidateLoanPoolWRBTC(address _wRBTCAddress) private view returns (address) {
        address loanPoolTokenWRBTC = protocol.underlyingToLoanPool(_wRBTCAddress);
        require(
            loanPoolTokenWRBTC != ZERO_ADDRESS,
            "FeeSharingCollector::withdraw: loan wRBTC not found"
        );

        return loanPoolTokenWRBTC;
    }

    // @todo update dependency `numTokenCheckpoints` -> `totalTokenCheckpoints` and deprecate numTokenCheckpoints function
    /**
     * @dev This getter function `numTokenCheckpoints` is added for backwards compatibility
     *      broken when renamed `numTokenCheckpoints` storage variable to `totalTokenCheckpoints`.
     *
     * @param _token token address to get checkpoints for
     *
     * @return Total token checkpoints
     */
    function numTokenCheckpoints(address _token) external view returns (uint256) {
        return totalTokenCheckpoints[_token];
    }
}

/* Interfaces */
interface ILoanToken {
    function mint(address receiver, uint256 depositAmount) external returns (uint256 mintAmount);
}

interface ILoanTokenWRBTC {
    function burnToBTC(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external returns (uint256 loanAmountPaid);

    function tokenPrice() external view returns (uint256 price);
}
