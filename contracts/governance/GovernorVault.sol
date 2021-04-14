pragma solidity ^0.5.17;

import "../openzeppelin/Ownable.sol";
import "../interfaces/IERC20.sol";

/**
 * @title Governance Vault.
 * @notice This contract stores tokens and rBTC only transfereble by owner,
 * i.e. Sovryn governance.
 * */
 contract GovernorVault is Ownable {
	
	/* Events */
	
	event Deposited(address indexed sender, uint256 amount);
	event TokensTransferred(address indexed receiver, address indexed token, uint256 amount);
	event RbtcTransferred(address indexed receiver, uint256 amount);

	
	/* Functions */

	/**
	 * @notice Transfers tokens.
	 * @param _receiver The receiver of tokens.
	 * @param _token The address of token contract.
	 * @param _amount The amount to be transferred.
	 * */
	function transferTokens(
		address _receiver,
		address _token,
		uint256 _amount
	) public onlyOwner {
		require(_receiver != address(0), "Invalid receiver address");
		require(_token != address(0), "Invalid token address");

		require(IERC20(_token).transfer(_receiver, _amount), "Transfer failed");
		emit TokensTransferred(_receiver, _token, _amount);
	}

	/**
	 * @notice Transfers RBTC.
	 * @param _receiver The receiver of RBTC.
	 * @param _amount The amount to be transferred.
	 * */
	function transferRbtc(address payable _receiver, uint256 _amount) public onlyOwner {
		require(_receiver != address(0), "Invalid receiver address");

		address(_receiver).transfer(_amount);
		emit RbtcTransferred(_receiver, _amount);
	}

	/**
	 * @notice Fallback function is to react to receiving value (rBTC).
	 * */
	function() external payable {
		if (msg.value > 0) {
			emit Deposited(msg.sender, msg.value);
		}
	}
}
