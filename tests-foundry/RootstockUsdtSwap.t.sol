// SPDX-License-Identifier: MIT
// Minimal mock for ERC1820Registry
contract MockERC1820Registry {
    function setInterfaceImplementer(address, bytes32, address) external {}
}
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../contracts/utils/RootstockUsdtSwap.sol";

contract MockERC20 is IERC20 {
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public override totalSupply;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external override returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function setBalance(address account, uint256 amount) external {
        balanceOf[account] = amount;
    }
}

contract RootstockUsdtSwapTest is Test {
    RootstockUsdtSwap swap;
    MockERC20 rusdt;
    MockERC20 usdt0;
    address rusdtReceiver = address(0x111);
    address usdt0Provider = address(0x222);
    address rescuer = address(0x333);
    address user = address(0x444);
    address otherToken = address(0x555);
    address RUSDT_ADDR = 0xef213441A85dF4d7ACbDaE0Cf78004e1E486bB96;
    address USDT0_ADDR = 0x779Ded0c9e1022225f8E0630b35a9b54bE713736;
    address erc1820RegistryAddr = 0x1820a4B7618BdE71Dce8cdc73aAB6C95905faD24;

    function setUp() public {
        // Deploy mock ERC1820Registry at the required address
        MockERC1820Registry mockRegistry = new MockERC1820Registry();
        bytes memory registryCode = address(mockRegistry).code;
        vm.etch(erc1820RegistryAddr, registryCode);

        // Deploy mock RUSDT at the required address
        MockERC20 mockRusdt = new MockERC20("RUSDT", "RUSDT", 18);
        bytes memory rusdtCode = address(mockRusdt).code;
        vm.etch(RUSDT_ADDR, rusdtCode);
        rusdt = MockERC20(RUSDT_ADDR);

        // Deploy mock USDT0 at the required address

        MockERC20 mockUsdt0 = new MockERC20("USDT0", "USDT0", 6);
        bytes memory usdt0Code = address(mockUsdt0).code;
        vm.etch(USDT0_ADDR, usdt0Code);
        usdt0 = MockERC20(USDT0_ADDR);

        swap = new RootstockUsdtSwap(rusdtReceiver, usdt0Provider, rescuer);
        // Set balances
        rusdt.mint(user, 1000e18);
        usdt0.mint(usdt0Provider, 1000e18);
        // Approve swap contract
        vm.prank(usdt0Provider);
        usdt0.approve(address(swap), 1000e18);
    }

    function testSwapSuccess() public {
        // Simulate ERC777 tokensReceived call
        // Give swap contract RUSDT for transfer
        vm.prank(user);
        rusdt.transfer(address(swap), 100e18);

        // Simulate ERC777 tokensReceived call
        vm.prank(RUSDT_ADDR);
        swap.tokensReceived(address(0), user, address(swap), 100e18, "", "");
        // RUSDT sent to receiver
        assertEq(rusdt.balanceOf(rusdtReceiver), 100e18);
        // USDT0 sent to user (should match decimals: 100e6)
        assertEq(usdt0.balanceOf(user), 100e6);
        // Invariant: no RUSDT or USDT0 left on contract
        assertEq(rusdt.balanceOf(address(swap)), 0);
        assertEq(usdt0.balanceOf(address(swap)), 0);
    }

    function testSwapFailsIfNotRUSDT() public {
        vm.expectRevert("Only RUSDT accepted");
        vm.prank(address(usdt0));
        swap.tokensReceived(address(0), user, address(swap), 100e18, "", "");
    }

    function testSwapFailsIfToNotContract() public {
        vm.expectRevert("Tokens not sent to contract");
        vm.prank(address(rusdt));
        swap.tokensReceived(address(0), user, address(0x999), 100e18, "", "");
    }

    function testSwapFailsIfAmountZero() public {
        vm.expectRevert("Amount must be > 0");
        vm.prank(address(rusdt));
        swap.tokensReceived(address(0), user, address(swap), 0, "", "");
    }

    function testSwapFailsIfAllowanceLow() public {
        vm.prank(usdt0Provider);
        usdt0.approve(address(swap), 50e6); // USDT0 has 6 decimals
        vm.expectRevert("USDT0 allowance too low");
        vm.prank(address(rusdt));
        swap.tokensReceived(address(0), user, address(swap), 100e18, "", "");
    }

    function testSwapFailsIfProviderBalanceLow() public {
        vm.prank(usdt0Provider);
        usdt0.approve(address(swap), 1000e6); // USDT0 has 6 decimals
        usdt0.setBalance(usdt0Provider, 50e6);
        vm.expectRevert("USDT0 provider balance too low");
        vm.prank(address(rusdt));
        swap.tokensReceived(address(0), user, address(swap), 100e18, "", "");
    }

    function testSwapFailsIfTransferFromFails() public {
        // Remove allowance
        vm.prank(usdt0Provider);
        usdt0.approve(address(swap), 0);
        vm.expectRevert("USDT0 allowance too low");
        vm.prank(address(rusdt));
        swap.tokensReceived(address(0), user, address(swap), 100e18, "", "");
    }

    function testRescueOtherToken() public {
        MockERC20 other = new MockERC20("OTHER", "OTHER", 18);
        other.mint(address(swap), 123e18);
        vm.prank(rescuer);
        swap.rescue(address(other));
        assertEq(other.balanceOf(rescuer), 123e18);
    }

    function testRescueFailsIfNotRescuer() public {
        MockERC20 other = new MockERC20("OTHER", "OTHER", 18);
        other.mint(address(swap), 123e18);
        vm.expectRevert("Not rescuer");
        vm.prank(user);
        swap.rescue(address(other));
    }

    function testRescueFailsForSwapTokens() public {
        vm.expectRevert("Cannot rescue RUSDT token");
        vm.prank(rescuer);
        swap.rescue(address(rusdt));
        // USDT0 can only be rescued if it was sent directly, otherwise revert is not triggered
        // so we only test the revert for RUSDT, as per contract logic
    }

    function testRescueUsdt0DirectlySent() public {
        // Simulate sending USDT0 directly to the swap contract (no ERC777 hook)
        usdt0.mint(address(swap), 42e6); // USDT0 has 6 decimals
        // Rescuer should be able to rescue it
        vm.prank(rescuer);
        swap.rescue(address(usdt0));
        assertEq(usdt0.balanceOf(rescuer), 42e6);
    }
}
