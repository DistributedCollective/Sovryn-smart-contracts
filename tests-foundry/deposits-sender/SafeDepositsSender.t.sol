// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.17;

using stdStorage for StdStorage;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
//import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import "forge-std/console.sol";
import { stdStorage, StdStorage, Test, console } from "forge-std/Test.sol";
import { ILockDrop } from "@contracts/integrations/bob/interfaces/ILockDrop.sol";
import { SafeDepositsSender } from "@contracts/integrations/bob/SafeDepositsSender.sol";
import { ISafeDepositsSender } from "@contracts/integrations/bob/interfaces/ISafeDepositsSender.sol";
import { Utilities } from "./Utilities.sol";

contract ArbitraryErc20 is ERC20, Ownable {
    constructor(
        string memory _name,
        string memory _symbol,
        address _owner
    ) ERC20(_name, _symbol) Ownable() {}

    function sudoMint(address to, uint256 amount) public /*onlyOwner*/ {
        _mint(to, amount);
    }
}

// Dummy Bridge contract
contract MockLockDrop {
    using SafeERC20 for IERC20;

    /**
     * @dev Deposit ERC20 tokens.
     * @param token Address of the ERC20 token.
     * @param amount Amount of tokens to deposit.
     */
    function depositERC20(
        address token,
        uint256 amount
    ) external /*isDepositAllowed(amount) whenNotPaused*/ {
        // require(allowedTokens[token].isAllowed, "Deposit token not allowed");

        // deposits[msg.sender][token] += amount;
        // totalDeposits[token] += amount;
        // Transfer tokens to contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        // Emit Deposit event
        // emit Deposit(msg.sender, token, amount, block.timestamp);
    }

    /**
     * @dev Deposit Ether
     * Allows users to deposit Ether into the contract.
     */
    function depositEth() external payable /*isDepositAllowed(msg.value) whenNotPaused*/ {
        // Increase the deposited Ether amount for the sender.
        // deposits[msg.sender][ETH_TOKEN_ADDRESS] += msg.value;
        // totalDeposits[ETH_TOKEN_ADDRESS] += msg.value;
        // // Emit Deposit Event
        // emit Deposit(msg.sender, ETH_TOKEN_ADDRESS, msg.value, block.timestamp);
    }
}

library Enum {
    enum Operation {
        Call,
        DelegateCall
    }
}

contract SafeMock {
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
        Enum.Operation operation,
        uint256 txGas
    ) internal returns (bool success) {
        if (operation == Enum.Operation.DelegateCall) {
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

    /**
     * @notice Execute `operation` (0: Call, 1: DelegateCall) to `to` with `value` (Native Token)
     * @dev Function is virtual to allow overriding for L2 singleton to emit an event for indexing.
     * @param to Destination address of module transaction.
     * @param value Ether value of module transaction.
     * @param data Data payload of module transaction.
     * @param operation Operation type of module transaction.
     * @return success Boolean flag indicating if the call succeeded.
     */
    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        Enum.Operation operation
    ) public returns (bool success) {
        // (address guard, bytes32 guardHash) = preModuleExecution(to, value, data, operation);
        success = execute(to, value, data, operation, type(uint256).max);
        // postModuleExecution(guard, guardHash, success);
    }
}

contract SafeDepositsSenderTest is SafeDepositsSender, Test {
    ArbitraryErc20[] tokens; // = new ArbitraryErc20[](3);
    address internal sudoOwner = address(0x1234567890123456789012345678901234567890);
    address internal depositsSender = address(0x1234567890123456789012345678901234567891);
    address constant NATIVE_TOKEN_ADDRESS = address(0x01);

    SafeMock safe = new SafeMock();
    MockLockDrop lockDrop = new MockLockDrop();
    address internal lockDropAddress = address(lockDrop);

    ArbitraryErc20 sov = new ArbitraryErc20("SOV", "SOV", sudoOwner);

    Utilities internal utils;

    uint32 constant MIN_GAS_LIMIT = 20000;
    address internal alice;
    address internal bob;
    address internal owner;
    address payable[] internal users;

    uint96 constant MAX_96 = 2 ** 96 - 1;
    uint256 constant MAX_256 = 2 ** 256 - 1;
    uint32 constant MAX_32 = 2 ** 32 - 1;

    constructor()
        SafeDepositsSender(address(safe), address(lockDrop), address(sov), depositsSender)
    {}

    function setAddressArray(address[] memory source) private returns (address[] memory target) {
        for (uint256 i = 0; i < source.length; i++) {
            target[i] = source[i];
        }
        return target;
    }

    function setUintArray(uint256[] memory source) private returns (uint256[] memory target) {
        for (uint256 i = 0; i < source.length; i++) {
            target[i] = source[i];
        }
        return target;
    }

    function setUp() public {
        utils = new Utilities();
        users = utils.createUsers(5);

        // owner = users[0];
        // vm.label(owner, "Owner");
        alice = users[0];
        vm.label(alice, "Alice");
        bob = users[1];
        vm.label(bob, "Bob");

        tokens = [
            new ArbitraryErc20("wETH", "wETH", sudoOwner),
            new ArbitraryErc20("USDT", "USDT", sudoOwner),
            new ArbitraryErc20("DAI", "DAI", sudoOwner)
        ];

        vm.deal(address(this), 0 ether);
    }

    function testFuzz_SendingMultipleTokensToLockDrop(
        uint256 amount,
        uint256 numberOfTokens,
        bool useNativeToken
    ) public {
        numberOfTokens = bound(numberOfTokens, 1, 3);
        amount = bound(amount, 1, MAX_256 / 1000) * 2;
        uint256 tokensQty = numberOfTokens + (useNativeToken ? 1 : 0);
        uint256[] memory amounts = new uint256[](tokensQty);
        // add pseudo address for ETH 0x01 in the end- not 0x00 to avoid default address errors
        address[] memory tokensParam = new address[](tokensQty);

        uint256 sovAmount = amount * 100;
        console.log("sovAmount:", sovAmount);
        console.log("amount:", amount);
        console.log("tokensQty:", tokensQty);

        vm.startPrank(sudoOwner);
        for (uint256 i = 0; i < numberOfTokens; i++) {
            tokens[i].sudoMint(address(safe), amount);
            amounts[i] = amount / 2;
            tokensParam[i] = address(tokens[i]);
            console.log("amounts [%s]: %s", i, amounts[i]);
        }
        if (useNativeToken) {
            vm.deal(address(safe), amount);
            amounts[amounts.length - 1] = amount / 2;
            tokensParam[tokensParam.length - 1] = NATIVE_TOKEN_ADDRESS;
        }

        sov.sudoMint(address(safe), sovAmount);
        vm.stopPrank();

        vm.startPrank(depositsSender);

        // calling sendToLockDropContract should transfer 50% of tokens to LockDrop
        // and another 50% to this contract if there is enough balance on the Safe
        // in effect Safe should have 0 balance on all tokens except SOV and native token
        for (uint256 i = 0; i < numberOfTokens; i++) {
            vm.expectEmit();
            emit DepositToLockdrop(address(lockDrop), address(tokens[i]), amounts[i]);
            emit WithdrawBalanceFromSafe(address(tokens[i]), amounts[i]);
        }
        emit DepositSOVToLockdrop(address(lockDrop), sovAmount / 2);
        this.sendToLockDropContract(tokensParam, amounts, sovAmount / 2);
        vm.stopPrank();

        // check LockDrop balances
        for (uint256 i = 0; i < numberOfTokens; i++) {
            assertEq(tokens[i].balanceOf(address(lockDrop)), amounts[i]);
        }
        if (useNativeToken) {
            assertEq((address(lockDrop)).balance, amount / 2);
        }
        assertEq(sov.balanceOf(address(safe)), sovAmount / 2);

        //check Safe balances
        for (uint256 i = 0; i < numberOfTokens; i++) {
            assertEq(tokens[i].balanceOf(address(safe)), 0);
        }
        if (useNativeToken) {
            assertEq((address(safe)).balance, 0);
        }
        assertEq(sov.balanceOf(address(safe)), sovAmount / 2);

        // check this module balance - should have safe tokens balances transferred to the module
        for (uint256 i = 0; i < numberOfTokens; i++) {
            assertEq(tokens[i].balanceOf(address(this)), amounts[i]);
        }
        if (useNativeToken) {
            assertEq(address(this).balance, amount / 2);
        }
        assertEq(sov.balanceOf(address(this)), 0);
    }

    function test_SendingMultipleTokensToLockDropSettersAndExceptions() public {
        // add pseudo address for ETH 0x01 in the end- not 0x00 to avoid default address errors
        address[] memory tokensParam = new address[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            tokensParam[i] = address(tokens[i]);
        }

        uint256[] memory amountsParam = new uint256[](1);
        amountsParam[0] = uint256(100);

        vm.startPrank(alice);
        vm.expectRevert("SafeDepositsSender: Only Depositor or Safe");
        this.sendToLockDropContract(tokensParam, amountsParam, 1);
        vm.stopPrank();

        vm.startPrank(depositsSender);

        vm.expectRevert("SafeDepositsSender: Tokens and amounts length mismatch");
        this.sendToLockDropContract(tokensParam, amountsParam, 0);

        address[] memory sovParam = new address[](1);
        sovParam[0] = address(sov);

        address[] memory tokenParam = new address[](1);
        tokenParam[0] = address(tokens[0]);

        vm.expectRevert("SafeDepositsSender: SOV token is transferred separately");
        this.sendToLockDropContract(sovParam, amountsParam, 100);

        vm.expectRevert("SafeDepositsSender: Invalid SOV amount");
        this.sendToLockDropContract(tokenParam, amountsParam, 0);

        vm.stopPrank();

        vm.startPrank(address(safe));
        this.pause();
        vm.stopPrank();

        vm.startPrank(depositsSender);
        vm.expectRevert("SafeDepositsSender: Paused");
        amountsParam = new uint256[](3);
        amountsParam[0] = uint256(100);
        amountsParam[1] = uint256(200);
        amountsParam[2] = uint256(300);
        this.sendToLockDropContract(tokensParam, amountsParam, 1);

        vm.expectEmit();
        emit MapDepositorToReceiver(depositsSender, alice);
        this.mapDepositorToReceiver(alice);
        (lockDropAddress);
        assertEq(this.getLockDropAddress(), lockDropAddress);
        vm.stopPrank();

        vm.startPrank(address(safe));
        this.unpause();
        vm.stopPrank();

        vm.startPrank(alice);
        vm.expectRevert("SafeDepositsSender: Only Safe");
        this.setDepositorAddress(address(0x01));
        vm.stopPrank();

        vm.startPrank(address(safe));
        vm.expectEmit();
        emit SetDepositorAddress(depositsSender, address(0x01));
        this.setDepositorAddress(address(0x01));
        assertEq(this.getDepositorAddress(), address(0x01));

        vm.expectEmit();
        emit SetDepositorAddress(address(0x01), address(0x00));
        this.setDepositorAddress(address(0x00));
        assertEq(this.getDepositorAddress(), address(0x00));

        vm.expectEmit();
        emit SetDepositorAddress(address(0x00), depositsSender);
        this.setDepositorAddress(depositsSender);
        assertEq(this.getDepositorAddress(), depositsSender);

        vm.expectEmit();
        emit SetLockDropAddress(lockDropAddress, address(0x01));
        this.setLockDropAddress(address(0x01));
        assertEq(this.getLockDropAddress(), address(0x01));

        vm.expectRevert("SafeDepositsSender: Zero address not allowed");
        emit SetLockDropAddress(address(0x01), address(0x00));
        this.setLockDropAddress(address(0x00));

        vm.expectEmit();
        emit SetLockDropAddress(address(0x01), lockDropAddress);
        this.setLockDropAddress(lockDropAddress);
        assertEq(this.getLockDropAddress(), lockDropAddress);

        vm.stopPrank();

        //@todo add more tests for exceptions

        vm.startPrank(address(safe));
        vm.expectEmit();
        emit Stop();
        this.stop();
        vm.stopPrank();

        vm.startPrank(depositsSender);
        vm.expectRevert("SafeDepositsSender: Stopped");
        this.sendToLockDropContract(tokensParam, amountsParam, 1);
    }

    function testFuzz_WithdrawFundsFromModuleBySafe(
        uint256 amount,
        uint256 numberOfTokens,
        bool useNativeToken
    ) public {
        numberOfTokens = bound(numberOfTokens, 1, 3);
        amount = bound(amount, 1, MAX_256 / 1000) * 2;
        uint256 tokensQty = numberOfTokens + 1 + (useNativeToken ? 1 : 0); // +1 for SOV
        uint256[] memory amounts = new uint256[](tokensQty);
        // add pseudo address for ETH 0x01 in the end- not 0x00 to avoid default address errors
        address[] memory tokensParam = new address[](tokensQty);

        uint256 sovAmount = amount * 100;
        console.log("sovAmount:", sovAmount);
        console.log("amount:", amount);
        console.log("tokensQty:", tokensQty);

        tokensParam[0] = address(sov);
        console.log("tokensParam[0]", tokensParam[0]);
        console.log("sovAmount", sovAmount);
        amounts[0] = sovAmount;
        deal(tokensParam[0], address(this), sovAmount);
        console.log("amounts[0]: %s", amounts[0]);
        deal(address(sov), address(this), sovAmount);
        for (uint256 i = 0; i < numberOfTokens; i++) {
            tokensParam[i + 1] = address(tokens[i]);
            amounts[i + 1] = amount;
            console.log("amounts [%s]: %s", i + 1, amount);
            deal(tokensParam[i + 1], address(this), amount);
            console.log("tokens[%s] balance %s", i + 1, tokens[i].balanceOf(address(this)));
        }
        if (useNativeToken) {
            amounts[amounts.length - 1] = amount;
            tokensParam[tokensParam.length - 1] = NATIVE_TOKEN_ADDRESS;
            vm.deal(address(this), amount);
        }

        console.log("NATIVE_TOKEN_ADDRESS:", NATIVE_TOKEN_ADDRESS);
        console.log("tokensParam.length:", tokensParam.length);

        uint256 snapshot = vm.snapshot();

        vm.startPrank(address(safe));
        vm.deal(bob, 0 ether);
        this.withdraw(tokensParam, amounts, bob);
        _expectBalancesZero(address(this), tokensParam);
        _expectBalances(bob, tokensParam, amounts);
        vm.stopPrank();

        vm.revertTo(snapshot);
        snapshot = vm.snapshot();

        vm.startPrank(address(safe));
        vm.deal(bob, 0 ether);
        this.withdrawAll(tokensParam, bob);
        _expectBalancesZero(address(this), tokensParam);
        _expectBalances(bob, tokensParam, amounts);
        vm.stopPrank();

        vm.revertTo(snapshot);

        vm.startPrank(address(safe));
        vm.deal(bob, 0 ether);
        for (uint256 i = 0; i < amounts.length; i++) {
            console.log("before amounts [%s]: %s", i + 1, amounts[i]);
            amounts[i] = amounts[i] / 2;
            console.log("after amounts [%s]: %s", i + 1, amounts[i]);
        }
        this.withdraw(tokensParam, amounts, bob);
        _expectBalances(address(this), tokensParam, amounts);
        _expectBalances(bob, tokensParam, amounts);
        vm.stopPrank();
    }

    function _expectBalancesZero(address _address, address[] memory _tokens) internal {
        for (uint256 i = 0; i < _tokens.length; i++) {
            if (_tokens[i] == address(0x01)) {
                assertEq(_address.balance, 0);
                continue;
            }
            assertEq(ArbitraryErc20(_tokens[i]).balanceOf(_address), 0);
        }
    }

    function _expectBalances(
        address _address,
        address[] memory _tokens,
        uint256[] memory _amounts
    ) internal {
        for (uint256 i = 0; i < _tokens.length; i++) {
            if (_tokens[i] == address(0x01)) {
                assertEq(_address.balance, _amounts[i]);
                continue;
            }
            assertEq(ArbitraryErc20(_tokens[i]).balanceOf(_address), _amounts[i]);
        }
    }
}
