pragma solidity ^0.5.17;

import "../../reentrancy/SharedReentrancyGuard.sol";

contract TestNonReentrantValueSetter is SharedReentrancyGuard {
    uint256 public value;

    // This will fail if another globallyNonReentrant function has already been entered
    function setValue(
        uint256 newValue
    )
    public
    globallyNonReentrant
    {
        value = newValue;
    }

    function setOtherContractValueNonReentrant(
        address other,
        uint256 newValue
    )
    external
    globallyNonReentrant
    {
        TestNonReentrantValueSetter(other).setValue(newValue);
    }

    // this is intentionally not globallyNonReentrant and should work even if both contracts are reentrant
    function setThisAndOtherContractValue(
        address other,
        uint256 newValue
    )
    external
    {
        setValue(newValue);
        TestNonReentrantValueSetter(other).setValue(newValue);
    }
}
