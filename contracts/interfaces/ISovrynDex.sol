pragma solidity 0.5.17;

interface ISovrynDex {
    function userCmd(uint16 callpath, bytes calldata cmd) external payable;
}
