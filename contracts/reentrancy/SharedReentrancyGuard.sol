pragma solidity ^0.5.17;

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
     * This is the address of the mutex contract that will be used as the
     * reentrancy guard.
     *
     * The address is hardcoded to avoid changing the memory layout of
     * derived contracts (possibly upgradable). Hardcoding the address is possible,
     * because the Mutex contract is always deployed to the same address, with the
     * same method used in the deployment of ERC1820Registry.
     */
    Mutex private constant MUTEX = Mutex(0xba10edD6ABC7696Eae685839217BdcC42139612b);

    /*
     * This is the modifier that will be used to protect functions from
     * reentrancy. It will call the mutex contract to increment the mutex
     * state and then revert if the mutex state was changed by another
     * nested call.
     */
    modifier globallyNonReentrant() {
        uint256 previous = MUTEX.incrementAndGetValue();

        _;

        /*
         * If the mutex state was changed by a nested function call, then
         * the value of the state variable will be different from the previous value.
         */
        require(previous == MUTEX.value(), "reentrancy violation");
    }
}
