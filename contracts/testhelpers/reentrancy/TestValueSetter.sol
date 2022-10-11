pragma solidity ^0.5.17;

contract TestValueSetter {
    uint256 public value;

    // This is intentionally reentrant for testing
    function setValue(uint256 newValue) public {
        value = newValue;
    }
}
