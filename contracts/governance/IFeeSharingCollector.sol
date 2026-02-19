pragma solidity ^0.5.17;

/**
 * @title Interface for contract governance/FeeSharingCollector/FeeSharingCollector.sol
 * @dev Interfaces are used to cast a contract address into a callable instance.
 * */
interface IFeeSharingCollector {
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

    event SetWrbtcToken(
        address indexed sender,
        address indexed oldWrbtcToken,
        address indexed newWrbtcToken
    );

    event SetLoanTokenWrbtc(
        address indexed sender,
        address indexed oldLoanTokenWrbtc,
        address indexed newLoanTokenWrbtc
    );

    /// @notice An event emitted when a token is added to the protocol withhold list.
    event TokenAddedToProtocolWithholdList(address indexed sender, address indexed token);

    /// @notice An event emitted when a token is removed from the protocol withhold list.
    event TokenRemovedFromProtocolWithholdList(address indexed sender, address indexed token);

    /// @notice An event emitted when protocol withheld fees are withdrawn.
    event ProtocolWithheldFeesWithdrawn(
        address indexed sender,
        address indexed receiver,
        address indexed token,
        uint256 amount
    );

    /// @notice An event emitted when revenue is accumulated.
    event ProtocolRevenueAccumulated(address indexed token, uint256 amount);
    function withdrawFees(address[] calldata _token) external;

    function transferTokens(address _token, uint96 _amount) external;

    function withdraw(address _loanPoolToken, uint32 _maxCheckpoints, address _receiver) external;

    function addProtocolWithholdToken(address token) external;

    function removeProtocolWithholdToken(address token) external;

    function isTokenInProtocolWithholdList(address token) external view returns (bool);

    function getProtocolWithholdTokensList() external view returns (address[] memory);

    function withdrawProtocolWithheldFees(address _token, address _receiver) external;

    function withdrawProtocolWithheldFeesBatch(
        address[] calldata _tokens,
        address _receiver
    ) external;

    function getProtocolWithheldFees(address token) external view returns (uint256);
}
