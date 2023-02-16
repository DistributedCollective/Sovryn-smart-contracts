pragma solidity ^0.5.17;

/*
 * @title Global Mutex contract
 *
 * @notice A mutex contract that allows only one function to be called at a time out
 * of a large set of functions. *Anyone* in the network can freely use any instance
 * of this contract to add a universal mutex to any function in any contract.
 */
contract Mutex {
    /*
     * We use an uint to store the mutex state.
     */
    uint256 public value;

    /*
     * @notice Increment the mutex state and return the new value.
     *
     * @dev This is the function that will be called by anyone to change the mutex
     * state. It is purposely not protected by any access control
     */
    function incrementAndGetValue() external returns (uint256) {
        /*
         * increment value using unsafe math. This is safe because we are
         * pretty certain no one will ever increment the value 2^256 times
         * in a single transaction.
         */
        return ++value;
    }
}
