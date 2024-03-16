pragma solidity 0.8.17;

/**
 * @dev Interface for BOB (Build on Bitcoin) LockDrop contract
 * The contract is used for deposits and BOB reward points allocation
 */
interface ILockDrop {
    // Events
    event TokenAllowed(address token, TokenInfo info);
    event TokenL2DepositAddressChange(address l1Token, address l2Token);
    event BridgeAddress(address bridgeAddress);
    event WithdrawalTimeUpdated(uint256 endTime);
    event Deposit(
        address indexed depositOwner,
        address indexed token,
        uint256 amount,
        uint256 depositTime
    );
    event WithdrawToL1(address indexed owner, address indexed token, uint256 amount);
    event WithdrawToL2(
        address indexed owner,
        address indexed l1Token,
        address indexed l2Token,
        uint256 amount
    );

    // Struct to hold token information.
    struct TokenInfo {
        bool isAllowed; // Flag indicating whether the token is allowed for deposit.
        address l2TokenAddress; // Address of the corresponding token on Layer 2.
    }

    // Struct to hold L1 and L2 token addresses.
    struct TokenAddressPair {
        address l1TokenAddress;
        address l2TokenAddress;
    }

    /** getter */
    function allowedTokens(address) external view returns (TokenInfo memory);
    function deposits(address, address) external view returns (uint256);
    function withdrawalStartTime() external view returns (uint256);
    function bridgeProxyAddress() external view returns (address);

    /**
     * @dev Deposit ERC20 tokens.
     * @param token Address of the ERC20 token.
     * @param amount Amount of tokens to deposit.
     */
    function depositERC20(address token, uint256 amount) external;

    /**
     * @dev Deposit Ether
     * Allows users to deposit Ether into the contract.
     */
    function depositEth() external payable;

    /**
     * @dev Function to withdraw all deposits to Layer 2 for multiple tokens.
     * @param tokens Array of token addresses to withdraw.
     * @param minGasLimit Minimum gas limit for the withdrawal transactions.
     */
    function withdrawDepositsToL2(address[] calldata tokens, uint32 minGasLimit) external;

    /**
     * @dev Function to withdraw all deposits to Layer 1 for multiple tokens.
     * @param tokens Array of token addresses to withdraw.
     */
    function withdrawDepositsToL1(address[] calldata tokens) external;

    /**
     * @dev Function to allow ERC20 tokens for deposit.
     * This function allows the contract owner to allow specific ERC20 tokens for deposit.
     * @param l1TokenAddress Address of the ERC20 token to allow on Layer 1.
     * @param l2TokenAddress Address of the corresponding token on Layer 2.
     */
    function allow(address l1TokenAddress, address l2TokenAddress) external;

    /**
     * @dev Function to change the Layer 2 (L2) address of tokens that were allowed for deposit.
     * This function allows the contract owner to change the L2 address of tokens that were previously allowed for deposit.
     * @param tokenPairs An array of structs, each containing a pair of addresses representing the Layer 1 (L1) token address
     *                   and its corresponding Layer 2 (L2) token address.
     */
    function changeMultipleL2TokenAddresses(TokenAddressPair[] calldata tokenPairs) external;

    /**
     * @dev Function to change the withdrawal time.
     * This function allows the contract owner to change the withdrawal time.
     * @param newWithdrawalStartTime New withdrawal start time.
     */
    function changeWithdrawalTime(uint256 newWithdrawalStartTime) external;

    /**
     * @dev Function to set the address of the bridge proxy.
     * This function allows the contract owner to set the address of the bridge proxy for token transfers between Layer 1 and Layer 2.
     * @param l2BridgeProxyAddress Address of the bridge proxy contract.
     */
    function setBridgeProxyAddress(address l2BridgeProxyAddress) external;
    /**
     * @dev Function to pause contract, Overridden functions from Pausable contract
     */
    function pause() external;

    /**
     * @dev Function to unpause contract, Overridden functions from Pausable contract
     */
    function unpause() external;

    /**
     * @dev Function to check if the withdrawal time has started.
     * @return bool true if the withdrawal time has started, false otherwise.
     */
    function isWithdrawalTimeStarted() external view returns (bool);

    /**
     * @dev Get the Ether balance of the contract
     * @return uint256 Ether balance of the contract
     */
    function getEthBalance() external view returns (uint256);

    /**
     * @dev Function to retrieve information about a token's allowance for deposit.
     * @param token Address of the token to retrieve information for.
     */
    function getTokenInfo(address token) external view returns (TokenInfo memory);

    /**
     * @dev Get the deposited amount of a token for a given user
     * @param depositOwner Address of the user
     * @param token Address of the token
     * @return uint256 Amount of tokens deposited
     */
    function getDepositAmount(address depositOwner, address token) external view returns (uint256);
}
