pragma solidity ^0.5.17;

import "../../proxy/UpgradableProxy.sol";

contract TestValueSetterProxy is UpgradableProxy {
    // This is here for the memory layout
    uint256 public value;
}
