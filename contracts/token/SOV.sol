pragma solidity ^0.5.17;

import "../openzeppelin/ERC20Detailed.sol";
import "../openzeppelin/ERC20.sol";
import "../openzeppelin/Ownable.sol";
import "./IApproveAndCall.sol";

/**
 * @title Sovryn Token: an ERC-20 token contract for Sovryn governance called SOV
 * @notice This contract accounts for all holders' balances.
 * @dev This contract represents a token with dynamic supply.
 * The owner of the token contract can mint/burn tokens to/from any account
 * based upon previous governance voting and approval.
 */
contract SOV is ERC20, ERC20Detailed, Ownable {
	string constant NAME = "Sovryn Token";
	string constant SYMBOL = "SOV";
	uint8 constant DECIMALS = 18;

	/**
	 * @notice constructor called on deployment, initiates the contract
	 * @dev on deployment, some amount of tokens will be minted for the owner
	 * @param _initialAmount the amount of tokens to be minted on contract creation
	 */
	constructor(uint256 _initialAmount) public ERC20Detailed(NAME, SYMBOL, DECIMALS) {
		if (_initialAmount != 0) {
			_mint(msg.sender, _initialAmount);
		}
	}

	/**
	 * @notice creates new tokens and sends them to the recipient
	 * @dev don't create more than 2^96/10 tokens before updating the governance first
	 * @param _account the recipient address to get the minted tokens
	 * @param _amount the amount of tokens to be minted
	 */
	function mint(address _account, uint256 _amount) public onlyOwner {
		_mint(_account, _amount);
	}

	/**
	 * @notice approves and then calls the receiving contract
	 * @notice useful to encapsulate sending tokens to a contract in one call
	 * @notice solidity has no native way to send tokens to contracts
	 * @notice ERC-20 tokens require approval to be spent by third parties, such as a contract in this case
	 * @param _spender the contract address to spend the tokens
	 * @param _amount the amount of tokens to be sent
	 * @param _data parameters for the contract call, such as endpoint signature
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
