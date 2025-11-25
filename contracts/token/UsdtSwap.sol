// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC777Recipient.sol";
import "@openzeppelin/contracts/utils/introspection/IERC1820Registry.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract UsdtSwap is IERC777Recipient, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable rusdtReceiver;
    address public immutable usdt0Provider;
    address public immutable rescuer;
    IERC20 public constant RUSDT = IERC20(0xEf213441a85DF4d7acBdAe0Cf78004E1e486BB96);
    IERC20 public constant USDT0 = IERC20(0x779dED0C9e1022225F8e0630b35A9B54Be713736);
    IERC1820Registry private constant _ERC1820_REGISTRY =
        IERC1820Registry(0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24);
    // keccak256("ERC777TokensRecipient") = 0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b
    bytes32 private constant TOKENS_RECIPIENT_INTERFACE_HASH =
        0xb281fc8c12954d22544db45de3159a39272895b169a852b314f9cc762e44c53b;

    /**
     * @notice Emitted when non-swap tokens are rescued from the contract.
     * @param token The address of the rescued token.
     * @param amount The amount of tokens rescued.
     */
    event Rescue(address indexed token, uint256 amount);

    /**
     * @notice Deploys the USDT swap contract with required addresses.
     * @param _rusdtReceiver Address to receive RUSDT tokens swapped for USDT0
     * @param _usdt0Provider Address providing USDT0 tokens for swap from RUSDT.
     * @param _rescuer Address allowed to rescue non-swap tokens.
     */
    constructor(address _rusdtReceiver, address _usdt0Provider, address _rescuer) {
        require(
            _rusdtReceiver != address(0) && _usdt0Provider != address(0) && _rescuer != address(0),
            "Recipient/provider/rescuer is zero"
        );
        rusdtReceiver = _rusdtReceiver;
        usdt0Provider = _usdt0Provider;
        rescuer = _rescuer;
        _ERC1820_REGISTRY.setInterfaceImplementer(
            address(this),
            TOKENS_RECIPIENT_INTERFACE_HASH,
            address(this)
        );
    }

    /**
     * @notice ERC777 recipient hook. Swaps RUSDT for USDT0 1:1 when RUSDT is sent to this contract.
     * @dev Only accepts RUSDT tokens. Transfers RUSDT to receiver and USDT0 from provider to sender.
     *      Reverts if not enough allowance or balance, or if transfer fails. Enforces invariant.
     * @param from The address sending RUSDT.
     * @param to The address receiving RUSDT (should be this contract).
     * @param amount Amount of RUSDT received and USDT0 to send.
     */
    function tokensReceived(
        address /*operator*/,
        address from,
        address to,
        uint256 amount,
        bytes calldata /*userData*/,
        bytes calldata /*operatorData*/
    ) external override nonReentrant {
        require(msg.sender == address(RUSDT), "Only RUSDT accepted");
        require(to == address(this), "Tokens not sent to contract");
        require(amount > 0, "Amount must be > 0");
        // Transfer USDT0 from provider to sender
        uint256 allowance = USDT0.allowance(usdt0Provider, address(this));
        require(allowance >= amount, "USDT0 allowance too low");
        uint256 providerBalance = USDT0.balanceOf(usdt0Provider);
        require(providerBalance >= amount, "USDT0 provider balance too low");
        bool success = USDT0.transferFrom(usdt0Provider, from, amount);
        require(success, "USDT0 transferFrom failed");
        // Transfer RUSDT to receiver
        RUSDT.safeTransfer(rusdtReceiver, amount);
        // Invariant: contract should not hold RUSDT or USDT0
        require(RUSDT.balanceOf(address(this)) == 0, "RUSDT left on contract");
        require(USDT0.balanceOf(address(this)) == 0, "USDT0 left on contract");
    }

    /**
     * @notice Rescue any non-swap tokens accidentally sent to this contract.
     * @dev Only callable by the rescuer address. Cannot rescue RUSDT or USDT0.
     * @param token The address of the token to rescue.
     */
    function rescue(address token) external nonReentrant {
        require(msg.sender == rescuer, "Not rescuer");
        require(token != address(RUSDT) && token != address(USDT0), "Cannot rescue swap tokens");
        uint256 bal = IERC20(token).balanceOf(address(this));
        if (bal > 0) {
            IERC20(token).safeTransfer(rescuer, bal);
            emit Rescue(token, bal);
        }
    }

    /**
     * @notice Prevent receiving native tokens (ETH/rBTC).
     */
    receive() external payable {
        revert("No native tokens accepted");
    }

    /**
     * @notice Prevent fallback calls.
     */
    fallback() external payable {
        revert("No fallback calls");
    }
}
