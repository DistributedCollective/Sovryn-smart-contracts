pragma solidity ^0.5.17;

import "../../openzeppelin/Ownable.sol";
import "../../interfaces/IERC20.sol";
import "../../utils/AdminRole.sol";

/**
 * @title Token sender contract.
 *
 * @notice This contract includes functions to transfer tokens
 * to a recipient or to several recipients in a list. There is
 * an ACL control check by modifier.
 *
 */
contract GenericTokenSender is AdminRole {
	/* Events */

	event TokensTransferred(address indexed token, address indexed receiver, uint256 amount);

	/* Functions */

	/**
	 * @notice Transfer given amounts of tokens to the given addresses.
	 * @param _token The address of the token.
	 * @param _receivers The addresses of the receivers.
	 * @param _amounts The amounts to be transferred.
	 * */
	function transferTokensUsingList(address _token, address[] memory _receivers, uint256[] memory _amounts) public onlyAuthorized {
		require(_receivers.length == _amounts.length, "arrays mismatch");

		for (uint256 i = 0; i < _receivers.length; i++) {
			_transferTokens(_token, _receivers[i], _amounts[i]);
		}
	}

	/**
	 * @notice Transfer tokens to given address.
	 * @param _token The address of the token.
	 * @param _receiver The address of the token receiver.
	 * @param _amount The amount to be transferred.
	 * */
	function transferTokens(address _token, address _receiver, uint256 _amount) public onlyAuthorized {
		_transferTokens(_token, _receiver, _amount);
	}

	function _transferTokens(address _token, address _receiver, uint256 _amount) internal {
		require(_token != address(0), "token address invalid");
		require(_receiver != address(0), "receiver address invalid");
		require(_amount != 0, "amount invalid");

		require(IERC20(_token).transfer(_receiver, _amount), "transfer failed");
		emit TokensTransferred(_token, _receiver, _amount);
	}
}
