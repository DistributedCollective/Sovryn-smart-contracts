/**
 * In order to test some functionalities like Pausable::pausable() modifier,
 * it is required to add a contract to invoke them and get a full coverage on tests.
 */

pragma solidity 0.5.17;

import "../connectors/loantoken/Pausable.sol";
import "../governance/Staking/SafeMath96.sol";
import "../mixins/EnumerableBytes32Set.sol";
import "../mixins/VaultController.sol";
import "../connectors/loantoken/AdvancedToken.sol";
import "../connectors/loantoken/LoanTokenLogicStorage.sol";

contract TestCoverage is
    Pausable,
    SafeMath96,
    VaultController,
    AdvancedToken,
    LoanTokenLogicStorage
{
    /// @dev Pausable is currently an unused contract that still is operative
    ///   because margin trade flashloan functionality has been commented out.
    ///   In case it were restored, contract would become used again, so for a
    ///   complete test coverage it is required to test it.

    function dummyPausableFunction() external pausable(msg.sig) {
        /// @dev do nothing, just to check if modifier is working
    }

    /// @dev This function should be located on Pausable contract in the case
    ///   it has to be used again by flashloan restoration.
    function togglePause(
        string memory funcId, // example: "mint(uint256,uint256)"
        bool isPaused
    ) public {
        /// keccak256("Pausable_FunctionPause")
        bytes32 slot =
            keccak256(
                abi.encodePacked(
                    bytes4(keccak256(abi.encodePacked(funcId))),
                    uint256(0xa7143c84d793a15503da6f19bf9119a2dac94448ca45d77c8bf08f57b2e91047)
                )
            );

        // solhint-disable-next-line no-inline-assembly
        assembly {
            sstore(slot, isPaused)
        }
    }

    /// @dev Testing internal functions of governance/Staking/SafeMath96.sol
    function testSafeMath96_safe32(uint256 n) public pure returns (uint32) {
        // Public wrapper for SafeMath96 internal function
        return safe32(n, "overflow");
    }

    function testSafeMath96_safe64(uint256 n) public pure returns (uint64) {
        // Public wrapper for SafeMath96 internal function
        return safe64(n, "overflow");
    }

    function testSafeMath96_safe96(uint256 n) public pure returns (uint96) {
        // Public wrapper for SafeMath96 internal function
        return safe96(n, "overflow");
    }

    function testSafeMath96_sub96(uint96 a, uint96 b) public pure returns (uint96) {
        // Public wrapper for SafeMath96 internal function
        return sub96(a, b, "underflow");
    }

    function testSafeMath96_mul96(uint96 a, uint96 b) public pure returns (uint96) {
        // Public wrapper for SafeMath96 internal function
        return mul96(a, b, "overflow");
    }

    function testSafeMath96_div96(uint96 a, uint96 b) public pure returns (uint96) {
        // Public wrapper for SafeMath96 internal function
        return div96(a, b, "division by 0");
    }

    using EnumerableBytes32Set for EnumerableBytes32Set.Bytes32Set;
    EnumerableBytes32Set.Bytes32Set internal aSet;

    function testEnum_AddRemove(bytes32 a, bytes32 b) public returns (bool) {
        aSet.addBytes32(a);
        return aSet.removeBytes32(b);
    }

    function testEnum_AddAddress(address a, address b) public returns (bool) {
        aSet.addAddress(a);
        return aSet.containsAddress(b);
    }

    function testEnum_AddAddressesAndEnumerate(
        address a,
        address b,
        uint256 start,
        uint256 count
    ) public returns (bytes32[] memory) {
        aSet.addAddress(a);
        aSet.addAddress(b);
        return aSet.enumerate(start, count);
    }

    /// @dev Wrapper to test internal function never called along current codebase
    function testVaultController_vaultApprove(
        address token,
        address to,
        uint256 value
    ) public {
        vaultApprove(token, to, value);
    }

    /// @dev mint wrapper w/o previous checks
    function testMint(
        address _to,
        uint256 _tokenAmount,
        uint256 _assetAmount,
        uint256 _price
    ) public {
        _mint(_to, _tokenAmount, _assetAmount, _price);
    }

    /// @dev wrapper for a function unreachable to tests
    function testStringToBytes32(string memory source) public pure returns (bytes32 result) {
        return stringToBytes32(source);
    }
}
