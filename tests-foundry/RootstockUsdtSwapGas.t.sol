// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";

interface IERC777 {
    function send(address recipient, uint256 amount, bytes calldata data) external;
    function balanceOf(address owner) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
}

interface IERC20Minimal {
    function balanceOf(address owner) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

/**
 * @notice Fork test to measure actual gas cost of RootstockUsdtSwap on mainnet.
 *
 * Run with:
 *   forge test --match-contract RootstockUsdtSwapGasTest --fork-url https://mainnet4.sovryn.app/rpc -vvv
 */
contract RootstockUsdtSwapGasTest is Test {
    address constant SWAP_CONTRACT = 0xD143f576B8e889B1c90eBEf8D0c4Bfbb3316fDd2;
    address constant RUSDT_ADDR = 0xef213441A85dF4d7ACbDaE0Cf78004e1E486bB96;
    address constant USDT0_ADDR = 0x779Ded0c9e1022225f8E0630b35a9b54bE713736;

    // Deployed constructor args: rusdtReceiver and usdt0Provider are both this address
    address constant USDT0_PROVIDER = 0x0E8b356B8f5A269C0Cb3975E64FC9C3193C63d01;

    IERC777 rusdt = IERC777(RUSDT_ADDR);
    IERC20Minimal usdt0 = IERC20Minimal(USDT0_ADDR);

    address sender;

    function setUp() public {
        sender = makeAddr("sender");

        // Give sender some RUSDT (18 decimals) via storage manipulation
        // RUSDT is an ERC777 — slot layout: balances are at mapping slot 0 for most OZ implementations
        // We use deal which handles ERC20-compatible tokens
        deal(RUSDT_ADDR, sender, 1000e18);

        // Ensure usdt0Provider has enough USDT0 (6 decimals) and has approved the swap contract
        deal(USDT0_ADDR, USDT0_PROVIDER, 1000e6);
        vm.prank(USDT0_PROVIDER);
        usdt0.approve(SWAP_CONTRACT, type(uint256).max);
    }

    function test_swapGasCost_100RUSDT() public {
        uint256 amount = 100e18; // 100 RUSDT

        vm.prank(sender);
        uint256 gasBefore = gasleft();
        rusdt.send(SWAP_CONTRACT, amount, "");
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas used for 100 RUSDT swap", gasUsed);

        // Verify swap happened
        assertGt(usdt0.balanceOf(sender), 0, "sender should have received USDT0");
    }

    function test_swapGasCost_1RUSDT() public {
        uint256 amount = 1e18; // 1 RUSDT

        vm.prank(sender);
        uint256 gasBefore = gasleft();
        rusdt.send(SWAP_CONTRACT, amount, "");
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas used for 1 RUSDT swap", gasUsed);
    }

    function test_swapGasCost_secondSwapWarm() public {
        // First swap (cold storage)
        vm.prank(sender);
        rusdt.send(SWAP_CONTRACT, 50e18, "");

        // Second swap (warm storage)
        vm.prank(sender);
        uint256 gasBefore = gasleft();
        rusdt.send(SWAP_CONTRACT, 50e18, "");
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas used for warm (2nd) swap", gasUsed);
    }
}
