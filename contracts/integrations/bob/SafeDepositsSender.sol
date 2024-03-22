// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { ISafeDepositsSender } from "./interfaces/ISafeDepositsSender.sol";

interface IERC20Spec {
    function balanceOf(address _who) external view returns (uint256);
    function transfer(address _to, uint256 _value) external returns (bool);
}
interface GnosisSafe {
    enum Operation {
        Call,
        DelegateCall
    }

    /// @dev Allows a Module to execute a Safe transaction without any further confirmations.
    /// @param to Destination address of module transaction.
    /// @param value Ether value of module transaction.
    /// @param data Data payload of module transaction.
    /// @param operation Operation type of module transaction.
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        Operation operation
    ) external returns (bool success);
}

/**
 * @title SafeDepositsSender
 * @notice This contract is a gateway for depositing funds into the Bob locker contracts
 */
contract SafeDepositsSender is ISafeDepositsSender {
    address public constant ETH_TOKEN_ADDRESS = address(0x01);

    GnosisSafe private immutable SAFE;
    address private immutable LOCK_DROP_ADDRESS;
    address private immutable SOV_TOKEN_ADDRESS;
    address private DEPOSITOR_ADDRESS;
    uint256 private stopBlock; // if set the contract is stopped forever - irreversible
    bool private paused;

    /**
     * @param _safeAddress Address of the Gnosis Safe
     * @param _lockDrop Address of the lock drop contract
     * @param _sovToken Address of the SOV token contract
     * @param _depositor Address of the depositor account
     */
    constructor(address _safeAddress, address _lockDrop, address _sovToken, address _depositor) {
        require(_safeAddress != address(0), "SafeDepositsSender: Invalid safe address");
        require(_lockDrop != address(0), "SafeDepositsSender: Invalid lockdrop address");
        require(_sovToken != address(0), "SafeDepositsSender: Invalid sov token address");
        require(_depositor != address(0), "SafeDepositsSender: Invalid depositor token address");
        SAFE = GnosisSafe(_safeAddress);
        LOCK_DROP_ADDRESS = _lockDrop;
        SOV_TOKEN_ADDRESS = _sovToken;
        DEPOSITOR_ADDRESS = _depositor;
    }

    receive() external payable {}

    // MODIFIERS //

    modifier onlySafe() {
        require(msg.sender == address(SAFE), "SafeDepositsSender: Only Safe");
        _;
    }

    modifier onlyDepositor() {
        require(msg.sender == DEPOSITOR_ADDRESS, "SafeDepositsSender: Only Depositor");
        _;
    }

    modifier onlyDepositorOrSafe() {
        require(
            msg.sender == DEPOSITOR_ADDRESS || msg.sender == address(SAFE),
            "SafeDepositsSender: Only Depositor or Safe"
        );
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "SafeDepositsSender: Paused");
        _;
    }

    modifier whenPaused() {
        require(paused, "SafeDepositsSender: Not paused");
        _;
    }

    modifier whenUnstopped() {
        require(stopBlock == 0, "SafeDepositsSender: Stopped");
        _;
    }

    modifier notZeroAddress(address _address) {
        require(_address != address(0), "SafeDepositsSender: Invalid address");
        _;
    }

    // CORE FUNCTIONS

    /**
     * @notice Sends tokens to the LockDrop contract
     * @dev This function is for sending tokens to the LockDrop contract for users to receive rewards and to be bridged to the BOB mainnet for Sovryn DEX
     * @dev The function is allowed to be called only by the DEPOSITOR_ADDRESS
     * @dev Token amounts and SOV amount to send are calculated offchain
     * @param tokens List of tokens to send
     * @param amounts List of amounts of tokens to send
     * @param sovAmount Amount of SOV tokens to send
     */
    function sendToLockDropContract(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256 sovAmount
    ) external onlyDepositor whenNotPaused whenUnstopped {
        require(
            tokens.length == amounts.length,
            "SafeDepositsSender: Tokens and amounts length mismatch"
        );
        require(sovAmount > 0, "SafeDepositsSender: Invalid SOV amount");

        bytes memory data;

        for (uint256 i = 0; i < tokens.length; i++) {
            require(
                tokens[i] != SOV_TOKEN_ADDRESS,
                "SafeDepositsSender: SOV token is transferred separately"
            );

            // transfer native token
            uint256 balance;
            if (tokens[i] == address(0x01)) {
                require(
                    address(SAFE).balance >= amounts[i],
                    "SafeDepositsSender: Not enough funds"
                );
                data = abi.encodeWithSignature("depositEth()");
                require(
                    SAFE.execTransactionFromModule(
                        LOCK_DROP_ADDRESS,
                        amounts[i],
                        data,
                        GnosisSafe.Operation.Call
                    ),
                    "Could not execute ether transfer"
                );

                // withdraw balance to this contract left after deposit to the LockDrop
                balance = address(SAFE).balance;
                require(
                    SAFE.execTransactionFromModule(
                        address(this),
                        balance,
                        "",
                        GnosisSafe.Operation.Call
                    ),
                    "Could not execute ether transfer"
                );
            } else {
                // transfer ERC20 tokens
                IERC20Spec token = IERC20Spec(tokens[i]);
                balance = token.balanceOf(address(SAFE));
                require(balance >= amounts[i], "SafeDepositsSender: Not enough funds");

                data = abi.encodeWithSignature(
                    "approve(address,uint256)",
                    LOCK_DROP_ADDRESS,
                    amounts[i]
                );
                require(
                    SAFE.execTransactionFromModule(tokens[i], 0, data, GnosisSafe.Operation.Call),
                    "Could not execute token transfer"
                );

                data = abi.encodeWithSignature(
                    "depositERC20(address,uint256)",
                    tokens[i],
                    amounts[i]
                );
                require(
                    SAFE.execTransactionFromModule(
                        LOCK_DROP_ADDRESS,
                        0,
                        data,
                        GnosisSafe.Operation.Call
                    ),
                    "Could not execute token transfer"
                );

                // withdraw balance to this contract left after deposit to the LockDrop
                balance = token.balanceOf(address(SAFE));
                data = abi.encodeWithSignature(
                    "transfer(address,uint256)",
                    address(this),
                    balance
                );
                require(
                    SAFE.execTransactionFromModule(tokens[i], 0, data, GnosisSafe.Operation.Call),
                    "Could not execute ether transfer"
                );
            }
            emit DepositToLockdrop(tokens[i], amounts[i]);
            emit WithdrawBalanceFromSafe(tokens[i], balance);
        }

        // transfer SOV
        data = abi.encodeWithSignature("approve(address,uint256)", LOCK_DROP_ADDRESS, sovAmount);
        require(
            SAFE.execTransactionFromModule(SOV_TOKEN_ADDRESS, 0, data, GnosisSafe.Operation.Call),
            "Could not execute token transfer"
        );
        data = abi.encodeWithSignature(
            "depositERC20(address,uint256)",
            SOV_TOKEN_ADDRESS,
            sovAmount
        );
        require(
            SAFE.execTransactionFromModule(LOCK_DROP_ADDRESS, 0, data, GnosisSafe.Operation.Call),
            "Could not execute SOV transfer"
        );

        emit DepositSOVToLockdrop(sovAmount);
    }

    // ADMINISTRATIVE FUNCTIONS //

    /// @notice There is no check if _newDepositor is not zero on purpose - that could be required

    /**
     * @notice Sets new depositor address
     * @dev Only Safe can call this function
     * @dev New depositor can be zero address
     * @param _newDepositor New depositor address
     */
    function setDepositorAddress(address _newDepositor) external onlySafe {
        emit setDepositor(DEPOSITOR_ADDRESS, _newDepositor);
        DEPOSITOR_ADDRESS = _newDepositor;
    }

    /**
     * @notice Withdraws tokens from this contract to a recipient address
     * @notice Withdrawal to the Safe address will affect balances and rewards
     * @notice Amount > 0 should be checked by the caller before calling this function
     * @dev Only Safe can call this function
     * @dev Recipient should not be a zero address
     * @param tokens List of token addresses to withdraw
     * @param amounts List of token amounts to withdraw
     * @param recipient Recipient address
     */
    function withdraw(
        address[] calldata tokens,
        uint256[] calldata amounts,
        address recipient
    ) external onlySafe notZeroAddress(recipient) {
        require(
            tokens.length == amounts.length,
            "SafeDepositsSender: Tokens and amounts length mismatch"
        );

        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0x01)) {
                require(
                    address(this).balance >= amounts[i],
                    "SafeDepositsSender: Not enough funds"
                );
                (bool success, ) = payable(recipient).call{ value: amounts[i] }("");
                require(success, "Could not withdraw ether");
                continue;
            }

            IERC20Spec token = IERC20Spec(tokens[i]);
            uint256 balance = token.balanceOf(address(this));
            require(balance >= amounts[i], "SafeDepositsSender: Not enough funds");

            token.transfer(recipient, amounts[i]);

            emit Withdraw(recipient, tokens[i], amounts[i]);
        }
    }

    /**
     * @notice Withdraws all tokens from this contract to a recipient
     * @notice Amount > 0 should be checked by the caller before calling this function
     * @dev Only Safe can call this function
     * @dev Recipient should not be a zero address
     * @notice Withdrawal to the Safe address will affect balances and rewards
     * @param tokens List of token addresses to withdraw
     * @param recipient Recipient address
     */
    function withdrawAll(
        address[] calldata tokens,
        address recipient
    ) external onlySafe notZeroAddress(recipient) {
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == address(0x01)) {
                (bool success, ) = payable(recipient).call{ value: address(this).balance }("");
                require(success, "Could not withdraw ether");
                continue;
            }
            IERC20Spec token = IERC20Spec(tokens[i]);
            uint256 balance = token.balanceOf(address(this));
            if (balance > 0) {
                token.transfer(recipient, balance);
            }

            emit Withdraw(recipient, tokens[i], balance);
        }
    }

    /// @notice pause the contract - no funds can be sent to the LockDrop contract
    function pause() external onlySafe whenNotPaused {
        paused = true;
        emit Pause();
    }

    /// @notice unpause the contract
    function unpause() external onlySafe whenPaused {
        paused = false;
        emit Unpause();
    }

    /// @notice stops the contract - no funds can be sent to the LockDrop contract, this is irreversible
    function stop() external onlySafe {
        stopBlock = block.number;
        emit Stop();
    }

    // GETTERS //
    function getSafeAddress() external view returns (address) {
        return address(SAFE);
    }

    function getLockDropAddress() external view returns (address) {
        return LOCK_DROP_ADDRESS;
    }

    function getSovTokenAddress() external view returns (address) {
        return SOV_TOKEN_ADDRESS;
    }

    function getDepositorAddress() external view returns (address) {
        return DEPOSITOR_ADDRESS;
    }

    function isStopped() external view returns (bool) {
        return stopBlock != 0;
    }

    function getStopBlock() external view returns (uint256) {
        return stopBlock;
    }

    function isPaused() external view returns (bool) {
        return paused;
    }
}
