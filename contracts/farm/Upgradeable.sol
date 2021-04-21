pragma solidity >=0.5.0 <0.6.0;

import "../openzeppelin/Ownable.sol";


contract Upgradeable is Ownable {
    address public implementation;
}