// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import { ISafeDepositsSender } from "./interfaces/ISafeDepositsSender.sol";

interface IERC20 {
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

contract SafeDepositsSender is ISafeDepositsSender {
    address public constant ETH_TOKEN_ADDRESS = address(0x01);

    GnosisSafe private immutable SAFE;
    address private immutable LOCK_DROP_ADDRESS;
    address private immutable SOV_TOKEN_ADDRESS;
    uint256 private stopBlock; // if set the contract is stopped forever - irreversible
    bool private paused;

    constructor(address _safeAddress, address _lockDrop, address _sovToken) {
        SAFE = GnosisSafe(_safeAddress);
        LOCK_DROP_ADDRESS = _lockDrop;
        SOV_TOKEN_ADDRESS = _sovToken;
    }

    receive() external payable {}

    // MODIFIERS //

    modifier onlySafe() {
        require(msg.sender == address(SAFE), "SafeDepositsSender: Only Safe");
        _;
    }

    modifier onlyDepositor() {
        require(msg.sender == address(this), "SafeDepositsSender: Only Depositor");
        _;
    }

    modifier onlyDepositorOrSafe() {
        require(
            msg.sender == address(this) || msg.sender == address(SAFE),
            "SafeDepositsSender: Only Depositor or Safe"
        );
        _;
    }

    modifier expectUnpaused() {
        require(!paused, "SafeDepositsSender: Paused");
        _;
    }

    modifier expectPaused() {
        require(paused, "SafeDepositsSender: unpaused");
        _;
    }

    modifier expectUnstopped() {
        require(stopBlock == 0, "SafeDepositsSender: stopped");
        _;
    }

    modifier notZeroAddress(address _address) {
        require(_address != address(0), "SafeDepositsSender: Invalid address");
        _;
    }

    // CORE FUNCTIONS
    function sendToLockDropContract(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256 sovAmount
    ) external onlyDepositor expectUnpaused expectUnstopped {
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
                data = abi.encodeWithSignature(
                    "transfer(address,uint256)",
                    address(this),
                    amounts[i]
                );
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
                IERC20 token = IERC20(tokens[i]);
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
                balance = IERC20(tokens[i]).balanceOf(address(SAFE));
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

    // @note amount > 0 should be checked by the caller
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

            IERC20 token = IERC20(tokens[i]);
            uint256 balance = token.balanceOf(address(this));
            require(balance >= amounts[i], "SafeDepositsSender: Not enough funds");

            token.transfer(recipient, amounts[i]);

            emit Withdraw(recipient, tokens[i], amounts[i]);
        }
    }

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
            IERC20 token = IERC20(tokens[i]);
            uint256 balance = token.balanceOf(address(this));
            if (balance > 0) {
                token.transfer(recipient, balance);
            }

            emit Withdraw(recipient, tokens[i], balance);
        }
    }

    function pause() external onlySafe expectUnpaused {
        paused = true;
        emit Pause();
    }

    function unpause() external onlySafe expectPaused {
        paused = false;
        emit Unpause();
    }

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

    function isStopped() external view returns (bool) {
        return stopBlock == 0;
    }

    function getStopBlock() external view returns (uint256) {
        return stopBlock;
    }

    function isPaused() external view returns (bool) {
        return paused;
    }
}
