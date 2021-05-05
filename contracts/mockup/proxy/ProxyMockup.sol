pragma solidity ^0.5.17;

import "./StorageMockup.sol";
import "../../proxy/UpgradableProxy.sol";

contract ProxyMockup is StorageMockup, UpgradableProxy {}
