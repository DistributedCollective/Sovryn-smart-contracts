pragma solidity >=0.5.0 <0.6.0;

import "./Mutex.sol";

/*
 * @title Abstract contract for shared reentrancy guards
 *
 * @notice Exposes a single modifier `globallyNonReentrant` that can be used to ensure
 * that there's no reentrancy between *any* functions marked with the modifier.
 *
 * @dev The Mutex contract address is hardcoded because the address is deployed using a
 * special deployment method (similar to ERC1820Registry). This contract therefore has no
 * state and is thus safe to add to the inheritance chain of upgradeable contracts.
 */
contract SharedReentrancyGuard {
    /*
     * This address is hardGet the mutex contract address from the constructor. This is the
     * address of the mutex contract that will be used as the
     * reentrancy guard.
     *
     * NOTE: The address could also be hardcoded (like with ERC1820Registry),
     * which would make this contract stateless.
     */
    Mutex private constant mutex = Mutex(0xc783106a68d2Dc47b443C20067448a9c53121207);

    /*
     * This is the modifier that will be used to protect functions from
     * reentrancy. It will call the mutex contract to increment the mutex
     * state and then revert if the mutex state was changed by another
     * nested call.
     */
    modifier globallyNonReentrant() {
        uint256 previous = mutex.incrementAndGetValue();

        _;

        /*
         * If the mutex state was changed by a nested function call, then
         * the value of the state variable will be different from the previous value.
         */
        require(previous == mutex.value(), "reentrancy violation");
    }
}
