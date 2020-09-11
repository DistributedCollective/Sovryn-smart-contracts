pragma solidity 0.5.17;

import "./AdvancedTokenStorage.sol";
import "OpenZeppelin/openzeppelin-contracts@2.4.0/contracts/token/ERC20/ERC20Mintable.sol";
import "OpenZeppelin/openzeppelin-contracts@2.4.0/contracts/token/ERC20/ERC20Detailed.sol";

contract EarlyAccessToken is ERC20Mintable, ERC20Detailed {

    constructor(
        string memory name,
        string memory symbol)
        ERC20Detailed(name, symbol, 0)
        public
    {}
}
