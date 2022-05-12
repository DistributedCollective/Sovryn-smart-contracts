pragma solidity ^0.5.17;

import "./StorageMockup.sol";

contract ImplementationMockup is StorageMockup {
    function setValue(uint256 _value) public {
        value = _value;
        emit ValueChanged(_value);
    }

    function getValue() public view returns (uint256) {
        return value;
    }
}
