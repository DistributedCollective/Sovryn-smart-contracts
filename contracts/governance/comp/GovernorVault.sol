pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";

contract GovernorVault is Ownable {

    string public constant ERROR_INVALID_ADDRESS = "Invalid address";

    IERC20 public token;

    event Deposited(address indexed sender, uint amount);
    event TokensTransferred(address indexed receiver, uint amount);
    event RbtcTransferred(address indexed receiver, uint amount);

    constructor(address _token) public {
        require(_token != address(0), ERROR_INVALID_ADDRESS);

        token = IERC20(_token);
    }

    /**
     * @notice transfers tokens
     * @param _receiver the receiver of tokens
     * @param _amount the to be transferred
     */
    function transferTokens(address _receiver, uint _amount) public onlyOwner {
        require(_receiver != address(0), ERROR_INVALID_ADDRESS);

        require(token.transfer(_receiver, _amount), "Transfer failed");
        emit TokensTransferred(_receiver, _amount);
    }

    /**
     * @notice transfers RBTC
     * @param _receiver the receiver of RBTC
     * @param _amount the to be transferred
     */
    function transferRbtc(address payable _receiver, uint _amount) public onlyOwner {
        require(_receiver != address(0), ERROR_INVALID_ADDRESS);

        address(_receiver).transfer(_amount);
        emit RbtcTransferred(_receiver, _amount);
    }

    function () payable external {
        if (msg.value > 0) {
            emit Deposited(msg.sender, msg.value);
        }
    }

}
