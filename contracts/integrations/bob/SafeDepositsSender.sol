// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { ISafeDepositsSender } from "./interfaces/ISafeDepositsSender.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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
    using SafeERC20 for IERC20;
    address public constant ETH_TOKEN_ADDRESS = address(0x01);
    GnosisSafe private immutable SAFE;
    address private immutable SOV_TOKEN_ADDRESS;
    address private lockdropDepositorAddress; // address used by automation script to deposit to the LockDrop contract
    address private lockDropAddress;
    uint256 private stopBlock; // if set the contract is stopped forever - irreversible
    bool private paused;

    /**
     * @param _safeAddress Address of the Gnosis Safe
     * @param _lockDrop Address of the BOB FusionLock contract
     * @param _sovToken Address of the SOV token contract
     * @param _depositor Address of the depositor account
     */
    constructor(address _safeAddress, address _lockDrop, address _sovToken, address _depositor) {
        require(_safeAddress != address(0), "SafeDepositsSender: Invalid safe address");
        require(_lockDrop != address(0), "SafeDepositsSender: Invalid lockdrop address");
        require(_sovToken != address(0), "SafeDepositsSender: Invalid sov token address");
        require(_depositor != address(0), "SafeDepositsSender: Invalid depositor token address");
        SAFE = GnosisSafe(_safeAddress);
        SOV_TOKEN_ADDRESS = _sovToken;
        lockdropDepositorAddress = _depositor;
        lockDropAddress = _lockDrop;
    }

    receive() external payable {}

    // MODIFIERS //

    modifier onlySafe() {
        require(msg.sender == address(SAFE), "SafeDepositsSender: Only Safe");
        _;
    }

    modifier onlyDepositor() {
        require(msg.sender == lockdropDepositorAddress, "SafeDepositsSender: Only Depositor");
        _;
    }

    modifier onlyDepositorOrSafe() {
        require(
            msg.sender == lockdropDepositorAddress || msg.sender == address(SAFE),
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
     * @dev The function is allowed to be called only by the lockdropDepositorAddress
     * @dev Token amounts and SOV amount to send are calculated offchain
     * @param tokens List of tokens to send
     * @param amounts List of amounts of tokens to send
     * @param sovAmount Amount of SOV tokens to send
     */
    function sendToLockDropContract(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256 sovAmount
    ) external onlyDepositorOrSafe whenNotPaused whenUnstopped {
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
            uint256 transferAmount;
            if (tokens[i] == ETH_TOKEN_ADDRESS) {
                require(
                    address(SAFE).balance >= amounts[i],
                    "SafeDepositsSender: Not enough funds"
                );
                data = abi.encodeWithSignature("depositEth()");
                require(
                    SAFE.execTransactionFromModule(
                        lockDropAddress,
                        amounts[i],
                        data,
                        GnosisSafe.Operation.Call
                    ),
                    "Could not execute ether transfer"
                );

                // withdraw balance to this contract left after deposit to the LockDrop
                balance = address(SAFE).balance;
                transferAmount = balance < amounts[i] ? balance : amounts[i];
                if (transferAmount > 0) {
                    require(
                        SAFE.execTransactionFromModule(
                            address(this),
                            transferAmount,
                            "",
                            GnosisSafe.Operation.Call
                        ),
                        "Could not execute ether transfer"
                    );
                    emit WithdrawBalanceFromSafe(tokens[i], transferAmount);
                }
            } else {
                // transfer ERC20 tokens
                IERC20 token = IERC20(tokens[i]);
                balance = token.balanceOf(address(SAFE));
                require(balance >= amounts[i], "SafeDepositsSender: Not enough funds");

                data = abi.encodeWithSignature(
                    "approve(address,uint256)",
                    lockDropAddress,
                    amounts[i]
                );
                require(
                    SAFE.execTransactionFromModule(tokens[i], 0, data, GnosisSafe.Operation.Call),
                    "SafeDepositsSender: Could not approve token transfer"
                );

                data = abi.encodeWithSignature(
                    "depositERC20(address,uint256)",
                    tokens[i],
                    amounts[i]
                );
                require(
                    SAFE.execTransactionFromModule(
                        lockDropAddress,
                        0,
                        data,
                        GnosisSafe.Operation.Call
                    ),
                    "SafeDepositsSender: Could not execute token transfer"
                );

                // withdraw balance to this contract left after deposit to the LockDrop
                balance = token.balanceOf(address(SAFE));
                transferAmount = balance < amounts[i] ? balance : amounts[i];
                if (transferAmount > 0) {
                    data = abi.encodeWithSignature(
                        "transfer(address,uint256)",
                        address(this),
                        transferAmount
                    );
                    require(
                        SAFE.execTransactionFromModule(
                            tokens[i],
                            0,
                            data,
                            GnosisSafe.Operation.Call
                        ),
                        "SafeDepositsSender: Could not execute ether transfer"
                    );
                    emit WithdrawBalanceFromSafe(tokens[i], transferAmount);
                }
            }
            emit DepositToLockdrop(lockDropAddress, tokens[i], amounts[i]);
        }

        // transfer SOV
        data = abi.encodeWithSignature("approve(address,uint256)", lockDropAddress, sovAmount);
        require(
            SAFE.execTransactionFromModule(SOV_TOKEN_ADDRESS, 0, data, GnosisSafe.Operation.Call),
            "SafeDepositsSender: Could not execute SOV token transfer"
        );
        data = abi.encodeWithSignature(
            "depositERC20(address,uint256)",
            SOV_TOKEN_ADDRESS,
            sovAmount
        );
        require(
            SAFE.execTransactionFromModule(lockDropAddress, 0, data, GnosisSafe.Operation.Call),
            "Could not execute SOV transfer"
        );

        emit DepositSOVToLockdrop(lockDropAddress, sovAmount);
    }

    /// @notice Maps depositor on ethereum to receiver on BOB
    /// @notice Receiver from the last emitted event called by msg.sender will be used
    /// @param receiver Receiver address on BOB. The depositor address will be replaced with the receiver address for distribution of LP tokens and rewards on BOB
    function mapDepositorToReceiver(address receiver) external {
        emit MapDepositorToReceiver(msg.sender, receiver);
    }

    // ADMINISTRATIVE FUNCTIONS //

    /**
     * @notice Execute `operation` (0: Call, 1: DelegateCall) to `to` with `value` (Native Token) from Safe
     * @param to Destination address of module transaction.
     * @param value Ether value of module transaction.
     * @param data Data payload of module transaction.
     * @param operation Operation type of module transaction.
     * @return success Boolean flag indicating if the call succeeded.
     */
    function execTransactionFromSafe(
        address to,
        uint256 value,
        bytes memory data,
        GnosisSafe.Operation operation
    ) external onlySafe returns (bool success) {
        success = execute(to, value, data, operation, type(uint256).max);
    }

    /**
     * @notice Executes either a delegatecall or a call with provided parameters.
     * @dev This method doesn't perform any sanity check of the transaction, such as:
     *      - if the contract at `to` address has code or not
     *      It is the responsibility of the caller to perform such checks.
     * @param to Destination address.
     * @param value Ether value.
     * @param data Data payload.
     * @param operation Operation type.
     * @return success boolean flag indicating if the call succeeded.
     */
    function execute(
        address to,
        uint256 value,
        bytes memory data,
        GnosisSafe.Operation operation,
        uint256 txGas
    ) internal returns (bool success) {
        if (operation == GnosisSafe.Operation.DelegateCall) {
            /* solhint-disable no-inline-assembly */
            /// @solidity memory-safe-assembly
            assembly {
                success := delegatecall(txGas, to, add(data, 0x20), mload(data), 0, 0)
            }
            /* solhint-enable no-inline-assembly */
        } else {
            /* solhint-disable no-inline-assembly */
            /// @solidity memory-safe-assembly
            assembly {
                success := call(txGas, to, value, add(data, 0x20), mload(data), 0, 0)
            }
            /* solhint-enable no-inline-assembly */
        }
    }

    /// @notice There is no check if _newDepositor is not zero on purpose - that could be required

    /**
     * @notice Sets new depositor address
     * @dev Only Safe can call this function
     * @dev New depositor can be zero address
     * @param _newDepositor New depositor address
     */
    function setDepositorAddress(address _newDepositor) external onlySafe {
        emit SetDepositorAddress(lockdropDepositorAddress, _newDepositor);
        lockdropDepositorAddress = _newDepositor;
    }

    /**
     * @notice Sets new LockDrop address
     * @dev Only Safe can call this function
     * @dev New LockDrop can't be zero address
     * @param _newLockdrop New depositor address
     */
    function setLockDropAddress(address _newLockdrop) external onlySafe {
        require(_newLockdrop != address(0), "SafeDepositsSender: Zero address not allowed");
        emit SetLockDropAddress(lockDropAddress, _newLockdrop);
        lockDropAddress = _newLockdrop;
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
            require(tokens[i] != address(0x00), "SafeDepositsSender: Zero address not allowed");
            require(amounts[i] != 0, "SafeDepositsSender: Zero amount not allowed");
            if (tokens[i] == ETH_TOKEN_ADDRESS) {
                require(
                    address(this).balance >= amounts[i],
                    "SafeDepositsSender: Not enough funds"
                );
                (bool success, ) = payable(recipient).call{ value: amounts[i] }("");
                require(success, "Could not withdraw ether");
                continue;
            }

            IERC20 token = IERC20(tokens[i]);
            uint256 balance = token.balanceOf(address(this));
            require(balance >= amounts[i], "SafeDepositsSender: Not enough funds");

            token.safeTransfer(recipient, amounts[i]);

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
            if (tokens[i] == ETH_TOKEN_ADDRESS) {
                (bool success, ) = payable(recipient).call{ value: address(this).balance }("");
                require(success, "Could not withdraw ether");
                continue;
            }
            IERC20 token = IERC20(tokens[i]);
            uint256 balance = token.balanceOf(address(this));
            if (balance > 0) {
                token.safeTransfer(recipient, balance);
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
        return lockDropAddress;
    }

    function getSovTokenAddress() external view returns (address) {
        return SOV_TOKEN_ADDRESS;
    }

    function getDepositorAddress() external view returns (address) {
        return lockdropDepositorAddress;
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
