pragma solidity ^0.5.17;

import "../openzeppelin/ERC20Detailed.sol";
import "../openzeppelin/ERC20.sol";
import "../openzeppelin/Ownable.sol";
import "./IApproveAndCall.sol";

/**
 * Sovryn Token
 */
contract SOV is ERC20, ERC20Detailed, Ownable {
	string constant NAME = "Sovryn Token";
	string constant SYMBOL = "SOV";
	uint8 constant DECIMALS = 18;

	constructor(uint256 _initialAmount) public ERC20Detailed(NAME, SYMBOL, DECIMALS) {
		if (_initialAmount != 0) {
			_mint(msg.sender, _initialAmount);
		}
	}

	/**
	 * @dev don't create more than 2^96/10 tokens before updating the governance first
	 */
	function mint(address _account, uint256 _amount) public onlyOwner {
		_mint(_account, _amount);
	}

	/**
	 * @notice approves and then calls the receiving contract
	 */
	function approveAndCall(
		address _spender,
		uint256 _amount,
		bytes memory _data
	) public {
		approve(_spender, _amount);
		IApproveAndCall(_spender).receiveApproval(msg.sender, _amount, address(this), _data);
	}
}
