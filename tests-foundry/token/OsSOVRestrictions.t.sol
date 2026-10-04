// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import { Test } from "forge-std/Test.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ProxyAdmin } from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import { TransparentUpgradeableProxy, ITransparentUpgradeableProxy } from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import { OsSOV } from "../../contracts/token/OsSOV.sol";

/// Test-only model of allowance state created before the restrictions were fixed.
contract OsSOVAllowanceState is OsSOV {
    function seedAllowance(address holder, address spender, uint256 amount) external onlyOwner {
        ERC20._approve(holder, spender, amount);
    }

    function burnForControl(address holder, uint256 amount) external onlyOwner {
        _burn(holder, amount);
    }
}

contract OsSOVRestrictionsTest is Test {
    OsSOV private token;
    address private constant HOLDER = address(0xA11CE);
    address private constant SPENDER = address(0xB0B);
    address private constant RECIPIENT = address(0xCAFE);

    function setUp() public {
        token = deployProxy(new OsSOV());
        token.mint(HOLDER, 100 ether);
    }

    function deployProxy(OsSOV implementation) private returns (OsSOV) {
        ProxyAdmin admin = new ProxyAdmin();
        return
            OsSOV(
                payable(
                    address(
                        new TransparentUpgradeableProxy(
                            address(implementation),
                            address(admin),
                            abi.encodeCall(
                                OsSOV.initialize,
                                (address(this), address(this), address(this))
                            )
                        )
                    )
                )
            );
    }

    function existingAllowance(uint256 amount) private returns (OsSOV) {
        OsSOVAllowanceState implementation = new OsSOVAllowanceState();
        ProxyAdmin admin = new ProxyAdmin();
        OsSOVAllowanceState previous = OsSOVAllowanceState(
            payable(
                address(
                    new TransparentUpgradeableProxy(
                        address(implementation),
                        address(admin),
                        abi.encodeCall(
                            OsSOV.initialize,
                            (address(this), address(this), address(this))
                        )
                    )
                )
            )
        );
        previous.mint(HOLDER, 100 ether);
        previous.seedAllowance(HOLDER, SPENDER, amount);
        admin.upgrade(ITransparentUpgradeableProxy(address(previous)), address(new OsSOV()));
        OsSOV upgraded = OsSOV(payable(address(previous)));
        assertEq(upgraded.allowance(HOLDER, SPENDER), amount);
        assertEq(upgraded.owner(), address(this));
        assertTrue(upgraded.hasRole(upgraded.DEFAULT_ADMIN_ROLE(), address(this)));
        assertTrue(upgraded.hasRole(upgraded.AUTHORISED_MINTER_ROLE(), address(this)));
        assertEq(upgraded.totalSupply(), 100 ether);
        assertEq(upgraded.balanceOf(HOLDER), 100 ether);
        assertEq(upgraded.cap(), 100_000_000 ether);
        return upgraded;
    }

    function unchangedBalances(OsSOV t) private view {
        assertEq(t.balanceOf(HOLDER), 100 ether);
        assertEq(t.balanceOf(RECIPIENT), 0);
        assertEq(t.totalSupply(), 100 ether);
    }

    function testMetadataAndAuthorizedMint() public view {
        assertEq(token.name(), "BitcoinOS Sovryn Transition Token");
        assertEq(token.symbol(), "osSOV");
        assertEq(token.decimals(), 18);
        assertEq(token.cap(), 100_000_000 ether);
        assertEq(token.balanceOf(HOLDER), 100 ether);
        assertEq(token.totalSupply(), 100 ether);
        assertEq(token.owner(), address(this));
    }

    function testDirectTransferAndApprovalRemainForbidden() public {
        vm.startPrank(HOLDER);
        vm.expectRevert(OsSOV.NonTransferable.selector);
        token.transfer(RECIPIENT, 1 ether);
        vm.expectRevert(OsSOV.NonTransferable.selector);
        token.transfer(HOLDER, 0);
        vm.expectRevert(OsSOV.NonApprovable.selector);
        token.approve(SPENDER, 1 ether);
        vm.expectRevert(OsSOV.NonApprovable.selector);
        token.approve(SPENDER, 0);
        vm.stopPrank();
        unchangedBalances(token);
    }

    function testInheritedIncreaseAllowanceRejectsZeroNonzeroAndMaximum() public {
        vm.startPrank(HOLDER);
        vm.expectRevert(OsSOV.NonApprovable.selector);
        token.increaseAllowance(SPENDER, 0);
        vm.expectRevert(OsSOV.NonApprovable.selector);
        token.increaseAllowance(SPENDER, 1 ether);
        vm.expectRevert(OsSOV.NonApprovable.selector);
        token.increaseAllowance(SPENDER, type(uint256).max);
        vm.stopPrank();
        assertEq(token.allowance(HOLDER, SPENDER), 0);
    }

    function testInheritedDecreaseAllowanceRejectsZeroAndPreservesBaseUnderflowError() public {
        vm.startPrank(HOLDER);
        vm.expectRevert(OsSOV.NonApprovable.selector);
        token.decreaseAllowance(SPENDER, 0);
        vm.expectRevert("ERC20: decreased allowance below zero");
        token.decreaseAllowance(SPENDER, 1);
        vm.stopPrank();
        assertEq(token.allowance(HOLDER, SPENDER), 0);
    }

    function testExistingFiniteAllowanceCannotTransferOrConsumeAllowance() public {
        OsSOV t = existingAllowance(10 ether);
        vm.startPrank(SPENDER);
        vm.expectRevert(OsSOV.NonApprovable.selector);
        t.transferFrom(HOLDER, RECIPIENT, 1 ether);
        vm.expectRevert(OsSOV.NonApprovable.selector);
        t.transferFrom(HOLDER, RECIPIENT, 0);
        vm.stopPrank();
        assertEq(t.allowance(HOLDER, SPENDER), 10 ether);
        unchangedBalances(t);
    }

    function testExistingInfiniteAllowanceCannotTransferZeroOrSelf() public {
        OsSOV t = existingAllowance(type(uint256).max);
        vm.startPrank(SPENDER);
        vm.expectRevert(OsSOV.NonTransferable.selector);
        t.transferFrom(HOLDER, RECIPIENT, 1 ether);
        vm.expectRevert(OsSOV.NonTransferable.selector);
        t.transferFrom(HOLDER, RECIPIENT, 0);
        vm.expectRevert(OsSOV.NonTransferable.selector);
        t.transferFrom(HOLDER, HOLDER, 1 ether);
        vm.stopPrank();
        assertEq(t.allowance(HOLDER, SPENDER), type(uint256).max);
        unchangedBalances(t);
    }

    function testExistingFiniteAndInfiniteAllowanceCannotBeDecreased() public {
        for (uint256 i; i < 2; i++) {
            uint256 amount = i == 0 ? 10 ether : type(uint256).max;
            OsSOV t = existingAllowance(amount);
            vm.startPrank(HOLDER);
            vm.expectRevert(OsSOV.NonApprovable.selector);
            t.decreaseAllowance(SPENDER, 1);
            vm.expectRevert(OsSOV.NonApprovable.selector);
            t.decreaseAllowance(SPENDER, amount);
            vm.stopPrank();
            assertEq(t.allowance(HOLDER, SPENDER), amount);
        }
    }

    function testTransferFromWithoutAllowanceNeverMovesBalance() public {
        vm.startPrank(SPENDER);
        vm.expectRevert("ERC20: insufficient allowance");
        token.transferFrom(HOLDER, RECIPIENT, 1 ether);
        vm.expectRevert(OsSOV.NonApprovable.selector);
        token.transferFrom(HOLDER, RECIPIENT, 0);
        vm.stopPrank();
        unchangedBalances(token);
    }

    function testUnauthorizedMintAndOwnerActionsRemainForbidden() public {
        vm.startPrank(HOLDER);
        vm.expectRevert("Not authorised to mint");
        token.mint(HOLDER, 1 ether);
        vm.expectRevert("Ownable: caller is not the owner");
        token.setAuthorisedMinterRole(HOLDER);
        vm.expectRevert("Ownable: caller is not the owner");
        token.setDefaultAdminRole(HOLDER);
        vm.stopPrank();
    }

    function testExactCapAndZeroAddressMintBehaviorRemain() public {
        token.mint(HOLDER, token.cap() - token.totalSupply());
        assertEq(token.totalSupply(), token.cap());
        vm.expectRevert("ERC20Capped: cap exceeded");
        token.mint(HOLDER, 1);
        vm.expectRevert("ERC20: mint to the zero address");
        token.mint(address(0), 0);
    }

    function testAdminRevocationAndOwnershipTransferRemain() public {
        bytes32 role = token.AUTHORISED_MINTER_ROLE();
        token.setAuthorisedMinterRole(HOLDER);
        vm.prank(HOLDER);
        token.mint(RECIPIENT, 1 ether);
        token.revokeRole(role, HOLDER);
        vm.prank(HOLDER);
        vm.expectRevert("Not authorised to mint");
        token.mint(RECIPIENT, 1 ether);
        token.transferOwnership(RECIPIENT);
        vm.expectRevert("Ownable: caller is not the owner");
        token.setDefaultAdminRole(SPENDER);
        vm.prank(RECIPIENT);
        token.setDefaultAdminRole(SPENDER);
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), SPENDER));
        assertEq(token.owner(), RECIPIENT);
    }

    function testImplementationAndProxyCannotReinitialize() public {
        OsSOV implementation = new OsSOV();
        vm.expectRevert("Initializable: contract is already initialized");
        implementation.initialize(address(this), address(this), address(this));
        vm.expectRevert("Initializable: contract is already initialized");
        token.initialize(address(this), address(this), address(this));
    }

    function testInternalMintAndBurnPathsRemainAvailable() public {
        OsSOVAllowanceState t = OsSOVAllowanceState(
            payable(address(deployProxy(new OsSOVAllowanceState())))
        );
        t.mint(HOLDER, 10 ether);
        t.burnForControl(HOLDER, 1 ether);
        assertEq(t.balanceOf(HOLDER), 9 ether);
        assertEq(t.totalSupply(), 9 ether);
    }

    function testEtherRemainsNonReceivable() public {
        vm.deal(address(this), 1 ether);
        (bool success, bytes memory reason) = address(token).call{ value: 1 }("");
        assertFalse(success);
        assertEq(reason, abi.encodeWithSelector(OsSOV.NonReceivable.selector));
    }
}
