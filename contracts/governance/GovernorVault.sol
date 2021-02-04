pragma solidity ^0.5.17;

import "../openzeppelin/Ownable.sol";
import "../interfaces/IERC20.sol";

contract GovernorVault is Ownable {

    event Deposited(address indexed sender, uint amount);
    event TokensTransferred(address indexed receiver, address indexed token, uint amount);
    event RbtcTransferred(address indexed receiver, uint amount);

    /**
     * @notice transfers tokens
     * @param _receiver the receiver of tokens
     * @param _token the address of token contract
     * @param _amount the to be transferred
     */
    function transferTokens(address _receiver, address _token, uint _amount) public onlyOwner {
        require(_receiver != address(0), "Invalid receiver address");
        require(_token != address(0), "Invalid token address");

        require(IERC20(_token).transfer(_receiver, _amount), "Transfer failed");
        emit TokensTransferred(_receiver, _token, _amount);
    }

    /**
     * @notice transfers RBTC
     * @param _receiver the receiver of RBTC
     * @param _amount the to be transferred
     */
    function transferRbtc(address payable _receiver, uint _amount) public onlyOwner {
        require(_receiver != address(0), "Invalid receiver address");

        address(_receiver).transfer(_amount);
        emit RbtcTransferred(_receiver, _amount);
    }

    function () payable external {
        if (msg.value > 0) {
            emit Deposited(msg.sender, msg.value);
        }
    }

}
