pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "../Staking/SafeMath96.sol";
import "../../openzeppelin/SafeMath.sol";
import "../../openzeppelin/SafeERC20.sol";
import "../../openzeppelin/Ownable.sol";
import "../IFeeSharingCollector.sol";
import "../../openzeppelin/Address.sol";
import "./FeeSharingCollectorStorage.sol";
import "../../interfaces/IConverterAMM.sol";
import "../../interfaces/ISovrynDex.sol";

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
 * When the fees are withdrawn all the tokens except SOV will be converted to wrappedNativeToken
 * and then transferred to wrappedNativeToken loan pool.
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
    address public constant NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT =
        address(uint160(uint256(keccak256("NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT"))));
    uint16 public constant SOVRYN_DEX_COLD_PATH_PROXY_IDX = 3;
    uint8 public constant SOVRYN_DEX_CMD_COLLECT_TREASURY_CODE = 40;

    /* Events */

    /// @notice Deprecated event after the unification between wrappedNativeToken & nativeToken
    // event FeeWithdrawn(address indexed sender, address indexed token, uint256 amount);
    event FeeWithdrawnInNativeToken(address indexed sender, uint256 amount);

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
     * @param amount total amount of fee (Already converted to wrappedNativeToken).
     */
    event FeeAMMWithdrawn(address indexed sender, address indexed converter, uint256 amount);

    /**
     * @notice An event emitted when fee from Dex get withdrawn.
     *
     * @param sender sender who initiate the withdrawn dex protocol fees.
     * @param token the token address.
     * @param amount total amount of fee (Already converted to wrappedNativeToken).
     */
    event FeeDexWithdrawn(address indexed sender, address indexed token, uint256 amount);

    /// @notice An event emitted when converter address has been registered to be whitelisted.
    event WhitelistedConverter(address indexed sender, address converter);

    /// @notice An event emitted when converter address has been removed from whitelist.
    event UnwhitelistedConverter(address indexed sender, address converter);

    event NativeTokenWithdrawn(address indexed sender, address indexed receiver, uint256 amount);

    event SetWrappedNativeToken(
        address indexed sender,
        address indexed oldWrappedNativeToken,
        address indexed newWrappedNativeToken
    );

    event SetLoanWrappedNativeToken(
        address indexed sender,
        address indexed oldLoanWrappedNativeToken,
        address indexed newLoanWrappedNativeToken
    );

    event SetProtocolAddress(address indexed sender, address _protocolAddress);

    event SetSovrynDexAddress(
        address indexed sender,
        address indexed oldSovrynDexAddress,
        address indexed newSovrynDexAddress
    );

    /* Modifier */
    modifier oneTimeExecution(bytes4 _funcSig) {
        require(
            !isFunctionExecuted[_funcSig],
            "FeeSharingCollector: function can only be called once"
        );
        _;
        isFunctionExecuted[_funcSig] = true;
    }

    /* Functions */

    /// @dev fallback function to support nativeToken transfer when unwrap the wrappedNativeToken.
    function() external payable {}

    /**
     * @dev initialize function for fee sharing collector proxy
     * @param wrappedNativeToken wrappedNativeToken token address
     * @param loanWrappedNativeToken address of loan token wrappedNativeToken (IWrappedNativeToken)
     */
    function initialize(
        address wrappedNativeToken,
        address loanWrappedNativeToken
    ) external onlyOwner oneTimeExecution(this.initialize.selector) {
        require(
            wrappedNativeTokenAddress == address(0) && loanWrappedNativeTokenAddress == address(0),
            "wrappedNativeToken or loanWrappedNativeToken has been initialized"
        );
        setWrappedNativeToken(wrappedNativeToken);
        setLoanWrappedNativeToken(loanWrappedNativeToken);
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

    function setSovrynDexAddress(
        address _sovrynDexAddress
    ) public onlyOwner oneTimeExecution(this.setSovrynDexAddress.selector) {
        require(Address.isContract(_sovrynDexAddress), "_sovrynDexAddress not a contract");
        emit SetSovrynDexAddress(msg.sender, sovrynDexAddress, _sovrynDexAddress);
        sovrynDexAddress = _sovrynDexAddress;
    }

    /**
     * @notice Set the loan wrappedNativeToken token address of fee sharing collector.
     *
     * only owner can perform this action.
     *
     * @param newLoanWrappedNativeTokenAddress The new address of the loan wrappedNativeToken token.
     * */
    function setLoanWrappedNativeToken(address newLoanWrappedNativeTokenAddress) public onlyOwner {
        require(
            Address.isContract(newLoanWrappedNativeTokenAddress),
            "newLoanWrappedNativeTokenAddress not a contract"
        );
        emit SetLoanWrappedNativeToken(
            msg.sender,
            loanWrappedNativeTokenAddress,
            newLoanWrappedNativeTokenAddress
        );
        loanWrappedNativeTokenAddress = newLoanWrappedNativeTokenAddress;
    }

    /**
     * @notice Withdraw fees for the given token:
     * lendingFee + tradingFee + borrowingFee
     * the fees (except SOV) will be converted in wrappedNativeToken form, and then will be transferred to wrappedNativeToken loan pool.
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

        uint256 wrappedNativeTokenAmountWithdrawn = protocol.withdrawFees(_tokens, address(this));

        IWrappedNativeTokenERC20 wrappedNativeToken = IWrappedNativeTokenERC20(
            wrappedNativeTokenAddress
        );

        if (wrappedNativeTokenAmountWithdrawn > 0) {
            // unwrap the wrappedNativeToken to nativeToken, and hold the nativeToken.
            wrappedNativeToken.withdraw(wrappedNativeTokenAmountWithdrawn);

            /// @notice Update unprocessed amount of tokens
            uint96 amount96 = safe96(
                wrappedNativeTokenAmountWithdrawn,
                "FeeSharingCollector::withdrawFees: wrappedNativeToken token amount exceeds 96 bits"
            );

            _addCheckpoint(NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT, amount96);
        }

        // note deprecated event since we unify the wrappedNativeToken & nativeToken
        // emit FeeWithdrawn(msg.sender, NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT, poolTokenAmount);

        // note new emitted event
        emit FeeWithdrawnInNativeToken(msg.sender, wrappedNativeTokenAmountWithdrawn);
    }

    /**
     * @notice Withdraw amm fees for the given converter addresses:
     * protocolFee from the conversion
     * the fees will be converted in wrappedNativeToken form, and then will be transferred to wrappedNativeToken loan pool
     *
     * @param _converters array addresses of the converters
     * */
    function withdrawFeesAMM(address[] memory _converters) public {
        IWrappedNativeTokenERC20 wrappedNativeToken = IWrappedNativeTokenERC20(
            wrappedNativeTokenAddress
        );

        // Validate
        _validateWhitelistedConverter(_converters);

        uint96 totalPoolTokenAmount;
        for (uint256 i = 0; i < _converters.length; i++) {
            uint256 wrappedNativeTokenAmountWithdrawn = IConverterAMM(_converters[i]).withdrawFees(
                address(this)
            );

            if (wrappedNativeTokenAmountWithdrawn > 0) {
                // unwrap wrappedNativeToken to nativeToken, and hold the nativeToken
                wrappedNativeToken.withdraw(wrappedNativeTokenAmountWithdrawn);

                /// @notice Update unprocessed amount of tokens
                uint96 amount96 = safe96(
                    wrappedNativeTokenAmountWithdrawn,
                    "FeeSharingCollector::withdrawFeesAMM: wrappedNativeToken token amount exceeds 96 bits"
                );

                totalPoolTokenAmount = add96(
                    totalPoolTokenAmount,
                    amount96,
                    "FeeSharingCollector::withdrawFeesAMM: total wrappedNativeToken token amount exceeds 96 bits"
                );

                emit FeeAMMWithdrawn(
                    msg.sender,
                    _converters[i],
                    wrappedNativeTokenAmountWithdrawn
                );
            }
        }

        if (totalPoolTokenAmount > 0) {
            _addCheckpoint(NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT, totalPoolTokenAmount);
        }
    }

    /**
     * @notice Withdraw amm fees for the given converter addresses:
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

        IWrappedNativeTokenERC20 wrappedNativeToken = IWrappedNativeTokenERC20(
            wrappedNativeTokenAddress
        );

        uint96 totalPoolTokenAmount;
        for (uint256 i = 0; i < _tokens.length; i++) {
            address token = _tokens[i];
            /** Withdraw from dex */
            bytes memory cmd = abi.encode(SOVRYN_DEX_CMD_COLLECT_TREASURY_CODE, token);
            bytes memory withdrawnData = ISovrynDex(sovrynDexAddress).userCmd(
                SOVRYN_DEX_COLD_PATH_PROXY_IDX,
                cmd
            );

            // Convert the return bytes data from dex to uint256
            uint256 wrappedNativeTokenAmountWithdrawn = bytesToUint256(withdrawnData);

            if (wrappedNativeTokenAmountWithdrawn > 0) {
                // unwrap wrappedNativeToken to nativeToken, and hold the nativeToken
                wrappedNativeToken.withdraw(wrappedNativeTokenAmountWithdrawn);

                /// @notice Update unprocessed amount of tokens
                uint96 amount96 = safe96(
                    wrappedNativeTokenAmountWithdrawn,
                    "FeeSharingCollector::withdrawFeesAMM: wrappedNativeToken token amount exceeds 96 bits"
                );

                totalPoolTokenAmount = add96(
                    totalPoolTokenAmount,
                    amount96,
                    "FeeSharingCollector::withdrawFeesAMM: total wrappedNativeToken token amount exceeds 96 bits"
                );

                emit FeeDexWithdrawn(msg.sender, token, wrappedNativeTokenAmountWithdrawn);
            }
        }

        if (totalPoolTokenAmount > 0) {
            _addCheckpoint(NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT, totalPoolTokenAmount);
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

        // if _token is wrappedNativeToken, need to unwrap it to nativeToken
        IWrappedNativeTokenERC20 wrappedNativeToken = IWrappedNativeTokenERC20(
            wrappedNativeTokenAddress
        );
        if (_token == address(wrappedNativeToken)) {
            wrappedNativeToken.withdraw(_amount);
            _token = NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT;
        }

        _addCheckpoint(_token, _amount);

        emit TokensTransferred(msg.sender, _token, _amount);
    }

    /**
     * @notice Transfer NativeToken / native tokens to this contract.
     * @dev We just write checkpoint here (based on the nativeToken value that is sent) in a separate methods
     * in order to prevent adding checkpoints too often.
     * */
    function transferNativeToken() external payable {
        uint96 _amount = uint96(msg.value);
        require(_amount > 0, "FeeSharingCollector::transferNativeToken: invalid value");

        _addCheckpoint(NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT, _amount);

        emit TokensTransferred(msg.sender, ZERO_ADDRESS, _amount);
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
    ) internal returns (uint256 totalAmount, uint256 endTokenCheckpoint) {
        /// @dev Prevents block gas limit hit when processing checkpoints
        require(
            _maxCheckpoints > 0,
            "FeeSharingCollector::withdraw: _maxCheckpoints should be positive"
        );

        address user = msg.sender;
        if (_receiver == ZERO_ADDRESS) {
            _receiver = msg.sender;
        }
        uint256 processedUserCheckpoints = processedCheckpoints[user][_token];
        (uint256 amount, uint256 end) = _getAccumulatedFees(
            user,
            _token,
            processedUserCheckpoints,
            _maxCheckpoints
        );
        if (amount == 0) {
            if (end > processedUserCheckpoints) {
                emit UserFeeProcessedNoWithdraw(msg.sender, _token, processedUserCheckpoints, end);
                processedCheckpoints[user][_token] = end;
                return (0, end);
            } else {
                // getting here most likely means smth wrong with the state
                revert("FeeSharingCollector::withdrawFees: no tokens for withdrawal");
            }
        }

        processedCheckpoints[user][_token] = end;
        if (loanWrappedNativeTokenAddress == _token) {
            // We will change, so that feeSharingCollector will directly burn then loanWrappedNativeToken (IWrappedNativeToken) to nativeToken and send to the user --- by call burnToBTC function
            ILoanWrappedNativeToken(_token).burnToBTC(_receiver, amount, false);
        } else {
            // Previously it directly send the loanWrappedNativeToken to the user
            require(
                IERC20(_token).transfer(_receiver, amount),
                "FeeSharingCollector::withdraw: withdrawal failed"
            );
        }

        emit UserFeeWithdrawn(msg.sender, _receiver, _token, amount);

        return (amount, end);
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
     * @param _token NativeToken dummy to fit into existing data structure or SOV. Former address of the pool token.
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

    /// @notice Validates if the checkpoint is payable for the user
    function validFromCheckpointsParam(
        TokenWithSkippedCheckpointsWithdraw[] memory _tokens,
        address _user
    ) private view {
        for (uint256 i = 0; i < _tokens.length; i++) {
            TokenWithSkippedCheckpointsWithdraw memory tokenData = _tokens[i];
            // _fromCheckpoint is checkpoint number, not array index, so should be > 1
            require(tokenData.fromCheckpoint > 1, "_fromCheckpoint param must be > 1");
            uint256 fromCheckpointIndex = tokenData.fromCheckpoint - 1;
            require(
                tokenData.fromCheckpoint > processedCheckpoints[_user][tokenData.tokenAddress],
                "_fromCheckpoint param must be > userProcessedCheckpoints"
            );
            require(
                tokenData.fromCheckpoint <= totalTokenCheckpoints[tokenData.tokenAddress],
                "_fromCheckpoint should be <= totalTokenCheckpoints"
            );

            Checkpoint memory prevCheckpoint = tokenCheckpoints[tokenData.tokenAddress][
                fromCheckpointIndex - 1
            ];

            uint96 weightedStake = staking.getPriorWeightedStake(
                _user,
                prevCheckpoint.blockNumber - 1,
                prevCheckpoint.timestamp
            );
            require(
                weightedStake == 0,
                "User weighted stake should be zero at previous checkpoint"
            );

            Checkpoint memory fromCheckpoint = tokenCheckpoints[tokenData.tokenAddress][
                fromCheckpointIndex
            ];
            weightedStake = staking.getPriorWeightedStake(
                _user,
                fromCheckpoint.blockNumber - 1,
                fromCheckpoint.timestamp
            );

            require(weightedStake > 0, "User weighted stake should be > 0 at  _fromCheckpoint");
        }
    }

    function validNativeTokenBasedTokens(address[] memory _tokens) private view {
        for (uint256 i = 0; i < _tokens.length; i++) {
            address _token = _tokens[i];
            if (
                _token != NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT &&
                _token != wrappedNativeTokenAddress &&
                _token != loanWrappedNativeTokenAddress
            ) {
                revert("only nativeToken-based tokens are allowed");
            }
        }
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
     * @param _tokens Array of TokenWithSkippedCheckpointsWithdraw struct, which contains the token address, and fromCheckpoiint
     * fromCheckpoints Skips all the checkpoints before '_fromCheckpoint'
     * should be calculated offchain with getNextPositiveUserCheckpoint function
     * @param _maxCheckpoints Maximum number of checkpoints to be processed.
     * @param _receiver The receiver of tokens or msg.sender
     *
     * @return total processed checkpoints
     * */
    function _withdrawStartingFromCheckpoints(
        TokenWithSkippedCheckpointsWithdraw[] memory _tokens,
        uint32 _maxCheckpoints,
        address _receiver
    ) internal returns (uint256 totalProcessedCheckpoints) {
        validFromCheckpointsParam(_tokens, msg.sender);

        if (_receiver == ZERO_ADDRESS) {
            _receiver = msg.sender;
        }

        uint256 nativeTokenAmountToSend;

        for (uint256 i = 0; i < _tokens.length; i++) {
            TokenWithSkippedCheckpointsWithdraw memory tokenData = _tokens[i];
            if (_maxCheckpoints == 0) break;
            uint256 endToken;
            uint256 totalAmount;

            uint256 previousProcessedUserCheckpoints = processedCheckpoints[msg.sender][
                tokenData.tokenAddress
            ];
            uint256 startingCheckpoint = tokenData.fromCheckpoint >
                previousProcessedUserCheckpoints
                ? tokenData.fromCheckpoint
                : previousProcessedUserCheckpoints;

            if (
                tokenData.tokenAddress == wrappedNativeTokenAddress ||
                tokenData.tokenAddress == loanWrappedNativeTokenAddress ||
                tokenData.tokenAddress == NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT
            ) {
                (totalAmount, endToken) = _withdrawNativeTokenStartingFromCheckpoint(
                    tokenData.tokenAddress,
                    tokenData.fromCheckpoint,
                    _maxCheckpoints,
                    _receiver
                );
                nativeTokenAmountToSend = nativeTokenAmountToSend.add(totalAmount);
            } else {
                (, endToken) = _withdrawStartingFromCheckpoint(
                    tokenData.tokenAddress,
                    tokenData.fromCheckpoint,
                    _maxCheckpoints,
                    _receiver
                );
            }

            uint256 _previousUsedCheckpoint = endToken.sub(startingCheckpoint).add(1);
            totalProcessedCheckpoints += _previousUsedCheckpoint;
            _maxCheckpoints = safe32(
                _maxCheckpoints - _previousUsedCheckpoint,
                "FeeSharingCollector: maxCheckpoint iteration exceeds 32 bits"
            );
        }

        if (nativeTokenAmountToSend > 0) {
            // send all nativeToken withdrawal
            (bool success, ) = _receiver.call.value(nativeTokenAmountToSend)("");
            require(success, "FeeSharingCollector::withdra: Withdrawal failed");

            emit NativeTokenWithdrawn(msg.sender, _receiver, nativeTokenAmountToSend);
        }
    }

    /**
     * @dev Function to wrap:
     * 1. regular withdrawal for both nativeToken & non-nativeToken token
     * 2. skipped checkpoints withdrawal for both nativeToken & non-nativeToken token
     *
     * @param _nonNativeTokensRegularWithdraw array of non-nativeToken token address with no skipped checkpoints that will be withdrawn
     * @param _nativeTokensRegularWithdraw array of nativeToken token address with no skipped checkpoints that will be withdrawn
     * @param _tokensWithSkippedCheckpoints array of nativeToken & non-nativeToken TokenWithSkippedCheckpointsWithdraw struct, which has skipped checkpoints that will be withdrawn
     *
     */
    function claimAllCollectedFees(
        address[] calldata _nonNativeTokensRegularWithdraw,
        address[] calldata _nativeTokensRegularWithdraw,
        TokenWithSkippedCheckpointsWithdraw[] calldata _tokensWithSkippedCheckpoints,
        uint32 _maxCheckpoints,
        address _receiver
    ) external nonReentrant {
        uint256 totalProcessedCheckpoints;

        /** Process normal multiple withdrawal for NativeToken based tokens */
        if (_nativeTokensRegularWithdraw.length > 0) {
            totalProcessedCheckpoints = _withdrawNativeTokens(
                _nativeTokensRegularWithdraw,
                _maxCheckpoints,
                _receiver
            );
            _maxCheckpoints = safe32(
                _maxCheckpoints - totalProcessedCheckpoints,
                "FeeSharingCollector: maxCheckpoint iteration exceeds 32 bits"
            );
        }

        /** Process normal non-nativeToken token withdrawal */
        for (uint256 i = 0; i < _nonNativeTokensRegularWithdraw.length; i++) {
            if (_maxCheckpoints == 0) break;
            uint256 endTokenCheckpoint;

            address _nonNativeTokenAddress = _nonNativeTokensRegularWithdraw[i];

            /** starting checkpoint is the previous processedCheckpoints for token */
            uint256 startingCheckpoint = processedCheckpoints[msg.sender][_nonNativeTokenAddress];

            (, endTokenCheckpoint) = _withdraw(_nonNativeTokenAddress, _maxCheckpoints, _receiver);

            uint256 _previousUsedCheckpoint = endTokenCheckpoint.sub(startingCheckpoint);
            if (startingCheckpoint > 0) {
                _previousUsedCheckpoint.add(1);
            }

            _maxCheckpoints = safe32(
                _maxCheckpoints - _previousUsedCheckpoint,
                "FeeSharingCollector: maxCheckpoint iteration exceeds 32 bits"
            );
        }

        /** Process token with skipped checkpoints withdrawal */
        if (_tokensWithSkippedCheckpoints.length > 0) {
            totalProcessedCheckpoints = _withdrawStartingFromCheckpoints(
                _tokensWithSkippedCheckpoints,
                _maxCheckpoints,
                _receiver
            );
            _maxCheckpoints = safe32(
                _maxCheckpoints - totalProcessedCheckpoints,
                "FeeSharingCollector: maxCheckpoint iteration exceeds 32 bits"
            );
        }
    }

    function _withdrawStartingFromCheckpoint(
        address _token,
        uint256 _fromCheckpoint,
        uint32 _maxCheckpoints,
        address _receiver
    ) internal returns (uint256 totalAmount, uint256 endTokenCheckpoint) {
        // @dev e.g. _fromCheckpoint == 10 meaning we should set 9 user's processed checkpoints
        // after _withdraw() the user's processedCheckpoints should be 10
        uint256 prevFromCheckpoint = _fromCheckpoint.sub(1);
        if (prevFromCheckpoint > processedCheckpoints[msg.sender][_token]) {
            processedCheckpoints[msg.sender][_token] = prevFromCheckpoint;
        }
        (totalAmount, endTokenCheckpoint) = _withdraw(_token, _maxCheckpoints, _receiver);
    }

    function _withdrawNativeToken(
        address _token,
        uint32 _maxCheckpoints
    ) internal returns (uint256 totalAmount, uint256 endTokenCheckpoint) {
        address user = msg.sender;

        IWrappedNativeTokenERC20 wrappedNativeToken = IWrappedNativeTokenERC20(
            wrappedNativeTokenAddress
        );

        (totalAmount, endTokenCheckpoint) = _getNativeTokenBalance(_token, user, _maxCheckpoints);

        if (totalAmount > 0) {
            processedCheckpoints[user][_token] = endTokenCheckpoint;
            if (_token == address(wrappedNativeToken)) {
                // unwrap the wrappedNativeToken
                wrappedNativeToken.withdraw(totalAmount);
            } else if (_token == loanWrappedNativeTokenAddress) {
                // pull out the iWrappedNativeToken to nativeToken to this feeSharingCollector contract
                /** @dev will use the burned result from IWrappedNativeToken to NativeToken as return total amount */
                totalAmount = ILoanWrappedNativeToken(loanWrappedNativeTokenAddress).burnToBTC(
                    address(this),
                    totalAmount,
                    false
                );
            }
        }
    }

    /**
     * @dev withdraw all of the NativeToken balance based on particular checkpoints
     *
     * This function will withdraw NativeToken balance which is passed as _token param, so it could be either of these:
     * - nativeToken balance or
     * - wrappedNativeToken balance which will be unwrapped to nativeToken or
     * - iWrappedNativeToken balance which will be unwrapped to nativeToken or
     *
     *
     * @param _tokens array of either NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT or wrappedNativeToken address or iWrappedNativeToken address
     * @param _maxCheckpoints  Maximum number of checkpoints to be processed to workaround block gas limit
     * @param _receiver An optional tokens receiver (msg.sender used if 0)
     */
    function _withdrawNativeTokens(
        address[] memory _tokens,
        uint32 _maxCheckpoints,
        address _receiver
    ) internal returns (uint256 totalProcessedCheckpoints) {
        validNativeTokenBasedTokens(_tokens);

        if (_receiver == ZERO_ADDRESS) {
            _receiver = msg.sender;
        }

        uint256 nativeTokenAmountToSend;

        for (uint256 i = 0; i < _tokens.length; i++) {
            if (_maxCheckpoints == 0) break;
            address _token = _tokens[i];
            uint256 startingCheckpoint = processedCheckpoints[msg.sender][_token];

            (uint256 totalAmount, uint256 endToken) = _withdrawNativeToken(
                _tokens[i],
                _maxCheckpoints
            );
            nativeTokenAmountToSend = nativeTokenAmountToSend.add(totalAmount);

            uint256 _previousUsedCheckpoint = endToken.sub(startingCheckpoint);
            if (startingCheckpoint > 0) {
                // we only need to add used checkpoint by 1 only if starting checkpoint > 0
                _previousUsedCheckpoint.add(1);
            }
            totalProcessedCheckpoints += _previousUsedCheckpoint;
            _maxCheckpoints = safe32(
                _maxCheckpoints - _previousUsedCheckpoint,
                "FeeSharingCollector: maxCheckpoint iteration exceeds 32 bits"
            );
        }

        // send all nativeToken
        if (nativeTokenAmountToSend > 0) {
            (bool success, ) = _receiver.call.value(nativeTokenAmountToSend)("");
            require(success, "FeeSharingCollector::withdrawNativeToken: Withdrawal failed");

            emit NativeTokenWithdrawn(msg.sender, _receiver, nativeTokenAmountToSend);
        }
    }

    /**
     * @dev Withdraw either specific NativeToken related token balance or all NativeToken related tokens balances.
     * NativeToken related here means, it could be either nativeToken, wrappedNativeToken, or iWrappedNativeToken, depends on the _token param.
     */
    function _withdrawNativeTokenStartingFromCheckpoint(
        address _token,
        uint256 _fromCheckpoint,
        uint32 _maxCheckpoints,
        address _receiver
    ) private returns (uint256 totalAmount, uint256 endTokenCheckpoint) {
        // @dev e.g. _fromCheckpoint == 10
        // after _withdraw() user's processedCheckpoints should be 10 =>
        // set processed checkpoints = 9, next maping index = 9 (10th checkpoint)
        uint256 prevFromCheckpoint = _fromCheckpoint.sub(1);
        if (prevFromCheckpoint > processedCheckpoints[msg.sender][_token]) {
            processedCheckpoints[msg.sender][_token] = prevFromCheckpoint;
        }
        return _withdrawNativeToken(_token, _maxCheckpoints);
    }

    /**
     * @dev Returns first user's checkpoint with weighted stake > 0
     *
     * @param _user The address of the user or contract.
     * @param _token NativeToken dummy to fit into existing data structure or SOV. Former address of the pool token.
     * @param _startFrom Checkpoint number to start from. If _startFrom < processedUserCheckpoints then starts from processedUserCheckpoints.
     * @param _maxCheckpoints Max checkpoints to process in a row to avoid timeout error
     * @return [checkpointNum: checkpoint number where user's weighted stake > 0, hasSkippedCheckpoints, hasFees]
     */
    function getNextPositiveUserCheckpoint(
        address _user,
        address _token,
        uint256 _startFrom,
        uint256 _maxCheckpoints
    ) external view returns (uint256 checkpointNum, bool hasSkippedCheckpoints, bool hasFees) {
        return _getNextPositiveUserCheckpoint(_user, _token, _startFrom, _maxCheckpoints);
    }

    /**
     * @dev Returns first user's checkpoint with weighted stake > 0
     *
     * @param _user The address of the user or contract.
     * @param _token NativeToken dummy to fit into existing data structure or SOV. Former address of the pool token.
     * @param _startFrom Checkpoint number to start from. If _startFrom < processedUserCheckpoints then starts from processedUserCheckpoints.
     * @param _maxCheckpoints Max checkpoints to process in a row to avoid timeout error
     * @return [checkpointNum: checkpoint number where user's weighted stake > 0, hasSkippedCheckpoints, hasFees]
     */
    function _getNextPositiveUserCheckpoint(
        address _user,
        address _token,
        uint256 _startFrom,
        uint256 _maxCheckpoints
    ) internal view returns (uint256 checkpointNum, bool hasSkippedCheckpoints, bool hasFees) {
        if (staking.isVestingContract(_user)) {
            return (0, false, false);
        }
        require(_maxCheckpoints > 0, "_maxCheckpoints must be > 0");

        uint256 totalCheckpoints = totalTokenCheckpoints[_token];
        uint256 processedUserCheckpoints = processedCheckpoints[_user][_token];

        if (processedUserCheckpoints >= totalCheckpoints || totalCheckpoints == 0) {
            return (totalCheckpoints, false, false);
        }

        uint256 startFrom = _startFrom > processedUserCheckpoints
            ? _startFrom
            : processedUserCheckpoints;

        uint256 end = startFrom.add(_maxCheckpoints);
        if (end >= totalCheckpoints) {
            end = totalCheckpoints;
        }

        // @note here processedUserCheckpoints is a number of processed checkpoints and
        // also an index for the next checkpoint because an array index starts wtih 0
        for (uint256 i = startFrom; i < end; i++) {
            Checkpoint storage tokenCheckpoint = tokenCheckpoints[_token][i];
            uint96 weightedStake = staking.getPriorWeightedStake(
                _user,
                tokenCheckpoint.blockNumber - 1,
                tokenCheckpoint.timestamp
            );
            if (weightedStake > 0) {
                // i is the index and we need to return checkpoint num which is i + 1
                return (i + 1, i > processedUserCheckpoints, true);
            }
        }
        return (end, end > processedUserCheckpoints, false);
    }

    /**
     * @notice Get the accumulated loan pool fee of the message sender.
     * @param _user The address of the user or contract.
     * @param _token NativeToken dummy to fit into existing data structure or SOV. Former address of the pool token.
     * @return The accumulated fee for the message sender.
     * */
    function getAccumulatedFees(address _user, address _token) public view returns (uint256) {
        uint256 amount;
        (amount, ) = _getAccumulatedFees({
            _user: _user,
            _token: _token,
            _startFrom: 0,
            _maxCheckpoints: 0
        });
        return amount;
    }

    /**
     * @notice Get the accumulated fee rewards for the message sender for a checkpoints range
     *
     * @dev This function is required to keep consistent with caching of weighted voting power when claiming fees
     *
     * @param _user The address of a user (staker) or contract.
     * @param _token NativeToken dummy to fit into existing data structure or SOV. Former address of the pool token.
     * @param _startFrom Checkpoint to start calculating fees from.
     * @param _maxCheckpoints maxCheckpoints to get accumulated fees for the _user
     * @return The accumulated fees rewards for the _user in the given checkpoints interval: [_startFrom, _startFrom + maxCheckpoints].
     * */
    function getAccumulatedFeesForCheckpointsRange(
        address _user,
        address _token,
        uint256 _startFrom,
        uint32 _maxCheckpoints
    ) external view returns (uint256) {
        uint256 amount;
        (amount, ) = _getAccumulatedFees(_user, _token, _startFrom, _maxCheckpoints);
        return amount;
    }

    /**
     * @dev Get all user fees reward per maxCheckpoint starting from latest processed checkpoint
     *
     * @dev e.g: Total user checkpoint for the particualar token = 300,
     * when we call this function with 50 maxCheckpoint, it will return 6 fee values in array form.
     * if there is no more fees, it will return empty array.
     *
     * @param _user The address of a user (staker) or contract.
     * @param _token NativeToken dummy to fit into existing data structure or SOV. Former address of the pool token.
     * @param _startFrom Checkpoint to start calculating fees from.
     * @param _maxCheckpoints maxCheckpoints to get accumulated fees for the _user
     * @return The next checkpoint num which is the starting point to fetch all of the fees, array of calculated fees.
     * */
    function getAllUserFeesPerMaxCheckpoints(
        address _user,
        address _token,
        uint256 _startFrom,
        uint32 _maxCheckpoints
    ) external view returns (uint256[] memory fees) {
        require(_maxCheckpoints > 0, "_maxCheckpoints must be > 0");

        uint256 totalCheckpoints = totalTokenCheckpoints[_token];
        uint256 totalTokensCheckpointsIndex = totalCheckpoints > 0 ? totalCheckpoints - 1 : 0;

        if (totalTokensCheckpointsIndex < _startFrom) return fees;

        uint256 arrSize = totalTokensCheckpointsIndex.sub(_startFrom).div(_maxCheckpoints) + 1;

        fees = new uint256[](arrSize);

        for (uint256 i = 0; i < fees.length; i++) {
            (uint256 fee, ) = _getAccumulatedFees(
                _user,
                _token,
                _startFrom + i * _maxCheckpoints,
                _maxCheckpoints
            );
            fees[i] = fee;
        }

        return fees;
    }

    /**
     * @notice Gets accumulated fees for a user starting from a given checkpoint
     *
     * @param _user Address of the user's account.
     * @param _token NativeToken dummy to fit into existing data structure or SOV. Former address of the pool token.
     * @param _maxCheckpoints Max checkpoints to process at once to fit into block gas limit
     * @param _startFrom Checkpoint num to start calculations from
     *
     * @return feesAmount - accumulated fees amount
     * @return endCheckpoint - last checkpoint of fees calculation
     * */
    function _getAccumulatedFees(
        address _user,
        address _token,
        uint256 _startFrom,
        uint32 _maxCheckpoints
    ) internal view returns (uint256 feesAmount, uint256 endCheckpoint) {
        if (staking.isVestingContract(_user)) {
            return (0, 0);
        }
        uint256 processedUserCheckpoints = processedCheckpoints[_user][_token];
        uint256 startOfRange = _startFrom > processedUserCheckpoints
            ? _startFrom
            : processedUserCheckpoints;
        endCheckpoint = _maxCheckpoints > 0
            ? _getEndOfRange(startOfRange, _token, _maxCheckpoints)
            : totalTokenCheckpoints[_token];

        if (startOfRange >= totalTokenCheckpoints[_token]) {
            return (0, endCheckpoint);
        }

        uint256 cachedLockDate = 0;
        uint96 cachedWeightedStake = 0;
        // @note here processedUserCheckpoints is a number of processed checkpoints and
        // also an index for the next checkpoint because an array index starts wtih 0
        for (uint256 i = startOfRange; i < endCheckpoint; i++) {
            Checkpoint memory checkpoint = tokenCheckpoints[_token][i];
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
            feesAmount = feesAmount.add(share);
        }
        return (feesAmount, endCheckpoint);
    }

    /**
     * @notice Withdrawal should only be possible for blocks which were already
     * mined. If the fees are withdrawn in the same block as the user withdrawal
     * they are not considered by the withdrawing logic (to avoid inconsistencies).
     *
     * @param _start Start of the range.
     * @param _token NativeToken dummy to fit into existing data structure or SOV. Former address of a pool token.
     * @param _maxCheckpoints Checkpoint index incremental.
     * */
    function _getEndOfRange(
        uint256 _start,
        address _token,
        uint32 _maxCheckpoints
    ) internal view returns (uint256) {
        uint256 nextCheckpointIndex = totalTokenCheckpoints[_token];
        if (nextCheckpointIndex == 0) {
            return 0;
        }
        uint256 end;

        if (_maxCheckpoints == 0) {
            /// @dev All checkpoints will be processed (only for getter outside of a transaction).
            end = nextCheckpointIndex;
        } else {
            end = safe32(
                _start + _maxCheckpoints,
                "FeeSharingCollector::withdraw: checkpoint index exceeds 32 bits"
            );
            if (end > nextCheckpointIndex) {
                end = nextCheckpointIndex;
            }
        }

        /// @dev Withdrawal should only be possible for blocks which were already mined.
        uint32 lastBlockNumber = tokenCheckpoints[_token][end - 1].blockNumber;
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
            "FeeSharingCollector::_writeCheckpoint: block number exceeds 32 bits"
        );
        uint32 blockTimestamp = safe32(
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
    function _getVoluntaryWeightedStake(
        uint32 blockNumber,
        uint256 timestamp
    ) internal view returns (uint96 totalWeightedStake) {
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

    function withdrawWrappedNativeToken(
        address receiver,
        uint256 wrappedNativeTokenAmount
    ) external onlyOwner {
        IERC20 wrappedNativeToken = IERC20(wrappedNativeTokenAddress);

        uint256 balance = wrappedNativeToken.balanceOf(address(this));
        require(wrappedNativeTokenAmount <= balance, "Insufficient balance");

        wrappedNativeToken.safeTransfer(receiver, wrappedNativeTokenAmount);
    }

    /**
     * @dev This function is dedicated to recover the wrong fee allocation for the 4 year vesting contracts.
     * This function can only be called once
     * The affected tokens to be withdrawn
     * 1. NativeToken
     * 2. ZUSD
     * 3. SOV
     * The amount for all of the tokens above is hardcoded
     * The withdrawn tokens will be sent to the owner.
     */
    function recoverIncorrectAllocatedFees()
        external
        oneTimeExecution(this.recoverIncorrectAllocatedFees.selector)
        onlyOwner
    {
        uint256 nativeTokenAmount = 878778886164898400;
        uint256 zusdAmount = 16658600400155126000000;
        uint256 sovAmount = 6275898259771202000000;

        address zusdToken = 0xdB107FA69E33f05180a4C2cE9c2E7CB481645C2d;
        address sovToken = 0xEFc78fc7d48b64958315949279Ba181c2114ABBd;

        // Withdraw nativeToken
        (bool success, ) = owner().call.value(nativeTokenAmount)("");
        require(
            success,
            "FeeSharingCollector::recoverIncorrectAllocatedFees: Withdrawal nativeToken failed"
        );

        // Withdraw ZUSD
        IERC20(zusdToken).safeTransfer(owner(), zusdAmount);

        // Withdraw SOV
        IERC20(sovToken).safeTransfer(owner(), sovAmount);
    }

    /**
     * @dev view function that calculate the total NativeToken that includes:
     * - NativeToken
     * - WrappedNativeToken
     * - iWrappedNativeToken * iWrappedNativeToken.tokenPrice()
     * @param _user address of the user.
     * @return nativeToken balance of the given user's address.
     */
    function getAccumulatedNativeTokenFeeBalances(address _user) external view returns (uint256) {
        (
            uint256 _nativeTokenAmount,
            uint256 _wrappedNativeTokenAmount,
            uint256 _iWrappedNativeTokenAmount,
            ,
            ,

        ) = _getNativeTokenBalances(_user, 0);
        uint256 iWrappedNativeTokenAmountInNativeToken = _iWrappedNativeTokenAmount
            .mul(ILoanWrappedNativeToken(loanWrappedNativeTokenAddress).tokenPrice())
            .div(1e18);
        return
            _nativeTokenAmount.add(_wrappedNativeTokenAmount).add(
                iWrappedNativeTokenAmountInNativeToken
            );
    }

    /**
     * @dev private function that responsible to calculate the user's token that has NativeToken as underlying token (nativeToken, wrappedNativeToken, iWrappedNativeToken)
     *
     * @param _user address of the user.
     * @param _maxCheckpoints maximum checkpoints.
     *
     * @return _nativeTokenAmount nativeToken amount
     * @return _wrappedNativeTokenAmount wrappedNativeToken amount
     * @return _iWrappedNativeTokenAmount iWrappedNativeToken (wrappedNativeToken lending pool token) amount * token price
     * @return _endNativeToken end time of accumulated fee calculation for nativeToken
     * @return _endWrappedNativeToken end time of accumulated fee calculation for wrappedNativeToken
     * @return _endIWrappedNativeToken end time of accumulated fee calculation for iWrappedNativeToken
     */
    function _getNativeTokenBalances(
        address _user,
        uint32 _maxCheckpoints
    )
        private
        view
        returns (
            uint256 _nativeTokenAmount,
            uint256 _wrappedNativeTokenAmount,
            uint256 _iWrappedNativeTokenAmount,
            uint256 _endNativeToken,
            uint256 _endWrappedNativeToken,
            uint256 _endIWrappedNativeToken
        )
    {
        (_nativeTokenAmount, _endNativeToken) = _getAccumulatedFees({
            _user: _user,
            _token: NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT,
            _startFrom: 0,
            _maxCheckpoints: _maxCheckpoints
        });

        (_wrappedNativeTokenAmount, _endWrappedNativeToken) = _getAccumulatedFees({
            _user: _user,
            _token: wrappedNativeTokenAddress,
            _startFrom: 0,
            _maxCheckpoints: _maxCheckpoints
        });
        (_iWrappedNativeTokenAmount, _endIWrappedNativeToken) = _getAccumulatedFees({
            _user: _user,
            _token: loanWrappedNativeTokenAddress,
            _startFrom: 0,
            _maxCheckpoints: _maxCheckpoints
        });
    }

    /**
     * @dev private function that responsible to calculate the user's token that has NativeToken as underlying token (nativeToken, wrappedNativeToken, iWrappedNativeToken)
     *
     * @param _token either NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT or wrappedNativeToken address or iWrappedNativeToken address
     * @param _user address of the user.
     * @param _maxCheckpoints maximum checkpoints.
     *
     * @return _tokenAmount token (nativeToken, or wrappedNativeToken, or iWrappedNativeToken) amount
     * @return _endToken end time of accumulated fee calculation for token (nativeToken, or wrappedNativeToken, or iWrappedNativeToken )
     */
    function _getNativeTokenBalance(
        address _token,
        address _user,
        uint32 _maxCheckpoints
    ) internal view returns (uint256 _tokenAmount, uint256 _endToken) {
        if (
            _token == NATIVE_TOKEN_DUMMY_ADDRESS_FOR_CHECKPOINT ||
            _token == wrappedNativeTokenAddress ||
            _token == loanWrappedNativeTokenAddress
        ) {
            (_tokenAmount, _endToken) = _getAccumulatedFees({
                _user: _user,
                _token: _token,
                _startFrom: 0,
                _maxCheckpoints: _maxCheckpoints
            });
        } else {
            revert(
                "FeeSharingCollector::_getNativeTokenBalance: only nativeToken-based tokens are allowed"
            );
        }
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

    // Function to convert bytes to uint256
    function bytesToUint256(bytes memory b) private pure returns (uint256) {
        require(b.length == 32, "Invalid bytes length, must be 32 bytes");

        uint256 result;

        assembly {
            result := mload(add(b, 0x20))
        }

        return result;
    }
}

interface ILoanWrappedNativeToken {
    function burnToBTC(
        address receiver,
        uint256 burnAmount,
        bool useLM
    ) external returns (uint256 loanAmountPaid);

    function tokenPrice() external view returns (uint256 price);
}
